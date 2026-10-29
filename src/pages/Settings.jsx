import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  User, Bell, Radio, Users, FileText, Shield,
  Save, Clock, AlertTriangle, CheckCircle, LogOut, RefreshCw, Copy, AlertCircle,
} from "lucide-react";
import  api, {
  updateProfile, changePassword, getSettings, updateSettings,
  getScans, getDetections, getAlerts, getFarmers,
} from "../services/api";
import { parseServerDate, formatDateTime } from "../utils/Dates";
import { SESSION_TIMEOUT_KEY } from "../hooks/useIdleLogout";

const menu = [
  { id: "profile",       icon: <User size={16} />,     label: "Profile" },
  { id: "notifications", icon: <Bell size={16} />,     label: "Notification Settings" },
  { id: "uav",           icon: <Radio size={16} />,    label: "UAV Integration" },
  { id: "farmers",       icon: <Users size={16} />,    label: "Farmer Management" },
  { id: "logs",          icon: <FileText size={16} />, label: "System Logs" },
  { id: "security",      icon: <Shield size={16} />,   label: "Account & Security" },
];

const NOTIF_KEYS  = ["auto_notify", "alert_threshold", "alert_cooldown_hours"];
const FARMER_KEYS = ["farmers_can_acknowledge"];
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20";

// ── Small building blocks ──────────────────────────────────────────────────────

function Toggle({ label, description, checked, onChange, disabled = false, comingSoon = false }) {
  return (
    <div className={`flex items-start justify-between py-3.5 border-b border-gray-100 last:border-0 gap-4 ${disabled ? "opacity-60" : ""}`}>
      <div>
        <p className="text-sm text-charcoal font-medium">
          {label}
          {comingSoon && (
            <span className="ml-2 text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full align-middle">
              Coming soon
            </span>
          )}
        </p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 disabled:cursor-not-allowed ${checked ? "bg-forest" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function SliderField({ label, description, min, max, value, onChange, unit }) {
  return (
    <div className="py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-charcoal font-medium">{label}</p>
        <span className="text-sm font-semibold text-forest">{value}{unit}</span>
      </div>
      {description && <p className="text-xs text-gray-400 mb-2">{description}</p>}
      <input type="range" min={min} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-forest" />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isError = msg.startsWith("✗");
  return (
    <p className={`text-xs mt-1 font-medium ${isError ? "text-red-500" : "text-green-600"}`}>{msg}</p>
  );
}

function SaveButton({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-2 bg-forest hover:bg-forest-light disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
      <Save size={15} />
      {loading ? "Saving..." : children}
    </button>
  );
}

function LoadError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <AlertCircle size={28} className="mb-2 text-red-300" />
      <p className="text-sm text-gray-600">Could not load this section.</p>
      <p className="text-xs mt-1">{message}</p>
      <button onClick={onRetry}
        className="mt-3 px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
        Try again
      </button>
    </div>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const logColors = {
  success: "text-green-600 bg-green-50",
  warning: "text-amber-600 bg-amber-50",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Settings({ admin, onLogout, onAdminUpdate }) {
  const [active, setActive] = useState("profile");

  // Profile
  const [fullName, setFullName] = useState(admin?.full_name || "");
  const [username, setUsername] = useState(admin?.username || "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Session timeout (saved in this browser, enforced app-wide by useIdleLogout)
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    try { return localStorage.getItem(SESSION_TIMEOUT_KEY) || "0"; } catch { return "0"; }
  });

  // Saved settings (from the server)
  const [serverSettings, setServerSettings] = useState(null);
  const [draft, setDraft]                   = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError]     = useState("");
  const [notifMsg, setNotifMsg]   = useState("");
  const [farmerMsg, setFarmerMsg] = useState("");
  const [savingSection, setSavingSection] = useState("");

  // Scans / detections / alerts / farmers (for UAV status, farmer count and logs)
  const [activity, setActivity]               = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError]     = useState("");
  const [activityLoadedAt, setActivityLoadedAt] = useState(null);
  const [copied, setCopied] = useState(false);

  // The admin may finish loading after this page opens, so keep the form in sync
  useEffect(() => {
    setFullName(admin?.full_name || "");
    setUsername(admin?.username || "");
  }, [admin]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const data = await getSettings();
      setServerSettings(data);
      setDraft(data);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || "Could not reach the server.");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const [scans, detections, alerts, farmers] = await Promise.all([
        getScans(), getDetections(), getAlerts(), getFarmers(),
      ]);
      setActivity({ scans, detections, alerts, farmers });
      setActivityLoadedAt(new Date());
    } catch (err) {
      setActivityError(err.response?.data?.detail || "Could not reach the server.");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Load scans/alerts/etc. the first time a section needs them
  useEffect(() => {
    if (["uav", "farmers", "logs"].includes(active) && !activity && !activityLoading && !activityError) {
      loadActivity();
    }
  }, [active, activity, activityLoading, activityError, loadActivity]);

  const displayName = admin?.full_name || admin?.username || "—";
  const initials    = getInitials(displayName);
  const lastLogin   = formatDateTime(admin?.last_login);
  const createdDate = parseServerDate(admin?.created_at);
  const createdAt   = createdDate
    ? createdDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  // ── Profile ──
  const profileDirty =
    fullName.trim() !== (admin?.full_name || "") || username.trim() !== (admin?.username || "");

  async function handleSaveProfile() {
    const name  = fullName.trim();
    const uname = username.trim();
    if (!uname) { setProfileMsg("✗ Username cannot be empty"); return; }

    setProfileLoading(true);
    setProfileMsg("");
    try {
      const usernameChanged = uname !== admin?.username;
      const updated = await updateProfile({ full_name: name, username: uname });
      onAdminUpdate(updated);
      if (usernameChanged) {
        // The login token is tied to the old username, so a fresh sign-in is needed
        setProfileMsg("✓ Saved. Your username changed, so you'll be signed out. Sign in again with the new username.");
        setTimeout(onLogout, 2500);
      } else {
        setProfileMsg("✓ Profile saved successfully");
      }
    } catch (err) {
      setProfileMsg("✗ " + (err.response?.data?.detail || "Failed to save"));
    } finally {
      setProfileLoading(false);
    }
  }

  // ── Password ──
  async function handleChangePassword() {
    if (!currentPw || !newPw || !confirmPw) { setPasswordMsg("✗ Please fill in all three fields"); return; }
    if (newPw.length < 8)                   { setPasswordMsg("✗ New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw)                { setPasswordMsg("✗ New passwords do not match"); return; }

    setPasswordLoading(true);
    setPasswordMsg("");
    try {
      await changePassword({ current_password: currentPw, new_password: newPw, confirm_password: confirmPw });
      setPasswordMsg("✓ Password updated successfully");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPasswordMsg("✗ " + (err.response?.data?.detail || "Failed to update password"));
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleTimeoutChange(value) {
    setSessionTimeout(value);
    try { localStorage.setItem(SESSION_TIMEOUT_KEY, value); } catch { /* storage blocked */ }
  }

  // ── Saved settings (notifications + farmers) ──
  const isDirty = (keys) => !!draft && !!serverSettings && keys.some((k) => draft[k] !== serverSettings[k]);
  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  async function saveSection(section, keys, setMsg) {
    setSavingSection(section);
    setMsg("");
    try {
      const payload = {};
      keys.forEach((k) => { payload[k] = draft[k]; });
      const saved = await updateSettings(payload);
      setServerSettings(saved);
      setDraft((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, saved[k]])) }));
      setMsg("✓ Settings saved");
    } catch (err) {
      setMsg("✗ " + (err.response?.data?.detail || "Failed to save settings"));
    } finally {
      setSavingSection("");
    }
  }

  // ── UAV status (from real scans) ──
  const uav = useMemo(() => {
    if (!activity) return null;
    const dated = activity.scans
      .map((s) => ({ ...s, when: parseServerDate(s.timestamp) }))
      .filter((s) => s.when)
      .sort((a, b) => b.when - a.when);
    return {
      total:   activity.scans.length,
      last:    dated[0] || null,
      devices: [...new Set(activity.scans.map((s) => s.device_id).filter(Boolean))],
    };
  }, [activity]);

  async function copyApiAddress() {
    try {
      await navigator.clipboard.writeText(api.defaults.baseURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  // ── Activity log (built from real scans, detections and notifications) ──
  const events = useMemo(() => {
    if (!activity) return [];
    const { scans, detections, alerts, farmers } = activity;
    const scanById = {};   scans.forEach((s) => { scanById[s.scan_id] = s; });
    const farmerById = {}; farmers.forEach((f) => { farmerById[f.user_id] = f; });
    const list = [];

    scans.forEach((s) => list.push({
      id: `scan-${s.scan_id}`, type: "success", Icon: CheckCircle,
      message: `UAV scan #${s.scan_id} received${s.device_id ? ` from ${s.device_id}` : ""}`,
      when: parseServerDate(s.timestamp),
    }));

    detections.filter((d) => d.anomaly_detected).forEach((d) => {
      const pct = d.tier2_confidence != null ? ` (${(d.tier2_confidence * 100).toFixed(0)}% confidence)` : "";
      list.push({
        id: `det-${d.detection_id}`, type: "warning", Icon: AlertTriangle,
        message: `${d.detected_class || "Disease"} detected${pct}${d.scan_id ? ` in scan #${d.scan_id}` : ""}`,
        when: parseServerDate(scanById[d.scan_id]?.timestamp),
      });
    });

    alerts.forEach((a) => list.push({
      id: `alert-${a.alert_id}`, type: "success", Icon: CheckCircle,
      message: `Notification sent to ${a.user_id ? (farmerById[a.user_id]?.full_name || `Farmer #${a.user_id}`) : "all farmers"}`,
      when: parseServerDate(a.alert_sent_at),
    }));

    return list.sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
  }, [activity]);

  const settingsReady = !settingsLoading && !settingsError && draft;

  return (
    <div className="flex gap-5">
      {/* Menu */}
      <div className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl p-2 h-fit">
        {menu.map((m) => (
          <button key={m.id} onClick={() => setActive(m.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === m.id ? "bg-forest text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m.icon}{m.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-6">

        {/* ── Profile ── */}
        {active === "profile" && (
          <div className="space-y-5 max-w-md">
            <h3 className="font-semibold text-base text-charcoal">Profile</h3>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-forest flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">{displayName}</p>
                <p className="text-xs text-gray-400 mt-0.5">Admin · Joined {createdAt}</p>
                <p className="text-xs text-gray-400">Last login: {lastLogin}</p>
              </div>
            </div>

            <div>
              <label htmlFor="full-name" className="text-xs font-medium text-gray-500 block mb-1">Full Name</label>
              <input id="full-name" type="text" placeholder="e.g. Tiffanie Claire A. Cupal"
                value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label htmlFor="username" className="text-xs font-medium text-gray-500 block mb-1">Username</label>
              <input id="username" type="text" value={username}
                onChange={(e) => setUsername(e.target.value)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-1">If you change your username, you'll need to sign in again.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Role</label>
              <input value="Admin" readOnly
                className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>

            <StatusMsg msg={profileMsg} />
            <SaveButton onClick={handleSaveProfile} disabled={!profileDirty} loading={profileLoading}>
              Save Changes
            </SaveButton>
          </div>
        )}

        {/* ── Notification Settings ── */}
        {active === "notifications" && (
          <div className="max-w-md">
            <h3 className="font-semibold text-base text-charcoal mb-1">Notification Settings</h3>
            <p className="text-xs text-gray-400 mb-4">
              These rules apply whenever a new disease detection is saved. Notifications appear in the Notifications page.
            </p>

            {settingsLoading ? (
              <p className="text-sm text-gray-400 py-6">Loading settings...</p>
            ) : settingsError ? (
              <LoadError message={settingsError} onRetry={loadSettings} />
            ) : (
              <>
                <Toggle label="Auto-notify farmers on Black Sigatoka detection"
                  description="Creates a notification for every farmer as soon as a disease detection is saved"
                  checked={draft.auto_notify} onChange={(v) => setField("auto_notify", v)} />
                <SliderField label="Alert threshold confidence %"
                  description="Only send automatic alerts when detection confidence meets this level"
                  min={50} max={100} unit="%" value={draft.alert_threshold}
                  onChange={(v) => setField("alert_threshold", v)} />
                <SliderField label="Notification cooldown"
                  description="Minimum hours before the same farmer gets another automatic alert"
                  min={0} max={24} unit="h" value={draft.alert_cooldown_hours}
                  onChange={(v) => setField("alert_cooldown_hours", v)} />
                <Toggle label="Send SMS alongside notification" description="Requires an SMS service to be set up"
                  checked={false} onChange={() => {}} disabled comingSoon />
                <Toggle label="Daily scan summary report" description="Sends a summary of all UAV scans at end of day"
                  checked={false} onChange={() => {}} disabled comingSoon />

                <div className="pt-4 space-y-2">
                  <StatusMsg msg={notifMsg} />
                  <SaveButton onClick={() => saveSection("notif", NOTIF_KEYS, setNotifMsg)}
                    disabled={!isDirty(NOTIF_KEYS)} loading={savingSection === "notif"}>
                    Save Settings
                  </SaveButton>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── UAV Integration ── */}
        {active === "uav" && (
          <div className="max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-charcoal">UAV Integration</h3>
              <button onClick={loadActivity} disabled={activityLoading} title="Refresh"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                <RefreshCw size={14} className={activityLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {activityError ? (
              <LoadError message={activityError} onRetry={loadActivity} />
            ) : !uav ? (
              <p className="text-sm text-gray-400 py-6">Loading...</p>
            ) : (
              <>
                {uav.last ? (
                  <div className="flex items-center gap-3 bg-forest-muted border border-forest/20 rounded-lg px-4 py-3">
                    <CheckCircle size={16} className="text-forest shrink-0" />
                    <p className="text-xs text-forest font-medium">
                      Last scan received {timeAgo(uav.last.when)} ({formatDateTime(uav.last.when)})
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <Radio size={16} className="text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-500">
                      No scans received yet. This updates when the UAV system sends its first scan.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-[11px] text-gray-400">Total scans</p>
                    <p className="text-lg font-semibold text-charcoal">{uav.total}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-[11px] text-gray-400">Devices seen</p>
                    <p className="text-sm font-semibold text-charcoal truncate" title={uav.devices.join(", ")}>
                      {uav.devices.length ? uav.devices.join(", ") : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Server address</label>
                  <div className="flex items-center gap-2">
                    <input value={api.defaults.baseURL} readOnly
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 text-gray-600" />
                    <button onClick={copyApiAddress}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <Copy size={14} />{copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    The UAV system saves results to <span className="font-mono">POST /scans</span> and{" "}
                    <span className="font-mono">POST /detections</span> on this address (sign in with an admin account first).
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Farmer Management ── */}
        {active === "farmers" && (
          <div className="max-w-md space-y-4">
            <h3 className="font-semibold text-base text-charcoal">Farmer Management</h3>

            {activity && (
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-[11px] text-gray-400">Registered farmers</p>
                  <p className="text-lg font-semibold text-charcoal">{activity.farmers.length}</p>
                </div>
                <Link to="/farmers" className="text-xs text-forest hover:underline">Manage farmers</Link>
              </div>
            )}

            {settingsLoading ? (
              <p className="text-sm text-gray-400 py-6">Loading settings...</p>
            ) : settingsError ? (
              <LoadError message={settingsError} onRetry={loadSettings} />
            ) : (
              <>
                <div className="space-y-1">
                  <Toggle label="Allow farmers to mark notifications as read"
                    description="When off, farmers can still see their notifications but cannot update them"
                    checked={draft.farmers_can_acknowledge} onChange={(v) => setField("farmers_can_acknowledge", v)} />
                  <Toggle label="Auto-deactivate inactive farmer accounts"
                    description="Deactivate accounts with no activity for 30 days"
                    checked={false} onChange={() => {}} disabled comingSoon />
                </div>
                <StatusMsg msg={farmerMsg} />
                <SaveButton onClick={() => saveSection("farmer", FARMER_KEYS, setFarmerMsg)}
                  disabled={!isDirty(FARMER_KEYS)} loading={savingSection === "farmer"}>
                  Save Preferences
                </SaveButton>
              </>
            )}
          </div>
        )}

        {/* ── System Logs ── */}
        {active === "logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-charcoal">System Logs</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <Clock size={13} />
                <span>{activityLoadedAt ? `Last updated: ${formatDateTime(activityLoadedAt)}` : "Not loaded yet"}</span>
                <button onClick={loadActivity} disabled={activityLoading} title="Refresh"
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                  <RefreshCw size={14} className={activityLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {activityError ? (
              <LoadError message={activityError} onRetry={loadActivity} />
            ) : !activity ? (
              <p className="text-sm text-gray-400 py-6">Loading activity...</p>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FileText size={32} className="mb-2 opacity-30" />
                <p className="text-sm text-gray-600">No activity yet</p>
                <p className="text-xs mt-1">Scans, detections and notifications will be listed here as they happen.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {events.slice(0, 50).map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className={`p-1.5 rounded-lg shrink-0 ${logColors[log.type]}`}><log.Icon size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-charcoal">{log.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{log.when ? formatDateTime(log.when) : "Time not recorded"}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {events.length > 50 && (
                  <p className="text-xs text-gray-400 text-center">Showing the latest 50 of {events.length} events.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Account & Security ── */}
        {active === "security" && (
          <div className="max-w-md space-y-4">
            <h3 className="font-semibold text-base text-charcoal mb-4">Account &amp; Security</h3>

            <div>
              <label htmlFor="current-pw" className="text-xs font-medium text-gray-500 block mb-1">Current Password</label>
              <input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="new-pw" className="text-xs font-medium text-gray-500 block mb-1">New Password</label>
              <input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} />
              <p className="text-[11px] text-gray-400 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <label htmlFor="confirm-pw" className="text-xs font-medium text-gray-500 block mb-1">Confirm New Password</label>
              <input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
            </div>

            <StatusMsg msg={passwordMsg} />
            <SaveButton onClick={handleChangePassword} loading={passwordLoading}>Update Password</SaveButton>

            <div className="pt-2 border-t border-gray-100 space-y-1">
              <div className="py-3.5 border-b border-gray-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-charcoal font-medium">Session Timeout</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sign out automatically after no activity. Applies to this browser.</p>
                  </div>
                  <select value={sessionTimeout} onChange={(e) => handleTimeoutChange(e.target.value)} aria-label="Session timeout"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20">
                    <option value="0">Never</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-400 mb-1">
                  Signed in as <span className="font-medium text-charcoal">{admin?.username}</span>
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Last login: <span className="font-medium text-charcoal">{lastLogin}</span>
                </p>
                <button onClick={onLogout}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-red-200">
                  <LogOut size={15} />Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}