import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../components/StatusBadge";
import AlertModal from "../components/AlertModal";
import { getDetections, getScans, getAlerts } from "../services/api";
import { parseServerDate, formatDateTime, toDateKey } from "../utils/Dates";
import { Plane, Calendar, MapPin, ShieldCheck, AlertTriangle, RefreshCw, AlertCircle } from "lucide-react";

const PAGE_SIZE = 12;
const FILTERS   = ["All", "Black Sigatoka", "Healthy"];
const ALL_DEVICES = "All Devices";

// Only show an image when image_path is a full web link.
// (Local file paths can't be opened by the browser.)
function toImageUrl(path) {
  if (!path) return null;
  return /^(https?:\/\/|data:image\/)/i.test(path) ? path : null;
}

function DetectionThumbnail({ isDisease, imagePath }) {
  const [failed, setFailed] = useState(false);
  const src = toImageUrl(imagePath);

  if (src && !failed) {
    return (
      <div className="relative w-full h-36 rounded-lg overflow-hidden bg-gray-100">
        <img
          src={src}
          alt="UAV scan"
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
        {isDisease && (
          <span className="absolute top-2 left-2 bg-red-100 text-red-800 text-[10px] font-medium px-2 py-0.5 rounded-full">
            Disease Detected
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-36 rounded-lg flex flex-col items-center justify-center gap-2 ${
      isDisease ? "bg-red-50" : "bg-forest-muted"
    }`}>
      {isDisease ? (
        <>
          <AlertTriangle size={32} className="text-red-500" />
          <span className="text-xs font-medium text-red-700">Disease Detected</span>
        </>
      ) : (
        <>
          <ShieldCheck size={32} className="text-forest" />
          <span className="text-xs font-medium text-forest">No Disease Found</span>
        </>
      )}
      <span className="text-[10px] text-gray-400">
        {imagePath ? "Image could not be loaded" : "No scan image yet"}
      </span>
    </div>
  );
}

export default function UAVDetections() {
  const [detections, setDetections] = useState([]);
  const [scans, setScans]           = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [filter, setFilter]         = useState("All");
  const [date, setDate]             = useState("");
  const [device, setDevice]         = useState(ALL_DEVICES);
  const [visible, setVisible]       = useState(PAGE_SIZE);
  const [modalDetection, setModalDetection] = useState(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      // Detections are required. Scans (image, time, device) and alerts are
      // nice-to-have, so the page still works if either one fails.
      const [dets, scanList, alertList] = await Promise.all([
        getDetections(),
        getScans().catch(() => []),
        getAlerts().catch(() => []),
      ]);
      setDetections(dets);
      setScans(scanList);
      setAlerts(alertList);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Join each detection with its scan (image, time, device)
  const rows = useMemo(() => {
    const scanById = {};
    scans.forEach((s) => { scanById[s.scan_id] = s; });
    return detections.map((d) => {
      const scan = scanById[d.scan_id] || null;
      return { ...d, scan, when: parseServerDate(scan?.timestamp) };
    });
  }, [detections, scans]);

  // How many farmers were already alerted about each detection
  const alertedCount = useMemo(() => {
    const counts = {};
    alerts.forEach((a) => {
      if (a.detection_id) counts[a.detection_id] = (counts[a.detection_id] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  const devices = useMemo(
    () => [...new Set(scans.map((s) => s.device_id).filter(Boolean))],
    [scans]
  );

  const filtered = rows.filter((d) => {
    if (filter === "Black Sigatoka" && !d.anomaly_detected) return false;
    if (filter === "Healthy" && d.anomaly_detected) return false;
    if (date && (!d.when || toDateKey(d.when) !== date)) return false;
    if (device !== ALL_DEVICES && d.scan?.device_id !== device) return false;
    return true;
  });

  const shown = filtered.slice(0, visible);
  const hasActiveFilters = filter !== "All" || date !== "" || device !== ALL_DEVICES;

  function clearFilters() {
    setFilter("All");
    setDate("");
    setDevice(ALL_DEVICES);
    setVisible(PAGE_SIZE);
  }

  // After alerts are sent, refresh only the alert counts
  function handleSent(count) {
    alert(`Notification sent to ${count} farmer${count === 1 ? "" : "s"}.`);
    setModalDetection(null);
    getAlerts().then(setAlerts).catch(console.error);
  }

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Status:</span>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setFilter(f); setVisible(PAGE_SIZE); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? (f === "Black Sigatoka" ? "bg-red-600 text-white" : "bg-forest text-white")
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setVisible(PAGE_SIZE); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-forest/20" />
        </div>

        {devices.length > 0 && (
          <div className="flex items-center gap-2">
            <Plane size={14} className="text-gray-400" />
            <select value={device} onChange={(e) => { setDevice(e.target.value); setVisible(PAGE_SIZE); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-forest/20">
              <option>{ALL_DEVICES}</option>
              {devices.map((id) => <option key={id}>{id}</option>)}
            </select>
          </div>
        )}

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-forest hover:underline">
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
          <button onClick={loadData} disabled={loading} title="Refresh"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading detections...</p>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-gray-400">
          <AlertCircle size={32} className="mb-2 text-red-300" />
          <p className="text-sm text-gray-600">Could not load detections.</p>
          <p className="text-xs mt-1">{error}</p>
          <button onClick={loadData}
            className="mt-4 px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-gray-400">
          <ShieldCheck size={32} className="mb-2 opacity-30" />
          {detections.length === 0 ? (
            <>
              <p className="text-sm text-gray-600">No detections yet</p>
              <p className="text-xs mt-1">Results will appear here once UAV scans have been processed.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">No detections match these filters</p>
              <button onClick={clearFilters} className="mt-3 text-xs text-forest hover:underline">
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {shown.map((d) => {
              const isDisease = !!d.anomaly_detected;
              const label     = d.detected_class || (isDisease ? "Disease detected" : "Healthy");
              const alerted   = alertedCount[d.detection_id] || 0;

              return (
                <div key={d.detection_id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                  <DetectionThumbnail isDisease={isDisease} imagePath={d.scan?.image_path} />

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={label} />
                      <span className="text-xs font-semibold text-gray-500">
                        {d.tier2_confidence != null
                          ? `${(d.tier2_confidence * 100).toFixed(0)}% confidence`
                          : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={13} className="text-gray-400 shrink-0" />
                      <span className="font-mono">
                        Detection #{d.detection_id}
                        {d.scan_id ? ` · Scan #${d.scan_id}` : ""}
                        {isDisease && d.lesion_count != null ? ` · ${d.lesion_count} lesion${d.lesion_count === 1 ? "" : "s"}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={13} className="text-gray-400 shrink-0" />
                      <span>{d.when ? formatDateTime(d.when) : "Scan time not recorded"}</span>
                    </div>

                    {d.recommendation && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        {d.recommendation}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Plane size={13} className="shrink-0" />
                      <span>
                        {d.scan?.device_id ? `Device: ${d.scan.device_id}` : "UAV Drone Scan"} — Talakag Banana Farm
                      </span>
                    </div>
                  </div>

                  {isDisease ? (
                    <>
                      <button onClick={() => setModalDetection(d)}
                        className="mt-4 w-full bg-amber hover:bg-yellow-500 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <AlertTriangle size={15} />
                        {alerted > 0 ? "Alert Farmers Again" : "Alert Farmers in Area"}
                      </button>
                      {alerted > 0 && (
                        <p className="mt-2 text-center text-[11px] text-gray-400">
                          {alerted} farmer{alerted === 1 ? "" : "s"} already alerted
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 w-full bg-forest-muted text-forest text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                      <ShieldCheck size={15} />
                      No Action Required
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length > visible && (
            <div className="flex justify-center">
              <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="px-5 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Show more ({filtered.length - visible} left)
              </button>
            </div>
          )}
        </>
      )}

      {modalDetection && (
        <AlertModal
          detection={modalDetection}
          onClose={() => setModalDetection(null)}
          onSend={handleSent}
        />
      )}
    </div>
  );
}