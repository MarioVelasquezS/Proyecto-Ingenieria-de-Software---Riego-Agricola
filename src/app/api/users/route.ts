import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateCreateUser } from "@/lib/validation";
import {
  getUniqueConflictMessage,
  PUBLIC_USER_SELECT,
} from "@/lib/prisma-errors";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const role = request.nextUrl.searchParams.get("role")?.trim() ?? "";
  const status = request.nextUrl.searchParams.get("status")?.trim() ?? "";

  const where: {
    role?: string;
    active?: boolean;
    OR?: Array<Record<string, { contains: string }>>;
  } = {};

  if (role === "ADMIN" || role === "OPERADOR") {
    where.role = role;
  }

  if (status === "active") {
    where.active = true;
  } else if (status === "inactive") {
    where.active = false;
  }

  if (search) {
    where.OR = [
      { username: { contains: search } },
      { fullName: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: PUBLIC_USER_SELECT,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo los administradores pueden crear usuarios." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const validation = validateCreateUser(body as Record<string, unknown>);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(validation.data.password, 10);
    const created = await prisma.user.create({
      data: {
        ...validation.data,
        password: passwordHash,
      },
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    const conflict = getUniqueConflictMessage(error);
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }
    console.error("Error en POST /api/users:", error);
    return NextResponse.json(
      { error: "Error interno al crear el usuario." },
      { status: 500 }
    );
  }
}

