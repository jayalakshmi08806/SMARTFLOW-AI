export type WeatherType = "clear" | "rainy" | "foggy" | "snowy";
export type TimeOfDayType = "morning" | "rush_hour_am" | "afternoon" | "rush_hour_pm" | "night";

export interface VehicleCount {
  cars: number;
  buses: number;
  trucks: number;
  motorcycles: number;
  bicycles: number;
  pedestrians: number;
}

export interface LaneState {
  id: "N" | "E" | "S" | "W";
  name: string;
  vehicles: VehicleCount;
  queueLength: number; // in meters
  avgWaitTime: number; // in seconds
  detectedEmergency: null | "ambulance" | "fire_truck" | "police";
  detectedAccident: null | "collision" | "stalled";
  signalStatus: "red" | "yellow" | "green";
  timeRemaining: number; // seconds
}

export interface SimState {
  weather: WeatherType;
  timeOfDay: TimeOfDayType;
  aiOptimizationActive: boolean;
  totalCO2Emissions: number; // cumulative g/min
  co2SavedPercentage: number; // comparison metric
  averageIntersectionWaitTime: number; // overall average
  activeMode: "high_throughput" | "eco_friendly" | "emergency_focus" | "standard";
  lanes: Record<"N" | "E" | "S" | "W", LaneState>;
  signalsCycleLeft: number;
  systemLogs: Array<{
    timestamp: string;
    type: "info" | "warning" | "alert" | "success";
    message: string;
  }>;
}

export interface TrafficPrediction {
  hour: string;
  predictedDensity: number; // 0 to 100
  predictedVolume: number; // vehicle count
  recommendedGreenDuration: number; // seconds
}

export interface GeminiOptimizeResponse {
  recommendation: string;
  suggestedTimings: {
    N: number;
    E: number;
    S: number;
    W: number;
  };
  reasoning: string;
  priorityMetrics: string;
}
