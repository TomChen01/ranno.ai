// src/services/routeService.ts
// 生成用于在 Google Maps 上绘制的路线

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RunGeniusIntent } from './aiService';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeneratedRoute {
  /** Encoded polyline overview (if available) */
  overview_polyline?: string;
  /** Ordered legs returned by Directions API */
  legs?: any[];
  /** 总距离（米） */
  distance_m?: number;
  /** 总时长（秒） */
  duration_s?: number;
  /** Full DirectionsResult when available (JS API) */
  directionsResult?: any;
}

export interface GenerateRouteOptions {
  /** 可选：显式提供起点经纬度（优先） */
  originLatLng?: LatLng;
  /** 可选：行程类型，默认 WALKING */
  travelMode?: 'WALKING' | 'DRIVING' | 'BICYCLING' | 'TRANSIT';
  /** 可选：Google Maps HTTP API key — 当页面没有加载 Google Maps JS API 时可回退使用 */
  apiKey?: string;
  /** 可选：生成环形路点数量（默认 6） */
  waypointCount?: number;
}

/**
 * 将地址文本解析为经纬度：优先使用 window.google.maps.Geocoder（如果加载了 Maps JS），
 * 否则在提供 apiKey 时回退到 HTTP Geocoding API。
 */
async function geocodeAddress(address: string, apiKey?: string): Promise<LatLng> {
  // If google maps JS api is present
  if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.Geocoder) {
    const geocoder = new (window as any).google.maps.Geocoder();
    return new Promise<LatLng>((resolve, reject) => {
  geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
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
  if (json.status === 'OK' && json.results && json.results[0]) {
    const loc = json.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  throw new Error('HTTP Geocoding failed: ' + JSON.stringify(json));
}

/** 计算由起点出发、给定方位角（degrees）和距离（公里）的目的地 */
function destinationPoint(origin: LatLng, bearingDeg: number, distanceKm: number): LatLng {
  const R = 6371; // earth radius km
  const brng = (bearingDeg * Math.PI) / 180;
  const d = distanceKm / R;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lon1 = (origin.lng * Math.PI) / 180;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

  return { lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI };
}

/**
 * 为环形路线生成环绕起点的 waypoint 列表。
 * 我们用简单的圆形近似：给定期望总长度 L (km)，圆半径 r = L / (2π)。
 */
function buildLoopWaypoints(origin: LatLng, desiredDistanceKm: number, count = 6): LatLng[] {
  const radiusKm = Math.max(0.05, desiredDistanceKm / (2 * Math.PI)); // 最小半径 50m
  const waypoints: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    const bearing = (i * 360) / count;
    waypoints.push(destinationPoint(origin, bearing, radiusKm));
  }
  return waypoints;
}

/**
 * 使用 Google Maps JS DirectionsService 请求路线（浏览器上下文）。
 */
function routeWithMapsJS(origin: LatLng, waypoints: LatLng[], travelMode: any): Promise<any> {
  const directionsService = new (window as any).google.maps.DirectionsService();
  const originLatLng = new (window as any).google.maps.LatLng(origin.lat, origin.lng);
  const gmWaypoints = waypoints.map((p) => ({ location: new (window as any).google.maps.LatLng(p.lat, p.lng), stopover: true }));

  const request: any = {
    origin: originLatLng,
    destination: originLatLng,
    travelMode,
    waypoints: gmWaypoints,
    optimizeWaypoints: false,
  };

  return new Promise((resolve, reject) => {
    directionsService.route(request, (result: any, status: any) => {
      if (status === 'OK') resolve(result);
      else reject(new Error('DirectionsService failed: ' + status));
    });
  });
}

/**
 * 主函数：根据 RunGeniusIntent 生成可绘制路线。
 * 说明：优先使用页面上已加载的 Google Maps JS API；当不可用且提供 apiKey 时，回退到 HTTP Geocoding + Directions HTTP API（注意 CORS/配额）。
 */
export async function generateRoute(intent: RunGeniusIntent, options: GenerateRouteOptions = {}): Promise<GeneratedRoute> {
  const travelMode = options.travelMode || 'WALKING';
  const waypointCount = options.waypointCount || 6;

  // 1) 确定起点位置
  let originLatLng: LatLng | undefined = options.originLatLng;
  if (!originLatLng) {
    const placeText = intent.location?.context;
    if (!placeText) throw new Error('No origin provided in intent and no options.originLatLng');
    originLatLng = await geocodeAddress(placeText, options.apiKey);
  }

  // 2) 目标距离
  const desiredKm = intent.constraints?.distance_km ?? 5;

  // 3) 生成环绕 waypoint 列表
  const waypoints = buildLoopWaypoints(originLatLng, desiredKm, waypointCount);

  // 4) 请求 Directions
  // If Google Maps JS is present, use it
  if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.DirectionsService) {
    const directionsResult = await routeWithMapsJS(originLatLng, waypoints, (window as any).google.maps.TravelMode[travelMode]);

    // compute totals
    let totalDistance = 0;
    let totalDuration = 0;
    if (directionsResult && directionsResult.routes && directionsResult.routes[0] && directionsResult.routes[0].legs) {
      const legs = directionsResult.routes[0].legs;
      for (const leg of legs) {
        totalDistance += (leg.distance?.value || 0);
        totalDuration += (leg.duration?.value || 0);
      }
    }

    return {
      overview_polyline: directionsResult.routes?.[0]?.overview_polyline?.encodedPath || directionsResult.routes?.[0]?.overview_polyline?.points,
      legs: directionsResult.routes?.[0]?.legs,
      distance_m: totalDistance,
      duration_s: totalDuration,
      directionsResult,
    };
  }

  // 5) 否则，回退到 HTTP Directions API (需要 apiKey)
  if (!options.apiKey) throw new Error('Google Maps JS API not available and no apiKey provided for HTTP Directions fallback');

  // Build waypoints param as lat,lng|lat,lng|...
  const wpParam = waypoints.map((p) => `${p.lat},${p.lng}`).join('|');
  const originParam = `${originLatLng.lat},${originLatLng.lng}`;
  // For HTTP Directions, we request origin -> origin with waypoints
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originParam}&destination=${originParam}&waypoints=${encodeURIComponent('via:' + wpParam)}&mode=${travelMode.toLowerCase()}&key=${options.apiKey}`;

  const resp = await fetch(url);
  const json = await resp.json();
  if (json.status !== 'OK') throw new Error('HTTP Directions failed: ' + JSON.stringify(json));

  // Aggregate results
  let totalDistance = 0;
  let totalDuration = 0;
  if (json.routes && json.routes[0] && json.routes[0].legs) {
    for (const leg of json.routes[0].legs) {
      totalDistance += leg.distance?.value || 0;
      totalDuration += leg.duration?.value || 0;
    }
  }

  return {
    overview_polyline: json.routes?.[0]?.overview_polyline?.points,
    legs: json.routes?.[0]?.legs,
    distance_m: totalDistance,
    duration_s: totalDuration,
    directionsResult: json,
  };
}
