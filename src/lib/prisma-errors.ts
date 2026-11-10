import { Prisma } from "@prisma/client";

export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function getUniqueConflictMessage(error: unknown): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(",")
      : String(error.meta?.target ?? "");

    if (target.includes("username")) {
      return "Ese nombre de usuario ya está registrado.";
    }
    if (target.includes("email")) {
      return "Ese correo electrónico ya está registrado.";
    }
    return "Ya existe un usuario con esos datos únicos.";
  }
  return null;
}

