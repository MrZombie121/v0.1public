
import { AirEvent, TargetType, LogEntry } from '../types';
import { REGIONS } from '../constants';

class MockBackend {
  private events: AirEvent[] = [];
  private logs: LogEntry[] = [];

  public syncServerEvents(serverEvents: any[]) {
    if (!Array.isArray(serverEvents)) return;

    this.events = serverEvents.map(re => {
        // We no longer fallback to region centers. 
        // If re.lat/lng are missing, the MapDisplay will simply skip rendering.
        return {
            ...re,
            startLat: re.lat || 0,
            startLng: re.lng || 0,
            speed: re.type === 'missile' ? 800 : 180,
            isVerified: true
        } as AirEvent;
    });

    serverEvents.forEach(re => {
        if (re.rawText && !this.logs.some(l => l.text === re.rawText)) {
            this.logs.unshift({
                id: 'log_' + re.id,
                text: re.rawText,
                source: re.source || 'Intel',
                timestamp: re.timestamp || Date.now(),
                isTest: false
            });
        }
    });
  }

  public getEvents(): AirEvent[] {
    const now = Date.now();
    return this.events.filter(e => now - e.timestamp < 30 * 60 * 1000);
  }

  public getLogs(): LogEntry[] {
    return this.logs.slice(0, 20);
  }
}

export const mockBackend = new MockBackend();
