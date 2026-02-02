
import { GoogleGenAI } from "@google/genai";
import { TargetType, AirEvent, ParsedModifier } from '../types';

export class TGParser {
  private static parseGrounded(text: string) {
    const latMatch = text.match(/LAT:\s*([\d.]+)/i);
    const lngMatch = text.match(/LNG:\s*([\d.]+)/i);
    const typeMatch = text.match(/TYPE:\s*(shahed|missile|kab)/i);
    const regionMatch = text.match(/REGION:\s*([a-z_]+)/i);
    const dirMatch = text.match(/DIR:\s*(\d+)/i);
    const clearMatch = text.match(/CLEAR:\s*(true|false)/i);

    return {
      type: typeMatch ? typeMatch[1].toLowerCase() : 'shahed',
      region: regionMatch ? regionMatch[1].toLowerCase() : 'sea',
      lat: latMatch ? parseFloat(latMatch[1]) : null,
      lng: lngMatch ? parseFloat(lngMatch[1]) : null,
      direction: dirMatch ? parseInt(dirMatch[1], 10) : 180,
      isClear: clearMatch ? clearMatch[1] === 'true' : false
    };
  }

  public static async parseAI(text: string): Promise<{ event: Partial<AirEvent>, modifiers: ParsedModifier } | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze for SkyWatch: "${text}".
        Format output:
        TYPE: [shahed|missile|kab]
        REGION: [id]
        LAT: [lat]
        LNG: [lng]
        DIR: [dir]
        CLEAR: [true|false]`,
      });

      const textOutput = response.text || "";
      const data = this.parseGrounded(textOutput);

      return {
        event: { 
          type: data.type as TargetType, 
          region: data.region, 
          lat: data.lat || undefined,
          lng: data.lng || undefined,
          direction: data.direction,
          rawText: text 
        },
        modifiers: {
          isClear: data.isClear,
          isUserTest: false,
          spawnModifier: 'normal'
        }
      };
    } catch (error) {
      console.error("AI Parser failed:", error);
      return null;
    }
  }
}
