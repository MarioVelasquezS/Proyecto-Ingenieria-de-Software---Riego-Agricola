export const WEEK_DAYS = [
  { value: 1, short: "L", label: "Lun" },
  { value: 2, short: "M", label: "Mar" },
  { value: 3, short: "X", label: "Mié" },
  { value: 4, short: "J", label: "Jue" },
  { value: 5, short: "V", label: "Vie" },
  { value: 6, short: "S", label: "Sáb" },
  { value: 0, short: "D", label: "Dom" },
] as const;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseDaysOfWeek(raw: string): number[] {
  const unique = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 6) {
      unique.add(n);
    }
  }
  return Array.from(unique);
}

export function serializeDaysOfWeek(days: number[]): string {
  const orderedValues = WEEK_DAYS.map((d) => d.value);
  const valid = new Set(
    days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
  return orderedValues.filter((v) => valid.has(v)).join(",");
}

export function formatLocalTimeHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function isSameLocalMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

export function isScheduleDueNow(
  schedule: {
    enabled: boolean;
    startTime: string;
    daysOfWeek: string;
    lastTriggeredAt: Date | string | null;
  },
  now: Date = new Date()
): boolean {
  if (!schedule.enabled) return false;
  if (schedule.startTime !== formatLocalTimeHHMM(now)) return false;

  const days = parseDaysOfWeek(schedule.daysOfWeek);
  if (!days.includes(now.getDay())) return false;

  if (schedule.lastTriggeredAt) {
    const prev =
      schedule.lastTriggeredAt instanceof Date
        ? schedule.lastTriggeredAt
        : new Date(schedule.lastTriggeredAt);
    if (Number.isFinite(prev.getTime()) && isSameLocalMinute(prev, now)) {
      return false;
    }
  }

  return true;
}

export interface ScheduleValidationPayload {
  label?: string;
  startTime?: string;
  durationSeconds?: number;
  daysOfWeek?: string;
  climateAdjust?: boolean;
  enabled?: boolean;
}

export function validateSchedulePayload(
  body: Record<string, unknown>,
  isCreate: boolean
):
  | { ok: true; data: ScheduleValidationPayload }
  | { ok: false; error: string } {
  const data: ScheduleValidationPayload = {};

  if (isCreate || body.label !== undefined) {
    const rawLabel =
      typeof body.label === "string"
        ? body.label.trim()
        : isCreate
          ? "Riego programado"
          : "";
    const label = rawLabel || (isCreate ? "Riego programado" : "");
    if (label.length < 2 || label.length > 60) {
      return {
        ok: false,
        error: "La etiqueta del horario debe tener entre 2 y 60 caracteres.",
      };
    }
    data.label = label;
  }

  if (isCreate || body.startTime !== undefined) {
    const startTime =
      typeof body.startTime === "string" ? body.startTime.trim() : "";
    if (!TIME_REGEX.test(startTime)) {
      return {
        ok: false,
        error: "La hora programada debe tener formato válido HH:MM (24h).",
      };
    }
    data.startTime = startTime;
  }

  if (isCreate || body.durationSeconds !== undefined) {
    const parsed =
      typeof body.durationSeconds === "number"
        ? body.durationSeconds
        : Number(body.durationSeconds);
    const rounded = Math.round(parsed);
    if (!Number.isFinite(parsed) || rounded < 5 || rounded > 86400) {
      return {
        ok: false,
        error:
          "La duración del horario debe estar entre 5 segundos y 24 horas (86,400 s).",
      };
    }
    data.durationSeconds = rounded;
  }

  if (isCreate || body.daysOfWeek !== undefined) {
    let daysList: number[] = [];
    if (Array.isArray(body.daysOfWeek)) {
      daysList = body.daysOfWeek.map((d) => Number(d));
    } else if (typeof body.daysOfWeek === "string") {
      daysList = parseDaysOfWeek(body.daysOfWeek);
    } else if (isCreate) {
      daysList = [1, 2, 3, 4, 5, 6, 0];
    }

    const serialized = serializeDaysOfWeek(daysList);
    if (!serialized) {
      return {
        ok: false,
        error: "Selecciona al menos un día de la semana para el horario.",
      };
    }
    data.daysOfWeek = serialized;
  }

  if (body.climateAdjust !== undefined) {
    if (typeof body.climateAdjust !== "boolean") {
      return { ok: false, error: "climateAdjust debe ser booleano." };
    }
    data.climateAdjust = body.climateAdjust;
  } else if (isCreate) {
    data.climateAdjust = true;
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return { ok: false, error: "enabled debe ser booleano." };
    }
    data.enabled = body.enabled;
  } else if (isCreate) {
    data.enabled = true;
  }

  return { ok: true, data };
}
