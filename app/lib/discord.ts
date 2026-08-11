const DISCORD_TIMEOUT_MS = 10_000;

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlert {
  title: string;
  description: string;
  color: number;
  fields?: DiscordEmbedField[];
}

export async function sendDiscordAlert(alert: DiscordAlert): Promise<void> {
  const configuredUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!configuredUrl) {
    throw new Error("DISCORD_WEBHOOK_URLが設定されていません。");
  }

  const webhookUrl = new URL(configuredUrl);
  webhookUrl.searchParams.set("wait", "true");

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Wine Cellar Monitor",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: alert.title,
          description: alert.description,
          color: alert.color,
          fields: alert.fields ?? [],
          timestamp: new Date().toISOString(),
          footer: { text: "ワインセラー環境モニター" },
        }],
      }),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError"
      ? "タイムアウトしました。"
      : "通信に失敗しました。";
    throw new Error(`Discord Webhookへの${detail}`);
  }

  if (!response.ok) {
    throw new Error(`Discord WebhookがHTTP ${response.status}を返しました。`);
  }
}
