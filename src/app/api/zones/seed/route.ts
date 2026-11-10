import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultZones } from "@/lib/zones-seed";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
} from "@/lib/zone-queries";

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden cargar parcelas de ejemplo." },
      { status: 403 }
    );
  }

  const seededCount = await seedDefaultZones(prisma);
  const [zones, events] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
  ]);

  return NextResponse.json({ seededCount, zones, events });
}

