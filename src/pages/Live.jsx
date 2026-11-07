import { useEffect, useRef, useState } from "react";
import { Camera, Leaf, Pause, Play, ShieldCheck, Wifi, AlertCircle } from "lucide-react";
import { getDetections, getScans } from "../services/api";
import { parseServerDate } from "../utils/dates";

const FEED_H = 420;

const STREAM_KEY         = "drone_stream_url";   // last link used, saved in this browser
const POLL_MS            = 5000;                 // how often to check for new model results
const CONNECT_TIMEOUT_MS = 15000;                // give up waiting for the first video frame
const NEW_FOR_MS         = 30000;                // how long a result keeps its NEW tag

const corner = "absolute w-6 h-6 border-white/80";

function safeGet(key) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// Browsers play plain video files and HLS (on Safari). Everything else is treated as an MJPEG image stream.
const isVideoUrl = (url) => /\.(m3u8|mp4|webm|ogg)(\?|$)/i.test(url);

// ═════════════════════════════════════════════════════════════════════════════
// DRONE STREAM (real feed from a link + results from the trained model)
// ═════════════════════════════════════════════════════════════════════════════

const STATUS_BADGE = {
  connecting: { label: "CONNECTING", dot: "bg-amber-400", blink: true },
  live:       { label: "LIVE",       dot: "bg-red-500",   blink: true },
  failed:     { label: "OFFLINE",    dot: "bg-gray-400",  blink: false },
};

function DroneFeed() {
  const [urlInput, setUrlInput]   = useState(() => safeGet(STREAM_KEY));
  const [activeUrl, setActiveUrl] = useState("");
  const [nonce, setNonce]         = useState(0);          // changes to force the video to reload
  const [status, setStatus]       = useState("idle");     // idle | connecting | live | failed
  const [paused, setPaused]       = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [flight, setFlight]       = useState([]);         // model results since connecting
  const [serverError, setServerError] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast]         = useState("");

  const mediaRef    = useRef(null);
  const baselineRef = useRef(null);   // newest detection id at connect time (older ones are not "this flight")
  const arrivedRef  = useRef({});     // detection id -> when this page first saw it

  function connect() {
    const url = urlInput.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      setFormError("Enter the full link, starting with http:// or https://");
      return;
    }
    setFormError("");
    safeSet(STREAM_KEY, url);
    baselineRef.current = null;
    arrivedRef.current = {};
    setFlight([]);
    setServerError(false);
    setElapsed(0);
    setPaused(false);
    setStatus("connecting");
    setNonce((n) => n + 1);
    setActiveUrl(url);
  }

  function disconnect() {
    setActiveUrl("");
    setStatus("idle");
    setPaused(false);
  }

  function reconnect() {
    setPaused(false);
    setStatus("connecting");
    setNonce((n) => n + 1);
  }

  // Give up if the first frame never arrives
  useEffect(() => {
    if (status !== "connecting" || !activeUrl) return;
    const id = setTimeout(() => setStatus("failed"), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status, activeUrl, nonce]);

  // Flight timer
  useEffect(() => {
    if (status !== "live" || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status, paused]);

  // Ask the server for new model results (Black Sigatoka / Healthy) every few seconds
  useEffect(() => {
    if (!activeUrl) return;
    let cancelled = false;

    async function poll() {
      try {
        const [dets, scans] = await Promise.all([getDetections(), getScans().catch(() => [])]);
        if (cancelled) return;
        setServerError(false);

        const newest = dets.reduce((m, d) => Math.max(m, d.detection_id), 0);
        if (baselineRef.current === null) {         // first check: remember what already existed
          baselineRef.current = newest;
          return;
        }

        const scanById = {};
        scans.forEach((s) => { scanById[s.scan_id] = s; });

        const fresh = dets
          .filter((d) => d.detection_id > baselineRef.current)
          .sort((a, b) => b.detection_id - a.detection_id)
          .slice(0, 20)
          .map((d) => {
            if (!arrivedRef.current[d.detection_id]) arrivedRef.current[d.detection_id] = Date.now();
            return { ...d, when: parseServerDate(scanById[d.scan_id]?.timestamp) };
          });
        setFlight(fresh);
      } catch {
        if (!cancelled) setServerError(true);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeUrl]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  function takeScreenshot() {
    const el = mediaRef.current;
    if (!el || status !== "live" || paused) {
      setToast("Nothing to capture yet. Connect to the drone first.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = el.naturalWidth  || el.videoWidth;
      canvas.height = el.naturalHeight || el.videoHeight;
      canvas.getContext("2d").drawImage(el, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { setToast("Could not capture this frame."); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bananaguard-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
        setToast("Screenshot saved to your downloads.");
      }, "image/jpeg", 0.92);
    } catch {
      setToast("This stream does not allow screenshots from the browser. Use Win + Shift + S instead.");
    }
  }

  const diseased = flight.filter((d) => d.anomaly_detected).length;
  const healthy  = flight.length - diseased;
  const badge    = paused ? { label: "PAUSED", dot: "bg-gray-400", blink: false } : STATUS_BADGE[status];
  const canControl = status === "live";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
        {/* Stream link */}
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !activeUrl) connect(); }}
            disabled={!!activeUrl}
            aria-label="Drone stream link"
            placeholder="Paste the drone stream link, e.g. http://192.168.4.1:8080/video"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 disabled:bg-gray-50 disabled:text-gray-500"
          />
          {activeUrl ? (
            <button onClick={disconnect}
              className="px-5 rounded-lg border border-red-200 bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition">
              Disconnect
            </button>
          ) : (
            <button onClick={connect}
              className="px-5 rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90 transition">
              Connect
            </button>
          )}
        </div>
        {formError && <p className="text-xs text-red-500 font-medium mt-1.5">{formError}</p>}
        <p className="text-[11px] text-gray-400 mt-1.5 mb-3">
          First connect your computer to the drone&apos;s Wi-Fi, then paste the link your drone gives for its video.
        </p>

        {/* Feed */}
        <div className="relative overflow-hidden rounded-2xl bg-black" style={{ height: FEED_H }}>
          {activeUrl && !paused && (
            isVideoUrl(activeUrl) ? (
              <video key={nonce} ref={mediaRef} src={activeUrl} autoPlay muted playsInline
                onPlaying={() => setStatus("live")} onError={() => setStatus("failed")}
                className="absolute inset-0 w-full h-full object-contain bg-black" />
            ) : (
              <img key={nonce} ref={mediaRef} src={activeUrl} alt="Drone camera feed"
                onLoad={() => setStatus("live")} onError={() => setStatus("failed")}
                className="absolute inset-0 w-full h-full object-contain bg-black" />
            )
          )}

          {/* Messages over the feed */}
          {!activeUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-[#10201a]">
              <Wifi size={34} className="text-emerald-200/60 mb-3" />
              <p className="text-white text-sm font-semibold">Not connected to the drone</p>
              <p className="text-emerald-100/60 text-xs mt-1 max-w-xs">
                Connect to the drone&apos;s Wi-Fi, paste its stream link above, and press Connect.
              </p>
            </div>
          )}
          {activeUrl && status === "connecting" && !paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <p className="text-white text-sm font-semibold">Connecting to the drone…</p>
            </div>
          )}
          {activeUrl && status === "failed" && !paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-black/80">
              <AlertCircle size={30} className="text-red-300 mb-2" />
              <p className="text-white text-sm font-semibold">Could not show the drone video</p>
              <p className="text-gray-300 text-xs mt-1 max-w-sm">
                {isVideoUrl(activeUrl)
                  ? "This browser could not play that link. Try a different video format or browser."
                  : "Check that your computer is on the drone's Wi-Fi and that the link is correct."}
              </p>
              <button onClick={reconnect}
                className="mt-4 px-4 py-1.5 rounded-lg bg-white text-[#1B4332] text-sm font-semibold hover:opacity-90">
                Try again
              </button>
            </div>
          )}
          {activeUrl && paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#10201a]">
              <p className="text-white text-sm font-semibold">Paused</p>
            </div>
          )}

          {activeUrl && (
            <>
              <div className={`${corner} top-2 left-2 border-t-2 border-l-2`} />
              <div className={`${corner} top-2 right-2 border-t-2 border-r-2`} />
              <div className={`${corner} bottom-2 left-2 border-b-2 border-l-2`} />
              <div className={`${corner} bottom-2 right-2 border-b-2 border-r-2`} />

              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-black/55 px-2.5 py-1 rounded-md">
                  <span className={`w-2 h-2 rounded-full ${badge.dot}`}
                    style={{ animation: badge.blink ? "bg-blink 1.2s infinite" : "none" }} />
                  <span className="text-white text-[11px] font-extrabold tracking-widest">{badge.label}</span>
                </div>
                {status === "live" && (
                  <span className="text-white text-xs font-semibold bg-black/55 px-2 py-1 rounded-md tabular-nums">{fmt(elapsed)}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-4 items-center">
          <button
            onClick={() => (paused ? reconnect() : setPaused(true))}
            disabled={!paused && !canControl}
            className="flex-1 h-11 rounded-lg bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={takeScreenshot}
            className="flex-1 h-11 rounded-lg border-[1.5px] border-[#1B4332] text-[#1B4332] text-sm font-semibold hover:bg-[#1B4332]/5 transition flex items-center justify-center gap-2">
            <Camera size={16} />
            Screenshot
          </button>
        </div>
        {toast && <p className="mt-3 text-sm text-gray-600 bg-gray-100 rounded-lg px-3 py-2">{toast}</p>}
      </div>

      {/* Model results */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-semibold tracking-widest text-gray-500">DETECTIONS THIS FLIGHT</h2>
          {flight.length > 0 && (
            <span className="text-[11px] text-gray-400">
              <span className="text-red-500 font-semibold">{diseased}</span> diseased ·{" "}
              <span className="text-forest font-semibold">{healthy}</span> healthy
            </span>
          )}
        </div>

        {serverError && (
          <div className="mb-2 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            Can&apos;t reach the BananaGuard server. Results will show up again once this computer is online.
          </div>
        )}

        {!activeUrl ? (
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-500">
            Connect to the drone to start receiving results.
          </div>
        ) : flight.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-500">
            Scanning… no results yet. Black Sigatoka and healthy leaves will appear here as the model checks the video.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {flight.map((d) => {
              const disease = !!d.anomaly_detected;
              const isNew   = Date.now() - (arrivedRef.current[d.detection_id] || 0) < NEW_FOR_MS;
              const time    = (d.when || new Date(arrivedRef.current[d.detection_id] || Date.now()))
                .toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              return (
                <div key={d.detection_id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
                  {disease
                    ? <Leaf size={16} className="text-red-500 shrink-0" />
                    : <ShieldCheck size={16} className="text-forest shrink-0" />}
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-900">
                      {disease ? `${d.detected_class || "Disease"} detected` : "Healthy leaf"}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      at {time}
                      {d.tier2_confidence != null && ` · confidence ${(d.tier2_confidence * 100).toFixed(0)}%`}
                    </p>
                  </div>
                  {isNew && (
                    <span className={`text-[10px] font-extrabold tracking-wide ${disease ? "text-red-500" : "text-forest"}`}>NEW</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function Live() {
  return (
    <div>
      <style>{`
        @keyframes bg-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
      `}</style>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#1B4332]">Live Drone Feed</h1>
        <p className="text-sm text-gray-500">Live from the drone</p>
      </div>

      <DroneFeed />
    </div>
  );
}