import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-agro-50 via-slate-50 to-sky-50 flex flex-col items-center justify-center p-4">
      <LoginForm />
      <p className="mt-6 text-xs text-slate-500 text-center">
        Base de datos SQLite local con migraciones Prisma
      </p>
    </main>
  );
}

