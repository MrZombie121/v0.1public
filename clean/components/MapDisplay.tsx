
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AirEvent, TargetType } from '../types';
import { TARGET_COLORS, UKRAINE_BOUNDS } from '../constants';

interface MapDisplayProps {
  events: AirEvent[];
  onSelectEvent: (event: AirEvent | null) => void;
}

const getTargetIconSVG = (type: TargetType, color: string) => {
  switch (type) {
    case TargetType.SHAHED:
      return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L4 22L12 18L20 22L12 2Z"/></svg>`;
    case TargetType.MISSILE:
      return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L10 6V18L12 22L14 18V6L12 2Z"/></svg>`;
    case TargetType.KAB:
      return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2C10 2 8 4 8 8V14L6 20H18L16 14V8C16 4 14 2 12 2Z"/></svg>`;
  }
};

const calculateLivePos = (event: AirEvent): [number, number] => {
  const elapsedHours = (Date.now() - event.timestamp) / (1000 * 60 * 60);
  const dist = event.speed * elapsedHours;
  
  // В навигации 0 градусов - это Север (вверх)
  // В математике 0 градусов - это Восток (вправо)
  // Нам нужно: 0 -> North, 90 -> East
  // Поэтому используем sin для долготы и cos для широты
  const rad = (event.direction * Math.PI) / 180;
  
  const dLat = (dist * Math.cos(rad)) / 111.32;
  const dLng = (dist * Math.sin(rad)) / (111.32 * Math.cos(event.startLat * Math.PI / 180));
  
  return [event.startLat + dLat, event.startLng + dLng];
};

const MapDisplay: React.FC<MapDisplayProps> = ({ events, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const trailsRef = useRef<{ [key: string]: L.Polyline }>({});
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    mapRef.current = L.map(mapContainerRef.current, {
      center: [48.3794, 31.1656],
      zoom: 6,
      zoomControl: false,
      maxBounds: UKRAINE_BOUNDS,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);

    return () => { mapRef.current?.remove(); };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const currentIds = new Set(events.map(e => e.id));

    // Cleanup
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
        if (trailsRef.current[id]) {
          trailsRef.current[id].remove();
          delete trailsRef.current[id];
        }
      }
    });

    events.forEach(event => {
      const currentPos = calculateLivePos(event);
      const startPos: [number, number] = [event.startLat, event.startLng];
      
      let color = event.isVerified ? TARGET_COLORS.VERIFIED : TARGET_COLORS.REAL;
      if (event.isUserTest) color = TARGET_COLORS.USER_TEST;

      // Update Trail
      if (trailsRef.current[event.id]) {
        trailsRef.current[event.id].setLatLngs([startPos, currentPos]);
      } else {
        trailsRef.current[event.id] = L.polyline([startPos, currentPos], {
          color: color,
          weight: 1.5,
          opacity: 0.2,
          dashArray: '5, 10',
          interactive: false
        }).addTo(mapRef.current!);
      }

      // Icon HTML
      const isHighSpeed = event.speed > 500;
      const iconHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="relative">
            ${isHighSpeed ? `<div class="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-150"></div>` : ''}
            <div style="transform: rotate(${event.direction}deg); width: 32px; height: 32px;" 
                 class="relative z-10 transition-transform duration-1000 ease-linear hover:scale-125 drop-shadow-[0_0_8px_${color}]">
              ${getTargetIconSVG(event.type, color)}
            </div>
          </div>
          <div class="mt-1 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span class="text-[8px] font-mono text-white bg-slate-900/80 px-1 rounded border border-white/10 uppercase whitespace-nowrap">
              ${event.type} ${event.speed}km/h
            </span>
          </div>
        </div>
      `;

      const icon = L.divIcon({ 
        html: iconHtml, 
        className: 'custom-marker', 
        iconSize: [40, 40], 
        iconAnchor: [20, 20] 
      });

      if (markersRef.current[event.id]) {
        markersRef.current[event.id].setLatLng(currentPos);
        markersRef.current[event.id].setIcon(icon);
      } else {
        const marker = L.marker(currentPos, { icon }).addTo(mapRef.current!);
        marker.on('click', () => onSelectEvent(event));
        markersRef.current[event.id] = marker;
      }
    });
  }, [events, ticker, onSelectEvent]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[400] opacity-10">
        <div className="radar-sweep"></div>
      </div>
      <style>{`
        @keyframes sweep {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .radar-sweep {
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, transparent, rgba(34, 211, 238, 0.4), transparent);
          position: absolute;
          animation: sweep 10s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MapDisplay;
