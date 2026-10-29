// src/utils/dates.js
//
// The server saves times in UTC but sends them without a "Z" at the end
// (e.g. "2026-10-29T06:00:00"). Browsers then read them as local time and
// show the wrong hour. These helpers fix that so Philippine time displays correctly.

export function parseServerDate(value) {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value) {
  const d = value instanceof Date ? value : parseServerDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// "YYYY-MM-DD" in the viewer's local time, to compare with <input type="date">
export function toDateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}