import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, AtlasContext, Coordinates } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    area_summary: { type: Type.STRING, description: "A concise professional summary of the location's character." },
    top_opportunities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          rationale: { type: Type.STRING },
          confidence_0_100: { type: Type.NUMBER },
          example_project: { type: Type.STRING, description: "A specific, named example of a business that could exist here (e.g. 'The Harbor Roast Coffee Lab')." },
          project_description: { type: Type.STRING, description: "Description of the example project (size, target audience, vibe)." },
          estimated_cost: {
            type: Type.OBJECT,
            properties: {
              total: { type: Type.STRING, description: "Estimated total startup cost range (e.g. '$150k - $220k')." },
              breakdown: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 key line items used to calculate the estimate." }
            },
            required: ["total", "breakdown"]
          }
        },
        required: ["name", "rationale", "confidence_0_100", "example_project", "project_description", "estimated_cost"]
      }
    },
    land_use_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidence: {
      type: Type.OBJECT,
      properties: {
        poi_counts_by_type: {
          type: Type.ARRAY,
          description: "List of POI types and their counts found in the data.",
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              count: { type: Type.INTEGER }
            },
            required: ["type", "count"]
          }
        },
        notable_places: { type: Type.ARRAY, items: { type: Type.STRING } },
        elevation_m: { type: Type.NUMBER },
        weather_now: { type: Type.STRING },
        reverse_geocode_label: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["poi_counts_by_type", "notable_places", "elevation_m", "weather_now", "reverse_geocode_label", "assumptions"]
    },
    voice_payload: {
      type: Type.OBJECT,
      properties: {
        location_coords: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          },
          required: ["lat", "lng"]
        },
        area_summary: { type: Type.STRING },
        top_opportunities: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              concept: { type: Type.STRING, description: "The specific example project name and concept." },
              cost: { type: Type.STRING, description: "The total estimated startup cost." }
            },
            required: ["name", "concept", "cost"]
          } 
        },
        land_use_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        risks: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["location_coords", "area_summary", "top_opportunities", "land_use_suggestions", "risks", "recommendations"]
    }
  },
  required: ["area_summary", "top_opportunities", "land_use_suggestions", "risks", "recommendations", "evidence", "voice_payload"]
};

export const analyzeWithGemini = async (
  coords: Coordinates,
  radiusKm: number,
  contextData: AtlasContext
): Promise<AnalysisResult> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this location for business potential and urban planning context.
    
    Coordinates: ${coords.lat}, ${coords.lng}
    Radius: ${radiusKm}km
    
    RAW DATA CONTEXT:
    ${JSON.stringify(contextData, null, 2)}
    
    INSTRUCTIONS:
    1. Reason over the provided raw data (POIs, weather, geocoding) AND use Google Search to find recent news, development plans, or specific business context for this exact area.
    2. Provide a professional, analytical assessment.
    3. Suggest 3 specific, feasible business opportunities. For EACH opportunity, provide:
       - A rationale grounded in the data.
       - A CONCRETE EXAMPLE PROJECT: Invent a realistic name and concept (e.g., "Greenline Logistics Hub" or "The Corner Bakery").
       - Describe the project (size, who it serves).
       - Provide an ESTIMATED STARTUP COST range with a brief breakdown of 3-4 major costs (e.g., "Fitout: $50k", "Equipment: $30k"). Explicitly state these are estimates.
    4. Fill the 'voice_payload' with concise summaries suitable for a text-to-speech agent to read aloud. 
       IMPORTANT: The 'voice_payload.top_opportunities' must include the specific Concept Name and Estimated Cost you generated in the detailed section, so the voice agent can discuss them.
    5. Be strictly factual. If data is sparse, acknowledge it in 'assumptions'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (err) {
    console.error("Gemini Analysis Error:", err);
    throw err;
  }
};