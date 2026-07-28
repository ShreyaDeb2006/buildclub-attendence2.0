"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ variant = "light" }: { variant?: "light" | "dark" }) {
  const path = usePathname();
  const dark = variant === "dark";

  const linkClass = (href: string) => {
    const active = path === href;
    if (dark) {
      return `text-sm font-medium transition-colors ${
        active ? "text-white" : "text-zinc-400 hover:text-white"
      }`;
    }
    return `text-sm font-medium transition-colors ${
      active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
    }`;
  };

  return (
    <nav
      className={`flex items-center justify-between px-5 lg:px-8 h-14 border-b ${
        dark ? "border-white/[0.06] bg-zinc-950" : "border-zinc-200 bg-white"
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        {/* Simple geometric logo — not a gradient icon */}
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold tracking-tight ${
            dark ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
          }`}
        >
          BC
        </div>
        <span
          className={`text-[15px] font-semibold tracking-tight ${
            dark ? "text-white" : "text-zinc-900"
          }`}
        >
          BuildClub
        </span>
      </Link>

      <div className="flex items-center gap-5">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>
        <Link href="/camera" className={linkClass("/camera")}>
          Camera
        </Link>
        <Link href="/admin" className={linkClass("/admin")}>
          Admin
        </Link>
        <Link
          href="/register"
          className={`ml-1 text-sm font-medium px-3.5 py-1.5 rounded-md transition-colors ${
            dark
              ? "bg-white text-zinc-900 hover:bg-zinc-200"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          Register
        </Link>
      </div>
    </nav>
  );
}
