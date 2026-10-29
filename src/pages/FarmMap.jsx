import { useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import StatusBadge from "../components/StatusBadge";
import { farmers, detections } from "../data/mockData";
import { MapPin, Calendar, Plane, User, X, AlertTriangle, ShieldCheck } from "lucide-react";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Farm zone polygons — actual coords near Talakag, Bukidnon
const zones = [
  {
    farmer: farmers[0],
    coords: [[8.454, 124.631], [8.456, 124.631], [8.456, 124.633], [8.454, 124.633]],
  },
  {
    farmer: farmers[1],
    coords: [[8.460, 124.628], [8.462, 124.628], [8.462, 124.630], [8.460, 124.630]],
  },
  {
    farmer: farmers[2],
    coords: [[8.447, 124.635], [8.449, 124.635], [8.449, 124.637], [8.447, 124.637]],
  },
  {
    farmer: farmers[3],
    coords: [[8.452, 124.639], [8.454, 124.639], [8.454, 124.641], [8.452, 124.641]],
  },
];

const zoneStyle = {
  notified: { color: "#F4A522", fillColor: "#FEF3DC", fillOpacity: 0.6, weight: 2 },
  resolved: { color: "#9CA3AF", fillColor: "#F3F4F6", fillOpacity: 0.6, weight: 2 },
  no_alert: { color: "#1B4332", fillColor: "#E9F5EE", fillOpacity: 0.6, weight: 2 },
  active:   { color: "#F4A522", fillColor: "#FEF3DC", fillOpacity: 0.6, weight: 2 },
};

// Custom colored marker
function coloredIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 16px; height: 16px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function FarmMap() {
  const [selected, setSelected] = useState(null);

  const selectedDetection = selected
    ? detections.find((d) => d.farmerId === selected.id)
    : null;

  const center = [8.452, 124.634];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-forest" />
          <span className="text-sm font-medium text-charcoal">Talakag Banana Farm</span>
          <span className="text-xs text-gray-400">— Talakag, Bukidnon, Philippines</span>
        </div>
        <div className="flex items-center gap-2">
          <Plane size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400">UAV Coverage: 10.0 ha</span>
        </div>
      </div>

      {/* Map + Side Panel */}
      <div className="flex gap-4">
        {/* Leaflet Map */}
        <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all ${selected ? "flex-1" : "w-full"}`}>
          <div className="h-[500px] w-full">
            <MapContainer
              center={center}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {zones.map(({ farmer, coords }) => {
                const style = zoneStyle[farmer.status] || zoneStyle.no_alert;
                const markerColor = style.color;
                const centerLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                const centerLng = coords.reduce((s, c) => s + c[1], 0) / coords.length;

                return (
                  <div key={farmer.id}>
                    <Polygon
                      positions={coords}
                      pathOptions={style}
                      eventHandlers={{ click: () => setSelected(farmer) }}
                    />
                    <Marker
                      position={[centerLat, centerLng]}
                      icon={coloredIcon(markerColor)}
                      eventHandlers={{ click: () => setSelected(farmer) }}
                    >
                      <Popup>
                        <div className="text-xs font-medium">{farmer.name}</div>
                        <div className="text-xs text-gray-500">{farmer.coordinates}</div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-6 flex-wrap">
            <span className="text-xs font-medium text-gray-400">Legend:</span>
            {[
              { color: "#1B4332", label: "Healthy zone" },
              { color: "#F4A522", label: "Black Sigatoka detected" },
              { color: "#9CA3AF", label: "Resolved" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ background: l.color }} />
                <span className="text-xs text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        {selected && (
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden h-fit">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-forest-muted">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-forest" />
                <span className="text-sm font-semibold text-forest">Zone Details</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-forest/10 rounded-lg transition-colors"
              >
                <X size={15} className="text-forest" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Farmer info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-forest flex items-center justify-center text-white font-semibold text-xs shrink-0">
                  {selected.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">{selected.name}</p>
                  <p className="text-xs text-gray-400">{selected.area} ha assigned zone</p>
                </div>
              </div>

              {/* Detection thumbnail */}
              <div className={`w-full h-28 rounded-lg flex flex-col items-center justify-center gap-1.5 ${
                selectedDetection?.class === "Black Sigatoka" ? "bg-amber-50" : "bg-forest-muted"
              }`}>
                {selectedDetection?.class === "Black Sigatoka" ? (
                  <>
                    <AlertTriangle size={28} className="text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">Disease Detected</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={28} className="text-forest" />
                    <span className="text-xs font-medium text-forest">Zone is Healthy</span>
                  </>
                )}
                <span className="text-[10px] text-gray-400">UAV Scan Thumbnail</span>
              </div>

              {/* Details */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">GPS Coordinates</p>
                    <p className="text-xs font-mono text-charcoal">{selected.coordinates}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Last UAV Scan</p>
                    <p className="text-xs text-charcoal">{selectedDetection?.datetime || "No scan yet"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <User size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Notification Status</p>
                    <div className="mt-0.5">
                      <StatusBadge status={
                        selected.status === "notified" ? "Notified" :
                        selected.status === "resolved" ? "Resolved" : "No Alert"
                      } />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Plane size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Detection Class</p>
                    <div className="mt-0.5">
                      <StatusBadge status={selectedDetection?.class || "Healthy"} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Confidence bar */}
              {selectedDetection && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Confidence Score</span>
                    <span className="text-xs font-semibold text-charcoal">{selectedDetection.confidence}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        selectedDetection.class === "Black Sigatoka" ? "bg-amber" : "bg-forest"
                      }`}
                      style={{ width: `${selectedDetection.confidence}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}