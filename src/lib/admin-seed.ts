import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Crea o actualiza el usuario administrador por defecto (admin / 1234).
 */
export async function seedDefaultAdmin(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("1234", 10);

  return prisma.user.upsert({
    where: { username: "admin" },
    update: {
      role: "ADMIN",
      active: true,
    },
    create: {
      username: "admin",
      fullName: "Administrador del Sistema",
      email: "admin@riego.local",
      role: "ADMIN",
      active: true,
      password: passwordHash,
    },
  });
}

/**
 * Garantiza que exista el usuario administrador por defecto si la tabla
 * de usuarios está vacía (por ejemplo, tras ejecutar solo `migrate deploy`).
 */
export async function ensureDefaultAdmin(prisma: PrismaClient) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return null;
  }
  return seedDefaultAdmin(prisma);
}
