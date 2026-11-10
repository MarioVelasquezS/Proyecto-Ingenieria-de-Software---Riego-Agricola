import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyMoistureStatus } from "@/lib/irrigation-engine";
import { getWeatherForCoordinates } from "@/lib/weather";
import { validateCreateZone } from "@/lib/zone-validation";
import { serializeZone } from "@/lib/zone-serializers";
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

  const [zones, events, rainSensorActive] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
    getRainSensorActive(),
  ]);

  return NextResponse.json({ zones, events, rainSensorActive });
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden crear parcelas de riego." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateCreateZone(body as Record<string, unknown>);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const status = classifyMoistureStatus(
    data.currentMoisture,
    data.minMoisture,
    data.maxMoisture
  );

  const rainSensorActive = await getRainSensorActive();
  const rainBlocked = data.rainBlockEnabled && rainSensorActive;

  // Si se crea activa en modo automático con déficit hídrico y sin lluvia bloqueando, abre la válvula
  const initialValveOpen =
    data.active && data.autoMode && status === "INSUFICIENTE" && !rainBlocked;

  const weather = await getWeatherForCoordinates(
    data.latitude,
    data.longitude,
    "auto"
  );

  const createdZone = await prisma.$transaction(async (tx) => {
    const zone = await tx.irrigationZone.create({
      data: {
        ...data,
        valveOpen: initialValveOpen,
        irrigationStartedAt: initialValveOpen ? new Date() : null,
      },
    });

    const reading = await tx.moistureReading.create({
      data: {
        zoneId: zone.id,
        moisture: data.currentMoisture,
        ambientTemp: weather.ambientTemp,
        airHumidity: weather.airHumidity,
        rainProbability: weather.rainProbability,
        windSpeedKmh: weather.windSpeedKmh,
        forecastRainProb: weather.forecastRainProb,
        status,
        valveOpen: initialValveOpen,
        source: weather.source,
      },
    });

    if (initialValveOpen) {
      await tx.irrigationEvent.create({
        data: {
          zoneId: zone.id,
          action: "VALVE_OPEN_AUTO",
          reason: `Riego insuficiente al registrar parcela (${data.currentMoisture}% < mín ${data.minMoisture}%). Válvula abierta automáticamente.`,
          moistureAtEvent: data.currentMoisture,
          waterUsedLiters: 0,
        },
      });
    } else if (status === "SOBRE_RIEGO") {
      await tx.irrigationEvent.create({
        data: {
          zoneId: zone.id,
          action: "ALERT_OVER_IRRIGATION",
          reason: `Sobre-riego detectado al registrar parcela (${data.currentMoisture}% > máx ${data.maxMoisture}%). Válvula cerrada.`,
          moistureAtEvent: data.currentMoisture,
          waterUsedLiters: 0,
        },
      });
    }

    return { ...zone, readings: [reading] };
  });

  return NextResponse.json(
    { zone: serializeZone(createdZone) },
    { status: 201 }
  );
}

