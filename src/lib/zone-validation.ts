export interface ZoneValidationError {
  ok: false;
  error: string;
}

export interface ZoneCreateData {
  name: string;
  cropType: string;
  areaHectares: number;
  latitude: number;
  longitude: number;
  minMoisture: number;
  maxMoisture: number;
  currentMoisture: number;
  flowRateLpm: number;
  sprinklerCount: number;
  maxIrrigationSeconds: number;
  autoMode: boolean;
  rainBlockEnabled: boolean;
  active: boolean;
}

export type ZoneUpdateData = Partial<ZoneCreateData> & {
  valveOpen?: boolean;
};

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function validateRanges(params: {
  latitude?: number;
  longitude?: number;
  areaHectares?: number;
  flowRateLpm?: number;
  sprinklerCount?: number;
  maxIrrigationSeconds?: number;
  minMoisture: number;
  maxMoisture: number;
  currentMoisture?: number;
}): string | null {
  if (
    params.latitude !== undefined &&
    (params.latitude < -90 || params.latitude > 90)
  ) {
    return "La latitud debe estar entre -90 y 90 grados.";
  }

  if (
    params.longitude !== undefined &&
    (params.longitude < -180 || params.longitude > 180)
  ) {
    return "La longitud debe estar entre -180 y 180 grados.";
  }

  if (
    params.areaHectares !== undefined &&
    (params.areaHectares <= 0 || params.areaHectares > 10000)
  ) {
    return "El área de la parcela debe ser mayor que 0 y menor o igual a 10,000 ha.";
  }

  if (
    params.flowRateLpm !== undefined &&
    (params.flowRateLpm <= 0 || params.flowRateLpm > 5000)
  ) {
    return "El caudal de agua debe ser mayor que 0 y hasta 5,000 L/min.";
  }

  if (
    params.sprinklerCount !== undefined &&
    (!Number.isInteger(params.sprinklerCount) ||
      params.sprinklerCount < 1 ||
      params.sprinklerCount > 1000)
  ) {
    return "La cantidad de aspersores debe ser un entero entre 1 y 1,000.";
  }

  if (
    params.maxIrrigationSeconds !== undefined &&
    (!Number.isInteger(params.maxIrrigationSeconds) ||
      params.maxIrrigationSeconds < 5 ||
      params.maxIrrigationSeconds > 86400)
  ) {
    return "El tiempo máximo de riego debe estar entre 5 segundos y 24 horas (86,400 s).";
  }

  if (params.minMoisture < 5 || params.minMoisture > 90) {
    return "La humedad mínima óptima debe estar entre 5% y 90%.";
  }

  if (params.maxMoisture < 10 || params.maxMoisture > 95) {
    return "La humedad máxima óptima debe estar entre 10% y 95%.";
  }

  if (params.minMoisture + 5 > params.maxMoisture) {
    return "La humedad máxima debe ser al menos 5% mayor que la mínima.";
  }

  if (
    params.currentMoisture !== undefined &&
    (params.currentMoisture < 0 || params.currentMoisture > 100)
  ) {
    return "La humedad actual debe estar entre 0% y 100%.";
  }

  return null;
}

export function validateCreateZone(
  body: Record<string, unknown>
): { ok: true; data: ZoneCreateData } | ZoneValidationError {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const cropType =
    typeof body.cropType === "string" ? body.cropType.trim() : "";

  if (name.length < 2 || name.length > 80) {
    return {
      ok: false,
      error: "El nombre de la parcela debe tener entre 2 y 80 caracteres.",
    };
  }

  if (cropType.length < 2 || cropType.length > 50) {
    return {
      ok: false,
      error: "El tipo de cultivo debe tener entre 2 y 50 caracteres.",
    };
  }

  const latitude = parseFiniteNumber(body.latitude);
  const longitude = parseFiniteNumber(body.longitude);
  const areaHectares =
    body.areaHectares === undefined ? 1 : parseFiniteNumber(body.areaHectares);
  const minMoisture =
    body.minMoisture === undefined ? 35 : parseFiniteNumber(body.minMoisture);
  const maxMoisture =
    body.maxMoisture === undefined ? 70 : parseFiniteNumber(body.maxMoisture);
  const currentMoisture =
    body.currentMoisture === undefined
      ? 50
      : parseFiniteNumber(body.currentMoisture);
  const flowRateLpm =
    body.flowRateLpm === undefined ? 25 : parseFiniteNumber(body.flowRateLpm);
  const sprinklerCount =
    body.sprinklerCount === undefined
      ? 4
      : parseFiniteNumber(body.sprinklerCount);
  const maxIrrigationSeconds =
    body.maxIrrigationSeconds === undefined
      ? 1800
      : parseFiniteNumber(body.maxIrrigationSeconds);

  if (
    latitude === null ||
    longitude === null ||
    areaHectares === null ||
    minMoisture === null ||
    maxMoisture === null ||
    currentMoisture === null ||
    flowRateLpm === null ||
    sprinklerCount === null ||
    maxIrrigationSeconds === null
  ) {
    return {
      ok: false,
      error: "Verifica que los valores numéricos de la parcela sean válidos.",
    };
  }

  const roundedMaxSeconds = Math.round(maxIrrigationSeconds);
  const roundedSprinklers = Math.round(sprinklerCount);

  const rangeError = validateRanges({
    latitude,
    longitude,
    areaHectares,
    flowRateLpm,
    sprinklerCount: roundedSprinklers,
    maxIrrigationSeconds: roundedMaxSeconds,
    minMoisture,
    maxMoisture,
    currentMoisture,
  });

  if (rangeError) {
    return { ok: false, error: rangeError };
  }

  return {
    ok: true,
    data: {
      name,
      cropType,
      areaHectares: Number(areaHectares.toFixed(2)),
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      minMoisture: Number(minMoisture.toFixed(1)),
      maxMoisture: Number(maxMoisture.toFixed(1)),
      currentMoisture: Number(currentMoisture.toFixed(1)),
      flowRateLpm: Number(flowRateLpm.toFixed(1)),
      sprinklerCount: roundedSprinklers,
      maxIrrigationSeconds: roundedMaxSeconds,
      autoMode: body.autoMode === undefined ? true : Boolean(body.autoMode),
      rainBlockEnabled:
        body.rainBlockEnabled === undefined
          ? true
          : Boolean(body.rainBlockEnabled),
      active: body.active === undefined ? true : Boolean(body.active),
    },
  };
}

export function validateUpdateZone(
  body: Record<string, unknown>,
  existingBounds: { minMoisture: number; maxMoisture: number }
): { ok: true; data: ZoneUpdateData } | ZoneValidationError {
  const data: ZoneUpdateData = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return {
        ok: false,
        error: "El nombre de la parcela debe tener entre 2 y 80 caracteres.",
      };
    }
    data.name = name;
  }

  if (body.cropType !== undefined) {
    const cropType =
      typeof body.cropType === "string" ? body.cropType.trim() : "";
    if (cropType.length < 2 || cropType.length > 50) {
      return {
        ok: false,
        error: "El tipo de cultivo debe tener entre 2 y 50 caracteres.",
      };
    }
    data.cropType = cropType;
  }

  const numericFields = [
    "latitude",
    "longitude",
    "areaHectares",
    "minMoisture",
    "maxMoisture",
    "currentMoisture",
    "flowRateLpm",
    "sprinklerCount",
    "maxIrrigationSeconds",
  ] as const;

  for (const field of numericFields) {
    if (body[field] !== undefined) {
      const parsed = parseFiniteNumber(body[field]);
      if (parsed === null) {
        return {
          ok: false,
          error: `El campo ${field} debe ser un número válido.`,
        };
      }
      data[field] = parsed;
    }
  }

  if (body.autoMode !== undefined) {
    if (typeof body.autoMode !== "boolean") {
      return { ok: false, error: "autoMode debe ser booleano." };
    }
    data.autoMode = body.autoMode;
  }

  if (body.rainBlockEnabled !== undefined) {
    if (typeof body.rainBlockEnabled !== "boolean") {
      return { ok: false, error: "rainBlockEnabled debe ser booleano." };
    }
    data.rainBlockEnabled = body.rainBlockEnabled;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return { ok: false, error: "active debe ser booleano." };
    }
    data.active = body.active;
  }

  if (body.valveOpen !== undefined) {
    if (typeof body.valveOpen !== "boolean") {
      return { ok: false, error: "valveOpen debe ser booleano." };
    }
    data.valveOpen = body.valveOpen;
  }

  const minMoisture = data.minMoisture ?? existingBounds.minMoisture;
  const maxMoisture = data.maxMoisture ?? existingBounds.maxMoisture;

  if (data.maxIrrigationSeconds !== undefined) {
    data.maxIrrigationSeconds = Math.round(data.maxIrrigationSeconds);
  }
  if (data.sprinklerCount !== undefined) {
    data.sprinklerCount = Math.round(data.sprinklerCount);
  }

  const rangeError = validateRanges({
    latitude: data.latitude,
    longitude: data.longitude,
    areaHectares: data.areaHectares,
    flowRateLpm: data.flowRateLpm,
    sprinklerCount: data.sprinklerCount,
    maxIrrigationSeconds: data.maxIrrigationSeconds,
    minMoisture,
    maxMoisture,
    currentMoisture: data.currentMoisture,
  });

  if (rangeError) {
    return { ok: false, error: rangeError };
  }

  if (data.latitude !== undefined) {
    data.latitude = Number(data.latitude.toFixed(6));
  }
  if (data.longitude !== undefined) {
    data.longitude = Number(data.longitude.toFixed(6));
  }

  return { ok: true, data };
}

