// src/components/MapView.tsx

import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import type { CrimePoint } from '../services/crimeService';
import type { RouteLike } from '../services/riskService';

export type TravelMode = 'WALKING' | 'BICYCLING' | 'DRIVING';

export type RouteEndpoint = {
  description: string;
  placeId?: string;
  location?: { lat: number; lng: number };
};

type DirectionsResultLike = {
  routes: RouteLike[];
};

export type RouteRequest = {
  origin: RouteEndpoint;
  destination: RouteEndpoint;
  travelMode: TravelMode;
  provideAlternatives: boolean;
};

type MapViewProps = {
  crimePoints: CrimePoint[];
  routeRequest: RouteRequest | null;
  onRouteReady?: (result: DirectionsResultLike) => void;
  onRouteError?: (status: string) => void;
  onPlacesServiceReady?: (service: google.maps.places.PlacesService) => void;
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

function MapLayers({
  crimePoints,
  routeRequest,
  onRouteReady,
  onRouteError,
  onPlacesServiceReady,
}: MapViewProps) {
  const map = useMap();
  const visualizationLibrary = useMapsLibrary('visualization');
  const routesLibrary = useMapsLibrary('routes');
  const placesLibrary = useMapsLibrary('places');

  const heatmapLayerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!map || !visualizationLibrary || heatmapLayerRef.current) {
      return;
    }

    const layer = new visualizationLibrary.HeatmapLayer({
      map,
      radius: 28,
      opacity: 0.7,
    });

    heatmapLayerRef.current = layer;

    return () => {
      layer.setMap(null);
      heatmapLayerRef.current = null;
    };
  }, [map, visualizationLibrary]);

  useEffect(() => {
    const layer = heatmapLayerRef.current;
    if (!layer) {
      return;
    }

    const points = crimePoints.map((point) => new google.maps.LatLng(point.latitude, point.longitude));
    layer.setData(points);
  }, [crimePoints]);

  useEffect(() => {
    if (!routesLibrary || directionsServiceRef.current) {
      return;
    }

    const service = new routesLibrary.DirectionsService();
    directionsServiceRef.current = service;

    return () => {
      directionsServiceRef.current = null;
    };
  }, [routesLibrary]);

  useEffect(() => {
    if (!map || !placesLibrary || placesServiceRef.current) {
      return;
    }

    const service = new placesLibrary.PlacesService(map);
    placesServiceRef.current = service;
    onPlacesServiceReady?.(service);

    return () => {
      placesServiceRef.current = null;
    };
  }, [map, placesLibrary, onPlacesServiceReady]);

  useEffect(() => {
    if (!map || !routesLibrary || directionsRendererRef.current) {
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

    directionsRendererRef.current = renderer;

    return () => {
      renderer.setMap(null);
      directionsRendererRef.current = null;
    };
  }, [map, routesLibrary]);

  useEffect(() => {
    const service = directionsServiceRef.current;
    const renderer = directionsRendererRef.current;
    if (!routeRequest || !service || !renderer) {
      return;
    }

    const travelMode =
      google.maps.TravelMode[routeRequest.travelMode as keyof typeof google.maps.TravelMode] ??
      google.maps.TravelMode.WALKING;

    const originParam = routeRequest.origin.placeId
      ? { placeId: routeRequest.origin.placeId }
      : routeRequest.origin.location ?? routeRequest.origin.description;

    const destinationParam = routeRequest.destination.placeId
      ? { placeId: routeRequest.destination.placeId }
      : routeRequest.destination.location ?? routeRequest.destination.description;

    service.route(
      {
        origin: originParam,
        destination: destinationParam,
        travelMode,
        provideRouteAlternatives: routeRequest.provideAlternatives,
      },
      (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result);
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
  }, [routeRequest, map, onRouteReady, onRouteError]);

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

