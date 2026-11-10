import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAdmin } from "@/lib/admin-seed";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/jwt";
import { isValidRole } from "@/lib/roles";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Solicitud inválida." },
        { status: 400 }
      );
    }

    const username =
      typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Ingresa tu usuario y contraseña." },
        { status: 400 }
      );
    }

    await ensureDefaultAdmin(prisma);

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Tu cuenta está desactivada. Contacta al administrador." },
        { status: 403 }
      );
    }

    const role = isValidRole(user.role) ? user.role : "OPERADOR";
    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role,
        active: user.active,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      { error: "Error interno al iniciar sesión." },
      { status: 500 }
    );
  }
}

