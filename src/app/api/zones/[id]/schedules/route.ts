import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSchedulePayload } from "@/lib/schedule-utils";
import { serializeSchedule } from "@/lib/zone-serializers";

interface RouteContext {
  params: { id: string };
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const zoneId = parseId(context.params.id);
  if (!zoneId) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const schedules = await prisma.irrigationSchedule.findMany({
    where: { zoneId },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({
    schedules: schedules.map(serializeSchedule),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const zoneId = parseId(context.params.id);
  if (!zoneId) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const zone = await prisma.irrigationZone.findUnique({
    where: { id: zoneId },
    select: { id: true },
  });

  if (!zone) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateSchedulePayload(
    body as Record<string, unknown>,
    true
  );
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const created = await prisma.irrigationSchedule.create({
    data: {
      zoneId,
      label: validation.data.label ?? "Riego programado",
      startTime: validation.data.startTime ?? "06:00",
      durationSeconds: validation.data.durationSeconds ?? 900,
      daysOfWeek: validation.data.daysOfWeek ?? "1,2,3,4,5,6,0",
      climateAdjust: validation.data.climateAdjust ?? true,
      enabled: validation.data.enabled ?? true,
    },
  });

  return NextResponse.json(
    { schedule: serializeSchedule(created) },
    { status: 201 }
  );
}

