
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AirEvent, TargetType } from '../types';
import { TARGET_COLORS, UKRAINE_BOUNDS } from '../constants';

interface MapDisplayProps {
  events: AirEvent[];
  onSelectEvent: (event: AirEvent | null) => void;
}

const GEOJSON_SOURCES = [
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.json', // Placeholder check
  'https://raw.githubusercontent.com/VadimGue/ukraine-geojson/master/ukraine.json',
  'https://cdn.jsdelivr.net/gh/EugeneBoryshpolets/ukraine_geojson@main/ukraine_regions.json'
];

const REGION_ID_MAP: Record<string, string> = {
  "odesa": "odesa", "одеська": "odesa", "kyiv": "kyiv", "київська": "kyiv",
  "kharkiv": "kharkiv", "харківська": "kharkiv", "lviv": "lviv", "львівська": "lviv",
  "dnipro": "dnipro", "дніпропетровська": "dnipro", "zaporizhzhia": "zaporizhzhia",
  "mykolaiv": "mykolaiv", "kherson": "kherson", "chernihiv": "chernihiv",
  "sumy": "sumy", "poltava": "poltava", "vinnytsia": "vinnytsia",
  "cherkasy": "cherkasy", "khmelnytskyi": "khmelnytskyi", "zhytomyr": "zhytomyr",
  "rivne": "rivne", "lutsk": "lutsk", "ternopil": "ternopil", "if": "if",
  "uzhhorod": "uzhhorod", "chernivtsi": "chernivtsi", "kirovohrad": "kirovohrad",
  "donetsk": "donetsk", "luhansk": "luhansk", "crimea": "crimea"
};

const normalizeStr = (val: any): string => {
  if (!val) return "";
  return String(val).toLowerCase()
    .replace(/ область/g, "")
    .replace(/oblast/g, "")
    .replace(/['’\.]/g, "")
    .replace(/\s+/g, "")
    .trim();
};

const getTargetIconSVG = (type: TargetType, color: string) => {
  const size = type === TargetType.MISSILE ? 28 : 24;
  switch (type) {
    case TargetType.SHAHED: return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L4 22L12 18L20 22L12 2Z"/></svg>`;
    case TargetType.MISSILE: return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L10 6V18L12 22L14 18V6L12 2Z"/></svg>`;
    case TargetType.KAB: return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2C10 2 8 4 8 8V14L6 20H18L16 14V8C16 4 14 2 12 2Z"/></svg>`;
    default: return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><circle cx="12" cy="12" r="8"/></svg>`;
  }
};

const MapDisplay: React.FC<MapDisplayProps> = ({ events, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const [ticker, setTicker] = useState(0);
  const [gridStatus, setGridStatus] = useState<'syncing' | 'online' | 'offline'>('syncing');

  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadGeoJSON = async () => {
    // Attempt multiple sources
    const urls = [
      'https://cdn.jsdelivr.net/gh/EugeneBoryshpolets/ukraine_geojson@main/ukraine_regions.json',
      'https://raw.githubusercontent.com/VadimGue/ukraine-geojson/master/ukraine.json'
    ];
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (mapRef.current) {
            applyGeoData(data);
            setGridStatus('online');
            return;
          }
        }
      } catch (e) {
        console.warn("GeoJSON URL failed:", url);
      }
    }
    setGridStatus('offline');
  };

  const applyGeoData = (data: any) => {
    if (!mapRef.current) return;
    if (geojsonLayerRef.current) mapRef.current.removeLayer(geojsonLayerRef.current);
    geojsonLayerRef.current = L.geoJSON(data, {
      style: { 
        color: 'rgba(255, 255, 255, 0.1)', 
        weight: 1, 
        fillColor: 'transparent', 
        fillOpacity: 0 
      }
    }).addTo(mapRef.current);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    const map = L.map(mapContainerRef.current, {
      center: [48.3794, 31.1656],
      zoom: 6,
      zoomControl: false,
      maxBounds: UKRAINE_BOUNDS,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    mapRef.current = map;
    
    loadGeoJSON();

    setTimeout(() => map.invalidateSize(), 500);

    return () => { 
      if (mapRef.current) {
        mapRef.current.remove(); 
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const activeRegions = new Map<string, string>();
    const activeIds = new Set(events.map(e => e.id));

    events.forEach(e => {
      if (e.region) activeRegions.set(e.region, e.isVerified ? TARGET_COLORS.REAL : TARGET_COLORS.TEST);
    });

    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.eachLayer((layer: any) => {
        const p = layer.feature?.properties;
        if (!p) return;
        
        let regionId = null;
        const names = [p.name, p.name_en, p.NAME_1, p.id, p.region_id];
        for (const n of names) {
          const norm = normalizeStr(n);
          if (REGION_ID_MAP[norm]) { regionId = REGION_ID_MAP[norm]; break; }
        }

        const path = layer as L.Path;
        if (regionId && activeRegions.has(regionId)) {
          const color = activeRegions.get(regionId)!;
          path.setStyle({ 
            color, 
            weight: 2, 
            fillColor: color, 
            fillOpacity: 0.15 + (Math.sin(ticker * 0.5) * 0.05) 
          });
        } else {
          path.setStyle({ 
            color: 'rgba(255, 255, 255, 0.1)', 
            weight: 1, 
            fillColor: 'transparent', 
            fillOpacity: 0 
          });
        }
      });
    }

    events.forEach(event => {
      // Use lat/lng or startLat/startLng as fallback
      const baseLat = event.lat || event.startLat;
      const baseLng = event.lng || event.startLng;

      if (typeof baseLat !== 'number' || typeof baseLng !== 'number') return;

      const elapsedHours = (Date.now() - event.timestamp) / 3600000;
      const speed = event.speed || 180;
      const dist = speed * elapsedHours;
      const rad = (event.direction * Math.PI) / 180;
      
      const currentPos: [number, number] = [
        baseLat + (dist * Math.cos(rad)) / 111.32, 
        baseLng + (dist * Math.sin(rad)) / (111.32 * Math.cos(baseLat * Math.PI / 180))
      ];

      let color = event.isVerified ? TARGET_COLORS.REAL : TARGET_COLORS.TEST;
      if (event.isUserTest || event.rawText?.toLowerCase().includes('тест')) color = TARGET_COLORS.USER_TEST;

      const icon = L.divIcon({ 
        html: `<div style="transform: rotate(${event.direction}deg); filter: drop-shadow(0 0 10px ${color});">${getTargetIconSVG(event.type, color)}</div>`, 
        className: 'custom-marker', 
        iconSize: [36, 36], 
        iconAnchor: [18, 18] 
      });

      if (markersRef.current[event.id]) {
        markersRef.current[event.id].setLatLng(currentPos).setIcon(icon);
      } else {
        const m = L.marker(currentPos, { icon, zIndexOffset: 5000 }).addTo(mapRef.current!);
        m.on('click', () => onSelectEvent(event));
        markersRef.current[event.id] = m;
      }
    });

    Object.keys(markersRef.current).forEach(id => { 
      if (!activeIds.has(id)) { 
        markersRef.current[id].remove(); 
        delete markersRef.current[id]; 
      } 
    });
  }, [events, ticker, onSelectEvent]);

  return (
    <div className="relative flex-1 w-full h-full min-h-0">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0 bg-[#020617]" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] glass-panel px-5 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl backdrop-blur-md">
         <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px] ${gridStatus === 'online' ? 'bg-emerald-500 shadow-emerald-500' : gridStatus === 'syncing' ? 'bg-amber-500 shadow-amber-500' : 'bg-rose-500 shadow-rose-500'}`} />
         <span className="text-[11px] font-black text-slate-200 uppercase tracking-widest">
           {gridStatus === 'online' ? 'GRID: SECURED' : gridStatus === 'syncing' ? 'SYNCING DATA...' : 'GRID: OFFLINE'}
         </span>
      </div>
    </div>
  );
};

export default MapDisplay;
