import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeSimulatedMoisture,
  evaluateZoneControl,
} from "@/lib/irrigation-engine";
import { runDueSchedules } from "@/lib/schedule-runner";
import {
  evaluateAdverseWeather,
  getWeatherForCoordinates,
  isWeatherPreset,
  type WeatherPreset,
} from "@/lib/weather";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
  getRainSensorActive,
} from "@/lib/zone-queries";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawZoneId =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).zoneId
      : undefined;
  const rawPreset =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).weatherPreset
      : undefined;
  const rawForcedMoisture =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).forcedMoisture
      : undefined;

  const weatherPreset: WeatherPreset = isWeatherPreset(rawPreset)
    ? rawPreset
    : "auto";

  let targetZoneId: number | null = null;
  if (rawZoneId !== undefined && rawZoneId !== "all") {
    const parsedId = Number(rawZoneId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json(
        { error: "Identificador de parcela inválido." },
        { status: 400 }
      );
    }
    targetZoneId = parsedId;
  }

  let forcedMoisture: number | null = null;
  if (rawForcedMoisture !== undefined && rawForcedMoisture !== null) {
    if (targetZoneId === null) {
      return NextResponse.json(
        {
          error:
            "forcedMoisture solo puede aplicarse al simular una parcela específica.",
        },
        { status: 400 }
      );
    }
    const parsedMoisture = Number(rawForcedMoisture);
    if (
      !Number.isFinite(parsedMoisture) ||
      parsedMoisture < 0 ||
      parsedMoisture > 100
    ) {
      return NextResponse.json(
        { error: "La humedad simulada debe estar entre 0% y 100%." },
        { status: 400 }
      );
    }
    forcedMoisture = Number(parsedMoisture.toFixed(1));
  }

  if (forcedMoisture === null) {
    await runDueSchedules(weatherPreset);
  }

  const targetZones = await prisma.irrigationZone.findMany({
    where: targetZoneId
      ? { id: targetZoneId }
      : { active: true },
    orderBy: { id: "asc" },
  });

  if (targetZoneId && targetZones.length === 0) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  if (targetZoneId && !targetZones[0].active) {
    return NextResponse.json(
      { error: "La parcela está inactiva y no admite simulación." },
      { status: 400 }
    );
  }

  const [rainSensorActive, weatherResults] = await Promise.all([
    getRainSensorActive(),
    Promise.all(
      targetZones.map((zone) =>
        getWeatherForCoordinates(zone.latitude, zone.longitude, weatherPreset)
      )
    ),
  ]);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < targetZones.length; i++) {
      const zone = targetZones[i];
      const weather = weatherResults[i];
      const adverseWeather = evaluateAdverseWeather(
        weather,
        rainSensorActive,
        zone.rainBlockEnabled
      );

      const nextMoisture =
        forcedMoisture !== null
          ? forcedMoisture
          : computeSimulatedMoisture({
              currentMoisture: zone.currentMoisture,
              valveOpen: zone.valveOpen,
              flowRateLpm: zone.flowRateLpm,
              areaHectares: zone.areaHectares,
              weather,
              rainDetected: rainSensorActive,
            });

      const now = new Date();
      const effectiveMaxSeconds =
        zone.activeMaxSeconds ?? zone.maxIrrigationSeconds;

      const evaluation = evaluateZoneControl({
        previousMoisture: zone.currentMoisture,
        nextMoisture,
        minMoisture: zone.minMoisture,
        maxMoisture: zone.maxMoisture,
        currentlyOpen: zone.valveOpen,
        autoMode: zone.autoMode,
        adverseWeather,
        flowRateLpm: zone.flowRateLpm,
        maxIrrigationSeconds: effectiveMaxSeconds,
        irrigationStartedAt: zone.irrigationStartedAt,
        cooldownUntil: zone.cooldownUntil,
        bypassCooldown: forcedMoisture !== null,
        now,
      });

      let nextStartedAt: Date | null = zone.irrigationStartedAt;
      let nextActiveMaxSeconds: number | null = zone.activeMaxSeconds;
      if (!zone.valveOpen && evaluation.nextValveOpen) {
        nextStartedAt = now;
        nextActiveMaxSeconds = null;
      } else if (!evaluation.nextValveOpen) {
        nextStartedAt = null;
        nextActiveMaxSeconds = null;
      } else if (evaluation.nextValveOpen && !nextStartedAt) {
        nextStartedAt = now;
      }

      const nextCooldownUntil =
        evaluation.setCooldownUntil === "KEEP"
          ? zone.cooldownUntil
          : evaluation.setCooldownUntil;

      await tx.irrigationZone.update({
        where: { id: zone.id },
        data: {
          currentMoisture: nextMoisture,
          valveOpen: evaluation.nextValveOpen,
          activeMaxSeconds: nextActiveMaxSeconds,
          irrigationStartedAt: nextStartedAt,
          cooldownUntil: nextCooldownUntil,
          lastReadingAt: now,
        },
      });

      await tx.moistureReading.create({
        data: {
          zoneId: zone.id,
          moisture: nextMoisture,
          ambientTemp: weather.ambientTemp,
          airHumidity: weather.airHumidity,
          rainProbability: rainSensorActive
            ? Math.max(85, weather.rainProbability)
            : weather.rainProbability,
          windSpeedKmh: weather.windSpeedKmh,
          forecastRainProb: rainSensorActive
            ? Math.max(90, weather.forecastRainProb)
            : weather.forecastRainProb,
          status: evaluation.status,
          valveOpen: evaluation.nextValveOpen,
          source: forcedMoisture !== null ? "SIMULACION" : weather.source,
          recordedAt: now,
        },
      });

      if (evaluation.event) {
        await tx.irrigationEvent.create({
          data: {
            zoneId: zone.id,
            action: evaluation.event.action,
            reason: evaluation.event.reason,
            moistureAtEvent: nextMoisture,
            waterUsedLiters: evaluation.waterUsedLiters,
            userId: forcedMoisture !== null ? currentUser.id : null,
            createdAt: now,
          },
        });
      }
    }
  });

  const [zones, events] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
  ]);

  return NextResponse.json({
    updatedCount: targetZones.length,
    rainSensorActive,
    zones,
    events,
  });
}

