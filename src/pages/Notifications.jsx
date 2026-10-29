import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../components/StatusBadge";
import { getAlerts, createAlert, acknowledgeAlert, getFarmers } from "../services/api";
import { formatDateTime } from "../utils/dates";
import { Send, X, Bell, RefreshCw, CheckCheck, AlertCircle } from "lucide-react";

const filters = ["All", "Sent", "Resolved"];

// An alert is "Resolved" once it has been acknowledged
const statusOf = (n) => (n.acknowledged ? "Resolved" : "Sent");

export default function Notifications() {
  const [filter, setFilter]       = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [notifList, setNotifList] = useState([]);
  const [farmers, setFarmers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending]     = useState(false);
  const [sendError, setSendError] = useState("");
  const [form, setForm]           = useState({ recipient: "", message: "" });

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [alerts, farmerData] = await Promise.all([getAlerts(), getFarmers()]);
      setNotifList(alerts);
      setFarmers(farmerData);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.detail || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // user_id -> farmer, so the table can show names instead of numbers
  const farmerById = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.user_id] = f; });
    return map;
  }, [farmers]);

  const filtered = filter === "All"
    ? notifList
    : notifList.filter((n) => statusOf(n) === filter);

  async function handleAcknowledge(alert_id) {
    try {
      const updated = await acknowledgeAlert(alert_id);
      setNotifList((prev) => prev.map((n) => (n.alert_id === alert_id ? updated : n)));
    } catch (err) {
      alert(err.response?.data?.detail || "Could not resolve this notification.");
    }
  }

  function openModal() {
    setForm({ recipient: "", message: "" });
    setSendError("");
    setShowModal(true);
  }

  async function handleSend() {
    const message = form.message.trim();
    if (!message) return;

    // "" means all farmers; otherwise one farmer's user_id
    const targets = form.recipient
      ? [Number(form.recipient)]
      : farmers.map((f) => f.user_id);

    if (targets.length === 0) {
      setSendError("There are no farmers to notify yet. Add a farmer first.");
      return;
    }

    setSending(true);
    setSendError("");
    try {
      const created = await Promise.all(
        targets.map((user_id) => createAlert({ user_id, alert_message: message }))
      );
      setNotifList((prev) => [...created, ...prev]);
      setShowModal(false);
    } catch (err) {
      setSendError(err.response?.data?.detail || "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function farmerLabel(n) {
    if (!n.user_id) return "All Farmers";
    return farmerById[n.user_id]?.full_name || `Farmer #${n.user_id}`;
  }

  return (
    <div className="space-y-5">
      {/* Filter + Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? "bg-forest text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === f ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {f === "All" ? notifList.length : notifList.filter((n) => statusOf(n) === f).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading} title="Refresh"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openModal}
            className="flex items-center gap-2 bg-amber hover:bg-yellow-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Send size={15} />
            Send New Notification
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AlertCircle size={32} className="mb-2 text-red-300" />
            <p className="text-sm text-gray-600">Could not load notifications.</p>
            <p className="text-xs mt-1">{loadError}</p>
            <button onClick={loadData}
              className="mt-4 px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell size={32} className="mb-2 opacity-30" />
            {notifList.length === 0 ? (
              <>
                <p className="text-sm text-gray-600">No notifications yet</p>
                <p className="text-xs mt-1">Alerts sent from UAV Detections and manual notifications will appear here.</p>
              </>
            ) : (
              <p className="text-sm">No {filter.toLowerCase()} notifications</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
              <tr>
                {["Date/Time", "Farmer", "Type", "Message", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((n) => (
                <tr key={n.alert_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDateTime(n.alert_sent_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {farmerLabel(n)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={n.detection_id ? "UAV Alert" : "Manual"} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={n.alert_message || ""}>
                    {n.alert_message || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statusOf(n)} />
                  </td>
                  <td className="px-4 py-3">
                    {!n.acknowledged ? (
                      <button onClick={() => handleAcknowledge(n.alert_id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors">
                        <CheckCheck size={12} />
                        Resolve
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300 italic">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-base text-charcoal">Send New Notification</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-forest-muted border border-forest/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <Bell size={13} className="text-forest shrink-0" />
                <p className="text-xs text-forest font-medium">Talakag Banana Farm — Manual Notification</p>
              </div>

              {sendError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0" />
                  {sendError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Recipient</label>
                <select value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20">
                  <option value="">All Farmers ({farmers.length})</option>
                  {farmers.map((f) => (
                    <option key={f.user_id} value={f.user_id}>{f.full_name} ({f.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Message</label>
                <textarea rows={3} placeholder="Type your notification message..."
                  value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSend} disabled={!form.message.trim() || sending}
                className="flex-1 py-2 rounded-lg bg-forest hover:bg-forest-light disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Send size={14} />
                {sending ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}