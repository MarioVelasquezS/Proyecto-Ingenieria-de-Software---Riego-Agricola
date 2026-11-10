import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fetchZonesWithReadings } from "@/lib/zone-queries";
import { AppShell } from "@/components/AppShell";
import { ZonesManager } from "@/components/ZonesManager";

export const dynamic = "force-dynamic";

export default async function ParcelasPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const initialZones = await fetchZonesWithReadings(4);

  return (
    <AppShell user={currentUser}>
      <ZonesManager
        initialZones={initialZones}
        currentUserRole={currentUser.role}
      />
    </AppShell>
  );
}

