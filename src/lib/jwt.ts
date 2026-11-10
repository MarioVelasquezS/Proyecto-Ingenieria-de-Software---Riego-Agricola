import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "./roles";

export const SESSION_COOKIE_NAME = "riego_session";

export interface SessionPayload {
  userId: number;
  username: string;
  role: UserRole;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET || "riego-agricola-local-dev-secret-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "OPERADOR")
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

