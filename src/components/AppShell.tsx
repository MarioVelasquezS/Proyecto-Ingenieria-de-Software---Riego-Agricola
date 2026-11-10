"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Droplets,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export interface ShellUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  active: boolean;
}

interface AppShellProps {
  user: ShellUser;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Panel General", icon: LayoutDashboard },
  { href: "/riego", label: "Control de Riego", icon: Sprout },
  { href: "/parcelas", label: "Gestión de Parcelas", icon: MapPin },
  { href: "/usuarios", label: "Gestión de Usuarios", icon: Users },
];

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Barra móvil */}
      <header className="lg:hidden bg-agro-900 text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-agro-700 flex items-center justify-center">
            <Droplets className="h-5 w-5 text-agro-200" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Riego Agrícola</p>
            <p className="text-xs text-agro-200">Control y Usuarios</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Abrir menú"
          className="p-2 rounded-lg hover:bg-agro-800 transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } lg:flex lg:flex-col lg:w-56 lg:shrink-0 bg-agro-900 text-white border-r border-agro-800`}
      >
        <div className="hidden lg:flex items-center gap-3 px-5 py-6 border-b border-agro-800/80">
          <div className="h-10 w-10 rounded-xl bg-agro-700/90 flex items-center justify-center shadow-inner">
            <Droplets className="h-6 w-6 text-agro-200" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-tight">
              Riego Agrícola
            </h1>
            <p className="text-xs text-agro-300">Sistema Administrativo</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-agro-700 text-white shadow-sm"
                    : "text-agro-100/80 hover:bg-agro-800/70 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-agro-800/80 bg-agro-950/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-agro-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.fullName}
              </p>
              <p className="text-xs text-agro-300 truncate">
                @{user.username} · {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-agro-800/80 hover:bg-agro-700 text-agro-100 transition-colors disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

