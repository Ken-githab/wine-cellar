"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CellarEnvironmentPoint, EnvironmentRange } from "@/app/types/cellar-environment";

const RANGE_OPTIONS: Array<{ value: EnvironmentRange; label: string; description: string }> = [
  { value: "day", label: "日", description: "直近24時間" },
  { value: "week", label: "週", description: "直近7日間" },
  { value: "month", label: "月", description: "直近30日間" },
];

function formatDateTime(value: string, range: EnvironmentRange): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: range === "day" ? undefined : "numeric",
    day: range === "day" ? undefined : "numeric",
    hour: "2-digit",
    minute: range === "month" ? undefined : "2-digit",
    hour12: false,
  }).format(date);
}

function formatTooltipDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

interface CellarChartProps {
  points: CellarEnvironmentPoint[];
  range: EnvironmentRange;
  onRangeChange: (range: EnvironmentRange) => void;
  loading?: boolean;
}

export function CellarChart({ points, range, onRangeChange, loading = false }: CellarChartProps) {
  return (
    <section className="rounded-3xl bg-white border border-[#E8E2F4] p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#1E0F38]">温度・湿度の推移</h2>
          <p className="mt-0.5 text-xs text-[#8E75B8]">
            {RANGE_OPTIONS.find((option) => option.value === range)?.description}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="グラフの表示期間"
          className="flex rounded-xl bg-[#E8E2F4] p-1"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={range === option.value}
              onClick={() => onRangeChange(option.value)}
              className={`min-w-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#634B99] ${
                range === option.value
                  ? "bg-white text-[#1E0F38] shadow-sm"
                  : "text-[#8E75B8] hover:text-[#634B99]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-72" aria-busy={loading}>
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E8E2F4" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="recordedAt"
                tickFormatter={(value: string) => formatDateTime(value, range)}
                tick={{ fill: "#8E75B8", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#CABFE3" }}
                minTickGap={24}
              />
              <YAxis
                yAxisId="temperature"
                tick={{ fill: "#D97706", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(value: number) => `${value}°`}
                domain={[
                  (minimum: number) => Math.floor(minimum - 2),
                  (maximum: number) => Math.ceil(maximum + 2),
                ]}
              />
              <YAxis
                yAxisId="humidity"
                orientation="right"
                tick={{ fill: "#634B99", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(value: number) => `${value}%`}
                domain={[
                  (minimum: number) => Math.max(0, Math.floor(minimum - 5)),
                  (maximum: number) => Math.min(100, Math.ceil(maximum + 5)),
                ]}
              />
              <Tooltip
                labelFormatter={(value) => formatTooltipDate(String(value))}
                formatter={(value, name) => [
                  `${Number(value).toFixed(1)}${name === "温度" ? "°C" : "%"}`,
                  name,
                ]}
                contentStyle={{
                  border: "1px solid #E8E2F4",
                  borderRadius: 16,
                  boxShadow: "0 8px 24px rgba(30, 15, 56, 0.10)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line
                yAxisId="temperature"
                type="monotone"
                dataKey="temperature"
                name="温度"
                stroke="#D97706"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="humidity"
                type="monotone"
                dataKey="humidity"
                name="湿度"
                stroke="#634B99"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full rounded-2xl bg-[#FAF8FC] flex items-center justify-center px-6 text-center">
            <p className="text-sm text-[#8E75B8]">
              最初のデータ取得後にグラフが表示されます
            </p>
          </div>
        )}
        {loading && points.length > 0 && (
          <div className="absolute inset-0 rounded-2xl bg-white/60 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
}
