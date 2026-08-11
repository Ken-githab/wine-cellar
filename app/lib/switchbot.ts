import { createHmac, randomUUID } from "node:crypto";

const SWITCHBOT_API_BASE = "https://api.switch-bot.com/v1.1";
const REQUEST_TIMEOUT_MS = 10_000;

interface SwitchBotResponse<T> {
  statusCode: number;
  message: string;
  body: T;
}

export interface SwitchBotDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  hubDeviceId?: string;
}

export interface SwitchBotMeterStatus {
  deviceId: string;
  deviceType: string;
  temperature: number;
  humidity: number;
}

export class SwitchBotApiError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = "SwitchBotApiError";
  }
}

function getCredentials() {
  const token = process.env.SWITCHBOT_TOKEN;
  const secret = process.env.SWITCHBOT_SECRET;
  if (!token || !secret) {
    throw new SwitchBotApiError("SwitchBot APIの認証情報が設定されていません。");
  }
  return { token, secret };
}

export function createSwitchBotHeaders(now = Date.now(), nonce = randomUUID()) {
  const { token, secret } = getCredentials();
  const t = String(now);
  const sign = createHmac("sha256", secret)
    .update(`${token}${t}${nonce}`)
    .digest("base64");

  return {
    Authorization: token,
    sign,
    nonce,
    t,
    "content-type": "application/json; charset=utf8",
  };
}

async function switchBotGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SWITCHBOT_API_BASE}${path}`, {
      method: "GET",
      headers: createSwitchBotHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "タイムアウトしました。"
      : "通信に失敗しました。";
    throw new SwitchBotApiError(`SwitchBot APIへの${detail}`);
  }

  const json = await response.json().catch(() => null) as SwitchBotResponse<T> | null;
  if (!response.ok) {
    throw new SwitchBotApiError(`SwitchBot APIがHTTP ${response.status}を返しました。`, response.status);
  }
  if (!json || json.statusCode !== 100) {
    const code = json?.statusCode;
    throw new SwitchBotApiError(
      `SwitchBot APIエラー${code ? ` (${code})` : ""}: ${json?.message || "不明な応答"}`,
      code,
    );
  }
  return json.body;
}

export async function listSwitchBotDevices(): Promise<SwitchBotDevice[]> {
  const body = await switchBotGet<{ deviceList?: SwitchBotDevice[] }>("/devices");
  return Array.isArray(body.deviceList) ? body.deviceList : [];
}

export async function getSwitchBotMeterStatus(deviceId: string): Promise<SwitchBotMeterStatus> {
  const body = await switchBotGet<Partial<SwitchBotMeterStatus>>(
    `/devices/${encodeURIComponent(deviceId)}/status`,
  );
  const temperature = Number(body.temperature);
  const humidity = Number(body.humidity);

  if (!Number.isFinite(temperature) || temperature < -50 || temperature > 100) {
    throw new SwitchBotApiError("SwitchBot APIから不正な温度が返されました。");
  }
  if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    throw new SwitchBotApiError("SwitchBot APIから不正な湿度が返されました。");
  }

  return {
    deviceId: typeof body.deviceId === "string" ? body.deviceId : deviceId,
    deviceType: typeof body.deviceType === "string" ? body.deviceType : "Unknown",
    temperature,
    humidity,
  };
}
