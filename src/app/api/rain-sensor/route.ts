import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
  getRainSensorActive,
} from "@/lib/zone-queries";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const rainSensorActive = await getRainSensorActive();
  return NextResponse.json({ rainSensorActive });
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.active !== "boolean") {
    return NextResponse.json(
      { error: "El campo active debe ser verdadero o falso." },
      { status: 400 }
    );
  }

  const active = body.active;
  const now = new Date();
  let closedCount = 0;
  let reopenedCount = 0;

  await prisma.$transaction(async (tx) => {
    await tx.systemConfig.upsert({
      where: { id: 1 },
      update: { rainSensorActive: active },
      create: { id: 1, rainSensorActive: active },
    });

    if (active) {
      // Si los sensores detectan lluvia, apagar riegos activos en parcelas con bloqueo por lluvia habilitado
      const openZones = await tx.irrigationZone.findMany({
        where: { valveOpen: true, rainBlockEnabled: true },
      });

      for (const zone of openZones) {
        closedCount++;
        await tx.irrigationZone.update({
          where: { id: zone.id },
          data: {
            valveOpen: false,
            activeMaxSeconds: null,
            irrigationStartedAt: null,
          },
        });

        await tx.irrigationEvent.create({
          data: {
            zoneId: zone.id,
            action: "VALVE_CLOSE_RAIN",
            reason: `Sensor de lluvia activado por ${currentUser.fullName}. Riego detenido automáticamente.`,
            moistureAtEvent: zone.currentMoisture,
            waterUsedLiters: 0,
            userId: currentUser.id,
            createdAt: now,
          },
        });
      }
    } else {
      // Al despejarse la lluvia, reanudar automáticamente las zonas en modo automático con déficit hídrico
      const dryZones = await tx.irrigationZone.findMany({
        where: {
          active: true,
          autoMode: true,
          valveOpen: false,
          rainBlockEnabled: true,
        },
      });

      for (const zone of dryZones) {
        const inCooldown =
          zone.cooldownUntil !== null &&
          zone.cooldownUntil.getTime() > now.getTime();
        if (zone.currentMoisture < zone.minMoisture && !inCooldown) {
          reopenedCount++;
          await tx.irrigationZone.update({
            where: { id: zone.id },
            data: {
              valveOpen: true,
              activeMaxSeconds: null,
              irrigationStartedAt: now,
              cooldownUntil: null,
            },
          });

          await tx.irrigationEvent.create({
            data: {
              zoneId: zone.id,
              action: "VALVE_OPEN_AUTO",
              reason: `Lluvia despejada (${zone.currentMoisture}% < mín ${zone.minMoisture}%). Riego automático reanudado.`,
              moistureAtEvent: zone.currentMoisture,
              waterUsedLiters: 0,
              createdAt: now,
            },
          });
        }
      }
    }
  });

  const [zones, events] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
  ]);

  return NextResponse.json({
    rainSensorActive: active,
    closedCount,
    reopenedCount,
    zones,
    events,
  });
}

