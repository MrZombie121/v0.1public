
import { AirEvent, TargetType, LogEntry, ParsedModifier } from '../types';
import { REGIONS, TACTICAL_SPAWN_POINTS, EVENT_EXPIRY_MINUTES } from '../constants';

const DEEP_SEA_POINTS = [
    [45.70, 31.80], 
    [46.00, 32.10],
    [45.30, 31.20]
];

class MockBackend {
  private events: AirEvent[] = [];
  private logs: LogEntry[] = [];

  private findRegion(name: string): any {
    if (!name) return REGIONS[0]; // Fallback to Odesa
    const lower = name.toLowerCase();
    
    // Прямое совпадение или через ключевые слова
    let found = REGIONS.find(r => 
      r.name.toLowerCase() === lower || 
      r.keywords.some(k => lower.includes(k.toLowerCase()))
    );

    // Если ИИ вернул что-то про Одессу, чего нет в keywords
    if (!found && (lower.includes("одес") || lower.includes("odesa"))) {
        return REGIONS.find(r => r.name === "Odesa");
    }

    return found || REGIONS[0]; 
  }

  private calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
    const startLatRad = startLat * Math.PI / 180;
    const destLatRad = destLat * Math.PI / 180;
    const dLng = (destLng - startLng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private findBestSpawn(regionName: string, modifier: string): [number, number] {
    if (modifier === 'sea') {
      const p = DEEP_SEA_POINTS[Math.floor(Math.random() * DEEP_SEA_POINTS.length)];
      return [p[0], p[1]];
    }
    
    const region = this.findRegion(regionName);
    if (modifier === 'border' || region?.isBorder) {
        const bp = TACTICAL_SPAWN_POINTS.BORDER[Math.floor(Math.random() * TACTICAL_SPAWN_POINTS.BORDER.length)];
        return [bp.coords[0], bp.coords[1]];
    }

    const base = region?.center || [48.4, 31.2];
    // Небольшой разброс, чтобы метки не слипались
    return [base[0] + (Math.random() - 0.5) * 0.5, base[1] + (Math.random() - 0.5) * 0.5];
  }

  public syncServerEvents(serverEvents: any[]) {
    if (!Array.isArray(serverEvents)) return;

    // Сохраняем логи, если они пришли
    serverEvents.forEach(re => {
        if (re.rawText && !this.logs.some(l => l.text === re.rawText)) {
            this.logs.unshift({
                id: 'log_' + re.id,
                text: re.rawText,
                source: re.source || 'Server',
                timestamp: re.timestamp || Date.now(),
                isTest: !!re.isUserTest
            });
        }
    });

    this.events = serverEvents.map(re => {
        const mod = re.spawnModifier || 'normal';
        const region = this.findRegion(re.region);
        const spawn = this.findBestSpawn(re.region, mod);
        const dest = region?.center || [46.48, 30.72];
        
        return {
            ...re,
            startLat: spawn[0],
            startLng: spawn[1],
            direction: this.calculateBearing(spawn[0], spawn[1], dest[0], dest[1]),
            speed: re.type === 'missile' ? 850 : 180,
            isVerified: true
        } as AirEvent;
    });
    
    console.log(`[SYNC] Active events: ${this.events.length}`);
  }

  public getEvents(): AirEvent[] {
    const now = Date.now();
    // События живут 45 минут
    return this.events.filter(e => now - e.timestamp < 45 * 60 * 1000);
  }

  public getLogs(): LogEntry[] {
    return this.logs.slice(0, 30);
  }
}

export const mockBackend = new MockBackend();
