import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateSchedulePayload } from "@/lib/schedule-utils";
import { serializeSchedule } from "@/lib/zone-serializers";

interface RouteContext {
  params: { scheduleId: string };
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const scheduleId = parseId(context.params.scheduleId);
  if (!scheduleId) {
    return NextResponse.json(
      { error: "Identificador de horario inválido." },
      { status: 400 }
    );
  }

  const existing = await prisma.irrigationSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Horario no encontrado." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateSchedulePayload(
    body as Record<string, unknown>,
    false
  );
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const updated = await prisma.irrigationSchedule.update({
    where: { id: scheduleId },
    data: {
      ...validation.data,
      // Si se edita hora o se rehabilita, permite disparar en el nuevo horario
      ...(validation.data.startTime !== undefined ||
      validation.data.enabled === true
        ? { lastTriggeredAt: null }
        : {}),
    },
  });

  return NextResponse.json({ schedule: serializeSchedule(updated) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const scheduleId = parseId(context.params.scheduleId);
  if (!scheduleId) {
    return NextResponse.json(
      { error: "Identificador de horario inválido." },
      { status: 400 }
    );
  }

  const existing = await prisma.irrigationSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Horario no encontrado." },
      { status: 404 }
    );
  }

  await prisma.irrigationSchedule.delete({
    where: { id: scheduleId },
  });

  return NextResponse.json({ ok: true });
}

