import { db } from "@/db";
import { attendance, members } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get member info
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, id));

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get all attendance records
    const records = await db
      .select()
      .from(attendance)
      .where(eq(attendance.memberId, id))
      .orderBy(desc(attendance.checkIn));

    // Calculate stats
    const totalVisits = records.length;
    const completedSessions = records.filter((r) => r.checkOut !== null);
    const totalMinutes = completedSessions.reduce(
      (sum, r) => sum + (r.durationMinutes || 0),
      0
    );

    // Calculate streak (consecutive days)
    const visitDays = new Set(
      records.map((r) => new Date(r.checkIn).toDateString())
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (visitDays.has(checkDate.toDateString())) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    // Get daily breakdown for last 30 days
    const dailyData = await db
      .select({
        date: sql<string>`DATE(${attendance.checkIn})`,
        visits: sql<number>`COUNT(*)`,
        totalMinutes: sql<number>`COALESCE(SUM(${attendance.durationMinutes}), 0)`,
      })
      .from(attendance)
      .where(
        sql`${attendance.memberId} = ${id} AND ${attendance.checkIn} >= NOW() - INTERVAL '30 days'`
      )
      .groupBy(sql`DATE(${attendance.checkIn})`)
      .orderBy(sql`DATE(${attendance.checkIn})`);

    // Get hourly distribution (what hours do they typically arrive)
    const hourlyData = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${attendance.checkIn})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(attendance)
      .where(eq(attendance.memberId, id))
      .groupBy(sql`EXTRACT(HOUR FROM ${attendance.checkIn})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${attendance.checkIn})`);

    // Average session duration
    const avgDuration =
      completedSessions.length > 0
        ? Math.round(totalMinutes / completedSessions.length)
        : 0;

    // Currently active?
    const activeSession = records.find((r) => r.checkOut === null);

    return NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        createdAt: member.createdAt,
        isActive: member.isActive,
      },
      stats: {
        totalVisits,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalMinutes,
        avgSessionMinutes: avgDuration,
        streak,
        currentlyActive: !!activeSession,
        activeCheckIn: activeSession?.checkIn || null,
      },
      dailyData,
      hourlyData,
      recentSessions: records.slice(0, 50).map((r) => ({
        id: r.id,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        durationMinutes: r.durationMinutes,
        confidence: r.confidence,
      })),
    });
  } catch (error) {
    console.error("Error fetching member stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch member stats" },
      { status: 500 }
    );
  }
}
