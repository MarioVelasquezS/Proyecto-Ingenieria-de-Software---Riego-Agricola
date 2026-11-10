import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUBLIC_USER_SELECT } from "@/lib/prisma-errors";
import { isValidRole } from "@/lib/roles";
import { AppShell } from "@/components/AppShell";
import { UsersManager } from "@/components/UsersManager";
import type { UserRecord } from "@/components/UserModal";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const rawUsers = await prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const initialUsers: UserRecord[] = rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: isValidRole(u.role) ? u.role : "OPERADOR",
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <AppShell user={currentUser}>
      <UsersManager
        initialUsers={initialUsers}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
      />
    </AppShell>
  );
}

