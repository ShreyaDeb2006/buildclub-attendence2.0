"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { findBestMatch } from "@/lib/face-utils";

declare global {
  interface Window {
    faceapi: any;
  }
}

interface MemberData {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  faceDescriptor: number[];
  isActive?: boolean;
}

interface RecognitionEvent {
  id: string;
  name: string;
  action: "checkin" | "checkout";
  confidence: number;
  time: Date;
  durationMinutes?: number;
}

export default function CameraClient() {
  const [status, setStatus] = useState("Loading face recognition models…");
  const [cameraOn, setCameraOn] = useState(false);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const [currentFace, setCurrentFace] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [scanNum, setScanNum] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const membersRef = useRef<MemberData[]>([]);
  const cooldownRef = useRef<Record<string, number>>({});
  const busyRef = useRef(false);
  const readyRef = useRef(false); // true when models + camera both ready
  const COOLDOWN = 30_000;

  // ── Clock ──
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(n.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDateStr(n.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch members (into ref so detection loop always has latest) ──
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members");
      if (!res.ok) return;
      const data: MemberData[] = await res.json();
      const active = data.filter((m) => m.faceDescriptor && m.isActive !== false);
      membersRef.current = active;
      setMemberCount(active.length);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    const id = setInterval(fetchMembers, 10_000);
    return () => clearInterval(id);
  }, [fetchMembers]);

  // ── Boot sequence: load models → start camera → start scanning ──
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      // 1) Load face-api script
      if (!window.faceapi) {
        setStatus("Downloading face-api.js…");
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Script failed"));
          document.head.appendChild(s);
        });
      }
      if (cancelled) return;

      // 2) Load models
      setStatus("Loading neural network models…");
      const M = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/";
      await Promise.all([
        window.faceapi.nets.ssdMobilenetv1.loadFromUri(M),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(M),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(M),
      ]);
      if (cancelled) return;

      // 3) Open camera
      setStatus("Opening camera…");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
      } catch (e: any) {
        setErrorMsg("Camera access denied. Please allow camera permissions and reload.");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();
      if (cancelled) return;

      setCameraOn(true);
      readyRef.current = true;
      setStatus("Scanning…");

      // 4) Start detection interval
      intervalRef.current = setInterval(runOneScan, 1200);
    };

    boot().catch((err) => {
      console.error("Boot error:", err);
      setErrorMsg(String(err?.message || err));
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Single scan tick ──
  async function runOneScan() {
    if (!readyRef.current || busyRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !window.faceapi) return;

    busyRef.current = true;
    setScanNum((n) => n + 1);

    try {
      const detections = await window.faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setCurrentFace(null);
        setStatus("Scanning…");
        busyRef.current = false;
        return;
      }

      setStatus(`${detections.length} face${detections.length > 1 ? "s" : ""} detected`);

      for (const det of detections) {
        const desc = Array.from(det.descriptor) as number[];
        const result = findBestMatch(desc, membersRef.current);

        if (result.member) {
          setCurrentFace(result.member.name);

          const now = Date.now();
          const last = cooldownRef.current[result.member.id] || 0;
          if (now - last > COOLDOWN) {
            cooldownRef.current[result.member.id] = now;

            const res = await fetch("/api/attendance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberId: result.member.id, confidence: result.confidence }),
            });

            if (res.ok) {
              const data = await res.json();
              setEvents((prev) => [
                {
                  id: result.member!.id,
                  name: result.member!.name,
                  action: data.action,
                  confidence: result.confidence,
                  time: new Date(),
                  durationMinutes: data.durationMinutes,
                },
                ...prev,
              ].slice(0, 50));
            }
          }
        } else {
          setCurrentFace("Unknown");
        }
      }
    } catch {
      // detection error, will retry next tick
    }
    busyRef.current = false;
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white text-zinc-900 flex items-center justify-center text-[10px] font-bold">
              BC
            </div>
            <span className="text-sm font-semibold text-white">BuildClub</span>
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="text-xs text-zinc-500">Live Recognition</span>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-sm font-semibold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{clock}</p>
            <p className="text-[10px] text-zinc-500">{dateStr}</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${cameraOn ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-zinc-800"}`}>
            <span className={`w-2 h-2 rounded-full ${cameraOn ? "bg-emerald-400 blink" : "bg-red-500"}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${cameraOn ? "text-emerald-400" : "text-zinc-400"}`}>
              {cameraOn ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Camera Feed ── */}
        <div className="flex-1 relative bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoPlay
          />

          {/* Loading / Error */}
          {!cameraOn && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950">
              <div className="text-center max-w-sm px-6">
                {errorMsg ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    </div>
                    <p className="text-sm text-red-400 font-medium mb-2">{errorMsg}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs text-zinc-400 underline hover:text-white mt-2"
                    >
                      Reload page
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-zinc-300 font-medium">{status}</p>
                    <p className="text-xs text-zinc-600 mt-2">This takes 5-10 seconds on first visit.</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Scan overlay */}
          {cameraOn && (
            <>
              {/* Corner markers */}
              <div className="absolute inset-6 pointer-events-none z-20">
                <div className="absolute top-0 left-0 w-14 h-14 border-t-2 border-l-2 border-emerald-400/50 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-14 h-14 border-t-2 border-r-2 border-emerald-400/50 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-14 h-14 border-b-2 border-l-2 border-emerald-400/50 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-14 h-14 border-b-2 border-r-2 border-emerald-400/50 rounded-br-xl" />
              </div>

              {/* Top info bar */}
              <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    SCAN #{scanNum} · {memberCount} members loaded
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" />
                    <span className="text-[10px] text-emerald-400 font-mono">RECORDING</span>
                  </span>
                </div>
              </div>

              {/* Bottom status bar */}
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 blink" />
                    <span className="text-xs text-zinc-300 font-mono">{status}</span>
                  </div>
                  {currentFace && (
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      currentFace === "Unknown"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}>
                      {currentFace === "Unknown" ? "Unknown Person" : `✓ ${currentFace}`}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Activity Feed</p>
              <span className="text-[10px] text-zinc-600 font-mono">{events.length} events</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <p className="text-sm text-zinc-500 font-medium">Waiting for activity</p>
                <p className="text-xs text-zinc-600 mt-1">Stand in front of the camera</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {events.map((ev, i) => (
                  <div
                    key={`${ev.id}-${ev.time.getTime()}`}
                    className={`px-4 py-3 hover:bg-zinc-800/30 transition-colors ${i === 0 ? "animate-fade-in bg-zinc-800/20" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        ev.action === "checkin"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {ev.action === "checkin" ? "IN" : "OUT"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{ev.name}</p>
                        <p className={`text-xs mt-0.5 ${ev.action === "checkin" ? "text-emerald-400" : "text-amber-400"}`}>
                          {ev.action === "checkin" ? "Checked in" : "Checked out"}
                          {ev.durationMinutes != null && ` · ${Math.floor(ev.durationMinutes / 60)}h ${ev.durationMinutes % 60}m`}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                          {fmtTime(ev.time)} · {Math.round(ev.confidence)}% match
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom links */}
          <div className="p-3 border-t border-zinc-800 space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-white rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-emerald-400 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
            >
              + Register Member
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
