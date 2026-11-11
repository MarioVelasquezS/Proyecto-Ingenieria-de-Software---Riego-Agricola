"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Droplet,
  Droplets,
  Gauge,
  Loader2,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

const MAX_CAPACITY = 50000; // 50,000 Litros
const CRITICAL_THRESHOLD = 5000; // Corte de protección a 5,000 Litros
const STEP_AMOUNT = 1000; // Incremento/decremento por botón (1,000 L)

export interface WaterTankMonitorProps {
  /** Nivel de agua actual en litros (ej. 24500) */
  currentLevel: number;
  /** ID de la zona o tanque para el endpoint de corte de seguridad */
  zoneId: string;
  /** Muestra u oculta los controles interactivos de simulación (slider y botones +1000L/-1000L) */
  isSimulationMode?: boolean;
  /** Callback opcional para notificar cambios de nivel durante la simulación */
  onLevelChange?: (newLevel: number) => void;
  /** Callback opcional cuando el backend confirma el corte de emergencia */
  onWatchdogTriggered?: () => void;
}

export function WaterTankMonitor({
  currentLevel,
  zoneId,
  isSimulationMode = false,
  onLevelChange,
  onWatchdogTriggered,
}: WaterTankMonitorProps) {
  // Sincroniza el nivel recibido por props y permite ajustarlo en modo simulación
  const [waterLevel, setWaterLevel] = useState<number>(() =>
    Math.min(Math.max(currentLevel, 0), MAX_CAPACITY)
  );

  // Estado de red para la petición de apagado de emergencia
  const [isSendingSignal, setIsSendingSignal] = useState<boolean>(false);
  const [signalStatus, setSignalStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  // Evita disparar múltiples peticiones consecutivas mientras ya está en nivel crítico
  const cutoffSentForZoneRef = useRef<string | null>(null);

  useEffect(() => {
    setWaterLevel(Math.min(Math.max(currentLevel, 0), MAX_CAPACITY));
  }, [currentLevel]);

  const isCritical = waterLevel <= CRITICAL_THRESHOLD;
  const fillPercentage = Math.min(
    Math.max((waterLevel / MAX_CAPACITY) * 100, 0),
    100
  );
  const criticalPercentage = (CRITICAL_THRESHOLD / MAX_CAPACITY) * 100; // 10%

  // Monitorea el nivel de agua y dispara el corte real al backend cuando es <= 5,000 L
  useEffect(() => {
    if (!zoneId) return;

    if (waterLevel > CRITICAL_THRESHOLD) {
      cutoffSentForZoneRef.current = null;
      setSignalStatus("idle");
      setIsSendingSignal(false);
      return;
    }

    // Si ya enviamos la señal para esta zona durante este evento crítico, no repetir
    if (cutoffSentForZoneRef.current === zoneId) {
      return;
    }

    let isCancelled = false;
    cutoffSentForZoneRef.current = zoneId;
    setIsSendingSignal(true);
    setSignalStatus("sending");

    async function triggerEmergencyShutdown() {
      try {
        const response = await fetch(
          `/api/zones/${encodeURIComponent(zoneId)}/watchdog`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "OFF",
              reason: "CRITICAL_WATER_LEVEL",
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!isCancelled) {
          setSignalStatus("sent");
          onWatchdogTriggered?.();
        }
      } catch {
        if (!isCancelled) {
          setSignalStatus("error");
          // Permitir reintento si cambia el nivel
          cutoffSentForZoneRef.current = null;
        }
      } finally {
        if (!isCancelled) {
          setIsSendingSignal(false);
        }
      }
    }

    void triggerEmergencyShutdown();

    return () => {
      isCancelled = true;
    };
  }, [waterLevel, zoneId, onWatchdogTriggered]);

  const updateLevel = (nextValue: number) => {
    const clamped = Math.min(Math.max(nextValue, 0), MAX_CAPACITY);
    setWaterLevel(clamped);
    onLevelChange?.(clamped);
  };

  const handleStep = (delta: number) => {
    updateLevel(waterLevel + delta);
  };

  const formatLiters = (liters: number) =>
    new Intl.NumberFormat("en-US").format(Math.round(liters));

  return (
    <section
      aria-label="Monitor de Tanque de Agua"
      className={`w-full rounded-2xl border bg-white p-6 shadow-sm transition-colors duration-500 ${
        isCritical
          ? "border-red-300 ring-2 ring-red-100"
          : "border-slate-200"
      }`}
    >
      {/* Encabezado y Badge de Estado de Válvulas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 ${
              isCritical
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-sky-50 border-sky-200 text-sky-600"
            }`}
          >
            {isCritical ? (
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            ) : (
              <Droplets className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Reservorio Principal de Riego
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Zona/Tanque: {zoneId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Capacidad máxima: {formatLiters(MAX_CAPACITY)} L · Corte de
              seguridad: {formatLiters(CRITICAL_THRESHOLD)} L
            </p>
          </div>
        </div>

        {/* Indicadores de Estado de Válvulas y Red */}
        <div className="flex flex-col sm:items-end gap-2 self-start sm:self-auto">
          <div
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border shadow-sm transition-all duration-300 ${
              isCritical
                ? "bg-red-600 text-white border-red-700 animate-pulse"
                : "bg-emerald-50 text-emerald-800 border-emerald-300"
            }`}
          >
            {isCritical ? (
              <>
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>VÁLVULAS APAGADAS - Nivel Crítico</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>VÁLVULAS ACTIVAS</span>
              </>
            )}
          </div>

          {/* Estado visual de la petición HTTP al backend */}
          {isSendingSignal && (
            <div
              role="status"
              aria-live="assertive"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shadow-sm"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
              <span>Enviando señal...</span>
            </div>
          )}

          {!isSendingSignal && isCritical && signalStatus === "sent" && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">
              <Radio className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span>Señal de corte confirmada por el servidor</span>
            </div>
          )}

          {!isSendingSignal && isCritical && signalStatus === "error" && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-600 shrink-0" />
              <span>Error de red al enviar señal de corte</span>
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo Principal: Visual del Tanque + Lecturas y Controles */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Columna Izquierda: Visualización Cilíndrica del Tanque */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center gap-3">
            {/* Escala graduada lateral */}
            <div className="flex flex-col justify-between h-64 text-[11px] font-mono font-medium text-slate-400 select-none text-right pr-1">
              <span>50k L</span>
              <span>37.5k L</span>
              <span>25k L</span>
              <span>12.5k L</span>
              <span className="text-red-500 font-bold">5k L</span>
              <span>0 L</span>
            </div>

            {/* Contenedor Vertical del Tanque */}
            <div
              className={`relative w-40 h-64 rounded-3xl border-4 bg-slate-100/80 overflow-hidden shadow-inner transition-colors duration-500 ${
                isCritical
                  ? "border-red-500 shadow-red-100"
                  : "border-sky-300 shadow-sky-100"
              }`}
            >
              {/* Brillo cilíndrico vertical (efecto cristal/metal) */}
              <div className="pointer-events-none absolute inset-y-0 left-3 w-4 bg-gradient-to-r from-white/50 to-transparent z-20" />
              <div className="pointer-events-none absolute inset-y-0 right-2 w-2 bg-gradient-to-l from-black/5 to-transparent z-20" />

              {/* Líneas guía de nivel (25%, 50%, 75%) */}
              {[25, 50, 75].map((mark) => (
                <div
                  key={mark}
                  style={{ bottom: `${mark}%` }}
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-300/70 z-10"
                />
              ))}

              {/* Línea de Corte Crítico (5,000 L = 10%) */}
              <div
                style={{ bottom: `${criticalPercentage}%` }}
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-red-500 z-20 flex items-center justify-end pr-2"
              >
                <span className="-mt-4 bg-red-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow">
                  Mín 10%
                </span>
              </div>

              {/* Nivel de Agua Dinámico */}
              <div
                style={{ height: `${fillPercentage}%` }}
                className={`absolute bottom-0 inset-x-0 transition-all duration-500 ease-out z-10 ${
                  isCritical
                    ? "bg-gradient-to-t from-red-700 via-red-500 to-orange-400"
                    : "bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-400"
                }`}
              >
                {/* Superficie / Menisco del agua */}
                <div
                  className={`w-full h-2.5 opacity-80 ${
                    isCritical ? "bg-orange-200" : "bg-cyan-200"
                  }`}
                />
              </div>

              {/* Etiqueta superpuesta en el centro del tanque */}
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
                <div className="rounded-xl bg-slate-900/75 backdrop-blur-sm px-3 py-1.5 text-center shadow-md border border-white/15">
                  <span className="block text-lg font-extrabold text-white leading-none">
                    {fillPercentage.toFixed(1)}%
                  </span>
                  <span className="block text-[10px] font-medium text-slate-200 mt-0.5">
                    {formatLiters(waterLevel)} L
                  </span>
                </div>
              </div>
            </div>
          </div>

          <span className="mt-2.5 text-xs font-medium text-slate-500 flex items-center gap-1">
            <Droplet
              className={`h-3.5 w-3.5 ${
                isCritical ? "text-red-500" : "text-sky-500"
              }`}
            />
            Vista de nivel en tiempo real
          </span>
        </div>

        {/* Columna Derecha: Métricas, Alerta de Protección y Simulador Condicional */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-5">
          {/* Tarjeta de Lectura Numérica */}
          <div
            className={`rounded-2xl border p-4 transition-colors duration-300 ${
              isCritical
                ? "bg-red-50/70 border-red-200"
                : "bg-slate-50 border-slate-200/80"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Volumen Actual Disponible</span>
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                {fillPercentage.toFixed(1)}% de capacidad
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  isCritical ? "text-red-700" : "text-slate-900"
                }`}
              >
                {formatLiters(waterLevel)} L / {formatLiters(MAX_CAPACITY)} L
              </span>
            </div>

            {/* Barra de progreso horizontal complementaria */}
            <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                style={{ width: `${fillPercentage}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical ? "bg-red-600" : "bg-sky-500"
                }`}
              />
            </div>

            {/* Mensaje contextual de protección */}
            <p
              className={`mt-2.5 text-xs font-medium ${
                isCritical ? "text-red-700" : "text-slate-600"
              }`}
            >
              {isCritical ? (
                <>
                  <strong>Protección hidráulica activada:</strong> El volumen es{" "}
                  igual o menor a {formatLiters(CRITICAL_THRESHOLD)} L. Se ha
                  enviado la orden de cierre (`CRITICAL_WATER_LEVEL`) al
                  endpoint `/api/zones/{zoneId}/watchdog`.
                </>
              ) : (
                <>
                  <strong>Operación normal:</strong> Margen disponible de{" "}
                  <span className="font-semibold text-slate-800">
                    {formatLiters(waterLevel - CRITICAL_THRESHOLD)} L
                  </span>{" "}
                  antes del corte automático de seguridad.
                </>
              )}
            </p>
          </div>

          {/* Controles Interactivos de Simulación (Renderizado Condicional) */}
          {isSimulationMode && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="water-tank-slider"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Simulador de Consumo / Llenado
                  </label>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Modo Simulación
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateLevel(24500)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  title="Restablecer a 24,500 L"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer
                </button>
              </div>

              {/* Control deslizante (Range Input) */}
              <div className="space-y-1.5">
                <input
                  id="water-tank-slider"
                  type="range"
                  min={0}
                  max={MAX_CAPACITY}
                  step={500}
                  value={waterLevel}
                  onChange={(e) => updateLevel(Number(e.target.value))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 ${
                    isCritical ? "accent-red-600" : "accent-sky-600"
                  }`}
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>0 L (0%)</span>
                  <span className="text-red-500 font-semibold">
                    5,000 L (Corte)
                  </span>
                  <span>25,000 L (50%)</span>
                  <span>50,000 L (100%)</span>
                </div>
              </div>

              {/* Botones de ajuste rápido (-1000L / +1000L y presets) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStep(-STEP_AMOUNT)}
                  disabled={waterLevel <= 0 || isSendingSignal}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4 text-red-600" />
                  -1000L
                </button>

                <button
                  type="button"
                  onClick={() => handleStep(STEP_AMOUNT)}
                  disabled={waterLevel >= MAX_CAPACITY || isSendingSignal}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-900 text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 text-sky-700" />
                  +1000L
                </button>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    disabled={isSendingSignal}
                    onClick={() => updateLevel(CRITICAL_THRESHOLD)}
                    className="px-2.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    Probar 5,000 L
                  </button>
                  <button
                    type="button"
                    disabled={isSendingSignal}
                    onClick={() => updateLevel(MAX_CAPACITY)}
                    className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    Llenar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default WaterTankMonitor;
