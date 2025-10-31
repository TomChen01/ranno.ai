// src/components/MapView.tsx

import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useState } from 'react';
import type { CrimePoint } from '../services/crimeService';
import type { RouteLike } from '../services/riskService';

export type TravelMode = 'WALKING' | 'BICYCLING' | 'DRIVING';

type DirectionsResultLike = {
  routes: RouteLike[];
};

export type RouteRequest = {
  origin: string;
  destination: string;
  travelMode: TravelMode;
  provideAlternatives: boolean;
};

type MapViewProps = {
  crimePoints: CrimePoint[];
  routeRequest: RouteRequest | null;
  onRouteReady?: (result: DirectionsResultLike) => void;
  onRouteError?: (status: string) => void;
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

function MapLayers({ crimePoints, routeRequest, onRouteReady, onRouteError }: MapViewProps) {
  const map = useMap();
  const visualizationLibrary = useMapsLibrary('visualization');
  const routesLibrary = useMapsLibrary('routes');

  const [heatmapLayer, setHeatmapLayer] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);

  useEffect(() => {
    if (!map || !visualizationLibrary || heatmapLayer) {
      return;
    }

    const layer = new visualizationLibrary.HeatmapLayer({
      map,
      radius: 28,
      opacity: 0.7,
    });

    setHeatmapLayer(layer);

    return () => {
      layer.setMap(null);
      setHeatmapLayer(null);
    };
  }, [map, visualizationLibrary, heatmapLayer]);

  useEffect(() => {
    if (!heatmapLayer) {
      return;
    }

    const points = crimePoints.map((point) => new google.maps.LatLng(point.latitude, point.longitude));
    heatmapLayer.setData(points);
  }, [crimePoints, heatmapLayer]);

  useEffect(() => {
    if (!routesLibrary || directionsService) {
      return;
    }

    const service = new routesLibrary.DirectionsService();
    setDirectionsService(service);

    return () => setDirectionsService(null);
  }, [routesLibrary, directionsService]);

  useEffect(() => {
    if (!map || !routesLibrary || directionsRenderer) {
      return;
    }

    const renderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeOpacity: 0.85,
        strokeWeight: 5,
      },
    });

    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
      setDirectionsRenderer(null);
    };
  }, [map, routesLibrary, directionsRenderer]);

  useEffect(() => {
    if (!routeRequest || !directionsService || !directionsRenderer) {
      return;
    }

    const travelMode =
      google.maps.TravelMode[routeRequest.travelMode as keyof typeof google.maps.TravelMode] ??
      google.maps.TravelMode.WALKING;

    directionsService.route(
      {
        origin: routeRequest.origin,
        destination: routeRequest.destination,
        travelMode,
        provideRouteAlternatives: routeRequest.provideAlternatives,
      },
      (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
          const primaryRoute = result.routes[0];
          if (primaryRoute?.bounds && map) {
            map.fitBounds(primaryRoute.bounds);
          }
          onRouteReady?.(result as DirectionsResultLike);
        } else {
          onRouteError?.(status);
        }
      },
    );
  }, [routeRequest, directionsService, directionsRenderer, map, onRouteReady, onRouteError]);

  return null;
}

export function MapView(props: MapViewProps) {
  return (
    <Map
      className="map-view"
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI
    >
      <MapLayers {...props} />
    </Map>
  );
}

