"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { UserModal, type UserRecord } from "./UserModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

interface UsersManagerProps {
  initialUsers: UserRecord[];
  currentUserId: number;
  currentUserRole: UserRole;
}

export function UsersManager({
  initialUsers,
  currentUserId,
  currentUserRole,
}: UsersManagerProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.active) return false;
      if (statusFilter === "INACTIVE" && u.active) return false;
      if (!query) return true;
      return (
        u.username.toLowerCase().includes(query) ||
        u.fullName.toLowerCase().includes(query) ||
        (u.email ?? "").toLowerCase().includes(query)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  function openCreateModal() {
    setModalMode("create");
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEditModal(user: UserRecord) {
    setModalMode("edit");
    setEditingUser(user);
    setModalOpen(true);
  }

  function handleSaved(savedUser: UserRecord, mode: "create" | "edit") {
    if (mode === "create") {
      setUsers((prev) => [...prev, savedUser]);
      setFeedback({
        type: "success",
        text: `Usuario @${savedUser.username} creado correctamente.`,
      });
    } else {
      setUsers((prev) =>
        prev.map((item) => (item.id === savedUser.id ? savedUser : item))
      );
      setFeedback({
        type: "success",
        text: `Usuario @${savedUser.username} actualizado correctamente.`,
      });
    }
    setModalOpen(false);
    router.refresh();
  }

  async function handleToggleActive(user: UserRecord) {
    setFeedback(null);
    setTogglingId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo cambiar el estado del usuario.",
        });
        return;
      }

      const updated = data.user as UserRecord;
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setFeedback({
        type: "success",
        text: `Usuario @${updated.username} ${
          updated.active ? "activado" : "desactivado"
        }.`,
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al actualizar estado.",
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
      const response = await fetch(`/api/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          type: "error",
          text: data.error || "No se pudo eliminar el usuario.",
        });
        setDeleteTarget(null);
        return;
      }

      setUsers((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setFeedback({
        type: "success",
        text: `Usuario @${deleteTarget.username} eliminado.`,
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        text: "Error de conexión al eliminar.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra las cuentas, roles y acceso al sistema de riego agrícola.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-agro-700 hover:bg-agro-800 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        )}
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
            placeholder="Buscar por usuario, nombre o correo..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <select
            aria-label="Filtrar por rol"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | UserRole)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agro-600"
          >
            <option value="ALL">Todos los roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="OPERADOR">Operadores</option>
          </select>

          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agro-600"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Usuario</th>
                <th className="py-3.5 px-4">Correo</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Registro</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 px-5 text-center text-slate-500"
                  >
                    No se encontraron usuarios con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const canEdit = isAdmin || isSelf;
                  const canDelete = isAdmin && !isSelf;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              user.role === "ADMIN"
                                ? "bg-agro-100 text-agro-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {user.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                              {user.fullName}
                              {isSelf && (
                                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {user.email || (
                          <span className="text-slate-400 italic">
                            Sin correo
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.role === "ADMIN"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-sky-50 text-sky-800 border border-sky-200"
                          }`}
                        >
                          {user.role === "ADMIN" ? (
                            <Shield className="h-3 w-3" />
                          ) : (
                            <UserCog className="h-3 w-3" />
                          )}
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {isAdmin && !isSelf ? (
                          <button
                            type="button"
                            disabled={togglingId === user.id}
                            onClick={() => handleToggleActive(user)}
                            title="Cambiar estado"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              user.active
                                ? "bg-agro-50 text-agro-700 border border-agro-200 hover:bg-agro-100"
                                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {user.active ? (
                              <UserCheck className="h-3 w-3" />
                            ) : (
                              <UserX className="h-3 w-3" />
                            )}
                            {user.active ? "Activo" : "Inactivo"}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              user.active
                                ? "bg-agro-50 text-agro-700 border border-agro-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {user.active ? "Activo" : "Inactivo"}
                          </span>
                        )}
                      </td>

                      <td
                        suppressHydrationWarning
                        className="py-3.5 px-4 text-xs text-slate-500"
                      >
                        {new Date(user.createdAt).toLocaleDateString("es-HN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              title="Editar usuario"
                              className="p-2 rounded-lg text-slate-600 hover:text-agro-700 hover:bg-agro-50 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(user)}
                              title="Eliminar usuario"
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        open={modalOpen}
        mode={modalMode}
        initialUser={editingUser}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDeleteModal
        user={deleteTarget}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
