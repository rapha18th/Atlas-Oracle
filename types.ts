export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AtlasContext {
  nominatim?: any;
  weather?: any;
  pois?: any[];
  timestamp: string;
}

export interface AnalysisResult {
  area_summary: string;
  top_opportunities: Array<{
    name: string;
    rationale: string;
    confidence_0_100: number;
    // New fields for enriched analysis
    example_project: string;
    project_description: string;
    estimated_cost: {
      total: string;
      breakdown: string[];
    };
  }>;
  land_use_suggestions: string[];
  risks: string[];
  recommendations: string[];
  evidence: {
    poi_counts_by_type: Array<{ type: string; count: number }>;
    notable_places: string[];
    elevation_m: number;
    weather_now: string;
    reverse_geocode_label: string;
    assumptions: string[];
  };
  voice_payload: {
    location_coords: {
      lat: number;
      lng: number;
    };
    area_summary: string;
    // Updated to pass full context to the voice agent
    top_opportunities: Array<{
      name: string;
      concept: string;
      cost: string;
    }>;
    land_use_suggestions: string[];
    risks: string[];
    recommendations: string[];
  };
}

export type LoadingState = 'idle' | 'fetching_data' | 'reasoning' | 'complete' | 'error';