"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sprout,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import {
  classifyMoistureStatus,
  formatMaxIrrigationLabel,
  MOISTURE_STATUS_LABELS,
} from "@/lib/irrigation-engine";
import type { UserRole } from "@/lib/roles";
import type { ZoneRecord } from "@/lib/zone-types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ZoneModal } from "./ZoneModal";

interface ZonesManagerProps {
  initialZones: ZoneRecord[];
  currentUserRole: UserRole;
}

export function ZonesManager({
  initialZones,
  currentUserRole,
}: ZonesManagerProps) {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneRecord[]>(initialZones);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingZone, setEditingZone] = useState<ZoneRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ZoneRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();
    return zones.filter((z) => {
      if (statusFilter === "ACTIVE" && !z.active) return false;
      if (statusFilter === "INACTIVE" && z.active) return false;
      if (!query) return true;
      return (
        z.name.toLowerCase().includes(query) ||
        z.cropType.toLowerCase().includes(query)
      );
    });
  }, [zones, search, statusFilter]);

  function openCreateModal() {
    setModalMode("create");
    setEditingZone(null);
    setModalOpen(true);
  }

  function openEditModal(zone: ZoneRecord) {
    setModalMode("edit");
    setEditingZone(zone);
    setModalOpen(true);
  }

  function handleSaved(savedZone: ZoneRecord, mode: "create" | "edit") {
    if (mode === "create") {
      setZones((prev) => [...prev, savedZone]);
      setFeedback({
        type: "success",
        text: `Parcela "${savedZone.name}" creada correctamente.`,
      });
    } else {
      setZones((prev) =>
        prev.map((item) => (item.id === savedZone.id ? savedZone : item))
      );
      setFeedback({
        type: "success",
        text: `Parcela "${savedZone.name}" actualizada correctamente.`,
      });
    }
    setModalOpen(false);
    router.refresh();
  }

  async function handleToggleActive(zone: ZoneRecord) {
    setFeedback(null);
    setTogglingId(zone.id);
    try {
      const response = await fetch(`/api/zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !zone.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo cambiar el estado de la parcela.",
        });
        return;
      }

      const updated = data.zone as ZoneRecord;
      setZones((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setFeedback({
        type: "success",
        text: `Parcela "${updated.name}" ${
          updated.active ? "activada" : "desactivada"
        }.`,
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al actualizar la parcela.",
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/zones/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo eliminar la parcela.",
        });
        setDeleteTarget(null);
        return;
      }

      setZones((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setFeedback({
        type: "success",
        text: `Parcela "${deleteTarget.name}" eliminada.`,
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al eliminar la parcela.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleLoadSampleZones() {
    setSeeding(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/zones/seed", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudieron cargar las parcelas de ejemplo.",
        });
        return;
      }
      if (Array.isArray(data.zones)) setZones(data.zones);
      setFeedback({
        type: "success",
        text: "Parcelas de ejemplo cargadas en SQLite.",
      });
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestión de Parcelas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Crea, edita o elimina zonas de cultivo, sus coordenadas (latitud y
            longitud) y umbrales óptimos de humedad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/riego"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold shadow-sm transition-colors"
          >
            Control de Riego
            <ArrowRight className="h-4 w-4" />
          </Link>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-agro-700 hover:bg-agro-800 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva parcela
            </button>
          )}
        </div>
      </div>

      {/* Mensaje de estado */}
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

      {/* Filtros */}
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
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agro-600"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="INACTIVE">Inactivas</option>
        </select>
      </div>

      {/* Tabla o estado vacío */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-800">
            No hay parcelas registradas
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Crea una parcela con sus coordenadas geográficas y umbrales de
            humedad, o carga las parcelas agrícolas de ejemplo.
          </p>
          {isAdmin && (
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={seeding}
                onClick={handleLoadSampleZones}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700"
              >
                {seeding ? "Cargando..." : "Cargar parcelas de ejemplo"}
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-agro-700 hover:bg-agro-800 text-white text-sm font-semibold"
              >
                Nueva parcela
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-3">Parcela / Cultivo</th>
                  <th className="py-3 px-2.5">Coordenadas</th>
                  <th className="py-3 px-2.5">Rango</th>
                  <th className="py-3 px-2.5">Humedad</th>
                  <th className="py-3 px-2.5">T. Máx.</th>
                  <th className="py-3 px-2.5">Caudal</th>
                  <th className="py-3 px-2.5">Estado</th>
                  {isAdmin && (
                    <th className="py-3 px-3 text-right">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredZones.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 8 : 7}
                      className="py-10 px-5 text-center text-slate-500"
                    >
                      No se encontraron parcelas con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredZones.map((zone) => {
                    const moistureStatus = classifyMoistureStatus(
                      zone.currentMoisture,
                      zone.minMoisture,
                      zone.maxMoisture
                    );

                    return (
                      <tr
                        key={zone.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-agro-50 text-agro-700 flex items-center justify-center shrink-0">
                              <Sprout className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 text-sm">
                                {zone.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {zone.cropType} · {zone.areaHectares}{" "}
                                {zone.areaHectares === 1
                                  ? "hectárea"
                                  : "hectáreas"}{" "}
                                · {zone.autoMode ? "Automático" : "Manual"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <div className="leading-snug">
                              <div>Lat: {zone.latitude.toFixed(4)}°</div>
                              <div>Lon: {zone.longitude.toFixed(4)}°</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2.5 text-xs text-slate-700 whitespace-nowrap">
                          {zone.minMoisture}–{zone.maxMoisture}%
                        </td>

                        <td className="py-3 px-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 text-xs">
                            {zone.currentMoisture.toFixed(1)}%
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              moistureStatus === "OPTIMO"
                                ? "bg-agro-50 text-agro-700"
                                : moistureStatus === "INSUFICIENTE"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-red-50 text-red-700"
                            }`}
                          >
                            {MOISTURE_STATUS_LABELS[moistureStatus]}
                          </span>
                        </td>

                        <td className="py-3 px-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {formatMaxIrrigationLabel(zone.maxIrrigationSeconds)}
                        </td>

                        <td className="py-3 px-2.5 text-xs text-slate-600 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-800">
                            {zone.flowRateLpm} L/min
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {zone.sprinklerCount} aspersor
                            {zone.sprinklerCount === 1 ? "" : "es"}
                          </div>
                        </td>

                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {isAdmin ? (
                            <button
                              type="button"
                              disabled={togglingId === zone.id}
                              onClick={() => handleToggleActive(zone)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                zone.active
                                  ? "bg-agro-50 text-agro-700 border border-agro-200 hover:bg-agro-100"
                                  : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                              }`}
                            >
                              {zone.active ? (
                                <ToggleRight className="h-3.5 w-3.5" />
                              ) : (
                                <ToggleLeft className="h-3.5 w-3.5" />
                              )}
                              {zone.active ? "Activa" : "Inactiva"}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                zone.active
                                  ? "bg-agro-50 text-agro-700 border border-agro-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {zone.active ? "Activa" : "Inactiva"}
                            </span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(zone)}
                                title="Editar parcela"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-agro-700 hover:bg-agro-50 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(zone)}
                                title="Eliminar parcela"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ZoneModal
        open={modalOpen}
        mode={modalMode}
        initialZone={editingZone}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar parcela"
        description={`¿Seguro que deseas eliminar "${deleteTarget?.name ?? ""}" junto con su historial de lecturas y eventos?`}
        confirmLabel="Eliminar"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

