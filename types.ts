
export enum TargetType {
  SHAHED = 'shahed',
  MISSILE = 'missile',
  KAB = 'kab'
}

export interface LogEntry {
  id: string;
  text: string;
  source: string;
  timestamp: number;
  isTest: boolean;
}

export interface AirEvent {
  id: string;
  type: TargetType;
  region: string; // Oblast ID
  cityName?: string;
  startLat: number;
  startLng: number;
  lat?: number; // Precise AI-detected latitude
  lng?: number; // Precise AI-detected longitude
  direction: number; 
  speed: number; 
  timestamp: number;
  isUserTest: boolean; 
  isVerified: boolean;
  source: string;
  rawText?: string;
  originRegion?: string | null;
  midpointRegions?: string[] | null;
  spatialOffset?: string | null;
}

export interface FilterState {
  types: TargetType[];
  showTest: boolean;
}

export interface RegionData {
  id: string;
  name: string;
  center: [number, number];
  radius: number; 
  keywords: string[];
  isCoastal?: boolean;
  isBorder?: boolean;
}

export interface ParsedModifier {
  isClear: boolean;
  isUserTest: boolean;
  spawnModifier: 'sea' | 'border' | 'normal';
  originRegion?: string | null;
  midpointRegions?: string[] | null;
  spatialOffset?: string | null;
}
