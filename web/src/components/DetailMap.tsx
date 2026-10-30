'use client';

import React, { useEffect, useState } from 'react';

interface DetailMapProps {
  latitude: number;
  longitude: number;
  title: string;
}

export default function DetailMap({ latitude, longitude, title }: DetailMapProps) {
  const [mounted, setMounted] = useState(false);
  const [LeafletMap, setLeafletMap] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([reactLeaflet, L]) => {
      const customIcon = L.default.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      setLeafletMap({
        MapContainer: reactLeaflet.MapContainer,
        TileLayer: reactLeaflet.TileLayer,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        icon: customIcon,
      });
    });
  }, []);

  if (!mounted || !LeafletMap) {
    return (
      <div className="w-full h-64 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
        Loading location map...
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, icon } = LeafletMap;

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-slate-200 shadow-sm z-0">
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={icon}>
          <Popup>
            <div className="text-xs font-medium text-slate-900">{title}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
