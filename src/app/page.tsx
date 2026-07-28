import Link from "next/link";
import Nav from "@/components/Nav";
import { db } from "@/db";
import { members, attendance } from "@/db/schema";
import { count, sql, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let totalMembers = 0;
  let activeNow = 0;
  let todayVisits = 0;

  try {
    const [mc] = await db.select({ count: count() }).from(members);
    totalMembers = mc.count;
    const [ac] = await db
      .select({ count: count() })
      .from(attendance)
      .where(isNull(attendance.checkOut));
    activeNow = ac.count;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [tc] = await db
      .select({ count: count() })
      .from(attendance)
      .where(sql`${attendance.checkIn} >= ${today}`);
    todayVisits = tc.count;
  } catch {
    // tables may not exist yet
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img
            src="/images/hero-bg.jpg"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/80 to-zinc-950/60" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-5">
              <span className="blink w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
                System online
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-tight">
              Face recognition
              <br />
              attendance for
              <br />
              <span className="text-zinc-400">your makerspace.</span>
            </h1>

            <p className="mt-5 text-[15px] text-zinc-400 leading-relaxed max-w-md">
              Members register once. After that, the camera handles everything —
              check-ins, check-outs, hours tracking. No badges, no sign-in
              sheets, no friction.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white text-zinc-900 rounded-md hover:bg-zinc-100 transition-colors"
              >
                Register a member
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
              <Link
                href="/camera"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-zinc-300 border border-zinc-700 rounded-md hover:bg-white/5 transition-colors"
              >
                Open live camera
              </Link>
            </div>

            {/* Counters */}
            <div className="mt-12 flex items-center gap-8">
              <div>
                <p className="text-2xl font-semibold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {totalMembers}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">members</p>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <p className="text-2xl font-semibold text-emerald-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {activeNow}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">in the space now</p>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <p className="text-2xl font-semibold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {todayVisits}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">today</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
            How it works
          </p>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Three steps. Zero ongoing effort.
          </h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200 rounded-lg overflow-hidden">
            {[
              {
                num: "01",
                title: "Register once",
                body: "Enter name, email, role. Then the camera runs a quick liveness check — you turn your head left and right so we know you're real, not a photo.",
              },
              {
                num: "02",
                title: "Camera runs 24/7",
                body: "Open /camera on any screen near the entrance. It starts automatically and scans for known faces every 1.5 seconds. No manual start.",
              },
              {
                num: "03",
                title: "Dashboard fills itself",
                body: "Every check-in and check-out lands in the dashboard in real-time. Hours, streaks, leaderboards — all automatic.",
              },
            ].map((s) => (
              <div key={s.num} className="bg-white p-6 lg:p-8">
                <span
                  className="text-xs font-medium text-zinc-300"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.num}
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-zinc-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="border-b border-zinc-200 bg-zinc-50/50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
                Under the hood
              </p>
              <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">
                Built for real use,<br />not a demo.
              </h2>
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed max-w-md">
                This isn&apos;t a wrapper around a face API with a pretty landing page.
                It&apos;s a working system that handles edge cases — duplicate scans,
                forgotten checkouts, spoofing attempts.
              </p>

              <div className="mt-8">
                <img
                  src="/images/face-scan.jpg"
                  alt="Camera module"
                  className="rounded-lg w-full max-w-sm object-cover h-48 border border-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-0 divide-y divide-zinc-200 border-t border-zinc-200">
              {[
                {
                  title: "Liveness detection",
                  body: "Registration requires a head-turn sequence (left → right → center). Static photos won't pass.",
                },
                {
                  title: "30-second cooldown",
                  body: "After recognizing someone, the system waits 30 seconds before processing them again. Prevents duplicate check-ins from lingering near the camera.",
                },
                {
                  title: "Auto check-out",
                  body: "Walk in — checked in. Walk in again later — checked out. The toggle is automatic based on open sessions.",
                },
                {
                  title: "Confidence scoring",
                  body: "Every match shows a confidence percentage. The threshold is 55% euclidean distance — tuned to reduce false positives.",
                },
                {
                  title: "Password-protected admin",
                  body: "The admin panel requires a password. Non-guest roles also need the password during registration. No unauthorized changes.",
                },
                {
                  title: "Runs in the browser",
                  body: "Face detection uses face-api.js client-side. No images leave the browser — the server only stores a 128-float descriptor.",
                },
              ].map((f, i) => (
                <div key={i} className="py-4">
                  <h4 className="text-sm font-semibold text-zinc-900">{f.title}</h4>
                  <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── For admins ─── */}
      <section className="border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
            For administrators
          </p>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight mb-8">
            Quick-start guide
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                step: "1",
                title: "Register members",
                desc: "Go to /register. Anyone can self-register as a guest. To assign member/admin/mentor roles, the admin password is required.",
                link: "/register",
              },
              {
                step: "2",
                title: "Set up the kiosk",
                desc: "Open /camera on a tablet or laptop near the door. The camera starts on its own — no button to press.",
                link: "/camera",
              },
              {
                step: "3",
                title: "Monitor the dashboard",
                desc: "Open /dashboard on another screen or your phone. It refreshes every 10 seconds with live data.",
                link: "/dashboard",
              },
              {
                step: "4",
                title: "Manage members (password-protected)",
                desc: "The admin panel at /admin is locked behind a password. Edit names, roles, toggle active status, export CSV, or delete members.",
                link: "/admin",
              },
            ].map((s) => (
              <Link
                key={s.step}
                href={s.link}
                className="group flex gap-4 p-5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all"
              >
                <span
                  className="shrink-0 w-7 h-7 rounded-md bg-zinc-100 text-zinc-400 flex items-center justify-center text-xs font-semibold group-hover:bg-zinc-900 group-hover:text-white transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.step}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">{s.title}</h4>
                  <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 text-center">
        <p className="text-xs text-zinc-400">
          BuildClub Vision &middot; Next.js &middot; face-api.js &middot; PostgreSQL &middot; Drizzle ORM
        </p>
      </footer>
    </div>
  );
}
