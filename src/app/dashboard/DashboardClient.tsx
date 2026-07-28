"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";

interface Stats {
  totalMembers: number;
  todayAttendance: number;
  currentlyActive: number;
  weeklyHours: number;
  leaderboard: {
    memberId: string;
    memberName: string;
    memberRole: string;
    totalMinutes: number;
    visitCount: number;
  }[];
  dailyActivity: {
    date: string;
    count: number;
    totalMinutes: number;
  }[];
}

interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  confidence: number | null;
}

interface MemberStats {
  member: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    createdAt: string;
  };
  stats: {
    totalVisits: number;
    totalHours: number;
    totalMinutes: number;
    avgSessionMinutes: number;
    streak: number;
    currentlyActive: boolean;
    activeCheckIn: string | null;
  };
  dailyData: { date: string; visits: number; totalMinutes: number }[];
  hourlyData: { hour: number; count: number }[];
  recentSessions: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    durationMinutes: number | null;
    confidence: number | null;
  }[];
}

interface Member {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"live" | "analytics" | "members" | "log">("live");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Member detail view
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [s, r, m] = await Promise.all([
        fetch("/api/stats").then((x) => x.json()),
        fetch("/api/attendance?limit=500").then((x) => x.json()),
        fetch("/api/members").then((x) => x.json()),
      ]);
      setStats(s);
      setRecords(r);
      setMembers(m);
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 8000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Fetch member details
  const fetchMemberStats = async (memberId: string) => {
    setMemberLoading(true);
    setSelectedMemberId(memberId);
    try {
      const res = await fetch(`/api/members/${memberId}/stats`);
      if (res.ok) {
        setMemberStats(await res.json());
      }
    } catch {
      // ignore
    }
    setMemberLoading(false);
  };

  const closeMemberDetail = () => {
    setSelectedMemberId(null);
    setMemberStats(null);
  };

  const dur = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const fmtFullDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  // Download member report
  const downloadMemberReport = () => {
    if (!memberStats) return;
    const { member, stats: s, recentSessions } = memberStats;
    
    let report = `ATTENDANCE REPORT\n`;
    report += `================\n\n`;
    report += `Member: ${member.name}\n`;
    report += `Role: ${member.role}\n`;
    report += `Email: ${member.email || "N/A"}\n`;
    report += `Phone: ${member.phone || "N/A"}\n`;
    report += `Registered: ${fmtFullDate(member.createdAt)}\n\n`;
    
    report += `STATISTICS\n`;
    report += `----------\n`;
    report += `Total Visits: ${s.totalVisits}\n`;
    report += `Total Hours: ${s.totalHours}\n`;
    report += `Average Session: ${dur(s.avgSessionMinutes)}\n`;
    report += `Current Streak: ${s.streak} days\n`;
    report += `Currently Active: ${s.currentlyActive ? "Yes" : "No"}\n\n`;
    
    report += `RECENT SESSIONS\n`;
    report += `---------------\n`;
    recentSessions.forEach((session) => {
      const inTime = fmtFullDate(session.checkIn) + " " + fmtTime(session.checkIn);
      const outTime = session.checkOut ? fmtTime(session.checkOut) : "Still active";
      const duration = session.durationMinutes ? dur(session.durationMinutes) : "—";
      report += `${inTime} → ${outTime} (${duration})\n`;
    });

    const blob = new Blob([report], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${member.name.replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  };

  // Download CSV for member
  const downloadMemberCSV = () => {
    if (!memberStats) return;
    const { member, recentSessions } = memberStats;
    
    const csv = [
      "Check In,Check Out,Duration (mins),Confidence",
      ...recentSessions.map((s) =>
        `"${s.checkIn}","${s.checkOut || ""}","${s.durationMinutes || ""}","${s.confidence || ""}"`
      ),
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${member.name.replace(/\s+/g, "_")}_sessions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportAllCSV = () => {
    const csv = [
      "Name,Role,Check In,Check Out,Duration (mins),Confidence",
      ...records.map((r) =>
        `"${r.memberName}","${r.memberRole}","${r.checkIn}","${r.checkOut || ""}","${r.durationMinutes || ""}","${r.confidence || ""}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `all_attendance_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const filtered = records.filter(
    (r) =>
      r.memberName.toLowerCase().includes(search.toLowerCase()) ||
      r.memberRole?.toLowerCase().includes(search.toLowerCase())
  );

  const activeRecords = records.filter((r) => !r.checkOut);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Nav variant="dark" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Nav variant="dark" />

      {/* Member Detail Modal */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-16 px-4 overflow-y-auto">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-3xl mb-16 animate-fade-in">
            {memberLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            ) : memberStats ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-zinc-800">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${
                      memberStats.stats.currentlyActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {memberStats.member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{memberStats.member.name}</h2>
                        {memberStats.stats.currentlyActive && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" />
                            ACTIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-0.5 capitalize">{memberStats.member.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeMemberDetail}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-px bg-zinc-800 mx-5 mt-5 rounded-lg overflow-hidden">
                  {[
                    { label: "Total Visits", value: memberStats.stats.totalVisits, sub: "all time" },
                    { label: "Total Hours", value: memberStats.stats.totalHours, sub: "logged" },
                    { label: "Avg Session", value: dur(memberStats.stats.avgSessionMinutes), sub: "duration" },
                    { label: "Streak", value: `${memberStats.stats.streak} days`, sub: "consecutive" },
                  ].map((s) => (
                    <div key={s.label} className="bg-zinc-900 p-4 text-center">
                      <p className="text-2xl font-bold font-mono text-white">{s.value}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-2 gap-5 p-5">
                  {/* Daily Activity Chart */}
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                      Last 30 Days Activity
                    </h3>
                    {memberStats.dailyData.length === 0 ? (
                      <p className="text-sm text-zinc-600 py-8 text-center">No data</p>
                    ) : (
                      <div className="flex items-end gap-1 h-24">
                        {(() => {
                          // Fill in missing days
                          const days: { date: string; totalMinutes: number }[] = [];
                          for (let i = 29; i >= 0; i--) {
                            const d = new Date();
                            d.setDate(d.getDate() - i);
                            const dateStr = d.toISOString().split("T")[0];
                            const found = memberStats.dailyData.find((x) => x.date === dateStr);
                            days.push({ date: dateStr, totalMinutes: found?.totalMinutes || 0 });
                          }
                          const max = Math.max(...days.map((d) => d.totalMinutes), 60);
                          return days.map((day, i) => {
                            const pct = (day.totalMinutes / max) * 100;
                            const isToday = i === days.length - 1;
                            return (
                              <div
                                key={day.date}
                                className="flex-1 flex flex-col items-center group"
                                title={`${fmtDate(day.date)}: ${dur(day.totalMinutes)}`}
                              >
                                <div
                                  className={`w-full rounded-sm transition-all ${
                                    pct > 0
                                      ? isToday
                                        ? "bg-emerald-400"
                                        : "bg-emerald-500/60"
                                      : "bg-zinc-700"
                                  } group-hover:bg-emerald-400`}
                                  style={{ height: `${Math.max(pct, 4)}%`, minHeight: "3px" }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-zinc-600">30 days ago</span>
                      <span className="text-[10px] text-zinc-600">Today</span>
                    </div>
                  </div>

                  {/* Hourly Distribution */}
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                      Peak Hours
                    </h3>
                    {memberStats.hourlyData.length === 0 ? (
                      <p className="text-sm text-zinc-600 py-8 text-center">No data</p>
                    ) : (
                      <div className="flex items-end gap-1 h-24">
                        {(() => {
                          const hours = Array.from({ length: 24 }, (_, i) => {
                            const found = memberStats.hourlyData.find((x) => Number(x.hour) === i);
                            return { hour: i, count: found?.count || 0 };
                          });
                          const max = Math.max(...hours.map((h) => h.count), 1);
                          return hours.map((h) => {
                            const pct = (h.count / max) * 100;
                            const isBusiness = h.hour >= 9 && h.hour <= 21;
                            return (
                              <div
                                key={h.hour}
                                className="flex-1 group"
                                title={`${h.hour}:00 - ${h.count} check-ins`}
                              >
                                <div
                                  className={`w-full rounded-sm transition-all ${
                                    pct > 0
                                      ? isBusiness
                                        ? "bg-blue-400"
                                        : "bg-blue-400/40"
                                      : "bg-zinc-700"
                                  } group-hover:bg-blue-400`}
                                  style={{ height: `${Math.max(pct, 4)}%`, minHeight: "3px" }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-zinc-600">12 AM</span>
                      <span className="text-[10px] text-zinc-600">12 PM</span>
                      <span className="text-[10px] text-zinc-600">11 PM</span>
                    </div>
                  </div>
                </div>

                {/* Recent Sessions */}
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Recent Sessions
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={downloadMemberCSV}
                        className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 border border-zinc-700 rounded-md hover:bg-zinc-800 transition-colors"
                      >
                        CSV
                      </button>
                      <button
                        onClick={downloadMemberReport}
                        className="px-3 py-1.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500/10 transition-colors"
                      >
                        Download Report
                      </button>
                    </div>
                  </div>
                  <div className="bg-zinc-800/30 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-zinc-800">
                          <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500">Date</th>
                          <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500">In</th>
                          <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500">Out</th>
                          <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {memberStats.recentSessions.slice(0, 20).map((s) => (
                          <tr key={s.id} className="hover:bg-zinc-800/30">
                            <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{fmtDate(s.checkIn)}</td>
                            <td className="px-3 py-2 text-zinc-400 font-mono text-xs">{fmtTime(s.checkIn)}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {s.checkOut ? (
                                <span className="text-zinc-400">{fmtTime(s.checkOut)}</span>
                              ) : (
                                <span className="text-emerald-400">Active</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-300 font-mono text-xs">
                              {s.durationMinutes ? dur(s.durationMinutes) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-zinc-500">Failed to load member data</div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              {lastUpdated ? `Last sync: ${lastUpdated.toLocaleTimeString()}` : "Loading…"} · Live refresh
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportAllCSV}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Export All CSV
            </button>
            <Link
              href="/camera"
              className="px-4 py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 blink" />
              Live Camera
            </Link>
          </div>
        </div>

        {/* Big Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-xl border border-zinc-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold font-mono">{stats.totalMembers}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total Members</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-xl border border-zinc-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold font-mono">{stats.todayAttendance}</p>
                  <p className="text-xs text-zinc-500 mt-1">Today's Check-ins</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-950/50 to-zinc-900/50 rounded-xl border border-emerald-500/20 p-5 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-4xl font-bold font-mono text-emerald-400">{stats.currentlyActive}</p>
                  <p className="text-xs text-emerald-400/60 mt-1">Active Now</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              {stats.currentlyActive > 0 && (
                <div className="absolute top-3 right-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 block blink" />
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-xl border border-zinc-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold font-mono">{stats.weeklyHours}<span className="text-xl text-zinc-500">h</span></p>
                  <p className="text-xs text-zinc-500 mt-1">This Week</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currently Active Strip */}
        {activeRecords.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-5 py-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 blink" />
                <span className="text-sm font-semibold text-emerald-400">IN THE SPACE</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeRecords.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => fetchMemberStats(r.memberId)}
                    className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5 shrink-0 hover:bg-emerald-500/20 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                      {r.memberName.charAt(0)}
                    </span>
                    <span className="text-sm font-medium text-emerald-300">{r.memberName}</span>
                    <span className="text-[10px] text-emerald-500/60 font-mono">since {fmtTime(r.checkIn)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 mb-6 w-fit">
          {([
            ["live", "Live Activity"],
            ["analytics", "Analytics"],
            ["members", "Members"],
            ["log", "Full Log"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                tab === key
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live Activity Tab */}
        {tab === "live" && stats && (
          <div className="grid grid-cols-3 gap-6">
            {/* 7-Day Chart */}
            <div className="col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Last 7 Days</h3>
              {stats.dailyActivity.length === 0 ? (
                <p className="text-sm text-zinc-600 py-12 text-center">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.dailyActivity.map((day) => {
                    const max = Math.max(...stats.dailyActivity.map((d) => d.count), 1);
                    const pct = (day.count / max) * 100;
                    const d = new Date(day.date + "T00:00:00");
                    const isToday = new Date().toDateString() === d.toDateString();
                    return (
                      <div key={day.date} className="flex items-center gap-4">
                        <div className="w-20 text-right shrink-0">
                          <span className={`text-xs font-mono ${isToday ? "text-emerald-400 font-semibold" : "text-zinc-500"}`}>
                            {d.toLocaleDateString("en-US", { weekday: "short" })} {d.getDate()}
                          </span>
                        </div>
                        <div className="flex-1 h-8 bg-zinc-800 rounded-lg overflow-hidden relative">
                          <div
                            className={`h-full rounded-lg transition-all duration-500 ${isToday ? "bg-emerald-500" : "bg-zinc-600"}`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                            {day.count} visits · {dur(day.totalMinutes)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Activity</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {records.slice(0, 20).map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => fetchMemberStats(rec.memberId)}
                    className="flex items-center gap-3 w-full p-2 -mx-2 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      rec.checkOut ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {rec.memberName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{rec.memberName}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {rec.checkOut ? "out" : "in"} · {fmtTime(rec.checkIn)} · {fmtDate(rec.checkIn)}
                      </p>
                    </div>
                    {!rec.checkOut && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 blink" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && stats && (
          <div className="grid grid-cols-2 gap-6">
            {/* Leaderboard */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300">Top Members by Hours</h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {stats.leaderboard.slice(0, 10).map((m, i) => (
                  <button
                    key={m.memberId}
                    onClick={() => fetchMemberStats(m.memberId)}
                    className={`flex items-center gap-4 px-5 py-3 w-full hover:bg-zinc-800/50 transition-colors text-left ${
                      i < 3 ? "bg-zinc-800/20" : ""
                    }`}
                  >
                    <span className={`w-6 text-center text-sm font-bold ${
                      i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-600" : "text-zinc-600"
                    }`}>
                      {i + 1}
                    </span>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      i === 0 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {m.memberName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{m.memberName}</p>
                      <p className="text-[10px] text-zinc-500">{m.visitCount} visits · {m.memberRole}</p>
                    </div>
                    <p className="text-sm font-bold font-mono text-zinc-300">{dur(m.totalMinutes)}</p>
                  </button>
                ))}
                {stats.leaderboard.length === 0 && (
                  <p className="text-sm text-zinc-600 py-12 text-center">No data yet</p>
                )}
              </div>
            </div>

            {/* Weekly Trend */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Weekly Trend</h3>
              <div className="flex items-end gap-2 h-48">
                {stats.dailyActivity.map((day, i) => {
                  const max = Math.max(...stats.dailyActivity.map((d) => d.totalMinutes), 60);
                  const pct = (day.totalMinutes / max) * 100;
                  const d = new Date(day.date + "T00:00:00");
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all hover:from-blue-500 hover:to-blue-300"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {tab === "members" && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">All Members</h3>
              <span className="text-xs text-zinc-500">{members.length} total</span>
            </div>
            <div className="grid grid-cols-4 gap-4 p-5">
              {members.filter(m => m.isActive).map((m) => {
                const isActive = activeRecords.some((r) => r.memberId === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => fetchMemberStats(m.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                      isActive
                        ? "bg-emerald-950/30 border-emerald-500/30 hover:bg-emerald-950/50"
                        : "bg-zinc-800/30 border-zinc-800 hover:bg-zinc-800"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-500 capitalize">{m.role}</p>
                    </div>
                    {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 blink" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Log Tab */}
        {tab === "log" && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 w-64"
              />
              <span className="text-xs text-zinc-500">{filtered.length} records</span>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Member</th>
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Role</th>
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Check In</th>
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Check Out</th>
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Duration</th>
                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filtered.map((rec) => (
                    <tr key={rec.id} className="hover:bg-zinc-800/30 cursor-pointer" onClick={() => fetchMemberStats(rec.memberId)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-bold">
                            {rec.memberName.charAt(0)}
                          </div>
                          <span className="font-medium text-zinc-200">{rec.memberName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-400 capitalize">{rec.memberRole}</td>
                      <td className="px-5 py-3 text-zinc-400 font-mono text-xs">
                        {fmtDate(rec.checkIn)} {fmtTime(rec.checkIn)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">
                        {rec.checkOut ? (
                          <span className="text-zinc-400">{fmtDate(rec.checkOut)} {fmtTime(rec.checkOut)}</span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 blink" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-300 font-mono text-xs">
                        {rec.durationMinutes ? dur(rec.durationMinutes) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {rec.confidence ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  rec.confidence > 80 ? "bg-emerald-500" : rec.confidence > 60 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${rec.confidence}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">{Math.round(rec.confidence)}%</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-sm text-zinc-600 py-12 text-center">
                  {search ? "No matches" : "No records yet"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Make Link available
import Link from "next/link";
