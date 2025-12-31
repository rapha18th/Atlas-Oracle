import { Coordinates } from '../types';

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";
const METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// List of public Overpass API instances to try in order.
// If the main instance is busy (504/429), we fallback to others.
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

export const fetchReverseGeocode = async ({ lat, lng }: Coordinates) => {
  try {
    const url = `${NOMINATIM_BASE}?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AtlasOracle/1.0 (atlas-oracle-demo)'
      }
    });
    if (!response.ok) throw new Error("Nominatim fetch failed");
    return await response.json();
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

export const fetchWeatherAndElevation = async ({ lat, lng }: Coordinates) => {
  try {
    // Open-Meteo forecast API returns elevation by default in the root object.
    const url = `${METEO_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Meteo fetch failed: ${response.status} ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Weather error:", error);
    return null;
  }
};

export const fetchNearbyPOIs = async ({ lat, lng }: Coordinates, radiusKm: number) => {
  const radiusMeters = radiusKm * 1000;
  
  // Query nearby amenities, offices, and shops. 
  // [timeout:10] ensures we fail fast on a busy server to switch to a mirror quickly.
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"](around:${radiusMeters},${lat},${lng});
      way["amenity"](around:${radiusMeters},${lat},${lng});
      node["office"](around:${radiusMeters},${lat},${lng});
      node["shop"](around:${radiusMeters},${lat},${lng});
    );
    out center 30;
  `;

  const body = new URLSearchParams();
  body.append('data', query);

  // Try servers sequentially
  for (const server of OVERPASS_SERVERS) {
    try {
      const response = await fetch(server, {
        method: 'POST',
        body: body,
      });

      if (!response.ok) {
        console.warn(`Overpass fetch failed on ${server} with status ${response.status}. Trying next mirror...`);
        continue; // Try next server
      }
      
      const data = await response.json();
      return data.elements || [];

    } catch (error) {
      console.warn(`Network error requesting ${server}:`, error);
      // Continue to next server
    }
  }

  console.error("All Overpass servers failed or timed out.");
  // Return empty array so the application allows the analysis to proceed (graceful degradation)
  return [];
};
