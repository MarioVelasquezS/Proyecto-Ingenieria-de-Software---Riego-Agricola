import type { AdverseWeatherResult, WeatherConditions } from "./weather";

export type MoistureStatus = "OPTIMO" | "INSUFICIENTE" | "SOBRE_RIEGO";

export type IrrigationEventAction =
  | "VALVE_OPEN_AUTO"
  | "VALVE_OPEN_SCHEDULE"
  | "VALVE_CLOSE_AUTO"
  | "VALVE_CLOSE_TIMEOUT"
  | "VALVE_CLOSE_RAIN"
  | "VALVE_SUSPENDED_WEATHER"
  | "VALVE_OPEN_MANUAL"
  | "VALVE_CLOSE_MANUAL"
  | "ALERT_UNDER_IRRIGATION"
  | "ALERT_OVER_IRRIGATION"
  | "MODE_CHANGE";

export const MOISTURE_STATUS_LABELS: Record<MoistureStatus, string> = {
  OPTIMO: "Nivel Óptimo",
  INSUFICIENTE: "Riego Insuficiente",
  SOBRE_RIEGO: "Sobre-riego",
};

export function isMoistureStatus(value: string): value is MoistureStatus {
  return (
    value === "OPTIMO" ||
    value === "INSUFICIENTE" ||
    value === "SOBRE_RIEGO"
  );
}

/**
 * Formatea una duración en segundos como MM:SS o HH:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Formatea el tiempo máximo configurado en minutos/segundos legibles.
 */
export function formatMaxIrrigationLabel(totalSeconds: number): string {
  if (totalSeconds >= 60 && totalSeconds % 60 === 0) {
    return `${totalSeconds / 60} min`;
  }
  if (totalSeconds >= 60) {
    return formatDuration(totalSeconds);
  }
  return `${totalSeconds} seg`;
}

/**
 * Calcula los segundos transcurridos desde que comenzó el riego activo.
 */
export function getElapsedIrrigationSeconds(
  startedAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): number {
  if (!startedAt) return 0;
  const startMs =
    startedAt instanceof Date ? startedAt.getTime() : Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

/**
 * Clasifica la humedad del suelo respecto al rango óptimo configurado por el usuario.
 */
export function classifyMoistureStatus(
  moisture: number,
  minMoisture: number,
  maxMoisture: number
): MoistureStatus {
  if (moisture < minMoisture) {
    return "INSUFICIENTE";
  }
  if (moisture > maxMoisture) {
    return "SOBRE_RIEGO";
  }
  return "OPTIMO";
}

export interface SimulationInput {
  currentMoisture: number;
  valveOpen: boolean;
  flowRateLpm: number;
  areaHectares: number;
  weather: WeatherConditions;
  rainDetected?: boolean;
}

/**
 * Simula la evolución de la humedad del suelo en un ciclo de monitoreo
 * combinando evapotranspiración climática (temperatura, humedad del aire y viento),
 * caudal de riego y lluvia.
 */
export function computeSimulatedMoisture(input: SimulationInput): number {
  const {
    currentMoisture,
    valveOpen,
    flowRateLpm,
    areaHectares,
    weather,
    rainDetected,
  } = input;

  const tempDrive = Math.max(0.2, (weather.ambientTemp - 12) / 14);
  const drynessDrive = Math.max(0.2, (100 - weather.airHumidity) / 45);
  const windDrive = 1 + Math.min(0.6, weather.windSpeedKmh / 60);
  const evaporationLoss = tempDrive * drynessDrive * windDrive * 0.85;

  const areaFactor = Math.max(0.4, Math.min(3, areaHectares));
  const irrigationGain = valveOpen
    ? Math.max(3.2, Math.min(8.5, flowRateLpm / (areaFactor * 8) + 2.5))
    : 0;

  const rainGain =
    rainDetected || weather.rainProbability >= 70
      ? 4.8
      : weather.rainProbability >= 40
        ? 1.8
        : 0;

  const sensorNoise = (Math.random() - 0.5) * 0.8;
  const next =
    currentMoisture - evaporationLoss + irrigationGain + rainGain + sensorNoise;

  return Number(Math.max(0, Math.min(100, next)).toFixed(1));
}

export interface ValveEvaluationInput {
  previousMoisture: number;
  nextMoisture: number;
  minMoisture: number;
  maxMoisture: number;
  currentlyOpen: boolean;
  autoMode: boolean;
  adverseWeather: AdverseWeatherResult;
  flowRateLpm: number;
  maxIrrigationSeconds: number;
  irrigationStartedAt: Date | null;
  cooldownUntil: Date | null;
  bypassCooldown?: boolean;
  now?: Date;
}

export interface ValveEvaluationResult {
  previousStatus: MoistureStatus;
  status: MoistureStatus;
  nextValveOpen: boolean;
  setCooldownUntil: Date | null | "KEEP";
  waterUsedLiters: number;
  event: {
    action: IrrigationEventAction;
    reason: string;
  } | null;
}

/**
 * Evalúa validaciones de riego insuficiente/sobre-riego, condiciones climáticas adversas,
 * cronómetro de tiempo máximo y decide apertura/cierre de válvula.
 * Nunca desactiva el interruptor `autoMode`, que permanece bajo control del usuario.
 */
export function evaluateZoneControl(
  input: ValveEvaluationInput
): ValveEvaluationResult {
  const now = input.now ?? new Date();
  const previousStatus = classifyMoistureStatus(
    input.previousMoisture,
    input.minMoisture,
    input.maxMoisture
  );
  const status = classifyMoistureStatus(
    input.nextMoisture,
    input.minMoisture,
    input.maxMoisture
  );

  const waterUsedLiters = input.currentlyOpen
    ? Number(input.flowRateLpm.toFixed(1))
    : 0;

  // 1) Suspensión ante condiciones climáticas adversas (lluvia con bloqueo, viento fuerte, calor/helada extrema)
  if (input.adverseWeather.isAdverse) {
    if (input.currentlyOpen) {
      return {
        previousStatus,
        status,
        nextValveOpen: false,
        setCooldownUntil: null,
        waterUsedLiters,
        event: {
          action:
            input.adverseWeather.kind === "RAIN"
              ? "VALVE_CLOSE_RAIN"
              : "VALVE_SUSPENDED_WEATHER",
          reason:
            input.adverseWeather.reason ??
            "Riego suspendido por condiciones climáticas adversas.",
        },
      };
    }

    if (status === "SOBRE_RIEGO" && previousStatus !== "SOBRE_RIEGO") {
      return {
        previousStatus,
        status,
        nextValveOpen: false,
        setCooldownUntil: "KEEP",
        waterUsedLiters: 0,
        event: {
          action: "ALERT_OVER_IRRIGATION",
          reason: `Sobre-riego detectado (${input.nextMoisture}% > máx ${input.maxMoisture}%). Riego suspendido por clima adverso.`,
        },
      };
    }

    return {
      previousStatus,
      status,
      nextValveOpen: false,
      setCooldownUntil: "KEEP",
      waterUsedLiters: 0,
      event: null,
    };
  }

  // 2) Si está regando, validar cronómetro máximo (watchdog) y umbral máximo
  if (input.currentlyOpen) {
    const elapsedSeconds = getElapsedIrrigationSeconds(
      input.irrigationStartedAt,
      now.getTime()
    );

    if (elapsedSeconds >= input.maxIrrigationSeconds) {
      const cooldown = new Date(now.getTime() + 60_000);
      return {
        previousStatus,
        status,
        nextValveOpen: false,
        setCooldownUntil: cooldown,
        waterUsedLiters,
        event: {
          action: "VALVE_CLOSE_TIMEOUT",
          reason: `Tiempo máximo de riego alcanzado (${formatMaxIrrigationLabel(
            input.maxIrrigationSeconds
          )}). Cronómetro finalizado y válvula cerrada.`,
        },
      };
    }

    if (input.nextMoisture >= input.maxMoisture) {
      return {
        previousStatus,
        status,
        nextValveOpen: false,
        setCooldownUntil: null,
        waterUsedLiters,
        event: {
          action: "VALVE_CLOSE_AUTO",
          reason:
            input.nextMoisture > input.maxMoisture
              ? `Sobre-riego detectado (${input.nextMoisture}% > máx ${input.maxMoisture}%). Riego detenido automáticamente.`
              : `Umbral máximo de humedad alcanzado (${input.nextMoisture}% >= máx ${input.maxMoisture}%). Riego detenido automáticamente.`,
        },
      };
    }

    return {
      previousStatus,
      status,
      nextValveOpen: true,
      setCooldownUntil: "KEEP",
      waterUsedLiters,
      event: null,
    };
  }

  // 3) Válvula cerrada: abrir automáticamente si autoMode activo y déficit hídrico (sin cooldown activo)
  const inCooldown =
    !input.bypassCooldown &&
    input.cooldownUntil !== null &&
    input.cooldownUntil.getTime() > now.getTime();

  if (input.autoMode && status === "INSUFICIENTE" && !inCooldown) {
    return {
      previousStatus,
      status,
      nextValveOpen: true,
      setCooldownUntil: null,
      waterUsedLiters: 0,
      event: {
        action: "VALVE_OPEN_AUTO",
        reason: `Riego insuficiente detectado (${input.nextMoisture}% < mín ${input.minMoisture}%). Válvula abierta automáticamente.`,
      },
    };
  }

  if (status === "SOBRE_RIEGO" && previousStatus !== "SOBRE_RIEGO") {
    return {
      previousStatus,
      status,
      nextValveOpen: false,
      setCooldownUntil: "KEEP",
      waterUsedLiters: 0,
      event: {
        action: "ALERT_OVER_IRRIGATION",
        reason: `Nivel de sobre-riego detectado (${input.nextMoisture}% > máx ${input.maxMoisture}%). Válvula permanece cerrada.`,
      },
    };
  }

  if (
    !input.autoMode &&
    status === "INSUFICIENTE" &&
    previousStatus !== "INSUFICIENTE"
  ) {
    return {
      previousStatus,
      status,
      nextValveOpen: false,
      setCooldownUntil: "KEEP",
      waterUsedLiters: 0,
      event: {
        action: "ALERT_UNDER_IRRIGATION",
        reason: `Alerta de riego insuficiente (${input.nextMoisture}% < mín ${input.minMoisture}%) en modo manual.`,
      },
    };
  }

  return {
    previousStatus,
    status,
    nextValveOpen: false,
    setCooldownUntil: "KEEP",
    waterUsedLiters: 0,
    event: null,
  };
}
