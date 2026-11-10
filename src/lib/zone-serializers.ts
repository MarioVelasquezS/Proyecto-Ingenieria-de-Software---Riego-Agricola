import { isMoistureStatus } from "./irrigation-engine";
import type {
  IrrigationEventRecord,
  ReadingRecord,
  ScheduleRecord,
  ZoneRecord,
} from "./zone-types";

interface RawReading {
  id: number;
  zoneId: number;
  moisture: number;
  ambientTemp: number;
  airHumidity: number;
  rainProbability: number;
  windSpeedKmh: number;
  forecastRainProb: number;
  status: string;
  valveOpen: boolean;
  source: string;
  recordedAt: Date;
}

interface RawSchedule {
  id: number;
  zoneId: number;
  label: string;
  startTime: string;
  durationSeconds: number;
  daysOfWeek: string;
  climateAdjust: boolean;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RawZone {
  id: number;
  name: string;
  cropType: string;
  areaHectares: number;
  latitude: number;
  longitude: number;
  minMoisture: number;
  maxMoisture: number;
  currentMoisture: number;
  valveOpen: boolean;
  autoMode: boolean;
  rainBlockEnabled: boolean;
  flowRateLpm: number;
  sprinklerCount: number;
  maxIrrigationSeconds: number;
  activeMaxSeconds: number | null;
  irrigationStartedAt: Date | null;
  cooldownUntil: Date | null;
  active: boolean;
  lastReadingAt: Date;
  createdAt: Date;
  updatedAt: Date;
  readings?: RawReading[];
  schedules?: RawSchedule[];
}

interface RawEvent {
  id: number;
  zoneId: number;
  action: string;
  reason: string;
  moistureAtEvent: number;
  waterUsedLiters: number;
  createdAt: Date;
  zone?: { name: string } | null;
  user?: { fullName: string; username: string } | null;
}

export function serializeReading(reading: RawReading): ReadingRecord {
  return {
    id: reading.id,
    zoneId: reading.zoneId,
    moisture: reading.moisture,
    ambientTemp: reading.ambientTemp,
    airHumidity: reading.airHumidity,
    rainProbability: reading.rainProbability,
    windSpeedKmh: reading.windSpeedKmh,
    forecastRainProb: reading.forecastRainProb,
    status: isMoistureStatus(reading.status) ? reading.status : "OPTIMO",
    valveOpen: reading.valveOpen,
    source: reading.source,
    recordedAt: reading.recordedAt.toISOString(),
  };
}

export function serializeSchedule(schedule: RawSchedule): ScheduleRecord {
  return {
    id: schedule.id,
    zoneId: schedule.zoneId,
    label: schedule.label,
    startTime: schedule.startTime,
    durationSeconds: schedule.durationSeconds,
    daysOfWeek: schedule.daysOfWeek,
    climateAdjust: schedule.climateAdjust,
    enabled: schedule.enabled,
    lastTriggeredAt: schedule.lastTriggeredAt
      ? schedule.lastTriggeredAt.toISOString()
      : null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export function serializeZone(zone: RawZone): ZoneRecord {
  const orderedReadings = (zone.readings ?? [])
    .slice()
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .map(serializeReading);

  const orderedSchedules = (zone.schedules ?? [])
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(serializeSchedule);

  return {
    id: zone.id,
    name: zone.name,
    cropType: zone.cropType,
    areaHectares: zone.areaHectares,
    latitude: zone.latitude,
    longitude: zone.longitude,
    minMoisture: zone.minMoisture,
    maxMoisture: zone.maxMoisture,
    currentMoisture: zone.currentMoisture,
    valveOpen: zone.valveOpen,
    autoMode: zone.autoMode,
    rainBlockEnabled: zone.rainBlockEnabled,
    flowRateLpm: zone.flowRateLpm,
    sprinklerCount: zone.sprinklerCount,
    maxIrrigationSeconds: zone.maxIrrigationSeconds,
    activeMaxSeconds: zone.activeMaxSeconds,
    irrigationStartedAt: zone.irrigationStartedAt
      ? zone.irrigationStartedAt.toISOString()
      : null,
    cooldownUntil: zone.cooldownUntil
      ? zone.cooldownUntil.toISOString()
      : null,
    active: zone.active,
    lastReadingAt: zone.lastReadingAt.toISOString(),
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
    readings: orderedReadings,
    schedules: orderedSchedules,
  };
}

export function serializeEvent(event: RawEvent): IrrigationEventRecord {
  return {
    id: event.id,
    zoneId: event.zoneId,
    zoneName: event.zone?.name ?? `Zona #${event.zoneId}`,
    action: event.action,
    reason: event.reason,
    moistureAtEvent: event.moistureAtEvent,
    waterUsedLiters: event.waterUsedLiters,
    userName: event.user ? event.user.fullName : null,
    createdAt: event.createdAt.toISOString(),
  };
}
