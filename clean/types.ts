
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
  region: string;
  originRegion?: string; 
  midpointRegions?: string[];
  spatialOffset?: 'north' | 'south' | 'east' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west' | null;
  startLat: number;
  startLng: number;
  direction: number; 
  speed: number; 
  timestamp: number;
  isTest: boolean; 
  isUserTest: boolean; 
  isVerified: boolean;
  reliability: 'low' | 'high' | 'official';
  source: string;
  rawText?: string;
}

export interface FilterState {
  types: TargetType[];
  showTest: boolean;
}

export interface ParsedModifier {
  isSea?: boolean;
  isBorder?: boolean;
  isUserTest?: boolean;
  isClear?: boolean;
  spawnModifier?: 'sea' | 'border' | 'normal';
  originRegion?: string;
  midpointRegions?: string[];
  spatialOffset?: string;
}

export interface RegionData {
  name: string;
  center: [number, number];
  keywords: string[];
  isCoastal?: boolean;
  isBorder?: boolean;
}
