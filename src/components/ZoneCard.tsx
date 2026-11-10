"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  Droplets,
  Gauge,
  MapPin,
  Play,
  Power,
  Sprout,
  Thermometer,
  Timer,
  Waves,
  Wind,
} from "lucide-react";
import {
  classifyMoistureStatus,
  formatDuration,
  formatMaxIrrigationLabel,
  getElapsedIrrigationSeconds,
  MOISTURE_STATUS_LABELS,
} from "@/lib/irrigation-engine";
import type { ZoneRecord } from "@/lib/zone-types";
import { MoistureSparkline } from "./MoistureSparkline";

interface ZoneCardProps {
  zone: ZoneRecord;
  nowMs: number;
  rainSensorActive: boolean;
  busy: boolean;
  onSimulateTick: (zoneId: number, forcedMoisture?: number) => void;
  onToggleValve: (zone: ZoneRecord) => void;
  onToggleAutoMode: (zone: ZoneRecord) => void;
  onToggleRainBlock: (zone: ZoneRecord) => void;
  onOpenSchedules: (zone: ZoneRecord) => void;
}

export function ZoneCard({
  zone,
  nowMs,
  rainSensorActive,
  busy,
  onSimulateTick,
  onToggleValve,
  onToggleAutoMode,
  onToggleRainBlock,
  onOpenSchedules,
}: ZoneCardProps) {
  const status = classifyMoistureStatus(
    zone.currentMoisture,
    zone.minMoisture,
    zone.maxMoisture
  );
  const midpointMoisture = Number(
    ((zone.minMoisture + zone.maxMoisture) / 2).toFixed(1)
  );
  const latestReading = zone.readings[zone.readings.length - 1] ?? null;

  const effectiveMaxSeconds =
    zone.activeMaxSeconds ?? zone.maxIrrigationSeconds;
  const elapsedSeconds =
    zone.valveOpen && zone.irrigationStartedAt
      ? getElapsedIrrigationSeconds(zone.irrigationStartedAt, nowMs)
      : 0;
  const remainingSeconds = Math.max(0, effectiveMaxSeconds - elapsedSeconds);
  const timerPercent =
    effectiveMaxSeconds > 0
      ? Math.min(100, (elapsedSeconds / effectiveMaxSeconds) * 100)
      : 0;

  const perSprinklerFlow =
    zone.sprinklerCount > 0
      ? (zone.flowRateLpm / zone.sprinklerCount).toFixed(1)
      : "0.0";
  const appliedLiters = ((elapsedSeconds * zone.flowRateLpm) / 60).toFixed(1);
  const rainDetectedHere =
    rainSensorActive || (latestReading?.rainProbability ?? 0) >= 60;
  const isBlockedByRain = rainDetectedHere && zone.rainBlockEnabled;
  const hasHighWind = (latestReading?.windSpeedKmh ?? 0) >= 35;
  const hasExtremeTemp =
    latestReading !== null &&
    (latestReading.ambientTemp >= 39 || latestReading.ambientTemp <= 4);
  const isSuspendedByWeather = isBlockedByRain || hasHighWind || hasExtremeTemp;
  const activeSchedules = zone.schedules.filter((s) => s.enabled);

  const statusConfig = {
    OPTIMO: {
      badge: "bg-agro-50 text-agro-800 border-agro-200",
      bar: "bg-agro-600",
      icon: CheckCircle2,
    },
    INSUFICIENTE: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      bar: "bg-amber-500",
      icon: AlertTriangle,
    },
    SOBRE_RIEGO: {
      badge: "bg-red-50 text-red-700 border-red-200",
      bar: "bg-red-600",
      icon: Waves,
    },
  }[status];

  const StatusIcon = statusConfig.icon;
  const clampedMoisture = Math.max(0, Math.min(100, zone.currentMoisture));

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-opacity ${zone.active ? "border-slate-200" : "border-slate-200 opacity-70"
        }`}
    >
      {/* Cabecera */}
      <div className="p-5 pb-3.5 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${statusConfig.badge}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {MOISTURE_STATUS_LABELS[status]}
            </span>
            {!zone.active && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Inactiva
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenSchedules(zone)}
            title="Gestionar horario programado de riego"
            aria-label={`Gestionar horario programado de ${zone.name}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${activeSchedules.length > 0
              ? "bg-agro-50 text-agro-800 border-agro-200 hover:bg-agro-100"
              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>
              {activeSchedules.length > 0
                ? activeSchedules[0].startTime
                : "Horario"}
            </span>
          </button>
        </div>

        <h3 className="font-bold text-slate-900 text-base leading-snug">
          {zone.name}
        </h3>

        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Sprout className="h-3.5 w-3.5 text-agro-600 shrink-0" />
            <span>
              <strong className="font-medium text-slate-700">
                {zone.cropType}
              </strong>{" "}
              · {zone.areaHectares}{" "}
              {zone.areaHectares === 1 ? "hectárea" : "hectáreas"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 text-slate-600 whitespace-nowrap overflow-x-auto">
            <MapPin className="h-3.5 w-3.5 text-agro-700 shrink-0" />
            <span className="font-mono">
              Latitud: {zone.latitude.toFixed(4)}°
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">
              Longitud: {zone.longitude.toFixed(4)}°
            </span>
          </div>
        </div>
      </div>

      {/* Cuerpo principal */}
      <div className="p-5 space-y-4 flex-1">
        {/* Medidor visual de humedad con banda óptima */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" />
              Humedad del suelo
            </span>
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {zone.currentMoisture.toFixed(1)}%
            </span>
          </div>

          <div className="relative h-3.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80">
            {/* Banda óptima configurada */}
            <div
              className="absolute top-0 bottom-0 bg-agro-200/70"
              style={{
                left: `${zone.minMoisture}%`,
                width: `${Math.max(4, zone.maxMoisture - zone.minMoisture)}%`,
              }}
              title={`Rango óptimo: ${zone.minMoisture}% - ${zone.maxMoisture}%`}
            />
            {/* Nivel actual */}
            <div
              className={`relative h-full transition-all duration-300 rounded-full opacity-90 ${statusConfig.bar}`}
              style={{ width: `${clampedMoisture}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Mín (activa): {zone.minMoisture}%</span>
            <span>Máx (detiene): {zone.maxMoisture}%</span>
          </div>
        </div>

        {/* Gráfico tendencia */}
        <MoistureSparkline
          readings={zone.readings}
          minMoisture={zone.minMoisture}
          maxMoisture={zone.maxMoisture}
        />

        {/* Condiciones climáticas asociadas a lat/lon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-700" title="Temperatura ambiente">
            <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span>
              {latestReading ? `${latestReading.ambientTemp}°C` : "--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700" title="Humedad relativa del aire">
            <Droplets className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            <span>
              {latestReading ? `${latestReading.airHumidity}% HR` : "--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700" title="Velocidad del viento">
            <Wind className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span>
              {latestReading ? `${latestReading.windSpeedKmh} km/h` : "--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700" title="Pronóstico de lluvia">
            <CloudRain className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>
              {latestReading ? `${latestReading.forecastRainProb}% pron.` : "--"}
            </span>
          </div>
        </div>

        {/* Estado de válvula, aspersores y automatización */}
        <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${zone.valveOpen
                  ? "bg-sky-500 animate-pulse"
                  : isBlockedByRain
                    ? "bg-indigo-500"
                    : "bg-slate-300"
                  }`}
              />
              <span className="text-sm font-semibold text-slate-800">
                {zone.valveOpen ? "Válvula ABIERTA" : "Válvula CERRADA"}
              </span>
            </div>

            <button
              type="button"
              disabled={
                busy || !zone.active || (!zone.valveOpen && isSuspendedByWeather)
              }
              onClick={() => onToggleValve(zone)}
              title={
                !zone.valveOpen && isSuspendedByWeather
                  ? "Suspendido por condiciones climáticas adversas"
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${zone.valveOpen
                ? "bg-slate-800 hover:bg-slate-900 text-white"
                : "bg-sky-600 hover:bg-sky-700 text-white"
                }`}
            >
              <Power className="h-3.5 w-3.5" />
              {zone.valveOpen ? "Cerrar manual" : "Abrir manual"}
            </button>
          </div>

          {/* Caudal de agua y aspersores */}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 border border-slate-100">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Droplets className="h-3.5 w-3.5 text-sky-600" />
              {zone.sprinklerCount} aspersor
              {zone.sprinklerCount === 1 ? "" : "es"} · {zone.flowRateLpm}{" "}
              L/min
            </span>
            <span
              suppressHydrationWarning
              className="font-mono text-[11px] text-slate-500"
            >
              {zone.valveOpen
                ? `${appliedLiters} L aplicados`
                : `${perSprinklerFlow} L/min c/u`}
            </span>
          </div>

          {isSuspendedByWeather && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs text-indigo-800 font-medium">
              <CloudRain className="h-3.5 w-3.5 shrink-0" />
              <span>
                {isBlockedByRain
                  ? "Riego apagado: lluvia detectada por sensores"
                  : hasHighWind
                    ? `Riego suspendido: viento fuerte (${latestReading?.windSpeedKmh} km/h)`
                    : `Riego suspendido: temperatura extrema (${latestReading?.ambientTemp}°C)`}
              </span>
            </div>
          )}

          {/* Cronómetro de tiempo de riego */}
          <div
            className={`rounded-lg px-3 py-2 border text-xs space-y-1.5 ${zone.valveOpen
              ? "bg-sky-50/70 border-sky-200"
              : "bg-slate-50 border-slate-200/70"
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Timer
                  className={`h-3.5 w-3.5 ${zone.valveOpen ? "text-sky-600" : "text-slate-400"
                    }`}
                />
                {zone.valveOpen ? "Tiempo regando" : "Cronómetro"}
              </span>
              <span
                suppressHydrationWarning
                className={`font-mono font-semibold tabular-nums ${zone.valveOpen
                  ? timerPercent >= 90
                    ? "text-red-700"
                    : "text-sky-800"
                  : "text-slate-500"
                  }`}
              >
                {zone.valveOpen
                  ? `${formatDuration(elapsedSeconds)} / ${formatDuration(
                    effectiveMaxSeconds
                  )}`
                  : `00:00 · Máx ${formatMaxIrrigationLabel(
                    zone.maxIrrigationSeconds
                  )}`}
              </span>
            </div>

            {zone.valveOpen && (
              <>
                <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${timerPercent >= 90
                      ? "bg-red-500"
                      : timerPercent >= 75
                        ? "bg-amber-500"
                        : "bg-sky-600"
                      }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
                <div
                  suppressHydrationWarning
                  className="flex justify-between text-[11px] text-slate-500"
                >
                  <span>Restante: {formatDuration(remainingSeconds)}</span>
                  <span>
                    Límite: {formatMaxIrrigationLabel(effectiveMaxSeconds)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Switches independientes bajo demanda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
            <button
              type="button"
              role="switch"
              aria-checked={zone.autoMode}
              disabled={busy || !zone.active}
              onClick={() => onToggleAutoMode(zone)}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              <span>Riego automático</span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${zone.autoMode ? "bg-agro-600" : "bg-slate-300"
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${zone.autoMode ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={zone.rainBlockEnabled}
              disabled={busy || !zone.active}
              onClick={() => onToggleRainBlock(zone)}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              <span>Apagar si llueve</span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${zone.rainBlockEnabled ? "bg-indigo-600" : "bg-slate-300"
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${zone.rainBlockEnabled
                    ? "translate-x-4 ml-0.5"
                    : "translate-x-0.5"
                    }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Botones de simulación rápida por parcela */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">
            Simulación puntual en esta zona:
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              disabled={busy || !zone.active}
              onClick={() => onSimulateTick(zone.id)}
              title="Simular siguiente ciclo natural"
              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-agro-50 hover:bg-agro-100 text-agro-800 border border-agro-200 text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              Ciclo
            </button>
            <button
              type="button"
              disabled={busy || !zone.active}
              onClick={() =>
                onSimulateTick(zone.id, Math.max(10, zone.minMoisture - 12))
              }
              title="Probar validación de riego insuficiente"
              className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              Sequía
            </button>
            <button
              type="button"
              disabled={busy || !zone.active}
              onClick={() => onSimulateTick(zone.id, midpointMoisture)}
              title="Probar humedad en nivel óptimo"
              className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              Óptimo
            </button>
            <button
              type="button"
              disabled={busy || !zone.active}
              onClick={() =>
                onSimulateTick(zone.id, Math.min(95, zone.maxMoisture + 12))
              }
              title="Probar validación de sobre-riego"
              className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              Exceso
            </button>
          </div>
        </div>
      </div>

      {/* Pie con marca temporal y modo */}
      <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span suppressHydrationWarning className="inline-flex items-center gap-1">
          <Droplets className="h-3.5 w-3.5 text-agro-600" />
          Lectura:{" "}
          {new Date(zone.lastReadingAt).toLocaleTimeString("es-HN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          {zone.autoMode ? "Modo Automático" : "Modo Manual"}
        </span>
      </div>
    </article>
  );
}

