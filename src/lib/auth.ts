import { cookies } from "next/headers";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "./jwt";
import { isValidRole, type UserRole } from "./roles";

export interface PublicUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  return {
    ...user,
    role: isValidRole(user.role) ? user.role : "OPERADOR",
  };
}

