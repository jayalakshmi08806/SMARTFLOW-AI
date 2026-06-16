import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { LaneState, SimState, WeatherType, TimeOfDayType, VehicleCount, TrafficPrediction } from "./src/types";

dotenv.config();

// Helper to construct Gemini Client
let lazyGeminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured or uses placeholder value. Please set a valid key in the Secrets Panel.");
  }
  if (!lazyGeminiClient) {
    lazyGeminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return lazyGeminiClient;
}

const app = express();
app.use(express.json());

// Main simulation state in memory
let simState: SimState = {
  weather: "clear",
  timeOfDay: "afternoon",
  aiOptimizationActive: true,
  totalCO2Emissions: 4320, // baseline index
  co2SavedPercentage: 27.5,
  averageIntersectionWaitTime: 18.2,
  activeMode: "high_throughput",
  signalsCycleLeft: 10,
  lanes: {
    N: {
      id: "N",
      name: "Northbound Lane (Broadway Ave)",
      vehicles: { cars: 12, buses: 2, trucks: 1, motorcycles: 4, bicycles: 2, pedestrians: 5 },
      queueLength: 42,
      avgWaitTime: 22.4,
      detectedEmergency: null,
      detectedAccident: null,
      signalStatus: "green",
      timeRemaining: 15,
    },
    E: {
      id: "E",
      name: "Eastbound Lane (4th Street)",
      vehicles: { cars: 6, buses: 0, trucks: 2, motorcycles: 1, bicycles: 1, pedestrians: 2 },
      queueLength: 22,
      avgWaitTime: 12.1,
      detectedEmergency: null,
      detectedAccident: null,
      signalStatus: "red",
      timeRemaining: 15,
    },
    S: {
      id: "S",
      name: "Southbound Lane (Broadway Ave)",
      vehicles: { cars: 15, buses: 3, trucks: 0, motorcycles: 6, bicycles: 4, pedestrians: 8 },
      queueLength: 55,
      avgWaitTime: 28.5,
      detectedEmergency: null,
      detectedAccident: null,
      signalStatus: "green",
      timeRemaining: 15,
    },
    W: {
      id: "W",
      name: "Westbound Lane (4th Street)",
      vehicles: { cars: 8, buses: 1, trucks: 1, motorcycles: 2, bicycles: 0, pedestrians: 3 },
      queueLength: 28,
      avgWaitTime: 14.8,
      detectedEmergency: null,
      detectedAccident: null,
      signalStatus: "red",
      timeRemaining: 15,
    },
  },
  systemLogs: [
    { timestamp: new Date().toLocaleTimeString(), type: "success", message: "SmartFlow AI Traffic Engine initialized." },
    { timestamp: new Date().toLocaleTimeString(), type: "info", message: "YOLOv8 Lane detection pipeline activated: 4x CCTV feeds online." },
    { timestamp: new Date().toLocaleTimeString(), type: "info", message: "Mode changed to [Dynamic High-Throughput Traffic Optimization]." }
  ]
};

// Tick Counter / Loop variable
let currentActivePhase: "NS" | "EW" = "NS";

function addLog(type: "info" | "warning" | "alert" | "success", message: string) {
  const timestamp = new Date().toLocaleTimeString();
  simState.systemLogs.unshift({ timestamp, type, message });
  if (simState.systemLogs.length > 50) {
    simState.systemLogs.pop();
  }
}

// Function to generate randomized incoming traffic depending on time & weather
function generateIncomingTraffic() {
  const laneKeys: Array<"N" | "E" | "S" | "W"> = ["N", "E", "S", "W"];
  
  // Rate multipliers based on weather & time of day
  let multiplier = 1.0;
  if (simState.timeOfDay === "rush_hour_am" || simState.timeOfDay === "rush_hour_pm") {
    multiplier = 2.2;
  } else if (simState.timeOfDay === "night") {
    multiplier = 0.4;
  }
  
  if (simState.weather === "rainy") {
    multiplier *= 1.1; // slower traffic build up queue
  } else if (simState.weather === "foggy") {
    multiplier *= 1.2; // visual hazard slowing down
  }

  laneKeys.forEach(key => {
    const lane = simState.lanes[key];
    
    // Add incoming vehicles unless lane has a total accident block
    if (lane.detectedAccident === "collision") {
      // Small chance of building queue as cars stack behind collision
      if (Math.random() > 0.4) lane.vehicles.cars += 1;
      return;
    }

    // Vehicle arrival rate (chance based)
    const arrivalChance = 0.35 * multiplier;
    if (Math.random() < arrivalChance) {
      const roll = Math.random();
      if (roll < 0.6) {
        lane.vehicles.cars += Math.floor(Math.random() * 2) + 1;
      } else if (roll < 0.75) {
        lane.vehicles.motorcycles += Math.floor(Math.random() * 2) + 1;
      } else if (roll < 0.85) {
        lane.vehicles.bicycles += 1;
      } else if (roll < 0.92) {
        lane.vehicles.buses += Math.random() < 0.3 ? 1 : 0;
      } else {
        lane.vehicles.trucks += Math.random() < 0.3 ? 1 : 0;
      }
    }
    
    // Pedestrians arrival rate
    if (Math.random() < 0.25 * multiplier) {
      lane.vehicles.pedestrians += Math.floor(Math.random() * 2) + 1;
    }
  });
}

// Tick the traffic simulation step of movement
function tickSimulation() {
  generateIncomingTraffic();

  // Dynamic timing or Static Timing calculation
  const isEmergencyActive = Object.values(simState.lanes).some(l => l.detectedEmergency !== null);
  
  // Decrease time remaining for current signal
  let activeLanes: Array<"N" | "E" | "S" | "W"> = [];
  if (isEmergencyActive) {
    // Determine priority lane with emergency
    const emergencyLanes = Object.values(simState.lanes).filter(l => l.detectedEmergency !== null);
    const primaryEmergencyLane = emergencyLanes[0]?.id || "N";
    
    // Override! Set emergency lane to green, others to red
    Object.keys(simState.lanes).forEach(k => {
      const lane = simState.lanes[k as "N" | "E" | "S" | "W"];
      if (lane.id === primaryEmergencyLane) {
        if (lane.signalStatus !== "green") {
          lane.signalStatus = "green";
          lane.timeRemaining = 99; // stays priority until cleared or ticks
          addLog("alert", `AI Override: Priority Phase active for ${lane.name} due to ${lane.detectedEmergency?.toUpperCase()} detection.`);
        }
      } else {
        lane.signalStatus = "red";
        lane.timeRemaining = 0;
      }
    });
  } else {
    // No active emergency. Run dynamic or static cycles
    let minTime = 999;
    Object.keys(simState.lanes).forEach(k => {
      const lane = simState.lanes[k as "N" | "E" | "S" | "W"];
      if (lane.signalStatus === "green") {
        lane.timeRemaining = Math.max(0, lane.timeRemaining - 1);
        if (lane.timeRemaining < minTime) minTime = lane.timeRemaining;
        activeLanes.push(lane.id);
      }
    });

    // Check if green cycle expired, switch phases
    if (minTime === 0) {
      if (currentActivePhase === "NS") {
        currentActivePhase = "EW";
        const greenDuration = simState.aiOptimizationActive 
          ? calculateAdaptiveGreenTime("EW") 
          : 15; // static 15s

        simState.lanes.N.signalStatus = "red";
        simState.lanes.N.timeRemaining = greenDuration;
        simState.lanes.S.signalStatus = "red";
        simState.lanes.S.timeRemaining = greenDuration;

        simState.lanes.E.signalStatus = "green";
        simState.lanes.E.timeRemaining = greenDuration;
        simState.lanes.W.signalStatus = "green";
        simState.lanes.W.timeRemaining = greenDuration;

        addLog("info", `Traffic controller switched active phase to EAST-WEST. Adaptive Green Time: ${greenDuration}s.`);
      } else {
        currentActivePhase = "NS";
        const greenDuration = simState.aiOptimizationActive 
          ? calculateAdaptiveGreenTime("NS") 
          : 15; // static 15s

        simState.lanes.E.signalStatus = "red";
        simState.lanes.E.timeRemaining = greenDuration;
        simState.lanes.W.signalStatus = "red";
        simState.lanes.W.timeRemaining = greenDuration;

        simState.lanes.N.signalStatus = "green";
        simState.lanes.N.timeRemaining = greenDuration;
        simState.lanes.S.signalStatus = "green";
        simState.lanes.S.timeRemaining = greenDuration;

        addLog("info", `Traffic controller switched active phase to NORTH-SOUTH. Adaptive Green Time: ${greenDuration}s.`);
      }
    }
  }

  // Vehicles exit on green lanes
  Object.keys(simState.lanes).forEach(k => {
    const lane = simState.lanes[k as "N" | "E" | "S" | "W"];
    
    // Queue length calculation: ~6 meters per vehicle stacked + a small base offset
    const totalVehicles = lane.vehicles.cars + lane.vehicles.buses + lane.vehicles.trucks + lane.vehicles.motorcycles + lane.vehicles.bicycles;
    lane.queueLength = Math.max(0, totalVehicles * 6 + (lane.detectedAccident ? 30 : 0));

    // Wait time calculations
    if (lane.signalStatus === "red") {
      lane.avgWaitTime = Math.min(120, lane.avgWaitTime + (totalVehicles > 0 ? 1.5 : 0.2));
    } else {
      // Greened lane removes vehicles
      let dischargeRate = 2; // base discharge rate per tick
      
      // Optimization adjustments
      if (simState.aiOptimizationActive) {
        if (simState.activeMode === "high_throughput") dischargeRate = 3;
        else if (simState.activeMode === "eco_friendly") dischargeRate = 2.5;
        else if (simState.activeMode === "emergency_focus") dischargeRate = 2;
      }
      
      if (lane.detectedAccident) {
        dischargeRate = Math.max(0.2, dischargeRate * 0.25); // very slow if blocked
      }

      // Perform exit
      for (let i = 0; i < Math.floor(dischargeRate); i++) {
        if (lane.vehicles.cars > 0) { lane.vehicles.cars--; }
        else if (lane.vehicles.motorcycles > 0) { lane.vehicles.motorcycles--; }
        else if (lane.vehicles.bicycles > 0) { lane.vehicles.bicycles--; }
        else if (lane.vehicles.buses > 0) { lane.vehicles.buses--; }
        else if (lane.vehicles.trucks > 0) { lane.vehicles.trucks--; }
      }

      // Pedestrians also cross
      if (lane.vehicles.pedestrians > 0) {
        lane.vehicles.pedestrians = Math.max(0, lane.vehicles.pedestrians - (Math.floor(Math.random() * 3) + 1));
      }

      // Lower wait timings
      lane.avgWaitTime = Math.max(4, lane.avgWaitTime - 3);
    }
  });

  // Calculate comparative parameters
  let totalVehiclesAtIntersection = 0;
  Object.values(simState.lanes).forEach(lane => {
    totalVehiclesAtIntersection += lane.vehicles.cars + lane.vehicles.buses*1.5 + lane.vehicles.trucks*2.0 + lane.vehicles.motorcycles*0.5;
  });

  // Calculate CO2 emissions
  // Red signals idling emit high CO2. Dynamic timing minimizes idling.
  let currentCO2 = 0;
  Object.values(simState.lanes).forEach(lane => {
    const isRed = lane.signalStatus === "red";
    const carEmissions = lane.vehicles.cars * (isRed ? 85 : 55); 
    const truckEmissions = lane.vehicles.trucks * (isRed ? 220 : 140);
    const busEmissions = lane.vehicles.buses * (isRed ? 180 : 110);
    const motoEmissions = lane.vehicles.motorcycles * (isRed ? 40 : 25);
    currentCO2 += carEmissions + truckEmissions + busEmissions + motoEmissions;
  });

  // Smoothing index
  simState.totalCO2Emissions = Math.floor(simState.totalCO2Emissions * 0.85 + currentCO2 * 0.15);
  
  // Calculate average intersection wait time
  let totalLanesWait = 0;
  Object.values(simState.lanes).forEach(l => totalLanesWait += l.avgWaitTime);
  simState.averageIntersectionWaitTime = parseFloat((totalLanesWait / 4).toFixed(1));

  // Saving calculations vs fallback
  if (simState.aiOptimizationActive) {
    simState.co2SavedPercentage = parseFloat((32.1 - (simState.averageIntersectionWaitTime * 0.4)).toFixed(1));
    simState.co2SavedPercentage = Math.max(5, Math.min(48, simState.co2SavedPercentage));
  } else {
    simState.co2SavedPercentage = 0;
  }
}

// Calculate optimized green timings depending on traffic volume
function calculateAdaptiveGreenTime(phase: "NS" | "EW"): number {
  let volume = 0;
  if (phase === "NS") {
    volume = simState.lanes.N.queueLength + simState.lanes.S.queueLength;
  } else {
    volume = simState.lanes.E.queueLength + simState.lanes.W.queueLength;
  }

  // Base timer is 10s, goes up to 35s max
  let duration = 12 + Math.floor(volume * 0.18);
  
  // Mode modifications
  if (simState.activeMode === "high_throughput") {
    duration = Math.min(45, duration + 5);
  } else if (simState.activeMode === "eco_friendly") {
    duration = Math.max(10, Math.min(28, duration - 2)); // optimize transition bounds to avoid high carbon stalls
  }

  return duration;
}

// Background simulation loop
setInterval(tickSimulation, 3000);


/* --- REST API ENDPOINTS --- */

// API 1: Fetch live simulator state
app.get("/api/sim/state", (req, res) => {
  res.json(simState);
});

// API 2: Configure state parameters (weather, mode, settings)
app.post("/api/sim/control", (req, res) => {
  const { weather, timeOfDay, aiOptimizationActive, activeMode } = req.body;
  
  if (weather !== undefined) simState.weather = weather as WeatherType;
  if (timeOfDay !== undefined) simState.timeOfDay = timeOfDay as TimeOfDayType;
  if (aiOptimizationActive !== undefined) simState.aiOptimizationActive = !!aiOptimizationActive;
  if (activeMode !== undefined) simState.activeMode = activeMode as "high_throughput" | "eco_friendly" | "emergency_focus" | "standard";

  addLog("success", `System parameters modified: Weather=${simState.weather.toUpperCase()}, Time=${simState.timeOfDay.toUpperCase()}, Optimizer=${simState.aiOptimizationActive ? "ON":"OFF"}, Mode=${simState.activeMode}`);
  res.json({ success: true, state: simState });
});

// API 3: Injects an emergency vehicle into a specific lane
app.post("/api/sim/inject-emergency", (req, res) => {
  const { laneId, type } = req.body as { laneId: "N" | "E" | "S" | "W", type: "ambulance" | "fire_truck" | "police" };
  
  if (!laneId || !type) {
    return res.status(400).json({ error: "laneId and type required" });
  }

  const lane = simState.lanes[laneId];
  lane.detectedEmergency = type;
  
  // Also bump counts
  if (type === "ambulance") lane.vehicles.cars++;
  
  addLog("alert", `CRITICAL: ${type.toUpperCase()} detected on ${lane.name} via YOLOv8 CCTV Analyzer! Transitioning signals.`);
  
  // Force simulate cycle tick to apply immediately
  tickSimulation();
  
  res.json({ success: true, state: simState });
});

// API 4: Injects an accident into a specific lane
app.post("/api/sim/inject-accident", (req, res) => {
  const { laneId, type } = req.body as { laneId: "N" | "E" | "S" | "W", type: "collision" | "stalled" };
  
  if (!laneId || !type) {
    return res.status(400).json({ error: "laneId and type required" });
  }

  const lane = simState.lanes[laneId];
  lane.detectedAccident = type;
  addLog("warning", `INCIDENT ALERT: ${type.toUpperCase()} reported on ${lane.name}. High congestion expected, AI rerouting recommended.`);
  
  res.json({ success: true, state: simState });
});

// API 5: Clears any emergencies or accidents on a lane
app.post("/api/sim/clear-event", (req, res) => {
  const { laneId, clearEmergency, clearAccident } = req.body as { laneId: "N" | "E" | "S" | "W", clearEmergency?: boolean, clearAccident?: boolean };
  
  if (!laneId) {
    return res.status(400).json({ error: "laneId required" });
  }

  const lane = simState.lanes[laneId];
  if (clearEmergency) {
    const prev = lane.detectedEmergency;
    lane.detectedEmergency = null;
    addLog("success", `RESOLVED: ${prev?.toUpperCase()} cleared on ${lane.name}. Returning to dynamic scheduling.`);
  }
  if (clearAccident) {
    const prev = lane.detectedAccident;
    lane.detectedAccident = null;
    addLog("success", `RESOLVED: Incident (${prev?.toUpperCase()}) cleared on ${lane.name}. Lane flow recovered.`);
  }

  res.json({ success: true, state: simState });
});

// API 6: Simulate a single step immediately
app.post("/api/sim/step", (req, res) => {
  tickSimulation();
  res.json(simState);
});

// API 7: Fetch traffic predictions for visual graphs
app.get("/api/sim/predictions", (req, res) => {
  const predictions: TrafficPrediction[] = [];
  const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
  
  hours.forEach(hr => {
    let baseDensity = 30;
    if (hr === "08:00" || hr === "18:00") baseDensity = 85; // Peak Rush
    else if (hr === "12:00" || hr === "16:00") baseDensity = 60;
    else if (hr === "22:00") baseDensity = 20;

    // Small weather adjustments
    if (simState.weather === "rainy") baseDensity += 10;
    
    predictions.push({
      hour: hr,
      predictedDensity: Math.min(100, Math.floor(baseDensity + (Math.random() * 8 - 4))),
      predictedVolume: Math.floor(baseDensity * 1.8 + (Math.random() * 20 - 10)),
      recommendedGreenDuration: Math.max(10, Math.floor(baseDensity * 0.4))
    });
  });

  res.json(predictions);
});

// API 8: Dynamic Gemini Traffiic Optimization Analyzer
app.post("/api/gemini/optimize", async (req, res) => {
  try {
    const client = getGeminiClient();
    
    // Build traffic summary to send to model
    const summary = Object.values(simState.lanes).map(lane => {
      const isEvent = lane.detectedAccident || lane.detectedEmergency;
      return `Lane ${lane.id} (${lane.name}):
- Vehicles: Cars(${lane.vehicles.cars}), Buses(${lane.vehicles.buses}), Trucks(${lane.vehicles.trucks}), Motorcycles(${lane.vehicles.motorcycles}), Pedestrians(${lane.vehicles.pedestrians})
- Queue Length: ${lane.queueLength}m
- Average Wait Time: ${lane.avgWaitTime}s
- Active Hazards/Events: ${isEvent ? `Emergency (${lane.detectedEmergency}) / Accident (${lane.detectedAccident})` : 'None'}`;
    }).join("\n");

    const prompt = `You are the AI Decision Engine of SmartFlow AI, an advanced computer-vision-powered Smart Traffic Management System.
Analyze the following active 4-way intersection state and provide an optimization recommendation:

WEATHER: ${simState.weather}
TIME OF DAY: ${simState.timeOfDay}
CURRENT MODE: ${simState.activeMode}

ACTIVE INTERSECTION STATES:
${summary}

Provide a short, structured optimization recommendation in solid JSON mode. The JSON must exactly match the following TypeScript interface:
{
  "recommendation": "Brief high level strategy (1-2 sentences)",
  "suggestedTimings": { "N": number, "E": number, "S": number, "W": number }, // suggested duration of green light in seconds for each direction
  "reasoning": "Scientific reasoning for timings (density metrics, pedestrian crossings, idle CO2 output etc.)",
  "priorityMetrics": "A one sentence summary of which lane needs critical priority."
}

Respond ONLY with valid JSON. Do not write any markdown code fences in your reply, just the raw JSON text.`;

    const model = "gemini-3.5-flash"; 
    const result = await client.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(result.text || "{}");
    res.json(parsed);

  } catch (error: any) {
    console.error("Gemini optimization API error:", error);
    // Return robust analysis dynamically computed when key is unavailable
    const fallbackTimings = {
      N: Math.max(10, Math.floor(simState.lanes.N.queueLength * 0.5)),
      E: Math.max(10, Math.floor(simState.lanes.E.queueLength * 0.5)),
      S: Math.max(10, Math.floor(simState.lanes.S.queueLength * 0.5)),
      W: Math.max(10, Math.floor(simState.lanes.W.queueLength * 0.5))
    };
    
    const maxQueueLane = Object.values(simState.lanes).reduce((prev, current) => (prev.queueLength > current.queueLength) ? prev : current);
    
    res.json({
      recommendation: `[LOCAL AI HYBRID ENGINE] Dynamic focus allocated to mitigate queue building. Rerouting rules enabled.`,
      suggestedTimings: fallbackTimings,
      reasoning: `Calculated from local simulation neural nodes. ${maxQueueLane.name} has peak traffic queue of ${maxQueueLane.queueLength}m, resulting in maximum weight priority.`,
      priorityMetrics: `Lane ${maxQueueLane.id} (${maxQueueLane.id === 'N' || maxQueueLane.id === 'S' ? 'Broadway Ave' : '4th Street'}) currently has peak wait index.`,
      errorMsg: error?.message || "Gemini API key unavailable. Operating in Local SmartFlow Engine."
    });
  }
});

// API 9: Chat Assistant with Gemini
app.post("/api/gemini/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    const client = getGeminiClient();
    
    // Snapshot state representation for prompt injection
    const summary = Object.values(simState.lanes).map(lane => {
      const eventInfo = [
        lane.detectedEmergency ? `Emergency (${lane.detectedEmergency})` : "",
        lane.detectedAccident ? `Accident (${lane.detectedAccident})` : ""
      ].filter(Boolean).join(", ") || "None";
      return `Lane ${lane.id} (${lane.name}): Status=${lane.signalStatus.toUpperCase()}, Total cars=${lane.vehicles.cars}, Queue=${lane.queueLength}m, WaitTime=${lane.avgWaitTime}s, Events=${eventInfo}`;
    }).join("\n");

    const prompt = `You are the chief SmartFlow AI Systems Administrator Assistant. You monitor a smart 4-way traffic intersection governed by YOLOv8 deep learning and computer vision pipelines, routing emergency priorities and minimizing idling carbon emissions.
    
    CURRENT SIMULATED SYSTEM STATE:
    - Weather: ${simState.weather.toUpperCase()}
    - Time of Day: ${simState.timeOfDay.toUpperCase()}
    - Dynamic AI Optimizer Mode: ${simState.lanes.N.signalStatus === 'green' ? 'North/South Active' : 'East/West Active'}
    - Cumulative Daily Carbon Savings: ${simState.co2SavedPercentage}%
    - Average Wait: ${simState.averageIntersectionWaitTime}s
    - Mode Profile: ${simState.activeMode}
    Lanes Snapshot:
    ${summary}

    User Question: "${message}"

    Reply with professional city administration authority, technical expertise, and detailed action points. Keep the response concise, formatted beautifully in markdown, and reference the actual intersection lanes if applicable.`;

    const model = "gemini-3.5-flash";
    const response = await client.models.generateContent({
      model: model,
      contents: prompt,
    });

    res.json({ text: response.text });

  } catch (error: any) {
    console.error("Gemini Chat API error:", error);
    // Hybrid local assistant logic
    let fallbackReply = `Hello Inspector, I am the SmartFlow Dynamic Local Monitor.

The Gemini AI capability is currently running on Local Mode (as process.env.GEMINI_API_KEY is not configured yet). 

Here are the critical metrics I've compiled:
1. **Intersection State**: The current phase is active. Weather is **${simState.weather}**.
2. **Alerts**: ${Object.values(simState.lanes).some(l => l.detectedEmergency || l.detectedAccident) ? "Active incident detected! Check the lane maps alert." : "No current accidents or active fire/ambulance priorities."}
3. **Optimizations**: Emitting ${simState.totalCO2Emissions} g/min of carbon, giving us **${simState.co2SavedPercentage}% CO2 reduction savings** under current AI profile settings.

Would you like helper instructions on setting up your Gemini API secret to test full-context deep reasoning? You can easily do so in the Secrets panel!`;
    
    res.json({ text: fallbackReply, errorMsg: error?.message });
  }
});


// Configure dev & production static serving paths
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving compiled static assets from dist.");
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartFlow AI Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
