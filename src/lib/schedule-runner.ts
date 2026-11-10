import { formatMaxIrrigationLabel } from "./irrigation-engine";
import { prisma } from "./prisma";
import { isScheduleDueNow } from "./schedule-utils";
import {
  computeClimateAdjustedScheduleDuration,
  evaluateAdverseWeather,
  getWeatherForCoordinates,
  type WeatherPreset,
} from "./weather";
import { getRainSensorActive } from "./zone-queries";

export interface ScheduleRunSummary {
  triggeredCount: number;
  skippedCount: number;
  messages: string[];
}

/**
 * Revisa los horarios programados que correspondan al minuto actual, aplica ajustes
 * según pronóstico de lluvia o temperatura ambiente, y suspende el riego si hay clima adverso.
 */
export async function runDueSchedules(
  weatherPreset: WeatherPreset = "auto",
  now: Date = new Date()
): Promise<ScheduleRunSummary> {
  const candidates = await prisma.irrigationSchedule.findMany({
    where: {
      enabled: true,
      zone: { active: true },
    },
    include: { zone: true },
    orderBy: { startTime: "asc" },
  });

  const dueByZone = new Map<number, (typeof candidates)[number]>();
  for (const schedule of candidates) {
    if (dueByZone.has(schedule.zoneId)) continue;
    if (isScheduleDueNow(schedule, now)) {
      dueByZone.set(schedule.zoneId, schedule);
    }
  }

  if (dueByZone.size === 0) {
    return { triggeredCount: 0, skippedCount: 0, messages: [] };
  }

  const dueList = Array.from(dueByZone.values());
  const [rainSensorActive, weatherList] = await Promise.all([
    getRainSensorActive(),
    Promise.all(
      dueList.map((item) =>
        getWeatherForCoordinates(
          item.zone.latitude,
          item.zone.longitude,
          weatherPreset
        )
      )
    ),
  ]);

  let triggeredCount = 0;
  let skippedCount = 0;
  const messages: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < dueList.length; i++) {
      const schedule = dueList[i];
      const zone = schedule.zone;
      const weather = weatherList[i];

      await tx.irrigationSchedule.update({
        where: { id: schedule.id },
        data: { lastTriggeredAt: now },
      });

      if (zone.valveOpen) {
        skippedCount++;
        continue;
      }

      const adverse = evaluateAdverseWeather(
        weather,
        rainSensorActive,
        zone.rainBlockEnabled
      );

      if (adverse.isAdverse) {
        skippedCount++;
        const reason = `Horario "${schedule.label}" (${schedule.startTime}) suspendido: ${adverse.reason}`;
        messages.push(reason);
        await tx.irrigationEvent.create({
          data: {
            zoneId: zone.id,
            action:
              adverse.kind === "RAIN"
                ? "VALVE_CLOSE_RAIN"
                : "VALVE_SUSPENDED_WEATHER",
            reason,
            moistureAtEvent: zone.currentMoisture,
            waterUsedLiters: 0,
            createdAt: now,
          },
        });
        continue;
      }

      if (zone.currentMoisture >= zone.maxMoisture) {
        skippedCount++;
        const reason = `Horario "${schedule.label}" (${schedule.startTime}) omitido: humedad (${zone.currentMoisture}%) ya en umbral máximo (${zone.maxMoisture}%).`;
        messages.push(reason);
        await tx.irrigationEvent.create({
          data: {
            zoneId: zone.id,
            action: "ALERT_OVER_IRRIGATION",
            reason,
            moistureAtEvent: zone.currentMoisture,
            waterUsedLiters: 0,
            createdAt: now,
          },
        });
        continue;
      }

      let finalDuration = Math.min(
        zone.maxIrrigationSeconds,
        schedule.durationSeconds
      );
      let adjustNote: string | null = null;

      if (schedule.climateAdjust) {
        const adjustment = computeClimateAdjustedScheduleDuration(
          schedule.durationSeconds,
          zone.maxIrrigationSeconds,
          weather
        );

        if (adjustment.action === "SKIP") {
          skippedCount++;
          const reason = `Horario "${schedule.label}" (${schedule.startTime}) suspendido: ${adjustment.note}`;
          messages.push(reason);
          await tx.irrigationEvent.create({
            data: {
              zoneId: zone.id,
              action: "VALVE_SUSPENDED_WEATHER",
              reason,
              moistureAtEvent: zone.currentMoisture,
              waterUsedLiters: 0,
              createdAt: now,
            },
          });
          continue;
        }

        finalDuration = adjustment.adjustedSeconds;
        adjustNote = adjustment.note;
      }

      triggeredCount++;
      const reason = `Riego programado "${schedule.label}" (${schedule.startTime}) iniciado por ${formatMaxIrrigationLabel(
        finalDuration
      )}.${adjustNote ? ` ${adjustNote}` : ""}`;
      messages.push(reason);

      await tx.irrigationZone.update({
        where: { id: zone.id },
        data: {
          valveOpen: true,
          irrigationStartedAt: now,
          activeMaxSeconds: finalDuration,
          cooldownUntil: null,
        },
      });

      await tx.irrigationEvent.create({
        data: {
          zoneId: zone.id,
          action: "VALVE_OPEN_SCHEDULE",
          reason,
          moistureAtEvent: zone.currentMoisture,
          waterUsedLiters: 0,
          createdAt: now,
        },
      });
    }
  });

  return { triggeredCount, skippedCount, messages };
}

