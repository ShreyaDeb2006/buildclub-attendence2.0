import { db } from "@/db";
import { attendance, members } from "@/db/schema";
import { eq, desc, isNull, and, sql, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const limit = parseInt(searchParams.get("limit") || "100");

    let query = db
      .select({
        id: attendance.id,
        memberId: attendance.memberId,
        memberName: members.name,
        memberRole: members.role,
        memberPhoto: members.photoUrl,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        durationMinutes: attendance.durationMinutes,
        confidence: attendance.confidence,
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .orderBy(desc(attendance.checkIn))
      .limit(limit);

    if (memberId) {
      query = query.where(eq(attendance.memberId, memberId)) as typeof query;
    }

    const records = await query;
    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// Check in or check out
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, confidence } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      );
    }

    // Check if there's an open session (checked in but not out)
    const openSessions = await db
      .select()
      .from(attendance)
      .where(
        and(eq(attendance.memberId, memberId), isNull(attendance.checkOut))
      )
      .orderBy(desc(attendance.checkIn))
      .limit(1);

    if (openSessions.length > 0) {
      // Check out
      const session = openSessions[0];
      const now = new Date();
      const diffMs = now.getTime() - new Date(session.checkIn).getTime();
      const durationMinutes = Math.round(diffMs / 60000);

      const [updated] = await db
        .update(attendance)
        .set({
          checkOut: now,
          durationMinutes,
        })
        .where(eq(attendance.id, session.id))
        .returning();

      const [member] = await db
        .select()
        .from(members)
        .where(eq(members.id, memberId));

      return NextResponse.json({
        action: "checkout",
        record: updated,
        member,
        durationMinutes,
      });
    } else {
      // Check in
      const [record] = await db
        .insert(attendance)
        .values({
          memberId,
          confidence: confidence || null,
        })
        .returning();

      const [member] = await db
        .select()
        .from(members)
        .where(eq(members.id, memberId));

      return NextResponse.json({
        action: "checkin",
        record,
        member,
      });
    }
  } catch (error) {
    console.error("Error processing attendance:", error);
    return NextResponse.json(
      { error: "Failed to process attendance" },
      { status: 500 }
    );
  }
}
