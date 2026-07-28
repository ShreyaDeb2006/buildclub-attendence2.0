"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { detectHeadRotation } from "@/lib/face-utils";

declare global {
  interface Window {
    faceapi: any;
  }
}

type Step = "form" | "camera" | "verify" | "done";

export default function RegisterClient() {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("guest");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [turnedLeft, setTurnedLeft] = useState(false);
  const [turnedRight, setTurnedRight] = useState(false);
  const [lookingCenter, setLookingCenter] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [registeredMember, setRegisteredMember] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js";
    script.async = true;
    script.onload = async () => {
      try {
        const MODEL_URL =
          "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/";
        await Promise.all([
          window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load models:", err);
        setError("Failed to load face recognition models. Try refreshing.");
      }
    };
    document.head.appendChild(script);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch {
      setError("Camera access was denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Head-turn detection with MULTI-FRAME confirmation
  // Requires 3 consecutive frames in the same direction to count
  useEffect(() => {
    if (step !== "verify" || !cameraReady || !modelsLoaded) return;

    const faceapi = window.faceapi;
    if (!faceapi) return;

    let hasLeft = false;
    let hasRight = false;
    let centerDescriptor: Float32Array | null = null;
    let capturedPhoto: string | null = null;

    // Multi-frame confirmation counters
    let leftCount = 0;
    let rightCount = 0;
    let centerCount = 0;
    const REQUIRED_FRAMES = 3; // Need 3 consecutive frames to confirm

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        leftCount = 0;
        rightCount = 0;
        centerCount = 0;
        setStatus("Looking for your face…");
        return;
      }

      const { direction, yaw } = detectHeadRotation(detection.landmarks);
      const yawDisplay = Math.abs(yaw * 100).toFixed(0);

      if (direction === "left") {
        leftCount++;
        rightCount = 0;
        centerCount = 0;
        if (leftCount >= REQUIRED_FRAMES && !hasLeft) {
          hasLeft = true;
          setTurnedLeft(true);
          setStatus("Left turn confirmed. Now turn your head to the right.");
        } else if (!hasLeft) {
          setStatus(`Turning left… hold it (${yawDisplay}% rotation)`);
        }
      } else if (direction === "right") {
        rightCount++;
        leftCount = 0;
        centerCount = 0;
        if (rightCount >= REQUIRED_FRAMES && !hasRight) {
          hasRight = true;
          setTurnedRight(true);
          setStatus("Right turn confirmed. Now look straight at the camera.");
        } else if (hasLeft && !hasRight) {
          setStatus(`Turning right… hold it (${yawDisplay}% rotation)`);
        }
      } else {
        // center
        centerCount++;
        leftCount = 0;
        rightCount = 0;
        if (centerCount >= REQUIRED_FRAMES && hasLeft && hasRight && !centerDescriptor) {
          centerDescriptor = detection.descriptor;
          setLookingCenter(true);
          setStatus("Capturing…");

          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, -canvas.width, 0);
            ctx.restore();
            capturedPhoto = canvas.toDataURL("image/jpeg", 0.8);
          }

          setTimeout(() => {
            if (centerDescriptor) {
              setFaceDescriptor(Array.from(centerDescriptor));
              setPhotoUrl(capturedPhoto);
              if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
              setStatus("Done. Saving…");
            }
          }, 600);
        }
      }

      // Status messages when waiting for a step
      if (!hasLeft && direction !== "left") {
        setStatus("Turn your head to the left and hold it.");
      } else if (hasLeft && !hasRight && direction !== "right") {
        setStatus("Good. Now turn your head to the right and hold it.");
      }
    }, 350);

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [step, cameraReady, modelsLoaded]);

  useEffect(() => {
    if (!faceDescriptor) return;

    const register = async () => {
      try {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, role, photoUrl, faceDescriptor }),
        });
        if (!res.ok) throw new Error("Registration failed");
        const member = await res.json();
        setRegisteredMember(member);
        stopCamera();
        setStep("done");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    };
    register();
  }, [faceDescriptor, name, email, phone, role, photoUrl, stopCamera]);

  const handleFormSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    // If a non-guest role is selected, verify admin password
    if (role !== "guest") {
      if (!adminPassword) {
        setError("Admin password is required to register as " + role + ".");
        setShowPasswordField(true);
        return;
      }
      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword }),
        });
        if (!res.ok) {
          setError("Wrong admin password. Only guests can register without it.");
          return;
        }
      } catch {
        setError("Could not verify password. Try again.");
        return;
      }
    }

    setError("");
    setStep("camera");
    await startCamera();
    setStep("verify");
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (newRole !== "guest") {
      setShowPasswordField(true);
    } else {
      setShowPasswordField(false);
      setAdminPassword("");
    }
  };

  const checkIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />

      <div className="max-w-lg mx-auto px-5 py-10 lg:py-14">
        {/* Breadcrumb-style progress */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-8">
          <span className={step === "form" ? "text-zinc-900 font-medium" : "text-emerald-600 font-medium"}>
            Details
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          <span className={(step === "camera" || step === "verify") ? "text-zinc-900 font-medium" : step === "done" ? "text-emerald-600 font-medium" : ""}>
            Face scan
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          <span className={step === "done" ? "text-zinc-900 font-medium" : ""}>
            Done
          </span>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Form ── */}
        {step === "form" && (
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              Register a new member
            </h1>
            <p className="text-sm text-zinc-500 mt-1 mb-6">
              After filling this out you&apos;ll do a quick face scan with liveness check.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                  placeholder="Ankit Gupta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                  placeholder="ankit@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 bg-white"
                >
                  <option value="guest">Guest</option>
                  <option value="member">Member (requires admin password)</option>
                  <option value="admin">Admin (requires admin password)</option>
                  <option value="mentor">Mentor (requires admin password)</option>
                </select>
                <p className="text-xs text-zinc-400 mt-1">
                  Anyone can register as a guest. Other roles need the admin password.
                </p>
              </div>

              {/* Admin password field — shown for non-guest roles */}
              {showPasswordField && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Admin password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
                    placeholder="Enter admin password"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Ask your BuildClub admin for this password.
                  </p>
                </div>
              )}

              <button
                onClick={handleFormSubmit}
                disabled={!modelsLoaded}
                className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-wait mt-2"
              >
                {modelsLoaded ? "Continue to face scan" : "Loading face recognition models…"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Face scan ── */}
        {(step === "camera" || step === "verify") && (
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              Liveness check
            </h1>
            <p className="text-sm text-zinc-500 mt-1 mb-5">
              Turn your head clearly in each direction and hold for a moment. Small movements won&apos;t count.
            </p>

            {/* Checklist */}
            <div className="flex gap-4 mb-5">
              {[
                { done: turnedLeft, label: "Turn left" },
                { done: turnedRight, label: "Turn right" },
                { done: lookingCenter, label: "Look center" },
              ].map((c) => (
                <div
                  key={c.label}
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    c.done ? "text-emerald-600" : "text-zinc-400"
                  }`}
                >
                  {c.done ? (
                    checkIcon
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-current" />
                  )}
                  {c.label}
                </div>
              ))}
            </div>

            {/* Camera */}
            <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-[4/3] border border-zinc-200">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scan line */}
              <div className="scan-overlay absolute inset-0 pointer-events-none" />

              {/* Face alignment guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-56 border-2 border-dashed border-white/20 rounded-[40%]" />
              </div>

              {/* Status */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                <p className="text-xs text-white/80" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {status || "Initializing camera…"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-400">
              All processing happens in your browser. No images are sent to any server.
            </p>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && registeredMember && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                {checkIcon}
              </span>
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
                Registered
              </h1>
            </div>
            <p className="text-sm text-zinc-500 mb-6">
              {registeredMember.name} can now be recognized by the camera.
            </p>

            {photoUrl && (
              <img
                src={photoUrl}
                alt="Captured face"
                className="w-24 h-24 rounded-lg object-cover border border-zinc-200 mb-6"
              />
            )}

            <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-200 mb-8 text-sm">
              {[
                ["Name", registeredMember.name],
                ["Email", registeredMember.email || "—"],
                ["Phone", registeredMember.phone || "—"],
                ["Role", registeredMember.role],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2.5">
                  <span className="text-zinc-500">{label}</span>
                  <span className="font-medium text-zinc-900 capitalize">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Link
                href="/camera"
                className="flex-1 text-center py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors"
              >
                Open camera
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 text-center py-2.5 text-sm font-medium border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 transition-colors"
              >
                Register another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
