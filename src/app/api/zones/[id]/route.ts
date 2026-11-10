import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateZoneControl } from "@/lib/irrigation-engine";
import { evaluateAdverseWeather, getWeatherForCoordinates } from "@/lib/weather";
import { getRainSensorActive } from "@/lib/zone-queries";
import { validateUpdateZone } from "@/lib/zone-validation";
import { serializeEvent, serializeZone } from "@/lib/zone-serializers";

interface RouteContext {
  params: { id: string };
}

function parseZoneId(rawId: string): number | null {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const zoneId = parseZoneId(context.params.id);
  if (!zoneId) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const zone = await prisma.irrigationZone.findUnique({
    where: { id: zoneId },
    include: {
      readings: {
        orderBy: { recordedAt: "desc" },
        take: 30,
      },
      schedules: {
        orderBy: { startTime: "asc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          zone: { select: { name: true } },
          user: { select: { fullName: true, username: true } },
        },
      },
    },
  });

  if (!zone) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    zone: serializeZone(zone),
    events: zone.events.map(serializeEvent),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const zoneId = parseZoneId(context.params.id);
  if (!zoneId) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const existing = await prisma.irrigationZone.findUnique({
    where: { id: zoneId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateUpdateZone(body as Record<string, unknown>, {
    minMoisture: existing.minMoisture,
    maxMoisture: existing.maxMoisture,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const isConfigChange =
    data.name !== undefined ||
    data.cropType !== undefined ||
    data.areaHectares !== undefined ||
    data.latitude !== undefined ||
    data.longitude !== undefined ||
    data.minMoisture !== undefined ||
    data.maxMoisture !== undefined ||
    data.flowRateLpm !== undefined ||
    data.sprinklerCount !== undefined ||
    data.maxIrrigationSeconds !== undefined ||
    data.active !== undefined;

  if (isConfigChange && currentUser.role !== "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Solo los administradores pueden modificar la configuración de la parcela.",
      },
      { status: 403 }
    );
  }

  const rainSensorActive = await getRainSensorActive();
  const nextMoisturePre = data.currentMoisture ?? existing.currentMoisture;
  const nextMaxPre = data.maxMoisture ?? existing.maxMoisture;
  const nextRainBlockPre = data.rainBlockEnabled ?? existing.rainBlockEnabled;

  if (data.valveOpen === true && !existing.valveOpen) {
    if (rainSensorActive && nextRainBlockPre) {
      return NextResponse.json(
        {
          error:
            "Los sensores detectan lluvia activa y la parcela tiene el bloqueo por lluvia habilitado.",
        },
        { status: 400 }
      );
    }

    if (nextMoisturePre >= nextMaxPre) {
      return NextResponse.json(
        {
          error: `No se puede iniciar el riego porque la humedad (${nextMoisturePre}%) ya alcanzó o superó el umbral máximo (${nextMaxPre}%).`,
        },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextAutoMode = data.autoMode ?? existing.autoMode;
    const nextRainBlockEnabled =
      data.rainBlockEnabled ?? existing.rainBlockEnabled;
    let nextValveOpen = data.valveOpen ?? existing.valveOpen;
    const nextMoisture = data.currentMoisture ?? existing.currentMoisture;
    const nextMin = data.minMoisture ?? existing.minMoisture;
    const nextMax = data.maxMoisture ?? existing.maxMoisture;
    const nextMaxSeconds =
      data.maxIrrigationSeconds ?? existing.maxIrrigationSeconds;
    const nextActive = data.active ?? existing.active;
    let nextCooldownUntil: Date | null = existing.cooldownUntil;
    const now = new Date();
    const eventsToCreate: Array<{
      action: string;
      reason: string;
      userId: number | null;
    }> = [];

    // El interruptor de control automático permanece intacto; nunca se apaga solo al operar manualmente
    if (
      data.valveOpen !== undefined &&
      data.valveOpen !== existing.valveOpen
    ) {
      nextCooldownUntil = data.valveOpen
        ? null
        : new Date(now.getTime() + 60_000);
      eventsToCreate.push({
        action: data.valveOpen ? "VALVE_OPEN_MANUAL" : "VALVE_CLOSE_MANUAL",
        reason: data.valveOpen
          ? `Apertura manual de válvula por ${currentUser.fullName}.`
          : `Cierre manual de válvula por ${currentUser.fullName}.`,
        userId: currentUser.id,
      });
    }

    if (
      data.autoMode !== undefined &&
      data.autoMode !== existing.autoMode
    ) {
      if (data.autoMode) {
        nextCooldownUntil = null;
      }
      eventsToCreate.push({
        action: "MODE_CHANGE",
        reason: data.autoMode
          ? `Control automático activado por ${currentUser.fullName}.`
          : `Control automático desactivado por ${currentUser.fullName}.`,
        userId: currentUser.id,
      });
    }

    // Reevaluar umbrales, clima adverso y cronómetro cuando no se forzó el cierre/apertura manual de válvula
    if (nextActive && data.valveOpen === undefined) {
      const weather = await getWeatherForCoordinates(
        data.latitude ?? existing.latitude,
        data.longitude ?? existing.longitude,
        "auto"
      );
      const adverseWeather = evaluateAdverseWeather(
        weather,
        rainSensorActive,
        nextRainBlockEnabled
      );
      const evalResult = evaluateZoneControl({
        previousMoisture: existing.currentMoisture,
        nextMoisture,
        minMoisture: nextMin,
        maxMoisture: nextMax,
        currentlyOpen: nextValveOpen,
        autoMode: nextAutoMode,
        adverseWeather,
        flowRateLpm: data.flowRateLpm ?? existing.flowRateLpm,
        maxIrrigationSeconds: existing.activeMaxSeconds ?? nextMaxSeconds,
        irrigationStartedAt: existing.irrigationStartedAt,
        cooldownUntil: nextCooldownUntil,
        bypassCooldown: data.autoMode === true || data.rainBlockEnabled === false,
        now,
      });
      nextValveOpen = evalResult.nextValveOpen;
      if (evalResult.setCooldownUntil !== "KEEP") {
        nextCooldownUntil = evalResult.setCooldownUntil;
      }
      if (evalResult.event) {
        eventsToCreate.push({
          action: evalResult.event.action,
          reason: evalResult.event.reason,
          userId: null,
        });
      }
    }

    if (!nextActive && nextValveOpen) {
      nextValveOpen = false;
    }

    let nextStartedAt: Date | null = existing.irrigationStartedAt;
    let nextActiveMaxSeconds: number | null = existing.activeMaxSeconds;
    if (!existing.valveOpen && nextValveOpen) {
      nextStartedAt = now;
      nextActiveMaxSeconds = null;
    } else if (!nextValveOpen) {
      nextStartedAt = null;
      nextActiveMaxSeconds = null;
    } else if (nextValveOpen && !nextStartedAt) {
      nextStartedAt = now;
    }

    const savedZone = await tx.irrigationZone.update({
      where: { id: zoneId },
      data: {
        ...data,
        autoMode: nextAutoMode,
        rainBlockEnabled: nextRainBlockEnabled,
        valveOpen: nextValveOpen,
        activeMaxSeconds: nextActiveMaxSeconds,
        irrigationStartedAt: nextStartedAt,
        cooldownUntil: nextCooldownUntil,
      },
      include: {
        readings: {
          orderBy: { recordedAt: "desc" },
          take: 14,
        },
        schedules: {
          orderBy: { startTime: "asc" },
        },
      },
    });

    for (const evt of eventsToCreate) {
      await tx.irrigationEvent.create({
        data: {
          zoneId,
          action: evt.action,
          reason: evt.reason,
          moistureAtEvent: nextMoisture,
          waterUsedLiters: 0,
          userId: evt.userId,
        },
      });
    }

    return savedZone;
  });

  return NextResponse.json({ zone: serializeZone(updated) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden eliminar parcelas." },
      { status: 403 }
    );
  }

  const zoneId = parseZoneId(context.params.id);
  if (!zoneId) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const existing = await prisma.irrigationZone.findUnique({
    where: { id: zoneId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  await prisma.irrigationZone.delete({
    where: { id: zoneId },
  });

  return NextResponse.json({ ok: true });
}

