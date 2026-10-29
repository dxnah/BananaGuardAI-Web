import { useState, useEffect, useMemo } from "react";
import { getFarmers, createFarmer, updateFarmer, deleteFarmer } from "../services/api";
import { parseServerDate } from "../utils/Dates";
import { UserPlus, Eye, Pencil, Trash2, X, Phone, Calendar, AtSign, Search, AlertCircle } from "lucide-react";

const emptyForm = { full_name: "", username: "", phone_number: "", password: "" };
const PH_MOBILE = /^(?:\+?63|0)9\d{9}$/;
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20";

const formatDate = (value, long = false) => {
  const d = parseServerDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", long
    ? { year: "numeric", month: "long", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric" });
};

const getInitials = (name = "") =>
  name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

function validate(form, { needPassword }) {
  if (!form.full_name.trim()) return "Farmer name is required.";
  if (form.username.trim().length < 3) return "Username must be at least 3 characters.";
  if (!PH_MOBILE.test(form.phone_number.replace(/[\s\-()]/g, "")))
    return "Enter a valid mobile number, e.g. 09171234567.";
  if (needPassword && form.password.length < 8) return "Password must be at least 8 characters.";
  return "";
}

function FormModal({ title, submitLabel, form, setForm, showPassword, error, saving, onSubmit, onClose }) {
  const fields = [
    { label: "Farmer Name",   key: "full_name",    placeholder: "e.g. Juan Dela Cruz", type: "text" },
    { label: "Username",      key: "username",     placeholder: "e.g. juandelacruz",   type: "text" },
    { label: "Mobile Number", key: "phone_number", placeholder: "e.g. 09171234567",    type: "tel"  },
    ...(showPassword ? [{ label: "Password", key: "password", placeholder: "At least 8 characters", type: "password" }] : []),
  ];
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base text-charcoal">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                autoComplete={f.type === "password" ? "new-password" : "off"}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className={inputCls} />
            </div>
          ))}
          {!showPassword && (
            <p className="text-[11px] text-gray-400">Farmers change their own password from the mobile app.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onSubmit} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-forest text-white text-sm font-medium hover:bg-forest-light disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Farmers() {
  const [farmerList, setFarmerList] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState("");
  const [query, setQuery]           = useState("");
  const [viewFarmer, setViewFarmer] = useState(null);
  const [editFarmer, setEditFarmer] = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [formError, setFormError]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [notice, setNotice]         = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try { setFarmerList(await getFarmers()); }
    catch (err) { setLoadError(err.response?.data?.detail || "Could not reach the server."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmerList;
    return farmerList.filter((f) =>
      [f.full_name, f.username, f.phone_number].some((v) => (v || "").toLowerCase().includes(q)));
  }, [farmerList, query]);

  function openAdd()  { setForm(emptyForm); setFormError(""); setShowAdd(true); }
  function openEdit(f) {
    setForm({ full_name: f.full_name || "", username: f.username, phone_number: f.phone_number || "", password: "" });
    setFormError("");
    setEditFarmer(f);
  }
  function closeForms() { setShowAdd(false); setEditFarmer(null); setForm(emptyForm); setFormError(""); }

  async function handleAdd() {
    const problem = validate(form, { needPassword: true });
    if (problem) { setFormError(problem); return; }
    setSaving(true); setFormError("");
    try {
      const created = await createFarmer({
        full_name: form.full_name.trim(), username: form.username.trim(),
        phone_number: form.phone_number.trim(), password: form.password,
      });
      setFarmerList((list) => [...list, created]);
      closeForms();
      setNotice(`${created.full_name} was added.`);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to add farmer.");
    } finally { setSaving(false); }
  }

  async function handleEdit() {
    const problem = validate(form, { needPassword: false });
    if (problem) { setFormError(problem); return; }
    setSaving(true); setFormError("");
    try {
      const updated = await updateFarmer(editFarmer.user_id, {
        full_name: form.full_name.trim(), username: form.username.trim(), phone_number: form.phone_number.trim(),
      });
      setFarmerList((list) => list.map((f) => (f.user_id === updated.user_id ? updated : f)));
      const usernameChanged = updated.username !== editFarmer.username;
      closeForms();
      setNotice(usernameChanged
        ? `${updated.full_name} was updated. They must sign in again with the new username.`
        : `${updated.full_name} was updated.`);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Failed to update farmer.");
    } finally { setSaving(false); }
  }

  async function handleDelete(f) {
    if (!confirm(`Delete ${f.full_name || f.username}? Their notifications will be removed too.`)) return;
    try {
      await deleteFarmer(f.user_id);
      setFarmerList((list) => list.filter((x) => x.user_id !== f.user_id));
      setNotice(`${f.full_name || f.username} was deleted.`);
    } catch (err) {
      setNotice(err.response?.data?.detail || "Failed to delete farmer.");
    }
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">{notice}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">{farmerList.length} registered farmer{farmerList.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, mobile"
              className="border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-forest/20" />
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-forest hover:bg-forest-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <UserPlus size={16} />Add Farmer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs font-medium">
            <tr>{["Farmer Name", "Username", "Mobile Number", "Registered", "Actions"].map((h) => (
              <th key={h} className="text-left px-5 py-3">{h}</th>))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-xs">Loading...</td></tr>
            ) : loadError ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-gray-500">
                {loadError} <button onClick={load} className="text-forest hover:underline ml-1">Try again</button>
              </td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-xs">
                {farmerList.length === 0 ? "No farmers registered yet." : "No farmers match your search."}
              </td></tr>
            ) : visible.map((f) => (
              <tr key={f.user_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-white font-semibold text-xs shrink-0">
                      {getInitials(f.full_name || f.username)}
                    </div>
                    <span className="font-medium text-charcoal">{f.full_name || f.username}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">@{f.username}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{f.phone_number || "—"}</td>
                <td className="px-5 py-3 text-gray-500">{formatDate(f.created_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewFarmer(f)} className="p-1.5 hover:bg-forest-muted rounded-lg transition-colors text-forest" title="View"><Eye size={15} /></button>
                    <button onClick={() => openEdit(f)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-500" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(f)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-400" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewFarmer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-base text-charcoal">Farmer Profile</h2>
              <button onClick={() => setViewFarmer(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-forest flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(viewFarmer.full_name || viewFarmer.username)}
                </div>
                <div>
                  <p className="font-semibold text-charcoal text-base">{viewFarmer.full_name || viewFarmer.username}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Farmer</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1"><AtSign size={12} className="text-gray-400" /><p className="text-xs text-gray-400">Username</p></div>
                  <p className="text-sm font-semibold text-charcoal break-all">{viewFarmer.username}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1"><Phone size={12} className="text-gray-400" /><p className="text-xs text-gray-400">Mobile Number</p></div>
                  <p className="text-sm font-mono text-charcoal">{viewFarmer.phone_number || "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <div className="flex items-center gap-1.5 mb-1"><Calendar size={12} className="text-gray-400" /><p className="text-xs text-gray-400">Registered</p></div>
                  <p className="text-sm font-medium text-charcoal">{formatDate(viewFarmer.created_at, true)}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={() => setViewFarmer(null)} className="w-full py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <FormModal title="Add New Farmer" submitLabel="Add Farmer" showPassword
          form={form} setForm={setForm} error={formError} saving={saving} onSubmit={handleAdd} onClose={closeForms} />
      )}
      {editFarmer && (
        <FormModal title="Edit Farmer" submitLabel="Save Changes"
          form={form} setForm={setForm} error={formError} saving={saving} onSubmit={handleEdit} onClose={closeForms} />
      )}
    </div>
  );
}
