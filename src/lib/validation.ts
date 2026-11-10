import { isValidRole, type UserRole } from "./roles";

export interface UserValidationError {
  ok: false;
  error: string;
}

export interface CreateUserInput {
  ok: true;
  data: {
    username: string;
    fullName: string;
    email: string | null;
    role: UserRole;
    active: boolean;
    password: string;
  };
}

export interface UpdateUserInput {
  ok: true;
  data: {
    username?: string;
    fullName?: string;
    email?: string | null;
    role?: UserRole;
    active?: boolean;
    password?: string;
  };
}

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null | "INVALID" {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return "INVALID";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!EMAIL_REGEX.test(trimmed)) return "INVALID";
  return trimmed;
}

export function validateCreateUser(
  body: Record<string, unknown>
): CreateUserInput | UserValidationError {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const email = normalizeEmail(body.email);
  const role = body.role === undefined ? "OPERADOR" : body.role;
  const active = body.active === undefined ? true : Boolean(body.active);

  if (!USERNAME_REGEX.test(username)) {
    return {
      ok: false,
      error:
        "El nombre de usuario debe tener entre 3 y 32 caracteres (solo letras, números, puntos, guiones o guiones bajos).",
    };
  }

  if (fullName.length < 2 || fullName.length > 80) {
    return {
      ok: false,
      error: "El nombre completo debe tener entre 2 y 80 caracteres.",
    };
  }

  if (email === "INVALID") {
    return {
      ok: false,
      error: "El correo electrónico no tiene un formato válido.",
    };
  }

  if (!isValidRole(role)) {
    return {
      ok: false,
      error: "El rol debe ser ADMIN o OPERADOR.",
    };
  }

  if (password.length < 4 || password.length > 100) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 4 caracteres.",
    };
  }

  return {
    ok: true,
    data: {
      username,
      fullName,
      email,
      role,
      active,
      password,
    },
  };
}

export function validateUpdateUser(
  body: Record<string, unknown>
): UpdateUserInput | UserValidationError {
  const data: UpdateUserInput["data"] = {};

  if (body.username !== undefined) {
    const username =
      typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!USERNAME_REGEX.test(username)) {
      return {
        ok: false,
        error:
          "El nombre de usuario debe tener entre 3 y 32 caracteres (solo letras, números, puntos, guiones o guiones bajos).",
      };
    }
    data.username = username;
  }

  if (body.fullName !== undefined) {
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (fullName.length < 2 || fullName.length > 80) {
      return {
        ok: false,
        error: "El nombre completo debe tener entre 2 y 80 caracteres.",
      };
    }
    data.fullName = fullName;
  }

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (email === "INVALID") {
      return {
        ok: false,
        error: "El correo electrónico no tiene un formato válido.",
      };
    }
    data.email = email;
  }

  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return {
        ok: false,
        error: "El rol debe ser ADMIN o OPERADOR.",
      };
    }
    data.role = body.role;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return {
        ok: false,
        error: "El estado activo debe ser verdadero o falso.",
      };
    }
    data.active = body.active;
  }

  if (body.password !== undefined && body.password !== "") {
    if (
      typeof body.password !== "string" ||
      body.password.length < 4 ||
      body.password.length > 100
    ) {
      return {
        ok: false,
        error: "La nueva contraseña debe tener al menos 4 caracteres.",
      };
    }
    data.password = body.password;
  }

  return { ok: true, data };
}

