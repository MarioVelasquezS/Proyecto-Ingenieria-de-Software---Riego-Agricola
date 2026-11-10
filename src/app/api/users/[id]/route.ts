import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateUpdateUser } from "@/lib/validation";
import {
  getUniqueConflictMessage,
  PUBLIC_USER_SELECT,
} from "@/lib/prisma-errors";

interface RouteContext {
  params: { id: string };
}

function parseUserId(rawId: string): number | null {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

async function hasAnotherActiveAdmin(excludeUserId: number): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      role: "ADMIN",
      active: true,
      id: { not: excludeUserId },
    },
  });
  return count > 0;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const targetId = parseUserId(context.params.id);
  if (!targetId) {
    return NextResponse.json(
      { error: "Identificador de usuario inválido." },
      { status: 400 }
    );
  }

  const isAdmin = currentUser.role === "ADMIN";
  const isSelf = currentUser.id === targetId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json(
      { error: "No tienes permisos para editar este usuario." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateUpdateUser(body as Record<string, unknown>);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  const updateData = { ...validation.data };

  if (!isAdmin) {
    delete updateData.role;
    delete updateData.active;
    delete updateData.username;
  }

  if (isSelf && updateData.active === false) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propio usuario en sesión." },
      { status: 400 }
    );
  }

  if (isSelf && updateData.role && updateData.role !== "ADMIN") {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de administrador a ti mismo." },
      { status: 400 }
    );
  }

  const nextRole = updateData.role ?? targetUser.role;
  const nextActive = updateData.active ?? targetUser.active;

  if (
    targetUser.role === "ADMIN" &&
    targetUser.active &&
    (nextRole !== "ADMIN" || !nextActive)
  ) {
    const anotherAdminExists = await hasAnotherActiveAdmin(targetId);
    if (!anotherAdminExists) {
      return NextResponse.json(
        {
          error:
            "Debe permanecer al menos un administrador activo en el sistema.",
        },
        { status: 400 }
      );
    }
  }

  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    const conflict = getUniqueConflictMessage(error);
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }
    console.error("Error en PATCH /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar el usuario." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden eliminar usuarios." },
      { status: 403 }
    );
  }

  const targetId = parseUserId(context.params.id);
  if (!targetId) {
    return NextResponse.json(
      { error: "Identificador de usuario inválido." },
      { status: 400 }
    );
  }

  if (currentUser.id === targetId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propio usuario en sesión." },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  if (targetUser.role === "ADMIN" && targetUser.active) {
    const anotherAdminExists = await hasAnotherActiveAdmin(targetId);
    if (!anotherAdminExists) {
      return NextResponse.json(
        {
          error:
            "Debe permanecer al menos un administrador activo en el sistema.",
        },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({
    where: { id: targetId },
  });

  return NextResponse.json({ ok: true });
}

