import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from '../types';

interface MapComponentProps {
  coords: Coordinates;
  onCoordsChange: (coords: Coordinates) => void;
  radiusKm: number;
}

// Custom hook to update map center when coords change externally
const RecenterAutomatically = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

// Component to handle map clicks for positioning
const MapEvents = ({ onCoordsChange }: { onCoordsChange: (c: Coordinates) => void }) => {
  useMapEvents({
    click(e) {
      onCoordsChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ coords, onCoordsChange, radiusKm }) => {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const newPos = marker.getLatLng();
          onCoordsChange({ lat: newPos.lat, lng: newPos.lng });
        }
      },
    }),
    [onCoordsChange],
  );

  // Simple custom icon to avoid asset loading issues with default leaflet icon in some bundlers
  const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div className="h-full w-full bg-slate-200 z-0">
      <MapContainer 
        center={[coords.lat, coords.lng]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="filter grayscale opacity-80" // Desaturated look for professional aesthetic
        />
        <Marker 
          draggable={true}
          eventHandlers={eventHandlers}
          position={[coords.lat, coords.lng]}
          ref={markerRef}
          icon={customIcon}
        />
        <RecenterAutomatically lat={coords.lat} lng={coords.lng} />
        <MapEvents onCoordsChange={onCoordsChange} />
        
        {/* Visual Radius Indicator (approximate) */}
        <div className="leaflet-overlay-pane">
           <svg className="leaflet-zoom-animated" style={{pointerEvents: 'none'}}>
             {/* Note: In a real production app we'd use L.Circle, but for simplicity relying on tile layer is fine. 
                 Radius visualization is omitted to keep the map clean as per "calm" aesthetic request 
             */}
           </svg>
        </div>
      </MapContainer>
    </div>
  );
};

export default MapComponent;
