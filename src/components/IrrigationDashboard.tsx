"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Droplets,
  History,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sprout,
} from "lucide-react";
import {
  classifyMoistureStatus,
  getElapsedIrrigationSeconds,
} from "@/lib/irrigation-engine";
import { isScheduleDueNow } from "@/lib/schedule-utils";
import type { WeatherPreset } from "@/lib/weather";
import type { IrrigationEventRecord, ZoneRecord } from "@/lib/zone-types";
import { ScheduleModal } from "./ScheduleModal";
import { WaterTankMonitor } from "./WaterTankMonitor";
import { ZoneCard } from "./ZoneCard";

interface IrrigationDashboardProps {
  initialZones: ZoneRecord[];
  initialEvents: IrrigationEventRecord[];
  initialRainSensorActive: boolean;
}

const ACTION_BADGE_MAP: Record<
  string,
  { label: string; className: string }
> = {
  VALVE_OPEN_AUTO: {
    label: "Apertura automática",
    className: "bg-sky-50 text-sky-800 border-sky-200",
  },
  VALVE_OPEN_SCHEDULE: {
    label: "Inicio programado",
    className: "bg-teal-50 text-teal-800 border-teal-200",
  },
  VALVE_CLOSE_AUTO: {
    label: "Cierre automático",
    className: "bg-agro-50 text-agro-800 border-agro-200",
  },
  VALVE_CLOSE_TIMEOUT: {
    label: "Fin por cronómetro",
    className: "bg-rose-50 text-rose-800 border-rose-200",
  },
  VALVE_CLOSE_CRITICAL_TANK: {
    label: "Corte tanque crítico",
    className: "bg-red-50 text-red-800 border-red-200",
  },
  VALVE_CLOSE_RAIN: {
    label: "Apagado por lluvia",
    className: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  VALVE_SUSPENDED_WEATHER: {
    label: "Suspensión climática",
    className: "bg-orange-50 text-orange-800 border-orange-200",
  },
  VALVE_OPEN_MANUAL: {
    label: "Apertura manual",
    className: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  VALVE_CLOSE_MANUAL: {
    label: "Cierre manual",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  ALERT_UNDER_IRRIGATION: {
    label: "Alerta déficit",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ALERT_OVER_IRRIGATION: {
    label: "Alerta sobre-riego",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  MODE_CHANGE: {
    label: "Cambio de modo",
    className: "bg-purple-50 text-purple-800 border-purple-200",
  },
};

export function IrrigationDashboard({
  initialZones,
  initialEvents,
  initialRainSensorActive,
}: IrrigationDashboardProps) {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneRecord[]>(initialZones);
  const [events, setEvents] = useState<IrrigationEventRecord[]>(initialEvents);
  const [rainSensorActive, setRainSensorActive] = useState(
    initialRainSensorActive
  );
  const [togglingRain, setTogglingRain] = useState(false);

  const [isLive, setIsLive] = useState(false);
  const [weatherPreset, setWeatherPreset] = useState<WeatherPreset>("auto");
  const [simulating, setSimulating] = useState(false);
  const simulatingRef = useRef(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [tankWaterLevel, setTankWaterLevel] = useState<number>(24500);
  const watchdogTriggeredRef = useRef<Set<string>>(new Set());
  const scheduleCheckRef = useRef<string>("");
  const [scheduleZoneId, setScheduleZoneId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<
    "ALL" | "ALERTS" | "OPEN_VALVES" | "INACTIVE"
  >("ALL");
  const [eventZoneFilter, setEventZoneFilter] = useState<string>("ALL");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const refreshState = useCallback(async () => {
    const response = await fetch("/api/zones", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.zones)) setZones(data.zones);
    if (Array.isArray(data.events)) setEvents(data.events);
    if (typeof data.rainSensorActive === "boolean") {
      setRainSensorActive(data.rainSensorActive);
    }
  }, []);

  const runSimulation = useCallback(
    async (zoneId: number | "all" = "all", forcedMoisture?: number) => {
      if (simulatingRef.current) return;
      simulatingRef.current = true;
      setSimulating(true);

      try {
        const response = await fetch("/api/zones/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zoneId,
            weatherPreset,
            ...(forcedMoisture !== undefined ? { forcedMoisture } : {}),
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFeedback({
            type: "error",
            text: data.error || "No se pudo ejecutar la simulación.",
          });
          return;
        }

        if (Array.isArray(data.zones)) setZones(data.zones);
        if (Array.isArray(data.events)) setEvents(data.events);
        if (typeof data.rainSensorActive === "boolean") {
          setRainSensorActive(data.rainSensorActive);
        }
      } catch {
        setFeedback({
          type: "error",
          text: "Error de conexión durante el monitoreo.",
        });
      } finally {
        simulatingRef.current = false;
        setSimulating(false);
      }
    },
    [weatherPreset]
  );

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      void runSimulation("all");
    }, 4000);
    return () => clearInterval(timer);
  }, [isLive, runSimulation]);

  const hasOpenValves = useMemo(
    () => zones.some((z) => z.valveOpen && z.irrigationStartedAt),
    [zones]
  );

  // Reloj de 1 segundo para actualizar en vivo el cronómetro de riego
  useEffect(() => {
    if (!hasOpenValves) return;
    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [hasOpenValves]);

  // Cierre automático exacto cuando algún cronómetro alcanza su tiempo máximo
  useEffect(() => {
    for (const zone of zones) {
      if (!zone.valveOpen || !zone.irrigationStartedAt) continue;
      const effectiveLimitSeconds =
        zone.activeMaxSeconds ?? zone.maxIrrigationSeconds;
      const elapsed = getElapsedIrrigationSeconds(
        zone.irrigationStartedAt,
        nowMs
      );
      if (elapsed < effectiveLimitSeconds) continue;

      const triggerKey = `${zone.id}:${zone.irrigationStartedAt}`;
      if (watchdogTriggeredRef.current.has(triggerKey)) continue;
      watchdogTriggeredRef.current.add(triggerKey);

      void (async () => {
        try {
          const response = await fetch(`/api/zones/${zone.id}/watchdog`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "OFF",
              reason: "MAX_TIME_REACHED",
            }),
          });
          if (!response.ok) return;
          const data = await response.json().catch(() => ({}));
          if (Array.isArray(data.zones)) setZones(data.zones);
          if (Array.isArray(data.events)) setEvents(data.events);
          if (data.closed) {
            setFeedback({
              type: "success",
              text: `Tiempo máximo alcanzado en "${zone.name}". La válvula se cerró automáticamente.`,
            });
            router.refresh();
          }
        } catch {
          watchdogTriggeredRef.current.delete(triggerKey);
        }
      })();
    }
  }, [zones, nowMs, router]);

  // Evaluación automática de horarios programados (con ajuste y suspensión climática)
  const checkDueSchedules = useCallback(async () => {
    const response = await fetch("/api/zones/check-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weatherPreset }),
    });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data.zones)) setZones(data.zones);
    if (Array.isArray(data.events)) setEvents(data.events);
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      setFeedback({
        type: data.triggeredCount > 0 ? "success" : "error",
        text: data.messages[0],
      });
      router.refresh();
    }
  }, [weatherPreset, router]);

  useEffect(() => {
    const checkNow = () => {
      const now = new Date();
      const dueZone = zones.find(
        (z) =>
          z.active && z.schedules.some((sch) => isScheduleDueNow(sch, now))
      );
      if (!dueZone) return;

      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      if (scheduleCheckRef.current === minuteKey) return;
      scheduleCheckRef.current = minuteKey;

      void checkDueSchedules();
    };

    checkNow();
    const timer = setInterval(checkNow, 4000);
    return () => clearInterval(timer);
  }, [zones, checkDueSchedules]);

  const stats = useMemo(() => {
    const activeZones = zones.filter((z) => z.active);
    const openValves = activeZones.filter((z) => z.valveOpen);
    const totalFlowLpm = openValves.reduce((sum, z) => sum + z.flowRateLpm, 0);
    let optimalCount = 0;
    let underCount = 0;
    let overCount = 0;

    for (const z of activeZones) {
      const status = classifyMoistureStatus(
        z.currentMoisture,
        z.minMoisture,
        z.maxMoisture
      );
      if (status === "OPTIMO") optimalCount++;
      else if (status === "INSUFICIENTE") underCount++;
      else overCount++;
    }

    return {
      activeCount: activeZones.length,
      openValvesCount: openValves.length,
      totalFlowLpm: Number(totalFlowLpm.toFixed(1)),
      optimalCount,
      alertCount: underCount + overCount,
      underCount,
      overCount,
    };
  }, [zones]);

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();
    return zones.filter((z) => {
      if (zoneFilter === "INACTIVE" && z.active) return false;
      if (zoneFilter !== "INACTIVE" && !z.active) {
        if (zoneFilter !== "ALL") return false;
      }

      if (zoneFilter === "OPEN_VALVES" && !z.valveOpen) return false;
      if (zoneFilter === "ALERTS") {
        const st = classifyMoistureStatus(
          z.currentMoisture,
          z.minMoisture,
          z.maxMoisture
        );
        if (st === "OPTIMO") return false;
      }

      if (!query) return true;
      return (
        z.name.toLowerCase().includes(query) ||
        z.cropType.toLowerCase().includes(query)
      );
    });
  }, [zones, search, zoneFilter]);

  const filteredEvents = useMemo(() => {
    if (eventZoneFilter === "ALL") return events;
    const id = Number(eventZoneFilter);
    return events.filter((e) => e.zoneId === id);
  }, [events, eventZoneFilter]);

  async function handleToggleValve(zone: ZoneRecord) {
    setFeedback(null);
    if (!zone.valveOpen && tankWaterLevel <= 5000) {
      setFeedback({
        type: "error",
        text: "Protección hidráulica activa: el reservorio principal está en nivel crítico (<= 5,000 L). No es posible abrir válvulas.",
      });
      return;
    }
    const response = await fetch(`/api/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valveOpen: !zone.valveOpen }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFeedback({
        type: "error",
        text: data.error || "No se pudo cambiar el estado de la válvula.",
      });
      return;
    }

    await refreshState();
    router.refresh();
  }

  async function handleToggleAutoMode(zone: ZoneRecord) {
    setFeedback(null);
    const response = await fetch(`/api/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoMode: !zone.autoMode }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFeedback({
        type: "error",
        text: data.error || "No se pudo cambiar el control automático.",
      });
      return;
    }

    await refreshState();
    router.refresh();
  }

  async function handleToggleRainBlock(zone: ZoneRecord) {
    setFeedback(null);
    const response = await fetch(`/api/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rainBlockEnabled: !zone.rainBlockEnabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFeedback({
        type: "error",
        text: data.error || "No se pudo cambiar el bloqueo por lluvia.",
      });
      return;
    }

    await refreshState();
    router.refresh();
  }

  async function handleToggleRainSensor() {
    setTogglingRain(true);
    setFeedback(null);
    try {
      const nextActive = !rainSensorActive;
      const response = await fetch("/api/rain-sensor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo actualizar el sensor de lluvia.",
        });
        return;
      }

      setRainSensorActive(Boolean(data.rainSensorActive));
      if (Array.isArray(data.zones)) setZones(data.zones);
      if (Array.isArray(data.events)) setEvents(data.events);
      setFeedback({
        type: "success",
        text: nextActive
          ? `Sensor de lluvia activado. Se apagaron ${data.closedCount ?? 0} riego(s) con bloqueo por lluvia.`
          : "Sensor de lluvia desactivado (clima despejado).",
      });
      router.refresh();
    } finally {
      setTogglingRain(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado y controles de simulación */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Control de Riego por Zona
            </h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-agro-100 text-agro-800 border border-agro-300">
                <span className="h-2 w-2 rounded-full bg-agro-600 animate-ping" />
                EN VIVO (4s)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Monitoreo en tiempo real de humedad del suelo, clima por
            coordenadas y válvulas automáticas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={rainSensorActive}
            disabled={togglingRain}
            onClick={() => void handleToggleRainSensor()}
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-60 ${
              rainSensorActive
                ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
          >
            <CloudRain className="h-4 w-4" />
            <span>
              {rainSensorActive
                ? "Sensor lluvia: Lloviendo"
                : "Sensor lluvia: Despejado"}
            </span>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                rainSensorActive ? "bg-indigo-400" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  rainSensorActive ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          <select
            aria-label="Escenario climático"
            value={weatherPreset}
            onChange={(e) => setWeatherPreset(e.target.value as WeatherPreset)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-agro-600"
          >
            <option value="auto">Clima por coordenadas (GPS)</option>
            <option value="dry">Clima seco y caluroso</option>
            <option value="temperate">Clima templado</option>
            <option value="rainy">Lluvia intensa</option>
            <option value="adverse">Clima adverso (viento/calor extremo)</option>
          </select>

          <button
            type="button"
            onClick={() => setIsLive((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              isLive
                ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
          >
            {isLive ? (
              <>
                <Pause className="h-4 w-4" />
                Pausar monitoreo
              </>
            ) : (
              <>
                <Play className="h-4 w-4 text-agro-700" />
                Monitoreo en vivo
              </>
            )}
          </button>

          <button
            type="button"
            disabled={simulating || stats.activeCount === 0}
            onClick={() => void runSimulation("all")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${simulating ? "animate-spin" : ""}`}
            />
            Simular lectura
          </button>

          <Link
            href="/parcelas"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold shadow-sm transition-colors"
          >
            <MapPin className="h-4 w-4 text-agro-700" />
            Gestionar parcelas
          </Link>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
            feedback.type === "success"
              ? "bg-agro-50 border-agro-200 text-agro-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline opacity-80 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Parcelas activas
            </span>
            <Sprout className="h-4 w-4 text-agro-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.activeCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {zones.length} zonas totales
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Válvulas abiertas
            </span>
            <Droplets className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {stats.openValvesCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Caudal activo: {stats.totalFlowLpm} L/min
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Nivel óptimo
            </span>
            <Activity className="h-4 w-4 text-agro-600" />
          </div>
          <p className="text-2xl font-bold text-agro-700 mt-2">
            {stats.optimalCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Dentro de umbral configurado
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Alertas de validación
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {stats.alertCount}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {stats.underCount} déficit · {stats.overCount} sobre-riego
          </p>
        </div>
      </div>

      {/* Monitor de Tanque de Agua Principal */}
      <WaterTankMonitor
        currentLevel={tankWaterLevel}
        zoneId={zones[0] ? String(zones[0].id) : "1"}
        isSimulationMode={true}
        onLevelChange={setTankWaterLevel}
        onWatchdogTriggered={() => {
          setFeedback({
            type: "error",
            text: "Corte de emergencia activado: el tanque llegó a nivel crítico (<= 5,000 L). Válvulas bloqueadas.",
          });
          void refreshState();
          router.refresh();
        }}
      />

      {/* Filtros de zonas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar parcela por nombre o cultivo..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
          />
        </div>

        <select
          aria-label="Filtrar parcelas"
          value={zoneFilter}
          onChange={(e) =>
            setZoneFilter(
              e.target.value as "ALL" | "ALERTS" | "OPEN_VALVES" | "INACTIVE"
            )
          }
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agro-600"
        >
          <option value="ALL">Todas las parcelas</option>
          <option value="ALERTS">Con alerta (déficit / sobre-riego)</option>
          <option value="OPEN_VALVES">Con válvula abierta</option>
          <option value="INACTIVE">Inactivas</option>
        </select>
      </div>

      {/* Cuadrícula de Parcelas */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-800">
            No hay parcelas registradas para monitorear
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Administra las zonas de cultivo desde la ventana de Gestión de
            Parcelas para comenzar el monitoreo de riego.
          </p>
          <div className="pt-2">
            <Link
              href="/parcelas"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-agro-700 hover:bg-agro-800 text-white text-sm font-semibold"
            >
              Ir a Gestión de Parcelas
            </Link>
          </div>
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Ninguna parcela coincide con los filtros actuales.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredZones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              nowMs={nowMs}
              rainSensorActive={rainSensorActive}
              busy={simulating}
              onSimulateTick={(id, forced) => void runSimulation(id, forced)}
              onToggleValve={(z) => void handleToggleValve(z)}
              onToggleAutoMode={(z) => void handleToggleAutoMode(z)}
              onToggleRainBlock={(z) => void handleToggleRainBlock(z)}
              onOpenSchedules={(z) => setScheduleZoneId(z.id)}
            />
          ))}
        </div>
      )}

      {/* Bitácora en base de datos para análisis y reportes */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-agro-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bitácora de Acciones y Validaciones
              </h2>
              <p className="text-xs text-slate-500">
                Historial persistido en SQLite para auditoría y reportes.
              </p>
            </div>
          </div>

          <select
            aria-label="Filtrar eventos por parcela"
            value={eventZoneFilter}
            onChange={(e) => setEventZoneFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-agro-600"
          >
            <option value="ALL">Todas las parcelas</option>
            {zones.map((z) => (
              <option key={z.id} value={String(z.id)}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">Parcela</th>
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Humedad</th>
                <th className="py-3 px-4">Detalle</th>
                <th className="py-3 px-4">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-4 text-center text-slate-500"
                  >
                    Aún no hay eventos registrados para este filtro.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const badge = ACTION_BADGE_MAP[evt.action] ?? {
                    label: evt.action,
                    className: "bg-slate-100 text-slate-700 border-slate-200",
                  };

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/70">
                      <td
                        suppressHydrationWarning
                        className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono"
                      >
                        {new Date(evt.createdAt).toLocaleTimeString("es-HN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {evt.zoneName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full font-medium border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {evt.moistureAtEvent.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-slate-600 min-w-[260px]">
                        {evt.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {evt.userName ?? "Automático"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ScheduleModal
        zone={zones.find((z) => z.id === scheduleZoneId) ?? null}
        onClose={() => setScheduleZoneId(null)}
        onChanged={async () => {
          scheduleCheckRef.current = "";
          await refreshState();
          await checkDueSchedules();
        }}
      />
    </div>
  );
}
