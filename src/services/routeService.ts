// src/services/routeService.ts
// Helper utilities for generating Google Maps routes with safety analysis

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RunGeniusIntent } from './aiService';
import type { CrimePoint } from './crimeService';
import { summarizeRouteRisk } from './riskService';
import type { RouteRiskSummary } from './riskService';

export interface LatLng {
  lat: number;
  lng: number;
}

// --- Interface definitions ---

/**
 * Route object returned to the frontend, including geometry, stats, and safety summary.
 */
export interface GeneratedRoute {
  /** Encoded polyline overview (if available) */
  overview_polyline?: string;
  /** Ordered legs returned by Directions API */
  legs?: any[];
  /** Total distance in meters */
  distance_m?: number;
  /** Total duration in seconds */
  duration_s?: number;
  /** Full DirectionsResult when available (JS API) */
  directionsResult?: any;
  /** Safety summary for the route */
  riskSummary?: RouteRiskSummary; 
}

export interface GenerateRouteOptions {
  /** Optional: explicit origin lat/lng, preferred over text geocoding */
  originLatLng?: LatLng;
  /** Optional: travel mode, defaults to WALKING */
  travelMode?: 'WALKING' | 'DRIVING' | 'BICYCLING' | 'TRANSIT';
  /** Optional: Google Maps HTTP API key for fallback HTTP geocoding */
  apiKey?: string;
  /** Optional: number of loop waypoints to build (default 6) */
  waypointCount?: number;
}

// --- Helper functions ---

/** Resolve an address string to latitude/longitude. */
async function geocodeAddress(address: string, apiKey?: string): Promise<LatLng> {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    const geocoder = new (window as any).google.maps.Geocoder();
    return new Promise<LatLng>((resolve, reject) => {
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          reject(new Error('Geocoder failed: ' + status));
        }
      });
    });
  }

  if (!apiKey) throw new Error('No Google Maps JS available and no apiKey provided for HTTP Geocoding.');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status === 'OK' && json.results?.[0]) {
    return json.results[0].geometry.location as LatLng;
  }
  throw new Error('HTTP Geocoding failed: ' + JSON.stringify(json));
}

/** Compute destination coordinate from origin using bearing + distance. */
function destinationPoint(origin: LatLng, bearingDeg: number, distanceKm: number): LatLng {
    const R = 6371; // earth radius in km
    const brng = (bearingDeg * Math.PI) / 180;
    const d = distanceKm / R;
    const lat1 = (origin.lat * Math.PI) / 180;
    const lon1 = (origin.lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI };
}

/** Build waypoint list around the origin for a loop-style route. */
function buildLoopWaypoints(origin: LatLng, desiredDistanceKm: number, count = 6): LatLng[] {
  const radiusKm = Math.max(0.05, desiredDistanceKm / (2 * Math.PI));
  return Array.from({ length: count }, (_, i) => {
    const bearing = (i * 360) / count;
    return destinationPoint(origin, bearing, radiusKm);
  });
}

/** Request a route via the Google Maps JS DirectionsService. */
function routeWithMapsJS(origin: LatLng, waypoints: LatLng[], travelMode: any): Promise<any> {
  const directionsService = new (window as any).google.maps.DirectionsService();
  const originLatLng = new (window as any).google.maps.LatLng(origin.lat, origin.lng);
  const gmWaypoints = waypoints.map((p) => ({ location: new (window as any).google.maps.LatLng(p.lat, p.lng), stopover: true }));
  
  const request: any = {
    origin: originLatLng,
    destination: originLatLng,
    travelMode,
    waypoints: gmWaypoints,
    optimizeWaypoints: false, // keep the custom loop ordering
  };

  return new Promise((resolve, reject) => {
    directionsService.route(request, (result: any, status: any) => {
      if (status === 'OK') resolve(result);
      else reject(new Error('DirectionsService failed: ' + status));
    });
  });
}

// --- Main entry point ---

/**
 * Generate a drawable route with an attached safety summary based on the intent.
 */
export async function generateRoute(
  intent: RunGeniusIntent,
  crimePoints: CrimePoint[],
  options: GenerateRouteOptions = {}
): Promise<GeneratedRoute> {
  const travelMode = options.travelMode || 'WALKING';
  const waypointCount = options.waypointCount || 6;

  // 1. Determine origin location
  let originLatLng: LatLng | undefined = options.originLatLng;
  if (!originLatLng) {
    const placeText = intent.location?.context;
    if (!placeText) throw new Error('No origin provided in intent and no options.originLatLng');
    originLatLng = await geocodeAddress(placeText, options.apiKey);
  }

  // 2. Desired distance
  const desiredKm = intent.constraints?.distance_km ?? 5;

  // 3. Build loop waypoints
  const waypoints = buildLoopWaypoints(originLatLng, desiredKm, waypointCount);

  // 4. Request Google Directions API via JS client (HTTP fallback removed for simplicity)
  if (!(typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService)) {
    throw new Error('Google Maps JS API is not available.');
  }
  const directionsResult = await routeWithMapsJS(originLatLng, waypoints, (window as any).google.maps.TravelMode[travelMode]);
  const route = directionsResult.routes?.[0];
  if (!route) throw new Error('Directions API did not return any routes.');
  
  // 5. Aggregate distance and duration
  let totalDistance = 0;
  let totalDuration = 0;
  if (route.legs) {
    for (const leg of route.legs) {
      totalDistance += (leg.distance?.value || 0);
      totalDuration += (leg.duration?.value || 0);
    }
  }

  console.log("Summarizing route risk...");
  const riskSummary = summarizeRouteRisk(route, crimePoints);
  console.log("Risk Summary:", riskSummary);

  // 6. Build and return final payload
  return {
    overview_polyline: route.overview_polyline?.encodedPath || route.overview_polyline,
    legs: route.legs,
    distance_m: totalDistance,
    duration_s: totalDuration,
    directionsResult,
    riskSummary: riskSummary,
  };
}