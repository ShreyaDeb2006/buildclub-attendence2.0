import { db } from "@/db";
import { attendance, members } from "@/db/schema";
import { eq, sql, desc, count, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Total members
    const [memberCount] = await db
      .select({ count: count() })
      .from(members)
      .where(eq(members.isActive, true));

    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCount] = await db
      .select({ count: count() })
      .from(attendance)
      .where(sql`${attendance.checkIn} >= ${today}`);

    // Currently checked in (open sessions)
    const [activeCount] = await db
      .select({ count: count() })
      .from(attendance)
      .where(sql`${attendance.checkOut} IS NULL`);

    // Total hours this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const [weekHours] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${attendance.durationMinutes}), 0)`,
      })
      .from(attendance)
      .where(
        sql`${attendance.checkIn} >= ${weekStart} AND ${attendance.durationMinutes} IS NOT NULL`
      );

    // Leaderboard - top members by total hours
    const leaderboard = await db
      .select({
        memberId: attendance.memberId,
        memberName: members.name,
        memberRole: members.role,
        memberPhoto: members.photoUrl,
        totalMinutes: sql<number>`COALESCE(SUM(${attendance.durationMinutes}), 0)`,
        visitCount: count(),
      })
      .from(attendance)
      .innerJoin(members, eq(attendance.memberId, members.id))
      .where(isNotNull(attendance.durationMinutes))
      .groupBy(attendance.memberId, members.name, members.role, members.photoUrl)
      .orderBy(desc(sql`SUM(${attendance.durationMinutes})`))
      .limit(10);

    // Recent 7 days activity
    const dailyActivity = await db
      .select({
        date: sql<string>`DATE(${attendance.checkIn})`,
        count: count(),
        totalMinutes: sql<number>`COALESCE(SUM(${attendance.durationMinutes}), 0)`,
      })
      .from(attendance)
      .where(sql`${attendance.checkIn} >= NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE(${attendance.checkIn})`)
      .orderBy(sql`DATE(${attendance.checkIn})`);

    return NextResponse.json({
      totalMembers: memberCount.count,
      todayAttendance: todayCount.count,
      currentlyActive: activeCount.count,
      weeklyHours: Math.round((weekHours.total || 0) / 60 * 10) / 10,
      leaderboard,
      dailyActivity,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
