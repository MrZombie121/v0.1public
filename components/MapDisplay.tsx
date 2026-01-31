
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AirEvent, TargetType } from '../types';
import { TARGET_COLORS, UKRAINE_BOUNDS, REGIONS } from '../constants';

interface MapDisplayProps {
  events: AirEvent[];
  onSelectEvent: (event: AirEvent | null) => void;
}

const GEOJSON_SOURCES = [
  'https://cdn.jsdelivr.net/gh/EugeneBoryshpolets/ukraine_geojson@main/ukraine_regions.json',
  'https://raw.githubusercontent.com/EugeneBoryshpolets/ukraine_geojson/main/ukraine_regions.json'
];

const REGION_ID_MAP: Record<string, string> = {
  "odesa": "odesa", "одеська": "odesa", "ua51": "odesa",
  "kyiv": "kyiv", "київська": "kyiv", "ua32": "kyiv",
  "kharkiv": "kharkiv", "харківська": "kharkiv", "ua63": "kharkiv",
  "lviv": "lviv", "львівська": "lviv", "ua46": "lviv",
  "dnipro": "dnipro", "дніпропетровська": "dnipro", "ua12": "dnipro",
  "zaporizhzhia": "zaporizhzhia", "запорізька": "zaporizhzhia", "ua23": "zaporizhzhia",
  "mykolaiv": "mykolaiv", "миколаївська": "mykolaiv", "ua48": "mykolaiv",
  "kherson": "kherson", "херсонська": "kherson", "ua65": "kherson",
  "chernihiv": "chernihiv", "чернігівська": "chernihiv", "ua74": "chernihiv",
  "sumy": "sumy", "сумська": "sumy", "ua59": "sumy",
  "poltava": "poltava", "полтавська": "poltava", "ua53": "poltava",
  "vinnytsia": "vinnytsia", "вінницька": "vinnytsia", "ua05": "vinnytsia",
  "cherkasy": "cherkasy", "черкаська": "cherkasy", "ua71": "cherkasy",
  "khmelnytskyi": "khmelnytskyi", "хмельницька": "khmelnytskyi", "ua68": "khmelnytskyi",
  "zhytomyr": "zhytomyr", "житомирська": "zhytomyr", "ua18": "zhytomyr",
  "rivne": "rivne", "рівненська": "rivne", "ua56": "rivne",
  "lutsk": "lutsk", "волинська": "lutsk", "ua07": "lutsk",
  "ternopil": "ternopil", "тернопільська": "ternopil", "ua61": "ternopil",
  "if": "if", "іванофранківська": "if", "ua26": "if",
  "uzhhorod": "uzhhorod", "закарпатська": "uzhhorod", "ua21": "uzhhorod",
  "chernivtsi": "chernivtsi", "чернівецька": "chernivtsi", "ua77": "chernivtsi",
  "kirovohrad": "kirovohrad", "кіровоградська": "kirovohrad", "ua35": "kirovohrad",
  "donetsk": "donetsk", "донецька": "donetsk", "ua14": "donetsk",
  "luhansk": "luhansk", "луганська": "luhansk", "ua44": "luhansk",
  "crimea": "crimea", "крим": "crimea", "ua43": "crimea"
};

const normalizeStr = (val: any): string => {
  if (!val) return "";
  return String(val).toLowerCase().replace(/ область/g, "").replace(/ oblast/g, "").replace(/ region/g, "").replace(/ city/g, "city").replace(/['’\.]/g, "").replace(/\s+/g, "").trim();
};

const getTargetIconSVG = (type: TargetType, color: string) => {
  switch (type) {
    case TargetType.SHAHED: return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L4 22L12 18L20 22L12 2Z"/></svg>`;
    case TargetType.MISSILE: return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2L10 6V18L12 22L14 18V6L12 2Z"/></svg>`;
    case TargetType.KAB: return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><path d="M12 2C10 2 8 4 8 8V14L6 20H18L16 14V8C16 4 14 2 12 2Z"/></svg>`;
    default: return `<svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="8"/></svg>`;
  }
};

const MapDisplay: React.FC<MapDisplayProps> = ({ events, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadGeoJSON = async () => {
    for (const url of GEOJSON_SOURCES) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!response.ok) continue;
        const data = await response.json();
        if (mapRef.current) {
          if (geojsonLayerRef.current) mapRef.current.removeLayer(geojsonLayerRef.current);
          geojsonLayerRef.current = L.geoJSON(data, {
            style: { color: 'rgba(255, 255, 255, 0.1)', weight: 1, fillColor: 'transparent', fillOpacity: 0 }
          }).addTo(mapRef.current);
          return;
        }
      } catch (e) {}
    }
  };

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
    loadGeoJSON();
    return () => { mapRef.current?.remove(); };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const activeRegions = new Map<string, string>();
    const activeIds = new Set(events.map(e => e.id));

    events.forEach(e => activeRegions.set(e.region, e.isVerified ? TARGET_COLORS.REAL : TARGET_COLORS.TEST));

    // Boundary Highlighting
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.eachLayer((layer: any) => {
        const p = layer.feature?.properties;
        if (!p) return;
        
        let regionId = null;
        const names = [p.name, p.name_en, p.NAME_1, p.id, p.ISO];
        for (const n of names) {
          const norm = normalizeStr(n);
          if (REGION_ID_MAP[norm]) { regionId = REGION_ID_MAP[norm]; break; }
        }

        const path = layer as L.Path;
        if (regionId && activeRegions.has(regionId)) {
          const color = activeRegions.get(regionId)!;
          path.setStyle({ color, weight: 2, fillColor: color, fillOpacity: 0.15 + (Math.sin(ticker * 0.5) * 0.05) });
        } else {
          path.setStyle({ color: 'rgba(255, 255, 255, 0.1)', weight: 1, fillColor: 'transparent', fillOpacity: 0 });
        }
      });
    }

    // Precise Target Placement
    events.forEach(event => {
      // Use AI-provided coordinates exclusively
      const lat = event.lat;
      const lng = event.lng;
      if (lat === undefined || lng === undefined) return;

      const dist = event.speed * ((Date.now() - event.timestamp) / 3600000);
      const rad = (event.direction * Math.PI) / 180;
      const currentPos: [number, number] = [
        lat + (dist * Math.cos(rad)) / 111.32, 
        lng + (dist * Math.sin(rad)) / (111.32 * Math.cos(lat * Math.PI / 180))
      ];

      let color = event.isVerified ? TARGET_COLORS.REAL : TARGET_COLORS.TEST;
      if (event.isUserTest) color = TARGET_COLORS.USER_TEST;

      const icon = L.divIcon({ 
        html: `<div style="transform: rotate(${event.direction}deg);" class="drop-shadow-[0_0_10px_${color}]">${getTargetIconSVG(event.type, color)}</div>`, 
        className: 'custom-marker', iconSize: [30, 30], iconAnchor: [15, 15] 
      });

      if (markersRef.current[event.id]) {
        markersRef.current[event.id].setLatLng(currentPos).setIcon(icon);
      } else {
        const m = L.marker(currentPos, { icon }).addTo(mapRef.current!);
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
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] glass-panel px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-3">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
           Precise Geo-Targeting Active
         </span>
      </div>
    </div>
  );
};

export default MapDisplay;
