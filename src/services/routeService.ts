// src/services/routeService.ts
// 生成用于在 Google Maps 上绘制的路线，并集成风险评估

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RunGeniusIntent } from './aiService';
import type { CrimePoint } from './crimeService'; // 导入犯罪数据点类型
import { summarizeRouteRisk, RouteRiskSummary } from './riskService'; // 导入风险分析函数

export interface LatLng {
  lat: number;
  lng: number;
}

// --- 接口定义区 ---

/**
 * 最终生成的、可供前端使用的路线对象。
 * 包含了绘图信息、基本数据和安全风险评估。
 */
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
  /** 路线的风险评估报告 */
  riskSummary?: RouteRiskSummary; 
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

// --- 辅助函数区 ---

/**
 * 将地址文本解析为经纬度。
 */
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

/** 计算由起点出发、给定方位角和距离的目的地 */
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

/** 为环形路线生成环绕起点的 waypoint 列表。 */
function buildLoopWaypoints(origin: LatLng, desiredDistanceKm: number, count = 6): LatLng[] {
  const radiusKm = Math.max(0.05, desiredDistanceKm / (2 * Math.PI));
  return Array.from({ length: count }, (_, i) => {
    const bearing = (i * 360) / count;
    return destinationPoint(origin, bearing, radiusKm);
  });
}

/** 使用 Google Maps JS DirectionsService 请求路线。 */
function routeWithMapsJS(origin: LatLng, waypoints: LatLng[], travelMode: any): Promise<any> {
  const directionsService = new (window as any).google.maps.DirectionsService();
  const originLatLng = new (window as any).google.maps.LatLng(origin.lat, origin.lng);
  const gmWaypoints = waypoints.map((p) => ({ location: new (window as any).google.maps.LatLng(p.lat, p.lng), stopover: true }));
  
  const request: any = {
    origin: originLatLng,
    destination: originLatLng,
    travelMode,
    waypoints: gmWaypoints,
    optimizeWaypoints: false, // 保持我们计算的环形顺序
  };

  return new Promise((resolve, reject) => {
    directionsService.route(request, (result: any, status: any) => {
      if (status === 'OK') resolve(result);
      else reject(new Error('DirectionsService failed: ' + status));
    });
  });
}

// --- 主函数 ---

/**
 * 主函数：根据 RunGeniusIntent 生成可绘制路线，并附带风险评估。
 */
export async function generateRoute(
  intent: RunGeniusIntent,
  crimePoints: CrimePoint[],
  options: GenerateRouteOptions = {}
): Promise<GeneratedRoute> {
  const travelMode = options.travelMode || 'WALKING';
  const waypointCount = options.waypointCount || 6;

  // 1. 确定起点位置
  let originLatLng: LatLng | undefined = options.originLatLng;
  if (!originLatLng) {
    const placeText = intent.location?.context;
    if (!placeText) throw new Error('No origin provided in intent and no options.originLatLng');
    originLatLng = await geocodeAddress(placeText, options.apiKey);
  }

  // 2. 确定目标距离
  const desiredKm = intent.constraints?.distance_km ?? 5;

  // 3. 生成环绕 waypoint 列表 (适用于环形路线)
  const waypoints = buildLoopWaypoints(originLatLng, desiredKm, waypointCount);

  // 4. 请求 Google Directions API 获取路线
  //    (注意：当前版本仅实现了JS API调用，HTTP 回退逻辑已移除以简化)
  if (!(typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService)) {
    throw new Error('Google Maps JS API is not available.');
  }
  const directionsResult = await routeWithMapsJS(originLatLng, waypoints, (window as any).google.maps.TravelMode[travelMode]);
  const route = directionsResult.routes?.[0];
  if (!route) throw new Error('Directions API did not return any routes.');
  
  // 5. 计算总距离和时长
  let totalDistance = 0;
  let totalDuration = 0;
  if (route.legs) {
    for (const leg of route.legs) {
      totalDistance += (leg.distance?.value || 0);
      totalDuration += (leg.duration?.value || 0);
    }
  }

  // 6. 【核心集成】调用风险评估服务
  console.log("Summarizing route risk...");
  const riskSummary = summarizeRouteRisk(route, crimePoints);
  console.log("Risk Summary:", riskSummary);

  // 7. 构建并返回最终的、包含所有信息的路线对象
  return {
    overview_polyline: route.overview_polyline?.encodedPath || route.overview_polyline,
    legs: route.legs,
    distance_m: totalDistance,
    duration_s: totalDuration,
    directionsResult,
    riskSummary: riskSummary,
  };
}