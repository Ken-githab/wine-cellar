import { getSql } from "@/app/lib/db";
import { sendDiscordAlert, type DiscordAlert, type DiscordEmbedField } from "@/app/lib/discord";
import type {
  ConnectivityAlertState,
  HumidityAlertState,
  TemperatureAlertState,
} from "@/app/types/cellar-environment";

export const ENVIRONMENT_THRESHOLDS = {
  targetTemperature: 13,
  highWarning: 16,
  highUrgent: 18,
  lowWarning: 10,
  lowUrgent: 7,
  recoveryLow: 11,
  recoveryHigh: 15,
  humidityLow: 50,
  humidityRecovery: 52,
  humidityMinimumSamples: 80,
  stoppedAfterMinutes: 45,
  reminderAfterHours: 24,
} as const;

const COLORS = {
  success: 0x16a34a,
  warning: 0xd97706,
  danger: 0xdc2626,
} as const;

interface AlertStateRow {
  device_id: string;
  temperature_state: TemperatureAlertState;
  temperature_high_count: number | string;
  temperature_low_count: number | string;
  temperature_recovery_count: number | string;
  humidity_state: HumidityAlertState;
  connectivity_state: ConnectivityAlertState;
  consecutive_failures: number | string;
  last_success_at: string | null;
  last_temperature_notification_at: string | null;
  last_humidity_notification_at: string | null;
  last_connectivity_notification_at: string | null;
}

interface AlertState {
  deviceId: string;
  temperatureState: TemperatureAlertState;
  temperatureHighCount: number;
  temperatureLowCount: number;
  temperatureRecoveryCount: number;
  humidityState: HumidityAlertState;
  connectivityState: ConnectivityAlertState;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastTemperatureNotificationAt: string | null;
  lastHumidityNotificationAt: string | null;
  lastConnectivityNotificationAt: string | null;
}

interface OutboxAlert extends DiscordAlert {
  deviceId: string;
  dedupeKey: string;
  category: "temperature" | "humidity" | "connectivity";
  eventKind: "opened" | "changed" | "reminder" | "resolved";
}

interface OutboxRow {
  id: number | string;
  title: string;
  description: string;
  color: number | string;
  fields: DiscordEmbedField[] | string;
  attempt_count: number | string;
}

function parseState(row: AlertStateRow): AlertState {
  return {
    deviceId: row.device_id,
    temperatureState: row.temperature_state,
    temperatureHighCount: Number(row.temperature_high_count),
    temperatureLowCount: Number(row.temperature_low_count),
    temperatureRecoveryCount: Number(row.temperature_recovery_count),
    humidityState: row.humidity_state,
    connectivityState: row.connectivity_state,
    consecutiveFailures: Number(row.consecutive_failures),
    lastSuccessAt: row.last_success_at,
    lastTemperatureNotificationAt: row.last_temperature_notification_at,
    lastHumidityNotificationAt: row.last_humidity_notification_at,
    lastConnectivityNotificationAt: row.last_connectivity_notification_at,
  };
}

async function getAlertState(deviceId: string): Promise<AlertState> {
  const sql = getSql();
  await sql`
    insert into cellar_environment_alert_state (device_id)
    values (${deviceId})
    on conflict (device_id) do nothing
  `;
  const rows = await sql`
    select * from cellar_environment_alert_state where device_id = ${deviceId}
  ` as AlertStateRow[];
  return parseState(rows[0]);
}

async function saveAlertState(state: AlertState): Promise<void> {
  const sql = getSql();
  await sql`
    update cellar_environment_alert_state
    set temperature_state = ${state.temperatureState},
        temperature_high_count = ${state.temperatureHighCount},
        temperature_low_count = ${state.temperatureLowCount},
        temperature_recovery_count = ${state.temperatureRecoveryCount},
        humidity_state = ${state.humidityState},
        connectivity_state = ${state.connectivityState},
        consecutive_failures = ${state.consecutiveFailures},
        last_success_at = ${state.lastSuccessAt},
        last_temperature_notification_at = ${state.lastTemperatureNotificationAt},
        last_humidity_notification_at = ${state.lastHumidityNotificationAt},
        last_connectivity_notification_at = ${state.lastConnectivityNotificationAt},
        updated_at = now()
    where device_id = ${state.deviceId}
  `;
}

async function enqueueAlert(alert: OutboxAlert): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    insert into cellar_environment_alert_outbox (
      device_id, dedupe_key, category, event_kind, title, description, color, fields
    ) values (
      ${alert.deviceId}, ${alert.dedupeKey}, ${alert.category}, ${alert.eventKind},
      ${alert.title}, ${alert.description}, ${alert.color}, ${JSON.stringify(alert.fields ?? [])}::jsonb
    )
    on conflict (dedupe_key) do nothing
    returning id
  ` as Array<{ id: number | string }>;
  return rows.length > 0;
}

export async function enqueueDiscordConnectionTest(
  deviceId: string,
  temperature: number,
  humidity: number,
): Promise<void> {
  await enqueueAlert({
    deviceId,
    dedupeKey: `discord:${deviceId}:connection-test:2026-08-11`,
    category: "connectivity",
    eventKind: "resolved",
    title: "✅ Discord通知テストに成功しました",
    description: "ワインセラー環境モニターからのテスト通知です。今後、温度・湿度・通信異常をこのチャンネルへ通知します。",
    color: COLORS.success,
    fields: [
      { name: "現在温度", value: `${temperature.toFixed(1)}°C`, inline: true },
      { name: "現在湿度", value: `${humidity.toFixed(1)}%`, inline: true },
    ],
  });
}

function isReminderDue(lastNotificationAt: string | null, now: Date): boolean {
  if (!lastNotificationAt) return true;
  return now.getTime() - new Date(lastNotificationAt).getTime()
    >= ENVIRONMENT_THRESHOLDS.reminderAfterHours * 60 * 60 * 1000;
}

function tokyoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function temperatureStateLabel(state: TemperatureAlertState): string {
  const labels: Record<TemperatureAlertState, string> = {
    normal: "正常",
    high_warning: "高温注意",
    high_urgent: "高温緊急",
    low_warning: "低温注意",
    low_urgent: "低温緊急",
  };
  return labels[state];
}

function temperatureAlert(
  deviceId: string,
  previous: TemperatureAlertState,
  next: TemperatureAlertState,
  temperature: number,
  dedupeSuffix: string,
  reminder = false,
): OutboxAlert {
  const resolved = next === "normal";
  const urgent = next === "high_urgent" || next === "low_urgent";
  const eventKind = reminder
    ? "reminder"
    : resolved
      ? "resolved"
      : previous === "normal"
        ? "opened"
        : "changed";
  const title = reminder
    ? `⏰ 温度異常が継続中（${temperatureStateLabel(next)}）`
    : resolved
      ? "✅ セラー温度が正常範囲に戻りました"
      : `${urgent ? "🚨" : "⚠️"} セラー温度：${temperatureStateLabel(next)}`;

  return {
    deviceId,
    dedupeKey: `temperature:${deviceId}:${eventKind}:${next}:${dedupeSuffix}`,
    category: "temperature",
    eventKind,
    title,
    description: resolved
      ? `現在 ${temperature.toFixed(1)}°C。11〜15°Cが2回連続し、復旧を確認しました。`
      : `現在 ${temperature.toFixed(1)}°Cです。セラーの設定温度は13°Cです。`,
    color: resolved ? COLORS.success : urgent ? COLORS.danger : COLORS.warning,
    fields: [
      { name: "現在温度", value: `${temperature.toFixed(1)}°C`, inline: true },
      { name: "判定", value: temperatureStateLabel(next), inline: true },
    ],
  };
}

function nextTemperatureState(state: AlertState, recentTemperatures: number[]) {
  const temperature = recentTemperatures[0];
  const countConsecutive = (predicate: (value: number) => boolean) => {
    let count = 0;
    for (const value of recentTemperatures) {
      if (!predicate(value)) break;
      count += 1;
    }
    return count;
  };
  const highCount = countConsecutive((value) => value >= ENVIRONMENT_THRESHOLDS.highWarning);
  const lowCount = countConsecutive((value) => value <= ENVIRONMENT_THRESHOLDS.lowWarning);
  const recoveryCount = countConsecutive((value) =>
    value >= ENVIRONMENT_THRESHOLDS.recoveryLow
    && value <= ENVIRONMENT_THRESHOLDS.recoveryHigh);
  let next = state.temperatureState;

  if (temperature >= ENVIRONMENT_THRESHOLDS.highUrgent) {
    next = "high_urgent";
  } else if (temperature <= ENVIRONMENT_THRESHOLDS.lowUrgent) {
    next = "low_urgent";
  } else if (state.temperatureState !== "normal" && recoveryCount >= 2) {
    next = "normal";
  } else if (highCount >= 2 && !state.temperatureState.startsWith("high")) {
    next = "high_warning";
  } else if (lowCount >= 2 && !state.temperatureState.startsWith("low")) {
    next = "low_warning";
  }

  return { next, highCount, lowCount, recoveryCount };
}

export function toSampleSlot(date = new Date()): Date {
  const intervalMs = 15 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

export async function insertEnvironmentReading(input: {
  deviceId: string;
  temperature: number;
  humidity: number;
  sampleSlot: Date;
  recordedAt: Date;
}): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    insert into cellar_environment_readings (
      device_id, temperature, humidity, sample_slot, recorded_at
    ) values (
      ${input.deviceId}, ${input.temperature}, ${input.humidity},
      ${input.sampleSlot.toISOString()}, ${input.recordedAt.toISOString()}
    )
    on conflict (device_id, sample_slot) do nothing
    returning id
  ` as Array<{ id: string }>;
  return rows.length > 0;
}

export async function recordPollSuccess(deviceId: string, sampleSlot: Date, now: Date): Promise<void> {
  const sql = getSql();
  await sql`
    insert into cellar_environment_poll_attempts (
      device_id, sample_slot, status, error_message, attempted_at, updated_at
    ) values (${deviceId}, ${sampleSlot.toISOString()}, 'success', null, ${now.toISOString()}, ${now.toISOString()})
    on conflict (device_id, sample_slot) do update
    set status = 'success', error_message = null, attempted_at = excluded.attempted_at, updated_at = excluded.updated_at
  `;

  const state = await getAlertState(deviceId);
  if (state.connectivityState === "stopped") {
    const inserted = await enqueueAlert({
      deviceId,
      dedupeKey: `connectivity:${deviceId}:resolved:${sampleSlot.toISOString()}`,
      category: "connectivity",
      eventKind: "resolved",
      title: "✅ セラー温湿度計との通信が復旧しました",
      description: "SwitchBotから新しい温湿度データを取得できました。",
      color: COLORS.success,
    });
    if (inserted) state.lastConnectivityNotificationAt = now.toISOString();
  }
  state.connectivityState = "connected";
  state.consecutiveFailures = 0;
  state.lastSuccessAt = now.toISOString();
  await saveAlertState(state);
}

export async function recordPollFailure(
  deviceId: string,
  sampleSlot: Date,
  now: Date,
  errorMessage: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    insert into cellar_environment_poll_attempts (
      device_id, sample_slot, status, error_message, attempted_at, updated_at
    ) values (
      ${deviceId}, ${sampleSlot.toISOString()}, 'failure', ${errorMessage.slice(0, 500)},
      ${now.toISOString()}, ${now.toISOString()}
    )
    on conflict (device_id, sample_slot) do update
    set status = case
          when cellar_environment_poll_attempts.status = 'success' then 'success'
          else excluded.status
        end,
        error_message = case
          when cellar_environment_poll_attempts.status = 'success' then null
          else excluded.error_message
        end,
        attempted_at = excluded.attempted_at,
        updated_at = excluded.updated_at
  `;

  const attempts = await sql`
    select status, sample_slot
    from cellar_environment_poll_attempts
    where device_id = ${deviceId}
    order by sample_slot desc
    limit 12
  ` as Array<{ status: "success" | "failure"; sample_slot: string }>;
  let consecutiveFailures = 0;
  for (const attempt of attempts) {
    if (attempt.status !== "failure") break;
    consecutiveFailures += 1;
  }

  const state = await getAlertState(deviceId);
  state.consecutiveFailures = consecutiveFailures;
  const lastSuccessMs = state.lastSuccessAt ? new Date(state.lastSuccessAt).getTime() : null;
  const successIsStale = lastSuccessMs !== null
    && now.getTime() - lastSuccessMs >= ENVIRONMENT_THRESHOLDS.stoppedAfterMinutes * 60 * 1000;
  const stopped = consecutiveFailures >= 3 || (consecutiveFailures > 0 && successIsStale);

  if (stopped && state.connectivityState !== "stopped") {
    const inserted = await enqueueAlert({
      deviceId,
      dedupeKey: `connectivity:${deviceId}:opened:${sampleSlot.toISOString()}`,
      category: "connectivity",
      eventKind: "opened",
      title: "🚨 セラー温湿度計からデータを取得できません",
      description: `通信失敗が${consecutiveFailures}回続いています。ブレーカー、Hub Mini、Wi-Fiをご確認ください。`,
      color: COLORS.danger,
      fields: [{ name: "直近のエラー", value: errorMessage.slice(0, 900) }],
    });
    if (inserted) state.lastConnectivityNotificationAt = now.toISOString();
    state.connectivityState = "stopped";
  } else if (
    stopped
    && state.connectivityState === "stopped"
    && isReminderDue(state.lastConnectivityNotificationAt, now)
  ) {
    const inserted = await enqueueAlert({
      deviceId,
      dedupeKey: `connectivity:${deviceId}:reminder:${tokyoDateKey(now)}`,
      category: "connectivity",
      eventKind: "reminder",
      title: "⏰ セラー温湿度計の通信停止が継続中です",
      description: `通信失敗が${consecutiveFailures}回続いています。機器と電源をご確認ください。`,
      color: COLORS.danger,
    });
    if (inserted) state.lastConnectivityNotificationAt = now.toISOString();
  }
  await saveAlertState(state);
}

export async function evaluateReadingAlerts(input: {
  deviceId: string;
  temperature: number;
  sampleSlot: Date;
  now: Date;
}): Promise<void> {
  const sql = getSql();
  const state = await getAlertState(input.deviceId);
  const recentRows = await sql`
    select temperature
    from cellar_environment_readings
    where device_id = ${input.deviceId}
    order by recorded_at desc
    limit 2
  ` as Array<{ temperature: number | string }>;
  const recentTemperatures = recentRows.map((row) => Number(row.temperature));
  const temperatureResult = nextTemperatureState(state, recentTemperatures);
  const previousTemperatureState = state.temperatureState;
  state.temperatureState = temperatureResult.next;
  state.temperatureHighCount = temperatureResult.highCount;
  state.temperatureLowCount = temperatureResult.lowCount;
  state.temperatureRecoveryCount = temperatureResult.recoveryCount;

  if (temperatureResult.next !== previousTemperatureState) {
    const inserted = await enqueueAlert(temperatureAlert(
      input.deviceId,
      previousTemperatureState,
      temperatureResult.next,
      input.temperature,
      input.sampleSlot.toISOString(),
    ));
    if (inserted) state.lastTemperatureNotificationAt = input.now.toISOString();
  } else if (
    temperatureResult.next !== "normal"
    && isReminderDue(state.lastTemperatureNotificationAt, input.now)
  ) {
    const inserted = await enqueueAlert(temperatureAlert(
      input.deviceId,
      previousTemperatureState,
      temperatureResult.next,
      input.temperature,
      tokyoDateKey(input.now),
      true,
    ));
    if (inserted) state.lastTemperatureNotificationAt = input.now.toISOString();
  }

  const humidityRows = await sql`
    select round(avg(humidity), 1) as average_humidity, count(*) as sample_count
    from cellar_environment_readings
    where device_id = ${input.deviceId}
      and recorded_at >= ${new Date(input.now.getTime() - 24 * 60 * 60 * 1000).toISOString()}
  ` as Array<{ average_humidity: number | string | null; sample_count: number | string }>;
  const averageHumidity = humidityRows[0]?.average_humidity === null
    ? null
    : Number(humidityRows[0]?.average_humidity);
  const sampleCount = Number(humidityRows[0]?.sample_count ?? 0);

  if (averageHumidity !== null && sampleCount >= ENVIRONMENT_THRESHOLDS.humidityMinimumSamples) {
    const previousHumidityState = state.humidityState;
    if (state.humidityState === "normal" && averageHumidity < ENVIRONMENT_THRESHOLDS.humidityLow) {
      state.humidityState = "low";
    } else if (
      state.humidityState === "low"
      && averageHumidity >= ENVIRONMENT_THRESHOLDS.humidityRecovery
    ) {
      state.humidityState = "normal";
    }

    if (state.humidityState !== previousHumidityState) {
      const resolved = state.humidityState === "normal";
      const inserted = await enqueueAlert({
        deviceId: input.deviceId,
        dedupeKey: `humidity:${input.deviceId}:${resolved ? "resolved" : "opened"}:${input.sampleSlot.toISOString()}`,
        category: "humidity",
        eventKind: resolved ? "resolved" : "opened",
        title: resolved ? "✅ セラー湿度が回復しました" : "⚠️ セラーの平均湿度が低下しています",
        description: resolved
          ? `直近24時間の平均湿度が${averageHumidity.toFixed(1)}%まで回復しました。`
          : `直近24時間の平均湿度が${averageHumidity.toFixed(1)}%です。50%未満になっています。`,
        color: resolved ? COLORS.success : COLORS.warning,
        fields: [
          { name: "24時間平均", value: `${averageHumidity.toFixed(1)}%`, inline: true },
          { name: "サンプル数", value: `${sampleCount}件`, inline: true },
        ],
      });
      if (inserted) state.lastHumidityNotificationAt = input.now.toISOString();
    } else if (
      state.humidityState === "low"
      && isReminderDue(state.lastHumidityNotificationAt, input.now)
    ) {
      const inserted = await enqueueAlert({
        deviceId: input.deviceId,
        dedupeKey: `humidity:${input.deviceId}:reminder:${tokyoDateKey(input.now)}`,
        category: "humidity",
        eventKind: "reminder",
        title: "⏰ セラーの低湿度が継続中です",
        description: `直近24時間の平均湿度は${averageHumidity.toFixed(1)}%です。`,
        color: COLORS.warning,
      });
      if (inserted) state.lastHumidityNotificationAt = input.now.toISOString();
    }
  }

  await saveAlertState(state);
}

function parseFields(value: DiscordEmbedField[] | string): DiscordEmbedField[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as DiscordEmbedField[] : [];
  } catch {
    return [];
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "不明な送信エラー";
}

export async function flushDiscordOutbox(): Promise<{ sent: number; failed: number }> {
  const sql = getSql();
  const rows = await sql`
    with targets as (
      select id
      from cellar_environment_alert_outbox
      where (status = 'pending' and next_attempt_at <= now())
         or (status = 'sending' and locked_at < now() - interval '10 minutes')
      order by created_at
      limit 5
      for update skip locked
    )
    update cellar_environment_alert_outbox outbox
    set status = 'sending', locked_at = now()
    from targets
    where outbox.id = targets.id
    returning outbox.id, outbox.title, outbox.description, outbox.color,
              outbox.fields, outbox.attempt_count
  ` as OutboxRow[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sendDiscordAlert({
        title: row.title,
        description: row.description,
        color: Number(row.color),
        fields: parseFields(row.fields),
      });
      await sql`
        update cellar_environment_alert_outbox
        set status = 'sent', sent_at = now(), locked_at = null, last_error = null
        where id = ${row.id}
      `;
      sent += 1;
    } catch (error) {
      const attemptCount = Number(row.attempt_count) + 1;
      const delayMinutes = Math.min(24 * 60, 5 * 2 ** Math.min(attemptCount - 1, 8));
      const nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
      await sql`
        update cellar_environment_alert_outbox
        set status = 'pending', attempt_count = ${attemptCount},
            next_attempt_at = ${nextAttemptAt}, locked_at = null,
            last_error = ${safeErrorMessage(error)}
        where id = ${row.id}
      `;
      failed += 1;
    }
  }
  return { sent, failed };
}
