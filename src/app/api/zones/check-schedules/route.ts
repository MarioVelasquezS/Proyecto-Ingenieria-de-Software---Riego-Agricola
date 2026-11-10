import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runDueSchedules } from "@/lib/schedule-runner";
import { isWeatherPreset, type WeatherPreset } from "@/lib/weather";
import {
  fetchRecentIrrigationEvents,
  fetchZonesWithReadings,
  getRainSensorActive,
} from "@/lib/zone-queries";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawPreset =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).weatherPreset
      : undefined;
  const weatherPreset: WeatherPreset = isWeatherPreset(rawPreset)
    ? rawPreset
    : "auto";

  const summary = await runDueSchedules(weatherPreset);

  const [zones, events, rainSensorActive] = await Promise.all([
    fetchZonesWithReadings(),
    fetchRecentIrrigationEvents(),
    getRainSensorActive(),
  ]);

  return NextResponse.json({
    ...summary,
    rainSensorActive,
    zones,
    events,
  });
}

