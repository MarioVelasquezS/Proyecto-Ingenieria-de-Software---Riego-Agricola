import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
} from "@/lib/zone-queries";

interface RouteContext {
  params: { id: string };
}

interface WatchdogRequestBody {
  status?: string;
  reason?: string;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    // 1. Extraer y validar el ID de la zona desde params.id
    const rawId = params?.id;
    const zoneId = Number(rawId);

    if (!rawId || !Number.isInteger(zoneId) || zoneId <= 0) {
      return NextResponse.json(
        { error: "El parámetro 'id' de la zona es inválido o no fue proporcionado." },
        { status: 400 }
      );
    }

    // 2. Leer y validar el body de la petición
    const body = (await request.json().catch(() => null)) as WatchdogRequestBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "El cuerpo de la petición (body) es requerido." },
        { status: 400 }
      );
    }

    const { status, reason } = body;

    if (
      status !== "OFF" ||
      (reason !== "CRITICAL_WATER_LEVEL" && reason !== "MAX_TIME_REACHED")
    ) {
      return NextResponse.json(
        {
          error:
            "Payload inválido. Se esperaba { status: 'OFF', reason: 'CRITICAL_WATER_LEVEL' }.",
        },
        { status: 400 }
      );
    }

    // 3. Verificar que la zona exista en la base de datos
    const existingZone = await prisma.irrigationZone.findUnique({
      where: { id: zoneId },
    });

    if (!existingZone) {
      return NextResponse.json(
        { error: `No se encontró la zona de riego con ID ${zoneId}.` },
        { status: 404 }
      );
    }

    // 4. Actualizar el estado de la válvula a apagado (valveOpen: false) en Prisma
    const now = new Date();
    const isCriticalWater = reason === "CRITICAL_WATER_LEVEL";

    const updatedZone = await prisma.$transaction(async (tx) => {
      // NOTA IMPORTANTE: AJUSTA EL NOMBRE DEL MODELO (irrigationZone / zone) Y DEL CAMPO (valveOpen / isActive) SEGÚN TU ARCHIVO schema.prisma
      const zone = await tx.irrigationZone.update({
        where: { id: zoneId },
        data: {
          valveOpen: false, // <-- AJUSTAR ESTE NOMBRE DE CAMPO A TU SCHEMA.PRISMA SI ES DIFERENTE (EJ. isActive: false)
          activeMaxSeconds: null,
          irrigationStartedAt: null,
          cooldownUntil: new Date(now.getTime() + 60_000),
        },
      });

      // Registrar el evento de corte en la bitácora
      await tx.irrigationEvent.create({
        data: {
          zoneId: zone.id,
          action: isCriticalWater
            ? "VALVE_CLOSE_CRITICAL_TANK"
            : "VALVE_CLOSE_TIMEOUT",
          reason: isCriticalWater
            ? "Corte de emergencia (CRITICAL_WATER_LEVEL): Nivel crítico en el tanque de agua (<= 5,000 L)."
            : "Tiempo máximo de riego alcanzado. Cronómetro finalizado y válvula cerrada.",
          moistureAtEvent: zone.currentMoisture,
          waterUsedLiters: 0,
          createdAt: now,
        },
      });

      return zone;
    });

    const [zones, events] = await Promise.all([
      fetchZonesWithReadings(),
      fetchRecentIrrigationEvents(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        closed: true,
        message: `Válvula de la zona "${updatedZone.name}" (ID ${zoneId}) apagada por nivel crítico de agua.`,
        zone: updatedZone,
        zones,
        events,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[WATCHDOG_POST_ERROR]:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor al procesar el corte de emergencia.",
      },
      { status: 500 }
    );
  }
}
