import { prisma } from "./prisma";
import { serializeEvent, serializeZone } from "./zone-serializers";

export async function getRainSensorActive(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { rainSensorActive: true },
  });
  return config?.rainSensorActive ?? false;
}

export async function fetchZonesWithReadings(readingLimit = 14) {
  const zones = await prisma.irrigationZone.findMany({
    orderBy: { id: "asc" },
    include: {
      readings: {
        orderBy: { recordedAt: "desc" },
        take: readingLimit,
      },
      schedules: {
        orderBy: { startTime: "asc" },
      },
    },
  });

  return zones.map(serializeZone);
}

export async function fetchRecentIrrigationEvents(limit = 30) {
  const events = await prisma.irrigationEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      zone: { select: { name: true } },
      user: { select: { fullName: true, username: true } },
    },
  });

  return events.map(serializeEvent);
}
