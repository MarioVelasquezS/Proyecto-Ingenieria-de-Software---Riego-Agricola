"use client";

import { AlertTriangle } from "lucide-react";
import type { UserRecord } from "./UserModal";

interface ConfirmDeleteModalProps {
  user: UserRecord | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  user,
  deleting,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3
              id="delete-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Eliminar usuario
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              ¿Seguro que deseas eliminar a{" "}
              <strong className="text-slate-900">{user.fullName}</strong> (
              <span className="font-mono text-xs">@{user.username}</span>)? Esta
              acción no se puede deshacer.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
