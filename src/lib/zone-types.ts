import type { MoistureStatus } from "./irrigation-engine";

export interface ReadingRecord {
  id: number;
  zoneId: number;
  moisture: number;
  ambientTemp: number;
  airHumidity: number;
  rainProbability: number;
  windSpeedKmh: number;
  forecastRainProb: number;
  status: MoistureStatus;
  valveOpen: boolean;
  source: string;
  recordedAt: string;
}

export interface IrrigationEventRecord {
  id: number;
  zoneId: number;
  zoneName: string;
  action: string;
  reason: string;
  moistureAtEvent: number;
  waterUsedLiters: number;
  userName: string | null;
  createdAt: string;
}

export interface ScheduleRecord {
  id: number;
  zoneId: number;
  label: string;
  startTime: string;
  durationSeconds: number;
  daysOfWeek: string;
  climateAdjust: boolean;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneRecord {
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
  irrigationStartedAt: string | null;
  cooldownUntil: string | null;
  active: boolean;
  lastReadingAt: string;
  createdAt: string;
  updatedAt: string;
  readings: ReadingRecord[];
  schedules: ScheduleRecord[];
}
