"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/roles";

export interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialUser: UserRecord | null;
  currentUserId: number;
  currentUserRole: UserRole;
  onClose: () => void;
  onSaved: (user: UserRecord, mode: "create" | "edit") => void;
}

export function UserModal({
  open,
  mode,
  initialUser,
  currentUserId,
  currentUserRole,
  onClose,
  onSaved,
}: UserModalProps) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("OPERADOR");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditingSelf = mode === "edit" && initialUser?.id === currentUserId;
  const isAdmin = currentUserRole === "ADMIN";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPassword("");
    setShowPassword(false);

    if (mode === "edit" && initialUser) {
      setUsername(initialUser.username);
      setFullName(initialUser.fullName);
      setEmail(initialUser.email ?? "");
      setRole(initialUser.role);
      setActive(initialUser.active);
    } else {
      setUsername("");
      setFullName("");
      setEmail("");
      setRole("OPERADOR");
      setActive(true);
    }
  }, [open, mode, initialUser]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const endpoint =
        mode === "create" ? "/api/users" : `/api/users/${initialUser?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const payload: Record<string, unknown> = {
        fullName,
        email,
      };

      if (isAdmin) {
        payload.username = username;
        payload.role = role;
        payload.active = active;
      }

      if (mode === "create" || password.length > 0) {
        payload.password = password;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No se pudo guardar el usuario.");
        return;
      }

      onSaved(data.user as UserRecord, mode);
    } catch {
      setError("Error de conexión al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2
              id="user-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {mode === "create" ? "Nuevo Usuario" : "Editar Usuario"}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === "create"
                ? "Registra una nueva cuenta de acceso al sistema."
                : `Actualizando cuenta @${initialUser?.username}`}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="modal-username"
                className="block text-sm font-medium text-slate-700"
              >
                Usuario *
              </label>
              <input
                id="modal-username"
                type="text"
                required
                disabled={!isAdmin}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. juan.perez"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="modal-role"
                className="block text-sm font-medium text-slate-700"
              >
                Rol *
              </label>
              <select
                id="modal-role"
                value={role}
                disabled={!isAdmin || isEditingSelf}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agro-600 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="modal-fullName"
              className="block text-sm font-medium text-slate-700"
            >
              Nombre completo *
            </label>
            <input
              id="modal-fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. María López"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="modal-email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo electrónico (opcional)
            </label>
            <input
              id="modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="modal-password"
              className="block text-sm font-medium text-slate-700"
            >
              {mode === "create"
                ? "Contraseña *"
                : "Nueva contraseña (opcional)"}
            </label>
            <div className="relative">
              <input
                id="modal-password"
                type={showPassword ? "text" : "password"}
                required={mode === "create"}
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "create"
                    ? "Mínimo 4 caracteres"
                    : "Déjalo vacío para mantener la actual"
                }
                className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Alternar visibilidad"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                disabled={isEditingSelf}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-agro-700 focus:ring-agro-600 disabled:opacity-50"
              />
              <span className="text-sm text-slate-700">
                Usuario activo
                {isEditingSelf && (
                  <span className="text-xs text-slate-400 ml-1">
                    (no puedes desactivar tu sesión actual)
                  </span>
                )}
              </span>
            </label>
          )}

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
                  ? "Crear usuario"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
