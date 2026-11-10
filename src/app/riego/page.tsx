import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
  getRainSensorActive,
} from "@/lib/zone-queries";
import { AppShell } from "@/components/AppShell";
import { IrrigationDashboard } from "@/components/IrrigationDashboard";

export const dynamic = "force-dynamic";

export default async function RiegoPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const [initialZones, initialEvents, initialRainSensorActive] =
    await Promise.all([
      fetchZonesWithReadings(),
      fetchRecentIrrigationEvents(),
      getRainSensorActive(),
    ]);

  return (
    <AppShell user={currentUser}>
      <IrrigationDashboard
        initialZones={initialZones}
        initialEvents={initialEvents}
        initialRainSensorActive={initialRainSensorActive}
      />
    </AppShell>
  );
}
