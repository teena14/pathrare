'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export type HeatCluster = {
  id: string;
  region: string;
  district: string;
  intensity: number;
  unmetNeeds: number;
  urgentCases: number;
  topNeed: string;
  lat: number;
  lng: number;
};

function intensityToColor(intensity: number) {
  if (intensity >= 90) return '#ef4444';
  if (intensity >= 75) return '#f97316';
  if (intensity >= 60) return '#f59e0b';
  if (intensity >= 45) return '#10b981';
  return '#0ea5e9';
}

export default function NgoHeatMap({ clusters }: { clusters: HeatCluster[] }) {
  return (
    <div className="ngo-map-shell relative z-0 overflow-hidden rounded-[1.8rem]">
      <MapContainer
        center={[19.2, 75.3]}
        zoom={6}
        scrollWheelZoom
        className="h-[520px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {clusters.map((cluster) => (
          <CircleMarker
            key={cluster.id}
            center={[cluster.lat, cluster.lng]}
            radius={10 + cluster.intensity / 5}
            pathOptions={{
              color: intensityToColor(cluster.intensity),
              fillColor: intensityToColor(cluster.intensity),
              fillOpacity: 0.45,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-bold">{cluster.district}</p>
                <p className="text-xs text-slate-600">{cluster.region}</p>
                <p className="text-xs">Intensity: {cluster.intensity}%</p>
                <p className="text-xs">Unmet needs: {cluster.unmetNeeds}</p>
                <p className="text-xs">Urgent cases: {cluster.urgentCases}</p>
                <p className="text-xs">Top need: {cluster.topNeed}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
