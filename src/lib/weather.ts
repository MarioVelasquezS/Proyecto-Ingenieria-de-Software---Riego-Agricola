export type WeatherPreset =
  | "auto"
  | "dry"
  | "temperate"
  | "rainy"
  | "adverse";

export interface WeatherConditions {
  ambientTemp: number;
  airHumidity: number;
  rainProbability: number;
  windSpeedKmh: number;
  forecastRainProb: number;
  source: "CLIMA" | "SIMULACION";
  label: string;
}

export interface AdverseWeatherResult {
  isAdverse: boolean;
  kind: "RAIN" | "WIND" | "HEAT" | "FROST" | null;
  reason: string | null;
}

export interface ScheduleClimateAdjustment {
  action: "RUN" | "SKIP";
  adjustedSeconds: number;
  note: string | null;
}

interface CacheEntry {
  expiresAt: number;
  conditions: WeatherConditions;
}

const WEATHER_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function isWeatherPreset(value: unknown): value is WeatherPreset {
  return (
    value === "auto" ||
    value === "dry" ||
    value === "temperate" ||
    value === "rainy" ||
    value === "adverse"
  );
}

function buildFallbackWeather(
  latitude: number,
  longitude: number,
  preset: WeatherPreset
): WeatherConditions {
  const jitter = () => (Math.random() - 0.5) * 1.6;

  if (preset === "dry") {
    return {
      ambientTemp: Number((33.5 + jitter()).toFixed(1)),
      airHumidity: Number((34 + jitter() * 2).toFixed(1)),
      rainProbability: 5,
      windSpeedKmh: Number((12 + Math.abs(jitter())).toFixed(1)),
      forecastRainProb: 10,
      source: "SIMULACION",
      label: "Seco y caluroso",
    };
  }

  if (preset === "rainy") {
    return {
      ambientTemp: Number((21.5 + jitter()).toFixed(1)),
      airHumidity: Number((88 + jitter()).toFixed(1)),
      rainProbability: 85,
      windSpeedKmh: Number((18 + Math.abs(jitter() * 2)).toFixed(1)),
      forecastRainProb: 90,
      source: "SIMULACION",
      label: "Lluvia intensa",
    };
  }

  if (preset === "adverse") {
    return {
      ambientTemp: Number((40.2 + Math.abs(jitter())).toFixed(1)),
      airHumidity: Number((26 + jitter()).toFixed(1)),
      rainProbability: 45,
      windSpeedKmh: Number((46 + Math.abs(jitter() * 3)).toFixed(1)),
      forecastRainProb: 75,
      source: "SIMULACION",
      label: "Clima adverso (viento/calor extremo)",
    };
  }

  if (preset === "temperate") {
    return {
      ambientTemp: Number((25.0 + jitter()).toFixed(1)),
      airHumidity: Number((62 + jitter() * 2).toFixed(1)),
      rainProbability: 15,
      windSpeedKmh: Number((9 + Math.abs(jitter())).toFixed(1)),
      forecastRainProb: 20,
      source: "SIMULACION",
      label: "Templado estable",
    };
  }

  // Modelo local determinista basado en la latitud/longitud cuando no hay red
  const latFactor = Math.max(0, 1 - Math.abs(latitude) / 60);
  const lonOffset = Math.sin((longitude * Math.PI) / 180) * 1.5;
  const baseTemp = 17 + latFactor * 14 + lonOffset + jitter();
  const baseHumidity = 48 + Math.cos((latitude * Math.PI) / 90) * 20 + jitter();

  return {
    ambientTemp: Number(Math.max(8, Math.min(38, baseTemp)).toFixed(1)),
    airHumidity: Number(Math.max(25, Math.min(95, baseHumidity)).toFixed(1)),
    rainProbability: 10,
    windSpeedKmh: 10.5,
    forecastRainProb: 15,
    source: "SIMULACION",
    label: "Clima local estimado",
  };
}

export async function getWeatherForCoordinates(
  latitude: number,
  longitude: number,
  preset: WeatherPreset = "auto"
): Promise<WeatherConditions> {
  if (preset !== "auto") {
    return buildFallbackWeather(latitude, longitude, preset);
  }

  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.conditions;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      latitude
    )}&longitude=${encodeURIComponent(
      longitude
    )}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&hourly=precipitation_probability&forecast_days=1`;

    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return buildFallbackWeather(latitude, longitude, "auto");
    }

    const payload = await response.json();
    const current = payload?.current;
    if (
      typeof current?.temperature_2m !== "number" ||
      typeof current?.relative_humidity_2m !== "number"
    ) {
      return buildFallbackWeather(latitude, longitude, "auto");
    }

    const precipitation =
      typeof current.precipitation === "number" ? current.precipitation : 0;
    const windSpeed =
      typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : 10;
    const rainProbNow =
      precipitation > 0.2 ? 80 : precipitation > 0 ? 45 : 10;

    let forecastRainProb = rainProbNow;
    const hourlyProbs: unknown = payload?.hourly?.precipitation_probability;
    if (Array.isArray(hourlyProbs) && hourlyProbs.length > 0) {
      const currentHour = new Date().getHours();
      const windowProbs = hourlyProbs
        .slice(currentHour, currentHour + 6)
        .filter((v): v is number => typeof v === "number");
      if (windowProbs.length > 0) {
        forecastRainProb = Math.max(...windowProbs);
      }
    }

    const conditions: WeatherConditions = {
      ambientTemp: Number(current.temperature_2m.toFixed(1)),
      airHumidity: Number(current.relative_humidity_2m.toFixed(1)),
      rainProbability: rainProbNow,
      windSpeedKmh: Number(windSpeed.toFixed(1)),
      forecastRainProb: Number(forecastRainProb.toFixed(0)),
      source: "CLIMA",
      label: precipitation > 0.2 ? "Lluvia detectada" : "Open-Meteo en vivo",
    };

    WEATHER_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      conditions,
    });

    return conditions;
  } catch {
    return buildFallbackWeather(latitude, longitude, "auto");
  }
}

/**
 * Evalúa si existen condiciones climáticas adversas que obligan a suspender el riego:
 * lluvia activa (con bloqueo habilitado), vientos fuertes (>= 35 km/h), calor extremo (>= 39°C) o helada (<= 4°C).
 */
export function evaluateAdverseWeather(
  weather: WeatherConditions,
  rainSensorActive: boolean,
  rainBlockEnabled: boolean
): AdverseWeatherResult {
  if (rainBlockEnabled && (rainSensorActive || weather.rainProbability >= 60)) {
    return {
      isAdverse: true,
      kind: "RAIN",
      reason:
        "Sensores detectaron lluvia activa. Riego suspendido automáticamente (Bloqueo por lluvia).",
    };
  }

  if (weather.windSpeedKmh >= 35) {
    return {
      isAdverse: true,
      kind: "WIND",
      reason: `Condición climática adversa: viento fuerte (${weather.windSpeedKmh} km/h). Riego suspendido para evitar pérdida de agua.`,
    };
  }

  if (weather.ambientTemp >= 39) {
    return {
      isAdverse: true,
      kind: "HEAT",
      reason: `Condición climática adversa: calor extremo (${weather.ambientTemp}°C). Riego por aspersión suspendido para evitar evaporación excesiva.`,
    };
  }

  if (weather.ambientTemp <= 4) {
    return {
      isAdverse: true,
      kind: "FROST",
      reason: `Condición climática adversa: riesgo de helada (${weather.ambientTemp}°C). Riego suspendido.`,
    };
  }

  return { isAdverse: false, kind: null, reason: null };
}

/**
 * Ajusta automáticamente la duración de un horario programado según el pronóstico
 * de lluvia y la temperatura ambiente.
 */
export function computeClimateAdjustedScheduleDuration(
  baseSeconds: number,
  maxZoneSeconds: number,
  weather: WeatherConditions
): ScheduleClimateAdjustment {
  const cappedBase = Math.min(baseSeconds, maxZoneSeconds);

  if (weather.forecastRainProb >= 70) {
    return {
      action: "SKIP",
      adjustedSeconds: 0,
      note: `Suspendido automáticamente por alto pronóstico de lluvia (${weather.forecastRainProb}%).`,
    };
  }

  let multiplier = 1;
  const reasons: string[] = [];

  if (weather.forecastRainProb >= 45) {
    multiplier *= 0.5;
    reasons.push(`-50% por pronóstico de lluvia (${weather.forecastRainProb}%)`);
  }

  if (weather.ambientTemp >= 30) {
    multiplier *= 1.25;
    reasons.push(`+25% por temperatura alta (${weather.ambientTemp}°C)`);
  } else if (weather.ambientTemp <= 18) {
    multiplier *= 0.75;
    reasons.push(`-25% por temperatura fresca (${weather.ambientTemp}°C)`);
  }

  const adjustedSeconds = Math.max(
    5,
    Math.min(maxZoneSeconds, Math.round(cappedBase * multiplier))
  );

  return {
    action: "RUN",
    adjustedSeconds,
    note:
      reasons.length > 0
        ? `Ajuste climático aplicado (${reasons.join(", ")}).`
        : null,
  };
}
