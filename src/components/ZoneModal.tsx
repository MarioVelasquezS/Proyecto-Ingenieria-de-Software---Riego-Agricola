"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Droplets, MapPin, Timer, X } from "lucide-react";
import type { ZoneRecord } from "@/lib/zone-types";

interface ZoneModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialZone: ZoneRecord | null;
  onClose: () => void;
  onSaved: (zone: ZoneRecord, mode: "create" | "edit") => void;
}

const LOCATION_PRESETS = [
  { label: "Tegucigalpa / Francisco Morazán", lat: "14.0818", lon: "-87.2068" },
  { label: "Valle de Comayagua", lat: "14.4556", lon: "-87.6431" },
  { label: "Valle de Sula / San Pedro Sula", lat: "15.4975", lon: "-87.9822" },
  { label: "Zamorano / Yeguare", lat: "14.0094", lon: "-87.0019" },
];

export function ZoneModal({
  open,
  mode,
  initialZone,
  onClose,
  onSaved,
}: ZoneModalProps) {
  const [name, setName] = useState("");
  const [cropType, setCropType] = useState("");
  const [areaHectares, setAreaHectares] = useState("1.5");
  const [latitude, setLatitude] = useState("14.0818");
  const [longitude, setLongitude] = useState("-87.2068");
  const [minMoisture, setMinMoisture] = useState("35");
  const [maxMoisture, setMaxMoisture] = useState("70");
  const [currentMoisture, setCurrentMoisture] = useState("50");
  const [flowRateLpm, setFlowRateLpm] = useState("25");
  const [sprinklerCount, setSprinklerCount] = useState("4");
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "seconds">(
    "minutes"
  );
  const [autoMode, setAutoMode] = useState(true);
  const [rainBlockEnabled, setRainBlockEnabled] = useState(true);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (mode === "edit" && initialZone) {
      setName(initialZone.name);
      setCropType(initialZone.cropType);
      setAreaHectares(String(initialZone.areaHectares));
      setLatitude(String(initialZone.latitude));
      setLongitude(String(initialZone.longitude));
      setMinMoisture(String(initialZone.minMoisture));
      setMaxMoisture(String(initialZone.maxMoisture));
      setCurrentMoisture(String(initialZone.currentMoisture));
      setFlowRateLpm(String(initialZone.flowRateLpm));
      setSprinklerCount(String(initialZone.sprinklerCount));
      if (
        initialZone.maxIrrigationSeconds >= 60 &&
        initialZone.maxIrrigationSeconds % 60 === 0
      ) {
        setDurationValue(String(initialZone.maxIrrigationSeconds / 60));
        setDurationUnit("minutes");
      } else {
        setDurationValue(String(initialZone.maxIrrigationSeconds));
        setDurationUnit("seconds");
      }
      setAutoMode(initialZone.autoMode);
      setRainBlockEnabled(initialZone.rainBlockEnabled);
      setActive(initialZone.active);
    } else {
      setName("");
      setCropType("");
      setAreaHectares("1.5");
      setLatitude("14.0818");
      setLongitude("-87.2068");
      setMinMoisture("35");
      setMaxMoisture("70");
      setCurrentMoisture("48");
      setFlowRateLpm("25");
      setSprinklerCount("4");
      setDurationValue("30");
      setDurationUnit("minutes");
      setAutoMode(true);
      setRainBlockEnabled(true);
      setActive(true);
    }
  }, [open, mode, initialZone]);

  if (!open) return null;

  const parsedFlow = Number(flowRateLpm);
  const parsedSprinklers = Number(sprinklerCount);
  const flowPerSprinkler =
    Number.isFinite(parsedFlow) &&
    Number.isFinite(parsedSprinklers) &&
    parsedSprinklers > 0
      ? (parsedFlow / parsedSprinklers).toFixed(1)
      : "0.0";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const endpoint =
        mode === "create" ? "/api/zones" : `/api/zones/${initialZone?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const maxIrrigationSeconds = Math.round(
        Number(durationValue) * (durationUnit === "minutes" ? 60 : 1)
      );

      const payload: Record<string, unknown> = {
        name,
        cropType,
        areaHectares: Number(areaHectares),
        latitude: Number(latitude),
        longitude: Number(longitude),
        minMoisture: Number(minMoisture),
        maxMoisture: Number(maxMoisture),
        flowRateLpm: Number(flowRateLpm),
        sprinklerCount: Number(sprinklerCount),
        maxIrrigationSeconds,
        autoMode,
        rainBlockEnabled,
        active,
      };

      if (mode === "create") {
        payload.currentMoisture = Number(currentMoisture);
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No se pudo guardar la parcela.");
        return;
      }

      onSaved(data.zone as ZoneRecord, mode);
    } catch {
      setError("Error de conexión al guardar la parcela.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-modal-title"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2
              id="zone-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {mode === "create" ? "Nueva Parcela de Riego" : "Configurar Parcela"}
            </h2>
            <p className="text-xs text-slate-500">
              Define ubicación geográfica, cultivo y umbrales óptimos de humedad.
            </p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="zone-name"
                className="block text-sm font-medium text-slate-700"
              >
                Nombre de parcela / zona *
              </label>
              <input
                id="zone-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Parcela Este - Frijol"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="zone-crop"
                className="block text-sm font-medium text-slate-700"
              >
                Cultivo *
              </label>
              <input
                id="zone-crop"
                type="text"
                required
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                placeholder="Ej. Maíz, Tomate, Café"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
            </div>
          </div>

          {/* Ubicación Geográfica (Latitud y Longitud configurable) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <MapPin className="h-4 w-4 text-agro-700" />
                Coordenadas Geográficas (para clima)
              </span>
              <select
                aria-label="Cargar ubicación de ejemplo"
                defaultValue=""
                onChange={(e) => {
                  const chosen = LOCATION_PRESETS.find(
                    (p) => p.label === e.target.value
                  );
                  if (chosen) {
                    setLatitude(chosen.lat);
                    setLongitude(chosen.lon);
                  }
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                <option value="">Ubicaciones rápidas...</option>
                {LOCATION_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="zone-lat"
                  className="block text-xs font-medium text-slate-600"
                >
                  Latitud (-90 a 90) *
                </label>
                <input
                  id="zone-lat"
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="zone-lon"
                  className="block text-xs font-medium text-slate-600"
                >
                  Longitud (-180 a 180) *
                </label>
                <input
                  id="zone-lon"
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="zone-min"
                className="block text-sm font-medium text-slate-700"
              >
                Umbral mín (%) *
              </label>
              <input
                id="zone-min"
                type="number"
                step="0.5"
                min={5}
                max={90}
                required
                value={minMoisture}
                onChange={(e) => setMinMoisture(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
              <span className="text-[11px] text-slate-400">Activa riego</span>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="zone-max"
                className="block text-sm font-medium text-slate-700"
              >
                Umbral máx (%) *
              </label>
              <input
                id="zone-max"
                type="number"
                step="0.5"
                min={10}
                max={95}
                required
                value={maxMoisture}
                onChange={(e) => setMaxMoisture(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
              <span className="text-[11px] text-slate-400">Detiene riego</span>
            </div>

            {mode === "create" ? (
              <div className="space-y-1">
                <label
                  htmlFor="zone-current"
                  className="block text-sm font-medium text-slate-700"
                >
                  Humedad inicial (%) *
                </label>
                <input
                  id="zone-current"
                  type="number"
                  step="0.5"
                  min={0}
                  max={100}
                  required
                  value={currentMoisture}
                  onChange={(e) => setCurrentMoisture(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label
                  htmlFor="zone-area-edit"
                  className="block text-sm font-medium text-slate-700"
                >
                  Área (hectáreas) *
                </label>
                <input
                  id="zone-area-edit"
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={10000}
                  required
                  value={areaHectares}
                  onChange={(e) => setAreaHectares(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>
            )}
          </div>

          {mode === "create" && (
            <div className="space-y-1">
              <label
                htmlFor="zone-area"
                className="block text-sm font-medium text-slate-700"
              >
                Área (hectáreas) *
              </label>
              <input
                id="zone-area"
                type="number"
                step="0.1"
                min={0.1}
                max={10000}
                required
                value={areaHectares}
                onChange={(e) => setAreaHectares(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
            </div>
          )}

          {/* Caudal de agua y aspersores */}
          <div className="rounded-xl border border-slate-200 bg-sky-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Droplets className="h-4 w-4 text-sky-600" />
                Caudal de Agua y Aspersores
              </span>
              <span className="text-[11px] font-mono text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                {flowPerSprinkler} L/min por aspersor
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="zone-sprinklers"
                  className="block text-xs font-medium text-slate-600"
                >
                  Cantidad de aspersores *
                </label>
                <input
                  id="zone-sprinklers"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  required
                  value={sprinklerCount}
                  onChange={(e) => setSprinklerCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="zone-flow"
                  className="block text-xs font-medium text-slate-600"
                >
                  Caudal de agua total (L/min) *
                </label>
                <input
                  id="zone-flow"
                  type="number"
                  step="0.5"
                  min={1}
                  max={5000}
                  required
                  value={flowRateLpm}
                  onChange={(e) => setFlowRateLpm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="zone-max-time"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800"
              >
                <Timer className="h-4 w-4 text-agro-700" />
                Tiempo Máximo de Riego (Watchdog) *
              </label>
              <span className="text-[11px] text-slate-500">
                Detiene el riego al finalizar el cronómetro
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                id="zone-max-time"
                type="number"
                min={durationUnit === "seconds" ? 5 : 1}
                max={durationUnit === "seconds" ? 86400 : 1440}
                step={1}
                required
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
              <select
                aria-label="Unidad de tiempo máximo"
                value={durationUnit}
                onChange={(e) =>
                  setDurationUnit(e.target.value as "minutes" | "seconds")
                }
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              >
                <option value="minutes">Minutos</option>
                <option value="seconds">Segundos</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600"
              />
              Control automático de riego
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rainBlockEnabled}
                onChange={(e) => setRainBlockEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600"
              />
              Bloqueo por lluvia
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600"
              />
              Parcela activa en monitoreo
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-agro-700 hover:bg-agro-800 text-white shadow-sm transition-colors disabled:opacity-60"
            >
              {saving
                ? "Guardando..."
                : mode === "create"
                  ? "Registrar parcela"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

