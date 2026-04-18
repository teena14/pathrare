'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Cluster {
  id: string;
  region: string;
  district: string;
  needs: number;
  crises: number;
  resources: number;
  lat: number;
  lng: number;
  intensity: number;
}

interface Props {
  clusters: Cluster[];
  subRole: string;
}

function intensityToColor(intensity: number): string {
  if (intensity >= 0.85) return '#ef4444'; // rose-500
  if (intensity >= 0.65) return '#f97316'; // orange-500
  if (intensity >= 0.45) return '#eab308'; // yellow-500
  if (intensity >= 0.25) return '#22c55e'; // green-500
  return '#06b6d4';                        // cyan-500
}

export default function HeatMap({ clusters, subRole }: Props) {
  // Fix Leaflet default marker icon in Next.js
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require('leaflet');
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);

  // Center on Maharashtra
  const center: [number, number] = subRole === 'asha'
    ? [19.039, 72.855]  // Mumbai (hyperlocal for ASHA)
    : [19.45, 75.3];    // Maharashtra centre for govt/admin

  const zoom = subRole === 'asha' ? 10 : 6;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {clusters.map(c => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lng]}
          radius={10 + c.intensity * 30}
          pathOptions={{
            fillColor: intensityToColor(c.intensity),
            fillOpacity: 0.5,
            color: intensityToColor(c.intensity),
            weight: 2,
            opacity: 0.8,
          }}
        >
          <Tooltip permanent={false} direction="top">
            <div className="text-xs font-bold">
              <p>{c.district}, {c.region}</p>
              <p>Unmet needs: {c.needs}</p>
              {c.crises > 0 && <p className="text-rose-600">⚠ {c.crises} active crisis</p>}
              <p>Resources: {c.resources} available</p>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
