import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  formatMaxIrrigationLabel,
  getElapsedIrrigationSeconds,
} from "@/lib/irrigation-engine";
import { prisma } from "@/lib/prisma";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
} from "@/lib/zone-queries";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const zoneId = Number(context.params.id);
  if (!Number.isInteger(zoneId) || zoneId <= 0) {
    return NextResponse.json(
      { error: "Identificador de parcela inválido." },
      { status: 400 }
    );
  }

  const zone = await prisma.irrigationZone.findUnique({
    where: { id: zoneId },
  });

  if (!zone) {
    return NextResponse.json(
      { error: "Parcela no encontrada." },
      { status: 404 }
    );
  }

  let closed = false;
  if (zone.valveOpen && zone.irrigationStartedAt) {
    const now = new Date();
    const effectiveLimitSeconds =
      zone.activeMaxSeconds ?? zone.maxIrrigationSeconds;
    const elapsedSeconds = getElapsedIrrigationSeconds(
      zone.irrigationStartedAt,
      now.getTime()
    );

    if (elapsedSeconds >= effectiveLimitSeconds) {
      closed = true;

      await prisma.$transaction(async (tx) => {
        await tx.irrigationZone.update({
          where: { id: zone.id },
          data: {
            valveOpen: false,
            activeMaxSeconds: null,
            irrigationStartedAt: null,
            cooldownUntil: new Date(now.getTime() + 60_000),
          },
        });

        await tx.irrigationEvent.create({
          data: {
            zoneId: zone.id,
            action: "VALVE_CLOSE_TIMEOUT",
            reason: `Tiempo máximo de riego alcanzado (${formatMaxIrrigationLabel(
              effectiveLimitSeconds
            )}). Cronómetro finalizado y válvula cerrada.`,
            moistureAtEvent: zone.currentMoisture,
            waterUsedLiters: Number(
              ((zone.flowRateLpm * effectiveLimitSeconds) / 60).toFixed(1)
            ),
            createdAt: now,
          },
        });
      });
    }
  }

  const [zones, events] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
  ]);

  return NextResponse.json({ closed, zones, events });
}

