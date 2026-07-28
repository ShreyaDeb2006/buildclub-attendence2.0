import { NextRequest, NextResponse } from "next/server";

// Default admin password — override with ADMIN_PASSWORD env var
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "buildclub2025";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
