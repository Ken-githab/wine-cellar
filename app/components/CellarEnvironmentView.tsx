"use client";

import { useCallback, useEffect, useState } from "react";
import { CellarChart } from "@/app/components/CellarChart";
import type {
  CellarEnvironmentResponse,
  EnvironmentRange,
} from "@/app/types/cellar-environment";

const STALE_AFTER_MS = 45 * 60 * 1000;

function formatLatestTime(value: string | null): string {
  if (!value) return "未取得";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function temperatureTone(value: number | null): string {
  if (value === null) return "border-[#E8E2F4] bg-white";
  if (value >= 18 || value <= 7) return "border-red-300 bg-red-50";
  if (value >= 16 || value <= 10) return "border-amber-300 bg-amber-50";
  return "border-[#E8E2F4] bg-white";
}

function humidityTone(value: number | null, ready: boolean): string {
  if (value !== null && ready && value < 50) return "border-amber-300 bg-amber-50";
  return "border-[#E8E2F4] bg-white";
}

export function CellarEnvironmentView() {
  const [range, setRange] = useState<EnvironmentRange>("day");
  const [data, setData] = useState<CellarEnvironmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: EnvironmentRange, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cellar-environment?range=${nextRange}`, {
        cache: "no-store",
        signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "環境データの取得に失敗しました。");
      setData(json as CellarEnvironmentResponse);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "環境データの取得に失敗しました。");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(range, controller.signal);
    const interval = window.setInterval(() => void load(range), 5 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load, range]);

  const latest = data?.summary.latest ?? null;
  const averageHumidity = data?.summary.averageHumidity24h ?? null;
  const humidityReady = Boolean(
    data && data.summary.sampleCount24h >= data.summary.minimumSamplesForHumidityAlert,
  );
  const stale = data?.summary.lastSuccessAt
    ? new Date(data.generatedAt).getTime() - new Date(data.summary.lastSuccessAt).getTime()
      >= STALE_AFTER_MS
    : false;
  const connectionProblem = stale || data?.summary.connectivityState === "stopped";

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24" aria-label="環境データを読み込み中">
        <div className="w-8 h-8 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
      </div>
    );
  }

  if (data && !data.configured) {
    return (
      <section className="rounded-3xl bg-white border border-[#E8E2F4] p-6 text-center shadow-sm space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#E8E2F4] flex items-center justify-center text-3xl">🌡️</div>
        <h2 className="font-semibold text-[#1E0F38]">温湿度計の設定があと一つ必要です</h2>
        <p className="text-sm leading-relaxed text-[#8E75B8]">
          VercelにSWITCHBOT_DEVICE_IDを追加すると監視を開始できます。
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white border border-[#E8E2F4] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#8E75B8]">最新取得値</p>
            <p className="mt-1 text-sm font-semibold text-[#1E0F38]">
              {formatLatestTime(data?.summary.lastSuccessAt ?? null)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#8E75B8]">最大15分程度の遅れがあります</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            connectionProblem
              ? "bg-red-100 text-red-700"
              : latest
                ? "bg-green-100 text-green-700"
                : "bg-[#E8E2F4] text-[#634B99]"
          }`}>
            {connectionProblem ? "通信を確認" : latest ? "監視中" : "開始待ち"}
          </span>
        </div>
        {connectionProblem && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
            45分以上、新しいデータを確認できていません。Hub Mini・Wi-Fi・ブレーカーをご確認ください。
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <article className={`rounded-3xl border p-4 shadow-sm ${temperatureTone(latest?.temperature ?? null)}`}>
          <p className="text-xs font-medium text-[#8E75B8]">現在温度</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#1E0F38]">
            {latest ? latest.temperature.toFixed(1) : "--"}
            <span className="ml-1 text-base font-semibold text-[#8E75B8]">°C</span>
          </p>
          <p className="mt-2 text-[11px] text-[#8E75B8]">目標 13°C</p>
        </article>

        <article className="rounded-3xl border border-[#E8E2F4] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#8E75B8]">現在湿度</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#1E0F38]">
            {latest ? latest.humidity.toFixed(1) : "--"}
            <span className="ml-1 text-base font-semibold text-[#8E75B8]">%</span>
          </p>
          <p className="mt-2 text-[11px] text-[#8E75B8]">相対湿度</p>
        </article>

        <article className={`col-span-2 rounded-3xl border p-4 shadow-sm ${humidityTone(averageHumidity, humidityReady)}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#8E75B8]">直近24時間の平均湿度</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[#1E0F38]">
                {averageHumidity === null ? "--" : averageHumidity.toFixed(1)}
                <span className="ml-1 text-base font-semibold text-[#8E75B8]">%</span>
              </p>
            </div>
            <p className="pb-1 text-right text-[11px] leading-relaxed text-[#8E75B8]">
              {humidityReady
                ? `${data?.summary.sampleCount24h ?? 0}件で判定中`
                : `判定開始まであと${Math.max(0, (data?.summary.minimumSamplesForHumidityAlert ?? 80) - (data?.summary.sampleCount24h ?? 0))}件`}
            </p>
          </div>
        </article>
      </section>

      <CellarChart
        points={data?.points ?? []}
        range={range}
        onRangeChange={setRange}
        loading={loading}
      />

      <section className="rounded-3xl bg-[#F3EDFF] border border-[#E0D4F4] p-4 text-xs leading-relaxed text-[#634B99]">
        <p className="font-semibold text-[#1E0F38]">アラート設定</p>
        <p className="mt-1.5">高温：16°C以上が2回／18°C以上は即時</p>
        <p>低温：10°C以下が2回／7°C以下は即時</p>
        <p>復旧：11〜15°Cが2回連続</p>
        <p>湿度：24時間平均50%未満（80件以上で判定）</p>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load(range)}
            className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
