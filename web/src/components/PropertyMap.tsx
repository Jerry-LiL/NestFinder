'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Property } from '../lib/api';

interface PropertyMapProps {
  properties: Property[];
}

export default function PropertyMap({ properties }: PropertyMapProps) {
  const [mounted, setMounted] = useState(false);
  const [LeafletMap, setLeafletMap] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    // Dynamically load react-leaflet and leaflet on client
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([reactLeaflet, L]) => {
      // Fix default leaflet icons
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
      <div className="w-full h-full min-h-[450px] bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
        Loading interactive map...
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, icon } = LeafletMap;

  // Default center if no properties or calculate average center
  const validCoords = properties.filter((p) => p.latitude && p.longitude);
  const centerLat =
    validCoords.length > 0
      ? validCoords.reduce((acc, p) => acc + p.latitude, 0) / validCoords.length
      : 19.076;
  const centerLng =
    validCoords.length > 0
      ? validCoords.reduce((acc, p) => acc + p.longitude, 0) / validCoords.length
      : 72.8777;

  return (
    <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden border border-slate-200 shadow-sm z-0">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={validCoords.length > 0 ? 11 : 5}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validCoords.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude, property.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="text-xs max-w-[200px] p-1">
                <div className="font-semibold text-slate-900 mb-1">{property.title}</div>
                <div className="text-indigo-600 font-bold mb-1">
                  ₹{property.price.toLocaleString('en-IN')} / mo
                </div>
                <div className="text-slate-500 mb-2">
                  {property.beds} Bed · {property.propertyType}
                </div>
                <Link
                  href={`/properties/${property.id}`}
                  className="inline-block text-center text-xs bg-indigo-600 text-white px-2 py-1 rounded font-medium hover:bg-indigo-700 transition"
                >
                  View Details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
