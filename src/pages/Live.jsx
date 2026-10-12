import { useEffect, useState } from "react";
import { Camera, Leaf, Pause, Play } from "lucide-react";

const FEED_H = 420;
const ROWS = 7;
const COLS = 12;

// Hard-coded fake detections (x/y are % of the feed)
const DETECTIONS = [
  { x: 24, y: 34, conf: 94 },
  { x: 62, y: 52, conf: 88 },
  { x: 38, y: 66, conf: 91 },
  { x: 70, y: 28, conf: 86 },
];

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// One feed-height tile of banana plants. Two of these scroll to fake flight.
function PlantTile({ shade }) {
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c === 5 || c === 6) continue; // gap for the dirt path
      const size = 26 + ((r * 7 + c * 3) % 4) * 4;
      const sick = (r * 5 + c * 11) % 17 === 0;
      dots.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            top: r * (FEED_H / ROWS) + 8 + (c % 2) * 8,
            left: `${c * (100 / COLS) + 2}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: sick
              ? "#8A7A2E"
              : (r + c) % 2 === 0
                ? "#2E7D4A"
                : "#3A9159",
            opacity: shade ? 0.9 : 1,
          }}
        />,
      );
    }
  }
  return (
    <div
      style={{ height: FEED_H, backgroundColor: "#17301F", position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "41%",
          width: "18%",
          backgroundColor: "#5B4B32",
          opacity: 0.55,
        }}
      />
      {dots}
    </div>
  );
}

const corner = "absolute w-6 h-6 border-white/80";

export default function Live() {
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState("");

  // 1-second clock drives timer, telemetry and detections
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const cycle = Math.floor(tick / 5);
  const phase = tick % 5;
  const detection = DETECTIONS[cycle % DETECTIONS.length];
  const showBox = !paused && phase >= 1 && phase <= 3;

  // Add to detection log when a new box appears
  useEffect(() => {
    if (phase === 1 && tick > 0) {
      setLog((prev) => {
        if (prev.some((l) => l.id === tick)) return prev;
        return [{ id: tick, time: fmt(tick), conf: detection.conf }, ...prev].slice(
          0,
          8,
        );
      });
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // Fake telemetry
  const alt = 32 + ((tick * 7) % 5) * 0.4;
  const spd = 4 + ((tick * 3) % 6) * 0.1;
  const bat = Math.max(20, 78 - Math.floor(tick / 30));

  return (
    <div>
      <style>{`
        @keyframes bg-scroll { from { transform: translateY(0); } to { transform: translateY(-${FEED_H}px); } }
        @keyframes bg-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
      `}</style>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#1B4332]">Live Drone Feed</h1>
        <p className="text-sm text-gray-500">UAV-01 · Demo stream</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Feed + controls */}
        <div className="xl:col-span-2">
          <div
            className="relative overflow-hidden rounded-2xl bg-black"
            style={{ height: FEED_H }}
          >
            <div
              style={{
                animation: "bg-scroll 7s linear infinite",
                animationPlayState: paused ? "paused" : "running",
              }}
            >
              <PlantTile shade={false} />
              <PlantTile shade />
            </div>

            {/* corner brackets */}
            <div className={`${corner} top-2 left-2 border-t-2 border-l-2`} />
            <div className={`${corner} top-2 right-2 border-t-2 border-r-2`} />
            <div className={`${corner} bottom-2 left-2 border-b-2 border-l-2`} />
            <div className={`${corner} bottom-2 right-2 border-b-2 border-r-2`} />

            {/* crosshair */}
            <div
              className="absolute bg-white/60"
              style={{ top: "50%", left: "48%", width: "4%", height: 1 }}
            />
            <div
              className="absolute bg-white/60"
              style={{ left: "50%", top: "46%", height: "8%", width: 1 }}
            />

            {/* detection box */}
            {showBox && (
              <div
                className="absolute border-2 border-red-500 rounded"
                style={{
                  left: `${detection.x}%`,
                  top: `${detection.y}%`,
                  width: 90,
                  height: 76,
                }}
              >
                <div className="absolute -top-5 -left-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                  Black Sigatoka {detection.conf}%
                </div>
              </div>
            )}

            {/* top HUD */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-black/55 px-2.5 py-1 rounded-md">
                <span
                  className="w-2 h-2 rounded-full bg-red-500"
                  style={{
                    animation: paused ? "none" : "bg-blink 1.2s infinite",
                  }}
                />
                <span className="text-white text-[11px] font-extrabold tracking-widest">
                  {paused ? "PAUSED" : "LIVE"}
                </span>
              </div>
              <span className="text-white text-xs font-semibold bg-black/55 px-2 py-1 rounded-md tabular-nums">
                {fmt(tick)}
              </span>
            </div>

            {/* telemetry */}
            <div className="absolute left-4 bottom-4 bg-black/55 px-2.5 py-1.5 rounded-lg flex flex-col">
              <span className="text-emerald-100 text-[10px] font-semibold tabular-nums">
                ALT {alt.toFixed(1)} m
              </span>
              <span className="text-emerald-100 text-[10px] font-semibold tabular-nums">
                SPD {spd.toFixed(1)} m/s
              </span>
              <span className="text-emerald-100 text-[10px] font-semibold tabular-nums">
                BAT {bat}%
              </span>
              <span className="text-emerald-100 text-[10px] font-semibold tabular-nums">
                8.1234°N 124.5678°E
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 mt-4 items-center">
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex-1 h-11 rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={() =>
                setToast("Screenshot saved (demo only — nothing was actually saved).")
              }
              className="flex-1 h-11 rounded-lg border-[1.5px] border-[#1B4332] text-[#1B4332] text-sm font-semibold hover:bg-[#1B4332]/5 transition flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              Screenshot
            </button>
          </div>
          {toast && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
              {toast}
            </p>
          )}
        </div>

        {/* Detection log */}
        <div>
          <h2 className="text-[11px] font-semibold tracking-widest text-gray-500 mb-2">
            DETECTIONS THIS FLIGHT
          </h2>
          {log.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-500">
              Scanning… no detections yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {log.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3"
                >
                  <Leaf size={16} className="text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-900">
                      Black Sigatoka detected
                    </p>
                    <p className="text-[11px] text-gray-500">
                      at {l.time} · confidence {l.conf}%
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold tracking-wide text-red-500">
                    NEW
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}