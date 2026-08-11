import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { listSwitchBotDevices } from "@/app/lib/switchbot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!getRequestUser(request)) return unauthorized();

  try {
    const devices = await listSwitchBotDevices();
    return NextResponse.json({
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        recommended: device.deviceType === "Outdoor Meter",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SwitchBot端末の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
