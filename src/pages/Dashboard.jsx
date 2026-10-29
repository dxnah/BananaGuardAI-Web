import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import AlertModal from "../components/AlertModal";
import { getFarmers, getDetections, getScans, getAlerts } from "../services/api";
import { parseServerDate, formatDateTime, toDateKey } from "../utils/dates";
import {
  ScanLine, MapPin, AlertTriangle, Bell, Video, Megaphone,
  FileDown, Leaf, RefreshCw, AlertCircle, CheckCircle,
} from "lucide-react";

const REFRESH_MS = 60_000;

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Dashboard({ admin }) {
  const [data, setData]               = useState(null);   // { farmers, detections, scans, alerts }
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [partialFail, setPartialFail] = useState(false);
  const [updatedAt, setUpdatedAt]     = useState(null);
  const [modalDetection, setModalDetection] = useState(null);
  const [toast, setToast]             = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const keys = ["farmers", "detections", "scans", "alerts"];
    const results = await Promise.allSettled([getFarmers(), getDetections(), getScans(), getAlerts()]);
    const failed = results.filter((r) => r.status === "rejected");

    if (failed.length === results.length) {
      setError(failed[0].reason?.response?.data?.detail || "Could not reach the server.");
    } else {
      setError("");
      // keep the previous list if only one request failed
      setData((prev) => Object.fromEntries(keys.map((k, i) => [
        k, results[i].status === "fulfilled" ? results[i].value : (prev?.[k] ?? []),
      ])));
      setUpdatedAt(new Date());
    }
    setPartialFail(failed.length > 0 && failed.length < results.length);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh quietly every minute so new UAV data shows up on its own
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Everything below is computed from the real lists ──
  const stats = useMemo(() => {
    if (!data) return null;
    const { farmers, detections, scans, alerts } = data;

    const scanById = Object.fromEntries(scans.map((s) => [s.scan_id, s]));
    const todayKey = toDateKey(new Date());
    const scansToday = scans.filter((s) => {
      const d = parseServerDate(s.timestamp);
      return d && toDateKey(d) === todayKey;
    }).length;

    const alertsByDetection = {};
    const alertsByUser = {};
    alerts.forEach((a) => {
      if (a.detection_id != null) alertsByDetection[a.detection_id] = (alertsByDetection[a.detection_id] || 0) + 1;
      if (a.user_id != null) alertsByUser[a.user_id] = (alertsByUser[a.user_id] || 0) + 1;
    });

    const sorted = [...detections]
      .sort((a, b) => b.detection_id - a.detection_id)
      .map((d) => ({
        ...d,
        when: parseServerDate(scanById[d.scan_id]?.timestamp),
        alertCount: alertsByDetection[d.detection_id] || 0,
      }));

    return {
      scansToday,
      totalFarmers: farmers.length,
      diseaseCount: detections.filter((d) => d.anomaly_detected).length,
      pendingAlerts: alerts.filter((a) => !a.acknowledged).length,
      latest: sorted[0] || null,
      recent: sorted.slice(0, 6),
      sorted,
      alertsByUser,
    };
  }, [data]);

  function exportReport() {
    if (!stats || stats.sorted.length === 0) return;
    const header = ["Detection ID", "Scan ID", "Scan Time", "Anomaly", "Class", "Confidence %", "Lesions", "Alerts Sent", "Recommendation"];
    const rows = stats.sorted.map((d) => [
      d.detection_id, d.scan_id, d.when ? formatDateTime(d.when) : "",
      d.anomaly_detected ? "Yes" : "No", d.detected_class,
      d.tier2_confidence != null ? (d.tier2_confidence * 100).toFixed(0) : "",
      d.lesion_count, d.alertCount, d.recommendation,
    ]);
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bananaguard-detections-${toDateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const name = admin?.full_name || admin?.username || "Admin";
  const v = (n) => (stats ? n : "—");
  const latest = stats?.latest;

  if (error && !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-16 flex flex-col items-center text-gray-400">
        <AlertCircle size={32} className="mb-2 text-red-300" />
        <p className="text-sm text-gray-600">Could not load the dashboard.</p>
        <p className="text-xs mt-1">{error}</p>
        <button onClick={load} className="mt-4 px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">
          <CheckCircle size={16} />{toast}
        </div>
      )}
      {partialFail && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-4 py-2.5">
          <AlertCircle size={14} />Some data could not be refreshed. Showing the last known values.
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-forest text-white rounded-xl p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Welcome back, {name}!</h2>
          <p className="text-white/60 text-sm mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amber text-white text-sm font-medium px-4 py-1.5 rounded-full">
            {stats ? stats.pendingAlerts : 0} Pending Alerts
          </span>
          <button onClick={load} disabled={loading} title="Refresh"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-60 transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      {updatedAt && (
        <p className="text-[11px] text-gray-400 -mt-4 text-right">Updated {formatDateTime(updatedAt)} · refreshes every minute</p>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="UAV Scans Today" value={v(stats?.scansToday)} icon={<ScanLine size={18} />} sub="Scans recorded today" />
        <MetricCard label="Total Farmers" value={v(stats?.totalFarmers)} icon={<MapPin size={18} />} sub="Registered farmers" />
        <MetricCard label="Disease Detections" value={v(stats?.diseaseCount)} icon={<AlertTriangle size={18} />} sub="Anomalies detected so far" />
        <MetricCard label="Pending Alerts" value={v(stats?.pendingAlerts)} icon={<Bell size={18} />} sub="Not yet read by farmers" />
      </div>

      {/* Latest detection + quick actions */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-base mb-4 text-charcoal">Latest UAV Detection</h3>
          {!stats ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : latest ? (
            <div className="flex gap-4">
              <div className={`w-28 h-20 rounded-lg flex flex-col items-center justify-center gap-1 shrink-0 ${
                latest.anomaly_detected ? "bg-amber-50" : "bg-forest-muted"}`}>
                {latest.anomaly_detected ? (
                  <><AlertTriangle size={24} className="text-amber-500" /><span className="text-[10px] text-amber-600 font-medium">Disease</span></>
                ) : (
                  <><Leaf size={24} className="text-forest opacity-60" /><span className="text-[10px] text-forest font-medium">Healthy</span></>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={latest.detected_class || (latest.anomaly_detected ? "Disease" : "Healthy")} />
                  {latest.anomaly_detected && (
                    <StatusBadge status={latest.alertCount > 0 ? "Notified" : "No Alert"} />
                  )}
                  <span className="text-xs text-gray-400">
                    {latest.tier2_confidence != null ? `${(latest.tier2_confidence * 100).toFixed(0)}% confidence` : "—"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-charcoal">Detection ID:</span> #{latest.detection_id}
                  {latest.scan_id && <> · Scan #{latest.scan_id}</>}
                  {latest.when && <> · {formatDateTime(latest.when)}</>}
                </p>
                {latest.lesion_count != null && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-charcoal">Lesions:</span> {latest.lesion_count}
                  </p>
                )}
                {latest.recommendation && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-charcoal">Note:</span> {latest.recommendation}
                  </p>
                )}
                {latest.anomaly_detected && (
                  <button onClick={() => setModalDetection(latest)}
                    className="mt-1 bg-amber hover:bg-yellow-500 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Bell size={12} />{latest.alertCount > 0 ? "Send Another Alert" : "Send Alert"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400">
              <ScanLine size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm text-gray-600">No detections yet</p>
              <p className="text-xs mt-1">Results will appear here as soon as the UAV system sends its first scan.</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-base mb-4 text-charcoal">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { icon: <Video size={16} />,     label: "View Live Drone Feed",      to: "/live" },
              { icon: <Megaphone size={16} />, label: "Send Manual Notification", to: "/notifications" },
            ].map((a) => (
              <Link key={a.label} to={a.to}
                className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-forest-muted hover:border-forest/30 transition-all font-medium text-charcoal flex items-center gap-3">
                <span className="text-forest">{a.icon}</span>{a.label}
              </Link>
            ))}
            <button onClick={exportReport} disabled={!stats || stats.sorted.length === 0}
              title={stats && stats.sorted.length === 0 ? "No detections to export yet" : "Download all detections as CSV"}
              className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-forest-muted hover:border-forest/30 transition-all font-medium text-charcoal flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
              <span className="text-forest"><FileDown size={16} /></span>Export Report (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Recent detections */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-base text-charcoal">Recent Detections</h3>
          <Link to="/detections" className="text-xs text-forest hover:underline">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
            <tr>{["ID", "Time", "Result", "Confidence", "Lesions", "Alerts sent", ""].map((h) => (
              <th key={h} className="text-left px-5 py-3">{h}</th>))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!stats || stats.recent.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-400 text-xs">
                {stats ? "No detections yet." : "Loading..."}
              </td></tr>
            ) : stats.recent.map((d) => (
              <tr key={d.detection_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-gray-500">#{d.detection_id}</td>
                <td className="px-5 py-3 text-gray-500">{d.when ? formatDateTime(d.when) : "—"}</td>
                <td className="px-5 py-3"><StatusBadge status={d.detected_class || (d.anomaly_detected ? "Disease" : "Healthy")} /></td>
                <td className="px-5 py-3 text-gray-500">{d.tier2_confidence != null ? `${(d.tier2_confidence * 100).toFixed(0)}%` : "—"}</td>
                <td className="px-5 py-3 text-gray-500">{d.lesion_count ?? "—"}</td>
                <td className="px-5 py-3 text-gray-500">{d.anomaly_detected ? d.alertCount : "—"}</td>
                <td className="px-5 py-3 text-right">
                  {d.anomaly_detected && (
                    <button onClick={() => setModalDetection(d)} className="text-xs text-forest hover:underline">Send alert</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Farmer Status Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-base text-charcoal">Farmer Status</h3>
          <Link to="/farmers" className="text-xs text-forest hover:underline">Manage farmers</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
            <tr>{["Farmer Name", "Username", "Mobile Number", "Alerts received", "Registered"].map((h) => (
              <th key={h} className="text-left px-5 py-3">{h}</th>))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!data || data.farmers.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-400 text-xs">
                {data ? "No farmers registered yet." : "Loading..."}
              </td></tr>
            ) : data.farmers.slice(0, 8).map((f) => (
              <tr key={f.user_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-charcoal">{f.full_name || f.username}</td>
                <td className="px-5 py-3 text-gray-500">@{f.username}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{f.phone_number || "—"}</td>
                <td className="px-5 py-3 text-gray-500">{stats?.alertsByUser[f.user_id] || 0}</td>
                <td className="px-5 py-3 text-gray-500">{f.created_at ? formatDateTime(f.created_at) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.farmers.length > 8 && (
          <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
            Showing 8 of {data.farmers.length} farmers.
          </p>
        )}
      </div>

      {modalDetection && (
        <AlertModal
          detection={modalDetection}
          onClose={() => setModalDetection(null)}
          onSend={(count) => {
            setModalDetection(null);
            setToast(`Alert sent to ${count} farmer${count === 1 ? "" : "s"}.`);
            load();
          }}
        />
      )}
    </div>
  );
}
