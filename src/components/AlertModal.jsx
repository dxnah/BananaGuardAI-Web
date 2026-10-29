import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { getFarmers, createAlert } from "../services/api";

// Builds the default message from the real detection data
function buildMessage(detection) {
  const pct = detection.tier2_confidence
    ? ` (${(detection.tier2_confidence * 100).toFixed(0)}% confidence)`
    : "";
  const tip = detection.recommendation ? ` ${detection.recommendation}` : "";
  return `⚠️ ${detection.detected_class || "Disease"} detected${pct} near your farm zone.${tip} Please inspect your crops immediately.`;
}

export default function AlertModal({ detection, onClose, onSend }) {
  const [farmers, setFarmers]   = useState([]);
  const [selected, setSelected] = useState([]);   // user_ids that will receive the alert
  const [message, setMessage]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!detection) return;
    setMessage(buildMessage(detection));
    setLoading(true);
    setError("");
    getFarmers()
      .then((list) => {
        setFarmers(list);
        setSelected(list.map((f) => f.user_id)); // everyone ticked by default
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load farmers."))
      .finally(() => setLoading(false));
  }, [detection]);

  if (!detection) return null;

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSend() {
    setSending(true);
    setError("");

    const results = await Promise.allSettled(
      selected.map((user_id) =>
        createAlert({
          detection_id: detection.detection_id,
          user_id,
          alert_message: message.trim(),
        })
      )
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    setSending(false);

    if (failed === 0) {
      onSend(sent);       // parent shows the success message and closes
    } else {
      // keep only the farmers that failed ticked, so a retry doesn't send duplicates
      setSelected(selected.filter((_, i) => results[i].status === "rejected"));
      setError(`Sent to ${sent}, but ${failed} failed. Press Send to retry the failed ones.`);
    }
  }

  const canSend = !loading && !sending && selected.length > 0 && message.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-charcoal">Alert Farmers in Area</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Detection</p>
            <p className="text-sm font-mono text-charcoal bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              #{detection.detection_id} — {detection.detected_class}
              {detection.lesion_count != null && ` — ${detection.lesion_count} lesions`}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">Send to ({selected.length} of {farmers.length})</p>
              {farmers.length > 0 && (
                <button
                  onClick={() => setSelected(selected.length === farmers.length ? [] : farmers.map((f) => f.user_id))}
                  className="text-xs text-forest hover:underline"
                >
                  {selected.length === farmers.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-gray-400 py-3">Loading farmers...</p>
            ) : farmers.length === 0 ? (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                No farmers are registered yet. Add farmers first, then come back to send this alert.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {farmers.map((f) => (
                  <label key={f.user_id}
                    className="flex items-center gap-3 p-2.5 bg-forest-muted rounded-lg cursor-pointer">
                    <input type="checkbox" checked={selected.includes(f.user_id)}
                      onChange={() => toggle(f.user_id)} className="accent-[#1B4332]" />
                    <div className="w-7 h-7 bg-forest rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {(f.full_name || f.username || "?").trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{f.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[f.phone_number, `@${f.username}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Message (you can edit it)</p>
            <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full text-sm text-gray-700 bg-amber-light border border-amber/30 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-forest/20 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={!canSend}
            className="flex-1 px-4 py-2 rounded-lg bg-forest text-white text-sm font-medium hover:bg-forest-light disabled:opacity-50 transition-colors">
            {sending ? "Sending..." : `Send to ${selected.length} farmer${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}