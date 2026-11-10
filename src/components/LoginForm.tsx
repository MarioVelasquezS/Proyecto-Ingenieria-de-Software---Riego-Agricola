"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Droplets, Eye, EyeOff, Lock, User } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "No se pudo iniciar sesión.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function fillDefaultAdmin() {
    setUsername("admin");
    setPassword("1234");
    setError(null);
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
      <div className="bg-gradient-to-br from-agro-800 to-agro-900 px-6 py-7 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Droplets className="h-6 w-6 text-agro-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Proyecto Riego Agrícola
            </h1>
            <p className="text-xs text-agro-200">
              Acceso al panel de administración
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-slate-700"
          >
            Usuario
          </label>
          <div className="relative">
            <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600 focus:border-agro-600 transition-shadow"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Contraseña
          </label>
          <div className="relative">
            <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-agro-600 focus:border-agro-600 transition-shadow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-agro-700 hover:bg-agro-800 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-60"
        >
          {loading ? "Validando acceso..." : "Iniciar sesión"}
        </button>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Admin inicial: <strong className="text-slate-700">admin</strong> /{" "}
            <strong className="text-slate-700">1234</strong>
          </span>
          <button
            type="button"
            onClick={fillDefaultAdmin}
            className="text-agro-700 hover:text-agro-800 font-medium underline underline-offset-2"
          >
            Rellenar
          </button>
        </div>
      </form>
    </div>
  );
}

