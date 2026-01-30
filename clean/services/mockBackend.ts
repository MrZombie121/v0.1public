
import { AirEvent, TargetType, LogEntry, ParsedModifier } from '../types';
import { REGIONS, TACTICAL_SPAWN_POINTS, EVENT_EXPIRY_MINUTES } from '../constants';

// Координаты глубоко в Черном море (юго-восточнее Одессы)
const DEEP_SEA_POINTS = [
    [45.70, 31.80], 
    [46.00, 32.10],
    [45.30, 31.20]
];

class MockBackend {
  private events: AirEvent[] = [];
  private logs: LogEntry[] = [];

  private findRegion(name: string): any {
    if (!name) return null;
    const lower = name.toLowerCase();
    let found = REGIONS.find(r => 
      r.name.toLowerCase() === lower || 
      r.keywords.some(k => lower.includes(k))
    );
    if (!found && (lower.includes("одес") || lower.includes("odesa"))) return REGIONS.find(r => r.name === "Odesa");
    return found;
  }

  private calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
    const startLatRad = startLat * Math.PI / 180;
    const destLatRad = destLat * Math.PI / 180;
    const dLng = (destLng - startLng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(dLng);
    let brng = Math.atan2(y, x);
    return (brng * 180 / Math.PI + 360) % 360;
  }

  private findBestSpawn(regionName: string, modifier: string): [number, number] {
    if (modifier === 'sea') {
      const p = DEEP_SEA_POINTS[Math.floor(Math.random() * DEEP_SEA_POINTS.length)];
      return [p[0], p[1]];
    }
    
    const region = this.findRegion(regionName);
    if (modifier === 'border' || (region?.isBorder && modifier !== 'sea')) {
        const bp = TACTICAL_SPAWN_POINTS.BORDER[Math.floor(Math.random() * TACTICAL_SPAWN_POINTS.BORDER.length)];
        return [bp.coords[0], bp.coords[1]];
    }

    const base = region?.center || [48.4, 31.2];
    return [base[0] + (Math.random() - 0.5) * 0.1, base[1] + (Math.random() - 0.5) * 0.1];
  }

  // Handle manual message processing in the browser when the backend is offline
  public async processManualMessage(text: string, source: string, aiResult: { event: Partial<AirEvent>, modifiers: ParsedModifier }) {
    const id = 'man_' + Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    // Log the incoming tactical message
    this.logs.unshift({
      id,
      text,
      source,
      timestamp,
      isTest: !!aiResult.modifiers.isUserTest
    });

    // Handle clearing events (e.g., target destroyed or left airspace)
    if (aiResult.modifiers.isClear) {
      const regToClear = (aiResult.event.region || '').toLowerCase();
      this.events = this.events.filter(e => (e.region || '').toLowerCase() !== regToClear);
      return;
    }

    const mod = aiResult.modifiers.spawnModifier || 'normal';
    const regionName = aiResult.event.region || 'Odesa';
    const region = this.findRegion(regionName);
    const spawn = this.findBestSpawn(regionName, mod);
    const dest = region?.center || [46.48, 30.72];

    const newEvent: AirEvent = {
      id,
      type: aiResult.event.type || TargetType.SHAHED,
      region: regionName,
      originRegion: aiResult.event.originRegion,
      midpointRegions: aiResult.event.midpointRegions,
      spatialOffset: aiResult.event.spatialOffset as any,
      startLat: spawn[0],
      startLng: spawn[1],
      direction: this.calculateBearing(spawn[0], spawn[1], dest[0], dest[1]),
      speed: aiResult.event.type === TargetType.SHAHED ? 180 : 850,
      timestamp,
      isTest: !!aiResult.modifiers.isUserTest,
      isUserTest: !!aiResult.modifiers.isUserTest,
      isVerified: false,
      reliability: 'low',
      source,
      rawText: text
    };

    this.events.push(newEvent);
  }

  public syncServerEvents(serverEvents: any[]) {
    const manualEvents = this.events.filter(e => !e.id.startsWith('srv_'));
    
    const mapped = serverEvents.map(re => {
        const mod = re.spawnModifier || 'normal';
        const region = this.findRegion(re.region);
        const spawn = this.findBestSpawn(re.region, mod);
        const dest = region?.center || [46.48, 30.72];
        
        return {
            ...re,
            startLat: spawn[0],
            startLng: spawn[1],
            direction: this.calculateBearing(spawn[0], spawn[1], dest[0], dest[1]),
            speed: re.type === 'shahed' ? 180 : 850,
            isVerified: re.source?.includes("ЗСУ") || re.source?.includes("vanek")
        } as AirEvent;
    });
    
    this.events = [...manualEvents, ...mapped];
  }

  public getEvents(): AirEvent[] {
    const now = Date.now();
    this.events = this.events.filter(e => now - e.timestamp < EVENT_EXPIRY_MINUTES * 60 * 1000);
    return [...this.events];
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }
}

export const mockBackend = new MockBackend();
