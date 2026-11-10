import type { PrismaClient } from "@prisma/client";
import { classifyMoistureStatus } from "./irrigation-engine";

const DEFAULT_ZONES = [
  {
    name: "Parcela Norte - Maíz",
    cropType: "Maíz",
    areaHectares: 2.5,
    latitude: 14.0818,
    longitude: -87.2068,
    minMoisture: 35,
    maxMoisture: 70,
    currentMoisture: 52.0,
    valveOpen: false,
    autoMode: true,
    rainBlockEnabled: true,
    flowRateLpm: 35,
    sprinklerCount: 6,
    maxIrrigationSeconds: 1800,
    irrigationStartedAt: null,
    active: true,
  },
  {
    name: "Invernadero Sur - Tomate",
    cropType: "Tomate",
    areaHectares: 1.2,
    latitude: 14.4556,
    longitude: -87.6431,
    minMoisture: 45,
    maxMoisture: 75,
    currentMoisture: 38.5,
    valveOpen: true,
    autoMode: true,
    rainBlockEnabled: true,
    flowRateLpm: 24,
    sprinklerCount: 4,
    maxIrrigationSeconds: 1200,
    irrigationStartedAt: new Date(),
    active: true,
  },
  {
    name: "Lote Valle - Café",
    cropType: "Café",
    areaHectares: 3.0,
    latitude: 15.4975,
    longitude: -87.9822,
    minMoisture: 40,
    maxMoisture: 68,
    currentMoisture: 72.4,
    valveOpen: false,
    autoMode: true,
    rainBlockEnabled: true,
    flowRateLpm: 40,
    sprinklerCount: 8,
    maxIrrigationSeconds: 1800,
    irrigationStartedAt: null,
    active: true,
  },
];

/**
 * Crea parcelas de cultivo iniciales si la tabla aún no tiene registros.
 */
export async function seedDefaultZones(prisma: PrismaClient) {
  const existingCount = await prisma.irrigationZone.count();
  if (existingCount > 0) {
    return 0;
  }

  for (const item of DEFAULT_ZONES) {
    const status = classifyMoistureStatus(
      item.currentMoisture,
      item.minMoisture,
      item.maxMoisture
    );

    const created = await prisma.irrigationZone.create({
      data: item,
    });

    if (created.name.includes("Maíz")) {
      await prisma.irrigationSchedule.create({
        data: {
          zoneId: created.id,
          label: "Riego matutino",
          startTime: "06:00",
          durationSeconds: 900,
          daysOfWeek: "1,2,3,4,5",
          climateAdjust: true,
          enabled: true,
        },
      });
    }

    await prisma.moistureReading.create({
      data: {
        zoneId: created.id,
        moisture: item.currentMoisture,
        ambientTemp: 27.5,
        airHumidity: 60,
        rainProbability: 10,
        status,
        valveOpen: item.valveOpen,
        source: "SIMULACION",
      },
    });

    if (status === "INSUFICIENTE") {
      await prisma.irrigationEvent.create({
        data: {
          zoneId: created.id,
          action: "VALVE_OPEN_AUTO",
          reason: `Riego insuficiente inicial (${item.currentMoisture}% < mín ${item.minMoisture}%). Válvula abierta automáticamente.`,
          moistureAtEvent: item.currentMoisture,
          waterUsedLiters: 0,
        },
      });
    } else if (status === "SOBRE_RIEGO") {
      await prisma.irrigationEvent.create({
        data: {
          zoneId: created.id,
          action: "ALERT_OVER_IRRIGATION",
          reason: `Sobre-riego inicial detectado (${item.currentMoisture}% > máx ${item.maxMoisture}%). Válvula cerrada.`,
          moistureAtEvent: item.currentMoisture,
          waterUsedLiters: 0,
        },
      });
    }
  }

  return DEFAULT_ZONES.length;
}

