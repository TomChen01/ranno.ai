// src/services/riskService.ts

import type { CrimePoint } from './crimeService';

type BoundsJson = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type RouteLike = {
  bounds?: { toJSON: () => BoundsJson } | null;
  summary?: string;
  legs?: Array<{
    distance?: { text?: string };
    duration?: { text?: string };
  }>;
};

export type RiskLevel = 'low' | 'medium' | 'high';

export type RouteRiskSummary = {
  incidentsAlongRoute: number;
  incidentsSampled: number;
  level: RiskLevel;
  message: string;
};

export function summarizeRouteRisk(route: RouteLike, crimePoints: CrimePoint[]): RouteRiskSummary {
  const boundsJson = route.bounds?.toJSON();

  if (!boundsJson) {
    return {
      incidentsAlongRoute: 0,
      incidentsSampled: 0,
      level: 'low',
      message: 'Route bounds unavailable, skipping risk estimation.',
    };
  }

  const { south, west, north, east } = boundsJson;

  const incidentsAlongRoute = crimePoints.filter((point) => {
    return (
      point.latitude >= south &&
      point.latitude <= north &&
      point.longitude >= west &&
      point.longitude <= east
    );
  }).length;

  const incidentsSampled = crimePoints.length;

  const density = incidentsSampled === 0 ? 0 : incidentsAlongRoute / incidentsSampled;

  let level: RiskLevel = 'low';
  if (density > 0.25) {
    level = 'high';
  } else if (density > 0.12) {
    level = 'medium';
  }

  const messageByLevel: Record<RiskLevel, string> = {
    low: 'Route stays clear of most recent incidents. Suitable for planned run.',
    medium: 'Route overlaps with a moderate number of incidents. Stay alert and consider alternatives.',
    high: 'Route intersects with concentrated incidents. Strongly consider replanning or changing schedule.',
  };

  return {
    incidentsAlongRoute,
    incidentsSampled,
    level,
    message: messageByLevel[level],
  };
}

