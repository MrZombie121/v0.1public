
import { GoogleGenAI, Type } from "@google/genai";
import { TargetType, AirEvent, ParsedModifier } from '../types';

export class TGParser {
  public static async parseAI(text: string): Promise<{ event: Partial<AirEvent>, modifiers: ParsedModifier } | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Сообщение: "${text}"`,
        config: {
          systemInstruction: `Ты — тактический анализатор SkyWatch. 
          Твоя задача: Разделить текст на ТОЧКУ ВЫЛЕТА/ТЕКУЩУЮ (originRegion) и ЦЕЛЬ (region).
          
          ВАЖНО ПО ОДЕССЕ:
          Аркадия, Фонтан, Ланжерон, Слободка, Поскот, Таирова, Черемушки, Лузановка — это всё РАЙОНЫ ОДЕССЫ.
          Если цель "на Аркадию", region должен быть "Odesa", но ты можешь указать в originRegion или spatialOffset дополнительные детали.
          
          ПРАВИЛА:
          1. "из [А] на [Б]" -> originRegion: А, region: Б.
          2. "между [А] и [Б] на [ЦЕЛЬ]" -> midpointRegions: [А, Б], region: ЦЕЛЬ.
          3. "[Направление] [Города]" -> Определи spatialOffset (north, south, east, west, north-east, etc).
          4. Типы: shahed (дроны), missile (ракеты), kab (бомбы).
          
          Верни JSON: { 
            type: string, 
            region: string, 
            originRegion: string | null,
            midpointRegions: string[] | null,
            spatialOffset: string | null,
            isClear: boolean,
            isUserTest: boolean,
            spawnModifier: 'sea'|'border'|'normal' 
          }`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['shahed', 'missile', 'kab'] },
              region: { type: Type.STRING },
              originRegion: { type: Type.STRING, nullable: true },
              midpointRegions: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              spatialOffset: { type: Type.STRING, nullable: true, enum: ['north', 'south', 'east', 'west', 'north-east', 'north-west', 'south-east', 'south-west'] },
              isClear: { type: Type.BOOLEAN },
              isUserTest: { type: Type.BOOLEAN },
              spawnModifier: { type: Type.STRING, enum: ['sea', 'border', 'normal'] }
            },
            required: ["type", "region", "isClear", "isUserTest"]
          }
        }
      });

      const data = JSON.parse(response.text);
      return {
        event: { 
          type: data.type as TargetType, 
          region: data.region, 
          originRegion: data.originRegion, 
          midpointRegions: data.midpointRegions,
          spatialOffset: data.spatialOffset,
          rawText: text 
        },
        modifiers: {
          isClear: data.isClear,
          isUserTest: data.isUserTest,
          spawnModifier: data.spawnModifier || 'normal',
          originRegion: data.originRegion,
          midpointRegions: data.midpointRegions,
          spatialOffset: data.spatialOffset
        }
      };
    } catch (error) {
      console.error("AI Parsing failed:", error);
      return null;
    }
  }
}
