import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Droplets,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyMoistureStatus } from "@/lib/irrigation-engine";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const [totalUsers, adminUsers, zones, totalEvents] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.irrigationZone.findMany({
      select: {
        active: true,
        valveOpen: true,
        currentMoisture: true,
        minMoisture: true,
        maxMoisture: true,
      },
    }),
    prisma.irrigationEvent.count(),
  ]);

  const activeZones = zones.filter((z) => z.active);
  const openValves = activeZones.filter((z) => z.valveOpen).length;
  const alertZones = activeZones.filter(
    (z) =>
      classifyMoistureStatus(z.currentMoisture, z.minMoisture, z.maxMoisture) !==
      "OPTIMO"
  ).length;

  return (
    <AppShell user={currentUser}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Bienvenido, {currentUser.fullName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Resumen general del sistema automático de riego agrícola y
              administración de accesos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/riego"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-agro-700 hover:bg-agro-800 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              Control de Riego
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/parcelas"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold shadow-sm transition-colors"
            >
              Parcelas
            </Link>
            <Link
              href="/usuarios"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold shadow-sm transition-colors"
            >
              Usuarios
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Parcelas Activas
              </span>
              <div className="h-9 w-9 rounded-xl bg-agro-50 text-agro-700 flex items-center justify-center">
                <Sprout className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {activeZones.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {zones.length} registradas en total
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Válvulas Abiertas
              </span>
              <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                <Droplets className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {openValves}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {totalEvents} acciones registradas
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Alertas de Humedad
              </span>
              <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {alertZones}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Fuera de rango óptimo
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Usuarios
              </span>
              <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-3">
              {totalUsers}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {adminUsers} administrador(es)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-agro-800 font-semibold">
              <Sprout className="h-5 w-5" />
              <h2>Control de Riego por Zona</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Monitorea en tiempo real la humedad del suelo por parcela, valida
              condiciones de <strong>riego insuficiente</strong> o{" "}
              <strong>sobre-riego</strong> según la latitud/longitud y clima, y
              controla la apertura y cierre automático de válvulas.
            </p>
            <Link
              href="/riego"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-agro-700 hover:text-agro-800"
            >
              Abrir consola de riego
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-agro-800 font-semibold">
              <Database className="h-5 w-5" />
              <h2>SQLite + Trazabilidad en Base de Datos</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Todas las lecturas climáticas, simulaciones de humedad y
              aperturas/cierres de válvulas se registran en{" "}
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                prisma/riego.db
              </span>{" "}
              con migraciones versionadas para análisis y reportes posteriores.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-agro-600" />
              <span>Tablas creadas y actualizadas mediante Prisma Migrate</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
