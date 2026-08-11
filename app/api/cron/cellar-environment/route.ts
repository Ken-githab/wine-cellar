import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  evaluateReadingAlerts,
  flushDiscordOutbox,
  insertEnvironmentReading,
  recordPollFailure,
  recordPollSuccess,
  toSampleSlot,
} from "@/app/lib/cellar-environment";
import { getSwitchBotMeterStatus } from "@/app/lib/switchbot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "不明なエラー";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = process.env.SWITCHBOT_DEVICE_ID;
  if (!deviceId) {
    return NextResponse.json(
      { error: "SWITCHBOT_DEVICE_IDが設定されていません。" },
      { status: 503 },
    );
  }

  const now = new Date();
  const sampleSlot = toSampleSlot(now);
  let meterStatus;
  try {
    meterStatus = await getSwitchBotMeterStatus(deviceId);
  } catch (error) {
    const message = errorMessage(error);
    try {
      await recordPollFailure(deviceId, sampleSlot, now, message);
      const notifications = await flushDiscordOutbox();
      console.error("Cellar environment polling failed:", message);
      return NextResponse.json(
        { ok: false, error: message, sampleSlot: sampleSlot.toISOString(), notifications },
        { status: 502 },
      );
    } catch (recordError) {
      console.error("Failed to record cellar polling error:", errorMessage(recordError));
      return NextResponse.json(
        { ok: false, error: "取得失敗の記録処理にも失敗しました。" },
        { status: 500 },
      );
    }
  }

  try {
    await recordPollSuccess(deviceId, sampleSlot, now);
    const inserted = await insertEnvironmentReading({
      deviceId,
      temperature: meterStatus.temperature,
      humidity: meterStatus.humidity,
      sampleSlot,
      recordedAt: now,
    });
    // 再送時も直近DB値から判定するため、途中失敗から安全に再開できる
    await evaluateReadingAlerts({
      deviceId,
      temperature: meterStatus.temperature,
      sampleSlot,
      now,
    });
    const notifications = await flushDiscordOutbox();

    return NextResponse.json({
      ok: true,
      inserted,
      duplicate: !inserted,
      sampleSlot: sampleSlot.toISOString(),
      reading: {
        temperature: meterStatus.temperature,
        humidity: meterStatus.humidity,
        deviceType: meterStatus.deviceType,
      },
      notifications,
    });
  } catch (error) {
    console.error("Cellar environment persistence failed:", errorMessage(error));
    return NextResponse.json(
      { ok: false, error: "温湿度データの保存または判定に失敗しました。" },
      { status: 500 },
    );
  }
}
