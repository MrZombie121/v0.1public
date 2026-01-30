
import { AirEvent, TargetType, ParsedModifier, LogEntry } from '../types';
import { REGIONS, TACTICAL_SPAWN_POINTS, EVENT_EXPIRY_MINUTES } from '../constants';
import { TGParser } from './tgParser';

class MockBackend {
  private events: AirEvent[] = [];
  private logs: LogEntry[] = [];

  private findRegion(name: string): any {
    if (!name) return null;
    const lower = name.toLowerCase();
    
    let found = REGIONS.find(r => 
      r.name.toLowerCase() === lower || 
      r.keywords.some(k => lower.includes(k) || k.includes(lower))
    );

    if (!found && lower.includes("одес")) {
        return REGIONS.find(r => r.name === "Odesa");
    }

    return found;
  }

  private applyOffset(coords: [number, number], offset?: string): [number, number] {
    if (!offset) return coords;
    const step = 0.08; 
    const [lat, lng] = coords;
    switch (offset) {
      case 'north': return [lat + step, lng];
      case 'south': return [lat - step, lng];
      case 'east': return [lat, lng + step];
      case 'west': return [lat, lng - step];
      case 'north-east': return [lat + step/1.4, lng + step/1.4];
      case 'north-west': return [lat + step/1.4, lng - step/1.4];
      case 'south-east': return [lat - step/1.4, lng + step/1.4];
      case 'south-west': return [lat - step/1.4, lng - step/1.4];
      default: return coords;
    }
  }

  private calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
    const startLatRad = startLat * Math.PI / 180;
    const destLatRad = destLat * Math.PI / 180;
    const dLng = (destLng - startLng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(dLng);
    let brng = Math.atan2(y, x);
    brng = brng * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  private findBestSpawn(regionName: string, modifier: string, originName?: string, spatialOffset?: string, midpointRegions?: string[]): [number, number] {
    if (midpointRegions && midpointRegions.length >= 2) {
      const r1 = this.findRegion(midpointRegions[0]);
      const r2 = this.findRegion(midpointRegions[1]);
      if (r1 && r2) {
        return [
          (r1.center[0] + r2.center[0]) / 2,
          (r1.center[1] + r2.center[1]) / 2
        ];
      }
    }

    if (originName) {
      const origin = this.findRegion(originName);
      if (origin) {
        let baseCoords: [number, number] = [origin.center[0], origin.center[1]];
        if (spatialOffset) baseCoords = this.applyOffset(baseCoords, spatialOffset);
        return [
          baseCoords[0] + (Math.random() - 0.5) * 0.02,
          baseCoords[1] + (Math.random() - 0.5) * 0.02
        ];
      }
    }

    const region = this.findRegion(regionName);
    if (modifier === 'sea' && region?.isCoastal) {
      const points = TACTICAL_SPAWN_POINTS.SEA;
      const point = points[Math.floor(Math.random() * points.length)];
      return [point.coords[0], point.coords[1]];
    }
    
    const base = region?.center || [46.48, 30.72]; 
    return [
      base[0] + (Math.random() - 0.5) * 0.1,
      base[1] + (Math.random() - 0.5) * 0.1
    ];
  }

  public async processManualMessage(text: string, source: string, preParsed?: any): Promise<AirEvent | null> {
    const result = preParsed || await TGParser.parseAI(text);
    if (!result) return null;

    const { event, modifiers } = result;
    const targetRegion = this.findRegion(event.region || '');

    if (modifiers.isClear) {
      const regToClear = (event.region || '').toLowerCase();
      this.events = this.events.filter(e => (e.region || '').toLowerCase() !== regToClear);
      this.logs.unshift({ id: 'clear_'+Date.now(), text: `ОЧИСТКА: ${event.region}`, source, timestamp: Date.now(), isTest: false });
      return null;
    }

    const spawnCoords = this.findBestSpawn(
      event.region || '', 
      modifiers.spawnModifier || 'normal', 
      modifiers.originRegion, 
      modifiers.spatialOffset,
      modifiers.midpointRegions
    );
    
    const destCoords = targetRegion?.center || [spawnCoords[0] + 0.05, spawnCoords[1] + 0.05];
    const finalDirection = this.calculateBearing(spawnCoords[0], spawnCoords[1], destCoords[0], destCoords[1]);

    const newEvent: AirEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: event.type || TargetType.SHAHED,
      region: targetRegion?.name || event.region || 'Unknown',
      originRegion: modifiers.originRegion,
      midpointRegions: modifiers.midpointRegions,
      spatialOffset: modifiers.spatialOffset as any,
      startLat: spawnCoords[0],
      startLng: spawnCoords[1],
      direction: finalDirection,
      speed: event.type === TargetType.SHAHED ? 180 : (event.type === TargetType.MISSILE ? 900 : 600),
      timestamp: Date.now(),
      isTest: false,
      isUserTest: !!modifiers.isUserTest,
      isVerified: source.includes("ЗСУ") || source.includes("Ванёк"),
      reliability: source.includes("ЗСУ") ? 'official' : 'high',
      source: source,
      rawText: text
    };

    this.events.push(newEvent);
    this.logs.unshift({ id: newEvent.id, text, source, timestamp: Date.now(), isTest: !!modifiers.isUserTest });
    return newEvent;
  }

  public injectEvent(re: any) {
    if (this.events.find(e => e.id === re.id)) return;
    const region = this.findRegion(re.region);
    const coords = region ? [region.center[0], region.center[1]] : [re.startLat || 46.48, re.startLng || 30.72];
    
    const event: AirEvent = {
      ...re,
      id: re.id || Math.random().toString(36).substr(2, 9),
      startLat: coords[0],
      startLng: coords[1],
      direction: re.direction ?? 0,
      timestamp: re.timestamp || Date.now(),
      speed: re.type === 'shahed' ? 180 : 900
    };
    this.events.push(event);
  }

  // Новый метод для полной синхронизации с сервером
  public syncServerEvents(serverEvents: any[]) {
    // 1. Оставляем только те локальные события, которые не начинаются на 'srv_' 
    // (то есть те, что были добавлены вручную в браузере)
    const manualEvents = this.events.filter(e => !e.id.startsWith('srv_'));
    
    // 2. Превращаем серверные события в формат AirEvent
    const mappedServerEvents = serverEvents.map(re => {
        const region = this.findRegion(re.region);
        const baseCoords = region ? region.center : [46.48, 30.72];
        return {
            ...re,
            startLat: re.startLat || baseCoords[0],
            startLng: re.startLng || baseCoords[1],
            direction: re.direction || 0,
            speed: re.speed || (re.type === 'shahed' ? 180 : 900)
        } as AirEvent;
    });

    // 3. Объединяем
    this.events = [...manualEvents, ...mappedServerEvents];
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
