export type EnvironmentRange = "day" | "week" | "month";

export type TemperatureAlertState =
  | "normal"
  | "high_warning"
  | "high_urgent"
  | "low_warning"
  | "low_urgent";

export type HumidityAlertState = "normal" | "low";
export type ConnectivityAlertState = "connected" | "stopped";

export interface CellarEnvironmentPoint {
  recordedAt: string;
  temperature: number;
  humidity: number;
}

export interface CellarEnvironmentSummary {
  latest: CellarEnvironmentPoint | null;
  averageHumidity24h: number | null;
  sampleCount24h: number;
  minimumSamplesForHumidityAlert: number;
  temperatureState: TemperatureAlertState;
  humidityState: HumidityAlertState;
  connectivityState: ConnectivityAlertState;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
}

export interface CellarEnvironmentResponse {
  configured: boolean;
  range: EnvironmentRange;
  generatedAt: string;
  summary: CellarEnvironmentSummary;
  points: CellarEnvironmentPoint[];
}
