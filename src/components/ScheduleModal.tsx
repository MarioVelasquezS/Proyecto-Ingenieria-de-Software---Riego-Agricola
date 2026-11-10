"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Clock,
  CloudSun,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatMaxIrrigationLabel } from "@/lib/irrigation-engine";
import {
  parseDaysOfWeek,
  serializeDaysOfWeek,
  WEEK_DAYS,
} from "@/lib/schedule-utils";
import type { ScheduleRecord, ZoneRecord } from "@/lib/zone-types";

interface ScheduleModalProps {
  zone: ZoneRecord | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

export function ScheduleModal({
  zone,
  onClose,
  onChanged,
}: ScheduleModalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("Riego programado");
  const [startTime, setStartTime] = useState("06:00");
  const [durationValue, setDurationValue] = useState("15");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "seconds">(
    "minutes"
  );
  const [selectedDays, setSelectedDays] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 0,
  ]);
  const [climateAdjust, setClimateAdjust] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setLabel("Riego programado");
    setStartTime("06:00");
    setDurationValue("15");
    setDurationUnit("minutes");
    setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
    setClimateAdjust(true);
    setEnabled(true);
    setError(null);
  }

  useEffect(() => {
    if (zone) {
      resetForm();
    }
  }, [zone?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!zone) return null;

  function loadForEdit(schedule: ScheduleRecord) {
    setEditingId(schedule.id);
    setLabel(schedule.label);
    setStartTime(schedule.startTime);
    if (
      schedule.durationSeconds >= 60 &&
      schedule.durationSeconds % 60 === 0
    ) {
      setDurationValue(String(schedule.durationSeconds / 60));
      setDurationUnit("minutes");
    } else {
      setDurationValue(String(schedule.durationSeconds));
      setDurationUnit("seconds");
    }
    setSelectedDays(parseDaysOfWeek(schedule.daysOfWeek));
    setClimateAdjust(schedule.climateAdjust);
    setEnabled(schedule.enabled);
    setError(null);
  }

  function toggleDay(dayValue: number) {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!zone) return;
    setError(null);
    setSaving(true);

    try {
      const durationSeconds = Math.round(
        Number(durationValue) * (durationUnit === "minutes" ? 60 : 1)
      );

      const payload = {
        label,
        startTime,
        durationSeconds,
        daysOfWeek: selectedDays,
        climateAdjust,
        enabled,
      };

      const endpoint =
        editingId !== null
          ? `/api/schedules/${editingId}`
          : `/api/zones/${zone.id}/schedules`;
      const method = editingId !== null ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No se pudo guardar el horario.");
        return;
      }

      resetForm();
      await onChanged();
    } catch {
      setError("Error de conexión al guardar el horario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(schedule: ScheduleRecord) {
    setBusyId(schedule.id);
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "No se pudo actualizar el horario.");
        return;
      }
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(scheduleId: number) {
    setBusyId(scheduleId);
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "No se pudo eliminar el horario.");
        return;
      }
      if (editingId === scheduleId) {
        resetForm();
      }
      await onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-agro-100 text-agro-800 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="schedule-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                Horario Programado — {zone.name}
              </h2>
              <p className="text-xs text-slate-500">
                Límite de seguridad de la parcela:{" "}
                {formatMaxIrrigationLabel(zone.maxIrrigationSeconds)} ·
                Umbral máx: {zone.maxMoisture}%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lista de horarios configurados */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Horarios configurados ({zone.schedules.length})
            </h3>

            {zone.schedules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                Esta parcela aún no tiene horarios programados. Agrega uno
                abajo.
              </div>
            ) : (
              <div className="space-y-2">
                {zone.schedules.map((sch) => {
                  const days = parseDaysOfWeek(sch.daysOfWeek);
                  return (
                    <div
                      key={sch.id}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        sch.enabled
                          ? "bg-white border-slate-200"
                          : "bg-slate-50 border-slate-200 opacity-70"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-base font-bold text-slate-900">
                            {sch.startTime}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">
                            {sch.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-medium">
                            {formatMaxIrrigationLabel(sch.durationSeconds)}
                          </span>
                          {sch.climateAdjust && (
                            <span
                              title="Ajusta duración o suspende según pronóstico de lluvia y temperatura"
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-agro-50 text-agro-800 border border-agro-200 font-medium"
                            >
                              <CloudSun className="h-3 w-3" />
                              Ajuste climático
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {WEEK_DAYS.map((day) => {
                            const activeDay = days.includes(day.value);
                            return (
                              <span
                                key={day.value}
                                className={`h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                  activeDay
                                    ? "bg-agro-700 text-white"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {day.short}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={sch.enabled}
                          disabled={busyId === sch.id}
                          onClick={() => void handleToggleEnabled(sch)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            sch.enabled
                              ? "bg-agro-50 text-agro-800 border-agro-200 hover:bg-agro-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {sch.enabled ? "Activo" : "Pausado"}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadForEdit(sch)}
                          title="Editar horario"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-agro-700 hover:bg-agro-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === sch.id}
                          onClick={() => void handleDelete(sch.id)}
                          title="Eliminar horario"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulario para agregar / editar horario */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-agro-700" />
                {editingId !== null
                  ? "Editar horario seleccionado"
                  : "Agregar nuevo horario"}
              </h3>
              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label
                  htmlFor="schedule-label"
                  className="block text-xs font-medium text-slate-700"
                >
                  Etiqueta *
                </label>
                <input
                  id="schedule-label"
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej. Riego matutino"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="schedule-time"
                  className="block text-xs font-medium text-slate-700"
                >
                  Hora de inicio *
                </label>
                <input
                  id="schedule-time"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label
                  htmlFor="schedule-duration"
                  className="block text-xs font-medium text-slate-700"
                >
                  Duración del riego *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    id="schedule-duration"
                    type="number"
                    min={durationUnit === "seconds" ? 5 : 1}
                    max={durationUnit === "seconds" ? 86400 : 1440}
                    required
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                  />
                  <select
                    aria-label="Unidad de duración"
                    value={durationUnit}
                    onChange={(e) =>
                      setDurationUnit(e.target.value as "minutes" | "seconds")
                    }
                    className="px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                  >
                    <option value="minutes">Min</option>
                    <option value="seconds">Seg</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Días activos *
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6, 0])}
                      className="text-[11px] text-agro-700 hover:underline font-medium"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                      className="text-[11px] text-agro-700 hover:underline font-medium"
                    >
                      Lun-Vie
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {WEEK_DAYS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        title={day.label}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? "bg-agro-700 text-white border-agro-700"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={climateAdjust}
                  onChange={(e) => setClimateAdjust(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600"
                />
                Ajuste automático según pronóstico de lluvia y temperatura
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600"
                />
                Horario habilitado
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-200/70 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving || serializeDaysOfWeek(selectedDays) === ""}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-agro-700 hover:bg-agro-800 text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {saving
                  ? "Guardando..."
                  : editingId !== null
                    ? "Actualizar horario"
                    : "Guardar horario"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

