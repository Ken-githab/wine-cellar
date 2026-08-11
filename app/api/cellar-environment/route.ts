import { NextRequest, NextResponse } from "next/server";
import { ENVIRONMENT_THRESHOLDS } from "@/app/lib/cellar-environment";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import type {
  CellarEnvironmentPoint,
  CellarEnvironmentResponse,
  ConnectivityAlertState,
  EnvironmentRange,
  HumidityAlertState,
  TemperatureAlertState,
} from "@/app/types/cellar-environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PointRow {
  recorded_at: string | Date;
  temperature: number | string;
  humidity: number | string;
}

const VALID_RANGES = new Set<EnvironmentRange>(["day", "week", "month"]);

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapPoints(rows: PointRow[]): CellarEnvironmentPoint[] {
  return rows.map((row) => ({
    recordedAt: toIso(row.recorded_at),
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
  }));
}

export async function GET(request: NextRequest) {
  if (!getRequestUser(request)) return unauthorized();

  const requestedRange = request.nextUrl.searchParams.get("range") as EnvironmentRange | null;
  const range = requestedRange && VALID_RANGES.has(requestedRange) ? requestedRange : "day";
  const deviceId = process.env.SWITCHBOT_DEVICE_ID;
  const generatedAt = new Date();

  const emptyResponse: CellarEnvironmentResponse = {
    configured: Boolean(deviceId),
    range,
    generatedAt: generatedAt.toISOString(),
    summary: {
      latest: null,
      averageHumidity24h: null,
      sampleCount24h: 0,
      minimumSamplesForHumidityAlert: ENVIRONMENT_THRESHOLDS.humidityMinimumSamples,
      temperatureState: "normal",
      humidityState: "normal",
      connectivityState: "connected",
      consecutiveFailures: 0,
      lastSuccessAt: null,
    },
    points: [],
  };
  if (!deviceId) return NextResponse.json(emptyResponse);

  try {
    const sql = getSql();
    const since24h = new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const [latestResult, averageResult, stateResult] = await Promise.all([
      sql`
        select recorded_at, temperature, humidity
        from cellar_environment_readings
        where device_id = ${deviceId}
        order by recorded_at desc
        limit 1
      `,
      sql`
        select round(avg(humidity), 1) as average_humidity, count(*) as sample_count
        from cellar_environment_readings
        where device_id = ${deviceId} and recorded_at >= ${since24h}
      `,
      sql`
        select temperature_state, humidity_state, connectivity_state,
               consecutive_failures, last_success_at
        from cellar_environment_alert_state
        where device_id = ${deviceId}
      `,
    ]);
    const latestRows = latestResult as PointRow[];
    const averageRows = averageResult as Array<{
      average_humidity: number | string | null;
      sample_count: number | string;
    }>;
    const stateRows = stateResult as Array<{
      temperature_state: TemperatureAlertState;
      humidity_state: HumidityAlertState;
      connectivity_state: ConnectivityAlertState;
      consecutive_failures: number | string;
      last_success_at: string | Date | null;
    }>;

    let pointRows: PointRow[];
    if (range === "day") {
      pointRows = await sql`
        select recorded_at, temperature, humidity
        from cellar_environment_readings
        where device_id = ${deviceId} and recorded_at >= ${since24h}
        order by recorded_at
        limit 200
      ` as PointRow[];
    } else if (range === "week") {
      const since = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      pointRows = await sql`
        select date_bin('1 hour', recorded_at, timestamptz '2000-01-01') as recorded_at,
               round(avg(temperature), 2) as temperature,
               round(avg(humidity), 2) as humidity
        from cellar_environment_readings
        where device_id = ${deviceId} and recorded_at >= ${since}
        group by 1
        order by 1
        limit 200
      ` as PointRow[];
    } else {
      const since = new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      pointRows = await sql`
        select date_bin('6 hours', recorded_at, timestamptz '2000-01-01') as recorded_at,
               round(avg(temperature), 2) as temperature,
               round(avg(humidity), 2) as humidity
        from cellar_environment_readings
        where device_id = ${deviceId} and recorded_at >= ${since}
        group by 1
        order by 1
        limit 200
      ` as PointRow[];
    }

    const average = averageRows[0];
    const state = stateRows[0];
    const response: CellarEnvironmentResponse = {
      configured: true,
      range,
      generatedAt: generatedAt.toISOString(),
      summary: {
        latest: latestRows[0] ? mapPoints(latestRows)[0] : null,
        averageHumidity24h: average?.average_humidity == null
          ? null
          : Number(average?.average_humidity),
        sampleCount24h: Number(average?.sample_count ?? 0),
        minimumSamplesForHumidityAlert: ENVIRONMENT_THRESHOLDS.humidityMinimumSamples,
        temperatureState: state?.temperature_state ?? "normal",
        humidityState: state?.humidity_state ?? "normal",
        connectivityState: state?.connectivity_state ?? "connected",
        consecutiveFailures: Number(state?.consecutive_failures ?? 0),
        lastSuccessAt: state?.last_success_at ? toIso(state.last_success_at) : null,
      },
      points: mapPoints(pointRows),
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "Failed to load cellar environment data:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "環境データの取得に失敗しました。" }, { status: 500 });
  }
}
