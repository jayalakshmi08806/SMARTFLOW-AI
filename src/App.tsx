import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  AlertTriangle, 
  Bell, 
  Bot, 
  Brain, 
  Car, 
  Clock, 
  Cloud, 
  CloudFog, 
  CloudRain, 
  CloudSnow, 
  Database, 
  Flame, 
  Gauge, 
  HelpCircle, 
  Info, 
  Leaf, 
  Moon, 
  Play, 
  Radio, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  Sparkles, 
  Sun, 
  Sunset, 
  TrendingUp, 
  Truck, 
  Users, 
  VolumeX, 
  Zap 
} from "lucide-react";
import { SimState, TrafficPrediction, WeatherType, TimeOfDayType, LaneState } from "./types";

export default function App() {
  // Live Simulator state
  const [simState, setSimState] = useState<SimState | null>(null);
  const [predictions, setPredictions] = useState<TrafficPrediction[]>([]);
  const [activeLaneTab, setActiveLaneTab] = useState<"N" | "E" | "S" | "W">("N");
  
  // Controls Form States
  const [weatherValue, setWeatherValue] = useState<WeatherType>("clear");
  const [timeValue, setTimeValue] = useState<TimeOfDayType>("afternoon");
  const [aiActive, setAiActive] = useState<boolean>(true);
  const [modeValue, setModeValue] = useState<"high_throughput" | "eco_friendly" | "emergency_focus" | "standard">("high_throughput");

  // Emergency & Accident Inject parameters
  const [injectLane, setInjectLane] = useState<"N" | "E" | "S" | "W">("N");
  
  // Gemini Interactive Analysis States
  const [geminiAnalysis, setGeminiAnalysis] = useState<{
    recommendation: string;
    suggestedTimings: { N: number; E: number; S: number; W: number };
    reasoning: string;
    priorityMetrics: string;
    errorMsg?: string;
  } | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);

  // Gemini Chat States
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { 
      sender: "bot", 
      text: "Welcome to the SmartFlow Headquarters. I'm connected to the YOLOv8 lane sensors, CCTV visual models, and the adaptive decision model. How can I assist you in managing the metropolitan grid today?" 
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Poll intervals
  useEffect(() => {
    fetchState();
    fetchPredictions();

    const interval = setInterval(() => {
      fetchState();
    }, 3000); // sync state matching simulation ticks

    return () => clearInterval(interval);
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch("/api/sim/state");
      if (res.ok) {
        const data = await res.json();
        setSimState(data);
        
        // Sync our input states with current values if initializing
        if (data) {
          setWeatherValue(data.weather);
          setTimeValue(data.timeOfDay);
          setAiActive(data.aiOptimizationActive);
          setModeValue(data.activeMode);
        }
      }
    } catch (e) {
      console.error("Error fetching simulation state:", e);
    }
  };

  const fetchPredictions = async () => {
    try {
      const res = await fetch("/api/sim/predictions");
      if (res.ok) {
        const data = await res.json();
        setPredictions(data);
      }
    } catch (e) {
      console.error("Error fetching predictions:", e);
    }
  };

  // Trigger server controls update
  const handleControlChange = async (params: {
    weather?: WeatherType;
    timeOfDay?: TimeOfDayType;
    aiOptimizationActive?: boolean;
    activeMode?: "high_throughput" | "eco_friendly" | "emergency_focus" | "standard";
  }) => {
    try {
      const res = await fetch("/api/sim/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weather: params.weather !== undefined ? params.weather : weatherValue,
          timeOfDay: params.timeOfDay !== undefined ? params.timeOfDay : timeValue,
          aiOptimizationActive: params.aiOptimizationActive !== undefined ? params.aiOptimizationActive : aiActive,
          activeMode: params.activeMode !== undefined ? params.activeMode : modeValue
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimState(data.state);
        // also reload predictions if weather changed
        if (params.weather) {
          fetchPredictions();
        }
      }
    } catch (e) {
      console.error("Error modifying controls:", e);
    }
  };

  // Immediate Single Step tick
  const handleSimStep = async () => {
    try {
      const res = await fetch("/api/sim/step", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSimState(data);
      }
    } catch (e) {
      console.error("Error stepping simulation:", e);
    }
  };

  // Inject Emergency vehicles
  const injectEmergency = async (type: "ambulance" | "fire_truck" | "police") => {
    try {
      const res = await fetch("/api/sim/inject-emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: injectLane, type })
      });
      if (res.ok) {
        const data = await res.json();
        setSimState(data.state);
      }
    } catch (e) {
      console.error("Error injecting emergency:", e);
    }
  };

  // Inject Accident blockages
  const injectAccident = async (type: "collision" | "stalled") => {
    try {
      const res = await fetch("/api/sim/inject-accident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: injectLane, type })
      });
      if (res.ok) {
        const data = await res.json();
        setSimState(data.state);
      }
    } catch (e) {
      console.error("Error injecting accident:", e);
    }
  };

  // Clear Event on lane
  const clearLaneEvent = async (laneId: "N" | "E" | "S" | "W", clearEmergency: boolean, clearAccident: boolean) => {
    try {
      const res = await fetch("/api/sim/clear-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId, clearEmergency, clearAccident })
      });
      if (res.ok) {
        const data = await res.json();
        setSimState(data.state);
      }
    } catch (e) {
      console.error("Error clearing lane events:", e);
    }
  };

  // Ask Gemini to optimize the intersection
  const runGeminiOptimization = async () => {
    setLoadingAnalysis(true);
    setGeminiAnalysis(null);
    try {
      const res = await fetch("/api/gemini/optimize", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGeminiAnalysis(data);
      }
    } catch (e) {
      console.error("Error requesting Gemini Optimization:", e);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Chat with Gemini system administrator
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { sender: "bot", text: data.text }]);
      } else {
        setChatMessages(prev => [...prev, { sender: "bot", text: "I'm having trouble analyzing the core database. Please check connection parameters." }]);
      }
    } catch (err) {
      console.error("Error in assistant chat:", err);
      setChatMessages(prev => [...prev, { sender: "bot", text: "Systems offline. Failed to broadcast transmission message." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!simState) {
    return (
      <div className="w-full min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
            <div className="w-16 h-16 bg-cyan-950 border-2 border-cyan-500 rounded-full flex items-center justify-center text-cyan-400 rotate-180">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">BOOTING SMARTFLOW AI</h1>
          <p className="text-sm text-cyan-400 font-mono tracking-widest uppercase animate-pulse">Initializing YOLOv8 Lane Detection Pipeline...</p>
        </div>
      </div>
    );
  }

  // Identify lanes
  const { N, E, S, W } = simState.lanes;
  const lanesArray = Object.values(simState.lanes) as LaneState[];
  const anyEmergency = lanesArray.some(l => l.detectedEmergency !== null);
  const anyAccident = lanesArray.some(l => l.detectedAccident !== null);

  // Helper icons for Weather & Times
  const getWeatherIcon = (w: WeatherType) => {
    switch (w) {
      case "rainy": return <CloudRain className="w-5 h-5 text-blue-400" />;
      case "foggy": return <CloudFog className="w-5 h-5 text-slate-400" />;
      case "snowy": return <CloudSnow className="w-5 h-5 text-sky-200" />;
      default: return <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />;
    }
  };

  const getTimeIcon = (t: TimeOfDayType) => {
    switch (t) {
      case "morning": return <SunriseIcon className="w-5 h-5 text-yellow-300" />;
      case "rush_hour_am": return <Zap className="w-5 h-5 text-orange-400" />;
      case "rush_hour_pm": return <Zap className="w-5 h-5 text-purple-400" />;
      case "night": return <Moon className="w-5 h-5 text-blue-300" />;
      default: return <Sunset className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div id="smartflow-root" className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-x-hidden antialiased">
      
      {/* 1. Header Navigation */}
      <header id="header-nav" className="sticky top-0 z-50 h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display leading-none">SMARTFLOW AI</h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 bg-cyan-950 border border-cyan-800 rounded font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
                Simulation Live
              </span>
            </div>
            <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mt-0.5">METROPOLITAN GRID CONTROLLER v4.2.0</p>
          </div>
        </div>

        {/* Global Connection Health Status */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-mono">VISION LATENCY: <span className="text-white">12ms</span></span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">YOLOv8 DETECTOR ACTIVE</span>
            </div>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-800 hidden md:block"></div>
          
          <div className="text-right">
            <div className="text-sm sm:text-base font-mono font-bold text-white tracking-wider flex items-center gap-2 justify-end">
              <Clock className="w-4 h-4 text-cyan-400 inline" />
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">ZONE 07-B • FOUR-WAY GRID</div>
          </div>
        </div>
      </header>

      {/* Main Grid Dashboard */}
      <main id="dashboard-grid" className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* ==================== LEFT AREA: CAMERA FEEDS & CONTROLLER (4 COLS) ==================== */}
        <section id="camera-feeds-side" className="xl:col-span-4 flex flex-col gap-5">
          
          {/* Live Visual Feeds Box */}
          <div id="live-feeds-container" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></div>
                <h2 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">CCTV Vision AI Streams</h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 bg-cyan-950/50 border border-cyan-900/40 rounded">
                YOLOv8 Edge Core
              </span>
            </div>

            {/* Lane Cameras Tabs */}
            <div className="grid grid-cols-4 gap-1 mb-3">
              {(["N", "E", "S", "W"] as const).map(laneKey => {
                const lane = simState.lanes[laneKey];
                const isEmergency = lane.detectedEmergency !== null;
                const isAccident = lane.detectedAccident !== null;
                let activeBorder = "border-slate-800 text-slate-400 bg-slate-950/40";
                
                if (activeLaneTab === laneKey) {
                  activeBorder = "border-cyan-500 text-cyan-400 bg-cyan-950/20";
                }
                if (isEmergency) {
                  activeBorder = "border-red-500 text-red-500 bg-red-950/20 animate-pulse";
                } else if (isAccident) {
                  activeBorder = "border-amber-500 text-amber-500 bg-amber-950/20";
                }

                return (
                  <button
                    key={laneKey}
                    id={`tab-lane-${laneKey}`}
                    onClick={() => setActiveLaneTab(laneKey)}
                    className={`py-1.5 px-1 rounded-md text-xs font-mono font-bold border transition-all text-center ${activeBorder}`}
                  >
                    CAM_{laneKey}
                    {isEmergency && <span className="block text-[8px] text-red-400">EMERG</span>}
                    {isAccident && <span className="block text-[8px] text-amber-400">BLOCKED</span>}
                  </button>
                );
              })}
            </div>

            {/* Main Active Live Feed Simulator View */}
            <div id="main-active-stream" className="relative h-56 bg-gradient-to-b from-slate-950 to-slate-900 rounded-lg overflow-hidden border border-slate-800 flex flex-col justify-end">
              {/* Scanline & Overlay Textures */}
              <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[length:100%_4px,_6px_100%]"></div>
              
              {/* Camera Tag Overlay */}
              <div className="absolute top-2 left-2 z-10 bg-black/80 border border-slate-800 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-cyan-400 font-bold">LIVE FEED // CAM_{activeLaneTab}</span>
                <span className="text-slate-500 border-l border-slate-800 pl-1.5">{simState.lanes[activeLaneTab].name}</span>
              </div>

              {/* Status Banner */}
              {simState.lanes[activeLaneTab].detectedEmergency && (
                <div className="absolute top-10 left-2 right-2 bg-red-950/90 border border-red-500 px-3 py-1.5 rounded flex items-center gap-2 z-10 animate-bounce">
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-ping shrink-0" />
                  <div className="text-[10px] font-mono text-white leading-tight">
                    <span className="font-bold text-red-400">EMERGENCY PRIORITY OVERRIDE</span>
                    <p>{simState.lanes[activeLaneTab].detectedEmergency?.toUpperCase()} DEPLOYED</p>
                  </div>
                </div>
              )}

              {simState.lanes[activeLaneTab].detectedAccident && (
                <div className="absolute top-10 left-2 right-2 bg-amber-950/90 border border-amber-500 px-3 py-1.5 rounded flex items-center gap-2 z-10 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-[10px] font-mono text-white leading-tight">
                    <span className="font-bold text-amber-400">COLLISION / ACCIDENT BLOCKED</span>
                    <p>HIGH BACKLOG BUILDUP</p>
                  </div>
                </div>
              )}

              {/* Schematic YOLOv8 bounding boxes representation */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="grid grid-cols-3 gap-2 w-full max-w-xs opacity-80 text-center">
                  <div className="bg-slate-900/40 p-1.5 border border-cyan-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">CARS</div>
                    <div className="text-sm font-bold font-mono text-cyan-400 glow-cyan">{simState.lanes[activeLaneTab].vehicles.cars}</div>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 border border-indigo-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">BUSES</div>
                    <div className="text-sm font-bold font-mono text-indigo-400">{simState.lanes[activeLaneTab].vehicles.buses}</div>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 border border-purple-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">TRUCKS</div>
                    <div className="text-sm font-bold font-mono text-purple-400">{simState.lanes[activeLaneTab].vehicles.trucks}</div>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 border border-yellow-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">MOTORS</div>
                    <div className="text-sm font-bold font-mono text-yellow-400">{simState.lanes[activeLaneTab].vehicles.motorcycles}</div>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 border border-emerald-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">PEDESTRIAN</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">{simState.lanes[activeLaneTab].vehicles.pedestrians}</div>
                  </div>
                  <div className="bg-slate-900/40 p-1.5 border border-sky-500/30 rounded">
                    <div className="text-[9px] text-slate-500 font-mono">QUEUE</div>
                    <div className="text-sm font-bold font-mono text-sky-400">{simState.lanes[activeLaneTab].queueLength}m</div>
                  </div>
                </div>
              </div>

              {/* Camera metadata at the bottom */}
              <div className="bg-black/95 border-t border-slate-900 px-3 py-2 flex items-center justify-between text-[10px] font-mono z-10">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-slate-400">YOLO: CONFIDENCE 99.1%</span>
                </div>
                <div className="text-slate-500 uppercase">FPS: 30 • ENCODER: NVENC</div>
              </div>
            </div>
          </div>

          {/* Configuration & Controls Parameters Panel */}
          <div id="system-controls" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-bold font-display uppercase tracking-wider text-slate-300">Administrative Knobs</h2>
              </div>
              <button
                id="btn-trigger-tick"
                onClick={handleSimStep}
                title="Force process single simulation traffic tick step immediately"
                className="p-1 px-2 border border-slate-800 bg-slate-950 hover:bg-slate-900 font-mono text-[9px] text-cyan-400 rounded transition-colors flex items-center gap-1.5"
              >
                <Play className="w-2.5 h-2.5" />
                FORCE STEP
              </button>
            </div>

            {/* Grid for parameters */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              
              {/* Weather selection */}
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Weather Setting</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {(["clear", "rainy", "foggy", "snowy"] as WeatherType[]).map(w => (
                    <button
                      key={w}
                      id={`ctrl-weather-${w}`}
                      onClick={() => {
                        setWeatherValue(w);
                        handleControlChange({ weather: w });
                      }}
                      className={`py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        weatherValue === w 
                          ? "bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time profile selection */}
              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Time of Day</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {([
                    { id: "morning", sym: "MORNING" },
                    { id: "afternoon", sym: "AFTERNOON" },
                    { id: "rush_hour_am", sym: "AM RUSH" },
                    { id: "rush_hour_pm", sym: "PM RUSH" },
                    { id: "night", sym: "NIGHT" }
                  ] as { id: TimeOfDayType; sym: string }[]).map(t => (
                    <button
                      key={t.id}
                      id={`ctrl-time-${t.id}`}
                      onClick={() => {
                        setTimeValue(t.id);
                        handleControlChange({ timeOfDay: t.id });
                      }}
                      className={`py-1 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                        timeValue === t.id 
                          ? "bg-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.4)]" 
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {t.sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Optimization Mode Selection */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${aiActive ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Dynamic Signal controller</label>
                </div>
                <button
                  id="toggle-ai-optimization"
                  onClick={() => {
                    const next = !aiActive;
                    setAiActive(next);
                    handleControlChange({ aiOptimizationActive: next });
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                    aiActive 
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/40" 
                      : "bg-rose-950/40 text-rose-400 border-rose-500/40"
                  }`}
                >
                  {aiActive ? "ACTIVE OPTIMIZING" : "STATIC CYCLE"}
                </button>
              </div>

              {/* Dropdown/Select option for active Mode Profiles */}
              {aiActive && (
                <div className="mt-2 text-xs">
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "high_throughput", label: "THROUGHPUT", icon: <TrendingUp className="w-3 h-3 text-cyan-400" /> },
                      { id: "eco_friendly", label: "ECO SAVINGS", icon: <Leaf className="w-3 h-3 text-emerald-400" /> },
                      { id: "emergency_focus", label: "EMERG FORCE", icon: <ShieldAlert className="w-3 h-3 text-rose-400" /> }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        id={`ctrl-mode-${opt.id}`}
                        onClick={() => {
                          setModeValue(opt.id as any);
                          handleControlChange({ activeMode: opt.id as any });
                        }}
                        className={`p-1.5 rounded border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                          modeValue === opt.id 
                            ? "bg-slate-900 border-indigo-500 text-white" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {opt.icon}
                        <span className="text-[8px] font-bold font-mono tracking-tighter">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Live Statistics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Pollution-Aware Index</div>
                <div className="text-sm font-mono text-emerald-450 font-bold mt-1 tracking-tight flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400">{simState.totalCO2Emissions} <span className="text-[8px] text-slate-500">g/min</span></span>
                </div>
                <span className="text-[9px] text-emerald-500 block font-mono mt-0.5">-{simState.co2SavedPercentage}% emission idling delay</span>
              </div>

              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Average Wait Time</div>
                <div className="text-sm font-mono text-orange-400 font-bold mt-1 tracking-tight flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>{simState.averageIntersectionWaitTime}s</span>
                </div>
                <span className="text-[9px] text-indigo-400 block font-mono mt-0.5">Flow: Adaptive Dynamic</span>
              </div>
            </div>

          </div>

          {/* Incident Injector Panel */}
          <div id="incident-injector" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex justify-between items-center pb-1 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h2 className="text-xs font-bold font-display uppercase tracking-wider text-slate-300">Stress-Test Incident Injector</h2>
              </div>
              <span className="text-[8px] font-mono text-slate-500 uppercase">Live Pipeline Test</span>
            </div>

            {/* Target Lane Selection */}
            <div className="flex items-center justify-between text-xs bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 pl-1 uppercase">Target Lane:</span>
              <div className="flex gap-1">
                {(["N", "E", "S", "W"] as const).map(laneKey => (
                  <button
                    key={laneKey}
                    id={`inject-lane-sel-${laneKey}`}
                    onClick={() => setInjectLane(laneKey)}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      injectLane === laneKey 
                        ? "bg-slate-800 text-white border border-slate-700" 
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {laneKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              
              {/* Emergency Injects */}
              <div className="space-y-1">
                <span className="block text-[8px] uppercase font-mono tracking-widest text-slate-500">Emergency Vehicles</span>
                <button
                  id="inject-ambulance"
                  onClick={() => injectEmergency("ambulance")}
                  className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/40 border border-red-800/60 rounded text-red-200 font-bold flex items-center justify-center gap-1"
                >
                  <Flame className="w-3 h-3 text-red-400" />
                  + AMBULANCE
                </button>
                <button
                  id="inject-fire"
                  onClick={() => injectEmergency("fire_truck")}
                  className="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/60 rounded text-rose-200 font-bold flex items-center justify-center gap-1"
                >
                  <Flame className="w-3 h-3 text-rose-400" />
                  + FIRE TRUCK
                </button>
              </div>

              {/* Accident / Blockage Injects */}
              <div className="space-y-1">
                <span className="block text-[8px] uppercase font-mono tracking-widest text-slate-500">Vehicle Blockages</span>
                <button
                  id="inject-collision"
                  onClick={() => injectAccident("collision")}
                  className="w-full py-1.5 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/60 rounded text-amber-200 font-bold flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  + COLLISION
                </button>
                <button
                  id="inject-stalled"
                  onClick={() => injectAccident("stalled")}
                  className="w-full py-1.5 bg-yellow-950/40 hover:bg-yellow-900/40 border border-yellow-800/60 rounded text-yellow-200 font-bold flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                  + STALLED VEH
                </button>
              </div>

            </div>

            {/* Clear-Out Control Section */}
            <div className="border-t border-slate-800 pt-2 flex flex-col gap-1.5">
              <span className="text-[8px] uppercase font-mono tracking-widest text-indigo-400 block">Active Incidents Cleaners</span>
              <div className="grid grid-cols-2 gap-1.5">
                {lanesArray.map(lane => {
                  const hasE = lane.detectedEmergency;
                  const hasA = lane.detectedAccident;
                  if (!hasE && !hasA) return null;

                  return (
                    <div key={lane.id} className="col-span-2 p-2 bg-slate-950/80 border border-slate-800 rounded flex justify-between items-center text-[10px]">
                      <span className="font-mono text-slate-300 font-bold">LANE {lane.id}: {hasE?.toUpperCase() || hasA?.toUpperCase()}</span>
                      <div className="flex gap-1">
                        {hasE && (
                          <button
                            id={`clear-emergency-lane-${lane.id}`}
                            onClick={() => clearLaneEvent(lane.id, true, false)}
                            className="px-1.5 py-0.5 bg-red-900/30 text-red-200 hover:bg-red-900/50 border border-red-800 rounded font-bold"
                          >
                            CLEAR EMER
                          </button>
                        )}
                        {hasA && (
                          <button
                            id={`clear-accident-lane-${lane.id}`}
                            onClick={() => clearLaneEvent(lane.id, false, true)}
                            className="px-1.5 py-0.5 bg-amber-900/30 text-amber-200 hover:bg-amber-905/50 border border-amber-800 rounded font-bold"
                          >
                            CLEAR BLK
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!anyEmergency && !anyAccident && (
                  <div className="col-span-2 text-center text-slate-500 py-1.5 font-mono text-[9px]">
                    No active blockages or priorities configured in the intersection.
                  </div>
                )}
              </div>
            </div>

          </div>

        </section>

        {/* ==================== CENTER AREA: LIVE INTERSECTION & PREDICTION (5 COLS) ==================== */}
        <section id="intersection-viz-area" className="xl:col-span-5 flex flex-col gap-5">
          
          {/* Main 4-Way Intersection Monitor */}
          <div id="4way-intersection-box" className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-lg flex-1 flex flex-col justify-between min-h-[460px]">
            
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">Dynamic 4-Way Intersection Grid</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">YOLOv8 Lane Density Engine Online</p>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Interactive Layout</span>
                <span className="block text-xs font-mono font-bold text-white uppercase">{simState.weather} • {simState.timeOfDay}</span>
              </div>
            </div>

            {/* Simulated interactive map map view */}
            <div className="flex-1 relative flex items-center justify-center my-6">
              
              {/* Crossroads background lines */}
              {/* North / South road */}
              <div className="absolute w-24 h-full bg-slate-950 border-l border-r border-slate-800 flex flex-col justify-between">
                <div className="w-full flex-1 border-b border-dashed border-slate-800"></div>
                <div className="h-24 bg-transparent border-t border-b border-dashed border-slate-800"></div>
                <div className="w-full flex-1 border-t border-dashed border-slate-800"></div>
              </div>

              {/* East / West road */}
              <div className="absolute h-24 w-full bg-slate-950 border-t border-b border-slate-800 flex justify-between">
                <div className="h-full flex-1 border-r border-dashed border-slate-800"></div>
                <div className="w-24 bg-transparent border-l border-r border-dashed border-slate-800"></div>
                <div className="h-full flex-1 border-l border-dashed border-slate-800"></div>
              </div>

              {/* Center Traffic controller box */}
              <div className="absolute w-20 h-20 bg-slate-900 border-2 border-slate-800 rounded-lg z-20 flex flex-col items-center justify-center shadow-lg">
                <div className="text-[8px] text-slate-500 uppercase font-mono tracking-tighter">Signal Timing</div>
                
                {/* Find the remaining countdown of the green lane */}
                <span className="text-xl font-mono font-bold text-cyan-400 animate-pulse">
                  {Math.max(
                    simState.lanes.N.signalStatus === "green" ? simState.lanes.N.timeRemaining : 0, 
                    simState.lanes.E.signalStatus === "green" ? simState.lanes.E.timeRemaining : 0,
                    simState.lanes.S.signalStatus === "green" ? simState.lanes.S.timeRemaining : 0,
                    simState.lanes.W.signalStatus === "green" ? simState.lanes.W.timeRemaining : 0
                  )}s
                </span>
                
                <div className="text-[7px] text-cyan-500 font-mono tracking-widest uppercase">
                  {simState.lanes.N.signalStatus === "green" ? "NS PHASE" : "EW PHASE"}
                </div>
              </div>

              {/* DIRECTIONAL CARDS OVERLAID IN CORNERS OR LANES */}
              
              {/* North Lane (Broadway Ave) - Top Center */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-center">
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-0.5 flex flex-col items-center gap-0.5 text-[9px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">NORTH</span>
                  <div className="flex items-center gap-1 justify-center">
                    <span className={`w-2 h-2 rounded-full ${N.signalStatus === "green" ? "bg-emerald-500 shadow-md shadow-emerald-500" : N.signalStatus === "yellow" ? "bg-amber-500" : "bg-red-500 shadow-md shadow-red-500"}`}></span>
                    <span className="text-white font-bold">{N.vehicles.cars + N.vehicles.buses + N.vehicles.trucks} Vehicles</span>
                  </div>
                  {N.detectedEmergency && <span className="bg-red-500/20 text-red-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ {N.detectedEmergency}</span>}
                  {N.detectedAccident && <span className="bg-amber-500/20 text-amber-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ BLOCKED</span>}
                </div>
                {/* Glow light indicator */}
                <div className={`mt-1.5 w-1.5 h-10 mx-auto rounded transition-all ${N.signalStatus === 'green' ? 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500/40'}`}></div>
              </div>

              {/* South Lane (Broadway Ave) - Bottom Center */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-center flex flex-col justify-end">
                <div className={`mb-1.5 w-1.5 h-10 mx-auto rounded transition-all ${S.signalStatus === 'green' ? 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500/40'}`}></div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-0.5 flex flex-col items-center gap-0.5 text-[9px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">SOUTH</span>
                  <div className="flex items-center gap-1 justify-center">
                    <span className={`w-2 h-2 rounded-full ${S.signalStatus === "green" ? "bg-emerald-500 shadow-md shadow-emerald-500" : S.signalStatus === "yellow" ? "bg-amber-500" : "bg-red-500 shadow-md shadow-red-500"}`}></span>
                    <span className="text-white font-bold">{S.vehicles.cars + S.vehicles.buses + S.vehicles.trucks} Vehicles</span>
                  </div>
                  {S.detectedEmergency && <span className="bg-red-500/20 text-red-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ {S.detectedEmergency}</span>}
                  {S.detectedAccident && <span className="bg-amber-500/20 text-amber-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ BLOCKED</span>}
                </div>
              </div>

              {/* West Lane (4th Street) - Left Center */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-start text-left">
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-0.5 flex flex-col items-start gap-0.5 text-[9px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">WEST</span>
                  <div className="flex items-center gap-1 justify-start">
                    <span className={`w-2 h-2 rounded-full ${W.signalStatus === "green" ? "bg-emerald-500 shadow-md shadow-emerald-500" : W.signalStatus === "yellow" ? "bg-amber-500" : "bg-red-500 shadow-md shadow-red-500"}`}></span>
                    <span className="text-white font-bold text-nowrap">{W.vehicles.cars + W.vehicles.buses + W.vehicles.trucks} Vehicles</span>
                  </div>
                  {W.detectedEmergency && <span className="bg-red-500/20 text-red-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ {W.detectedEmergency}</span>}
                  {W.detectedAccident && <span className="bg-amber-500/20 text-amber-400 font-bold px-1 rounded uppercase tracking-tighter">⚠ BLOCKED</span>}
                </div>
                <div className={`ml-1.5 h-1.5 w-10 rounded transition-all ${W.signalStatus === 'green' ? 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500/40'}`}></div>
              </div>

              {/* East Lane (4th Street) - Right Center */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-end text-right">
                <div className={`mr-1.5 h-1.5 w-10 rounded transition-all ${E.signalStatus === 'green' ? 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500/40'}`}></div>
                <div className="bg-slate-900/90 border border-slate-800 rounded px-2 py-0.5 flex flex-col items-end gap-0.5 text-[9px] font-mono">
                  <span className="text-slate-400 font-bold uppercase">EAST</span>
                  <div className="flex items-center gap-1 justify-end">
                    <span className={`w-2 h-2 rounded-full ${E.signalStatus === "green" ? "bg-emerald-500 shadow-md shadow-emerald-500" : E.signalStatus === "yellow" ? "bg-amber-500" : "bg-red-500 shadow-md shadow-red-500"}`}></span>
                    <span className="text-white font-bold text-nowrap">{E.vehicles.cars + E.vehicles.buses + E.vehicles.trucks} Vehicles</span>
                  </div>
                  {E.detectedEmergency && <span className="bg-red-500/20 text-red-400 font-bold px-1 rounded uppercase tracking-tighter col-start-2">⚠ {E.detectedEmergency}</span>}
                  {E.detectedAccident && <span className="bg-amber-500/20 text-amber-400 font-bold px-1 rounded uppercase tracking-tighter col-start-2">⚠ BLOCKED</span>}
                </div>
              </div>

            </div>

            {/* Micro analytics meters */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { name: "Northbound", lane: N },
                { name: "Eastbound", lane: E },
                { name: "Southbound", lane: S },
                { name: "Westbound", lane: W }
              ].map(item => {
                const lane = item.lane;
                const total = lane.vehicles.cars + lane.vehicles.buses + lane.vehicles.trucks + lane.vehicles.motorcycles;
                return (
                  <div key={lane.id} className="bg-slate-950 p-2 border border-slate-900 rounded-lg text-center">
                    <span className="text-[8px] text-slate-500 font-mono tracking-wider uppercase block">{item.name}</span>
                    <span className="text-xs font-mono font-bold text-cyan-400 block mt-0.5">{total} <span className="text-[7px] text-slate-500">vhs</span></span>
                    
                    {/* Tiny microbar representing visual lane density limit */}
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full ${total > 15 ? 'bg-red-500' : total > 8 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, Math.floor((total / 25) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Traffic Prediction Engine & Congestion Forecast Line Chart */}
          <div id="traffic-prediction-chart" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg flex flex-col justify-between min-h-[220px]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">Predictive Congestion Forecast Engine</h3>
              </div>
              <span className="text-[10px] font-mono text-purple-400 px-2 py-0.5 bg-purple-950/40 border border-purple-900/40 rounded">
                LSTM / XGBoost Neural Network
              </span>
            </div>

            <p className="text-[10px] text-slate-400 mb-3 font-mono leading-relaxed">
              Real-time deep metrics combining current visual densities with historical city volumes ({simState.timeOfDay}) and meteorological conditions ({simState.weather}).
            </p>

            {/* Custom SVG line Chart */}
            <div className="flex-1 min-h-[100px] flex items-end relative py-3">
              {predictions.length > 0 ? (
                <div className="w-full h-full flex items-end justify-between px-2 gap-1.5">
                  {predictions.map((p, idx) => {
                    const barHeight = Math.max(15, p.predictedDensity);
                    const isPeak = p.hour === "08:00" || p.hour === "18:00";
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {/* Hover values */}
                        <div className="absolute -top-6 scale-0 group-hover:scale-100 bg-slate-950 border border-indigo-500 text-[8px] font-mono px-1 rounded text-white whitespace-nowrap z-30 transition-all">
                          {p.predictedVolume} vhs / Rec: {p.recommendedGreenDuration}s
                        </div>

                        {/* Bar Segment */}
                        <div className="w-full relative rounded-t-sm transition-all" style={{ height: `${barHeight}%` }}>
                          <div className={`absolute inset-0 rounded-t-sm transition-colors ${
                            isPeak 
                              ? "bg-gradient-to-t from-orange-600/60 to-orange-500" 
                              : p.predictedDensity > 60 
                                ? "bg-gradient-to-t from-cyan-600/60 to-cyan-500" 
                                : "bg-gradient-to-t from-emerald-600/60 to-emerald-500"
                          }`}></div>
                          
                          {/* Top lighting line */}
                          <div className={`h-0.5 w-full ${isPeak ? 'bg-orange-300' : 'bg-cyan-300'}`}></div>
                        </div>

                        {/* Label */}
                        <span className="text-[8px] font-mono text-slate-500 tracking-tighter block">{p.hour}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center w-full text-xs text-slate-500 font-mono py-8">
                  Synthesizing neural forecasting vectors...
                </div>
              )}
            </div>

            <div className="flex justify-between mt-2 pt-2 border-t border-slate-800 text-[9px] font-mono text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-emerald-500 rounded-sm"></span> Normal Flow</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-cyan-500 rounded-sm"></span> Fluid Rerouted</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-orange-500 rounded-sm"></span> Peak Surge Limit</span>
            </div>
          </div>

        </section>

        {/* ==================== RIGHT AREA: GEMINI HYBRID ENGINE & LOGS (3 COLS) ==================== */}
        <section id="ai-decision-column" className="xl:col-span-3 flex flex-col gap-5">
          
          {/* Gemini AI Optimization Advisor */}
          <div id="gemini-analyzer-card" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden">
            {/* Ambient decorative light background */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">Gemini Decision Module</h3>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            </div>

            <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
              Push real-time active dataset parameters directly to Gemini reasoning core to extract mathematical green timings.
            </p>

            <button
              id="btn-run-optimization"
              onClick={runGeminiOptimization}
              disabled={loadingAnalysis}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-md shadow-indigo-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingAnalysis ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  CONSULTING ORACLE NODES...
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  TRIGGER AI OPTIMIZATION ANALYSIS
                </>
              )}
            </button>

            {/* Analysis Output Result */}
            {geminiAnalysis && (
              <div className="mt-2 bg-slate-950/80 rounded-lg p-3 border border-indigo-950 flex flex-col gap-2.5 text-[10px] font-mono">
                <div>
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block">Recommendation Strategy</span>
                  <p className="text-slate-200 mt-0.5 font-sans text-[11px] leading-tight">{geminiAnalysis.recommendation}</p>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center py-1.5 border-y border-slate-800">
                  {Object.entries(geminiAnalysis.suggestedTimings || {}).map(([lane, sec]) => (
                    <div key={lane} className="bg-slate-900 p-1 rounded border border-slate-800/60">
                      <span className="text-[7px] text-slate-400 uppercase tracking-widest font-mono block">LANE {lane}</span>
                      <span className="text-xs text-cyan-400 font-bold font-mono block mt-0.5">{sec}s</span>
                    </div>
                  ))}
                </div>

                <div>
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block">Decision Reasoning Matrix</span>
                  <p className="text-slate-400 mt-1 leading-normal text-[9px]">{geminiAnalysis.reasoning}</p>
                </div>

                <div>
                  <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider block">Critical Queue Target</span>
                  <p className="text-amber-300 mt-0.5 italic text-[9.5px] font-sans">{geminiAnalysis.priorityMetrics}</p>
                </div>
                
                {geminiAnalysis.errorMsg && (
                  <span className="text-[8px] bg-amber-950/50 text-amber-500 border border-amber-900 px-1 py-0.5 rounded text-center">
                    Note: Running via Local SmartFlow Optimization Model fallback
                  </span>
                )}
              </div>
            )}

            {!geminiAnalysis && !loadingAnalysis && (
              <div className="text-center p-4 bg-slate-950/40 rounded border border-slate-850 text-slate-500 text-[10px] font-mono italic">
                Awaiting neural query transmission. Click above to trigger evaluation.
              </div>
            )}

          </div>

          {/* Integrated City Admin Chat Assistant (Advanced Gemini interaction) */}
          <div id="city-admin-chat" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg flex-1 flex flex-col justify-between min-h-[280px]">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">Metropolitan AI Advisor</h3>
            </div>

            {/* Conversational Screen */}
            <div className="flex-1 overflow-y-auto max-h-[160px] min-h-[120px] bg-slate-950/80 rounded-lg p-2.5 border border-slate-850 text-[10px] flex flex-col gap-2.5 scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`max-w-[85%] rounded p-2 text-[10px] font-sans leading-relaxed ${
                  msg.sender === "user" 
                    ? "bg-indigo-950/80 text-white self-end border border-indigo-900/60" 
                    : "bg-slate-900 text-slate-300 self-start border border-slate-800"
                }`}>
                  <span className="text-[7.5px] font-mono text-slate-500 block uppercase mb-0.5">
                    {msg.sender === "user" ? "CITY_INSPECTOR_ADMIN" : "SMARTFLOW_ORACLE_BOT"}
                  </span>
                  <div className="prose prose-invert prose-xs leading-snug">{msg.text}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="bg-slate-900 text-slate-500 rounded p-2 text-[8px] font-mono self-start animate-pulse">
                  TRANSMITTING QUERY SIGNAL TO GEMINI AI...
                </div>
              )}
            </div>

            {/* Input Form layout */}
            <form onSubmit={sendChatMessage} className="mt-2.5 flex gap-1.5">
              <input
                id="inp-chat-message"
                type="text"
                placeholder="Query intersection densities or ask for system recommendations..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[9.5px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600 disabled:opacity-50"
              />
              <button
                id="btn-send-chat"
                type="submit"
                disabled={chatLoading}
                className="bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 rounded text-slate-950 font-bold text-[10px] uppercase font-mono transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Real-Time Vision Event Logging Feed */}
          <div id="vision-event-logging" className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 shadow-lg h-44 flex flex-col justify-between">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold font-display uppercase text-slate-300 tracking-wider">Vision System Telemetry</h3>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            {/* Scrollable logs */}
            <div className="flex-1 overflow-y-auto font-mono text-[8.5px] space-y-2 pr-1 scrollbar">
              {simState.systemLogs.map((log, index) => {
                let badgeColor = "text-cyan-400";
                if (log.type === "warning") badgeColor = "text-amber-500 font-bold";
                else if (log.type === "alert") badgeColor = "text-red-500 font-bold animate-pulse";
                else if (log.type === "success") badgeColor = "text-emerald-400";

                return (
                  <div key={index} className="flex gap-2 leading-normal border-b border-slate-850 pb-1.5">
                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                    <span className="text-slate-400">
                      <span className={badgeColor}>[{log.type.toUpperCase()}]</span> {log.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

      </main>

      {/* 3. Bottom Status Bar */}
      <footer id="bottom-footer" className="bg-slate-950 border-t border-slate-950 px-6 py-2.5 mt-auto flex flex-col md:flex-row gap-3 items-center justify-between text-[10px] font-mono text-slate-500">
        <div id="indicators-list" className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>DATABASE: <span className="text-slate-400 font-bold">MONGO_IN-MEMORY_SYNC</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>FASTAPI SERVER: <span className="text-slate-400 font-bold">STABLE/ONLINE</span></span>
          </div>
          <div>SESSION: <span className="text-cyan-400 font-bold">SF-AI-7092-2026</span></div>
        </div>
        <div className="text-center md:text-right">
          © 2026 SMARTFLOW AI • ADVANCED SMART CITY TRAFFIC MANAGEMENT SYSTEM
        </div>
      </footer>

    </div>
  );
}

// Custom simple SunriseIcon equivalent
function SunriseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2v8h4" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 18H2" />
      <path d="M22 18H12" />
      <path d="M16 12a4 4 0 0 0-8 0" />
      <path d="M2 22h20" />
    </svg>
  );
}
