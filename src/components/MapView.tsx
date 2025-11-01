// src/components/MapView.tsx

import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import type { CrimePoint } from '../services/crimeService';
import type { AmenityStop } from '../services/routeService';

export type TravelMode = 'WALKING' | 'BICYCLING' | 'DRIVING';

export type RouteEndpoint = {
  description: string;
  placeId?: string;
  location?: { lat: number; lng: number };
};

type MapViewProps = {
  crimePoints: CrimePoint[];
  directionsResult: google.maps.DirectionsResult | null;
  waterStops: AmenityStop[];
  restroomStops: AmenityStop[];
  onPlacesServiceReady?: (service: google.maps.places.PlacesService) => void;
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

function MapLayers({ crimePoints, directionsResult, waterStops, restroomStops, onPlacesServiceReady }: MapViewProps) {
  const map = useMap();
  const visualizationLibrary = useMapsLibrary('visualization');
  const routesLibrary = useMapsLibrary('routes');
  const placesLibrary = useMapsLibrary('places');

  const heatmapLayerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const waterMarkersRef = useRef<google.maps.Marker[]>([]);
  const restroomMarkersRef = useRef<google.maps.Marker[]>([]);

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
    const renderer = directionsRendererRef.current;
    if (!renderer) {
      return;
    }

    if (directionsResult && directionsResult.routes?.length) {
      renderer.setDirections(directionsResult);
      const primaryRoute = directionsResult.routes[0];
      if (primaryRoute?.bounds && map) {
        map.fitBounds(primaryRoute.bounds);
      }
    } else {
      renderer.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
    }
  }, [directionsResult, map]);

  useEffect(() => {
    const rendererMap = map;
    if (!rendererMap) {
      return;
    }

    waterMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    waterMarkersRef.current = [];
    restroomMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    restroomMarkersRef.current = [];

    if (!waterStops || waterStops.length === 0 || !window.google?.maps?.Marker) {
      // even if no water stops, we could still render restrooms separately below.
    } else {
      const dropPath = 'M12 2C9.238 6.333 6 9.714 6 13.2 6 17.418 9.582 21 13.8 21s7.8-3.582 7.8-7.8c0-3.486-3.238-6.867-6-11.2L13.8 0z';

      waterMarkersRef.current = waterStops.map((stop) =>
        new window.google.maps.Marker({
          map: rendererMap,
          position: { lat: stop.lat, lng: stop.lng },
          title: stop.name ?? 'Water fountain',
          icon: {
            path: dropPath,
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            strokeColor: '#0369a1',
            strokeWeight: 1,
            scale: 1.2,
            anchor: new window.google.maps.Point(13, 21),
          },
        }),
      );
    }
    if (restroomStops && restroomStops.length > 0 && window.google?.maps?.Marker) {
      const restroomPath = 'M12 2c-2.4 0-4 1.82-4 4.22 0 3.18 3.51 6.79 3.66 6.95.2.2.52.2.72 0 .15-.16 3.62-3.79 3.62-6.95C16 3.82 14.4 2 12 2Zm0 5.5c-.83 0-1.5-.67-1.5-1.5S11.17 4.5 12 4.5 13.5 5.17 13.5 6 12.83 7.5 12 7.5ZM9 14c-1.66 0-3 1.34-3 3v4h2v-4c0-.55.45-1 1-1s1 .45 1 1v4h8v-4c0-1.66-1.34-3-3-3h-6Z';

      restroomMarkersRef.current = restroomStops.map((stop) =>
        new window.google.maps.Marker({
          map: rendererMap,
          position: { lat: stop.lat, lng: stop.lng },
          title: stop.name ?? 'Restroom',
          icon: {
            path: restroomPath,
            fillColor: '#ec4899',
            fillOpacity: 1,
            strokeColor: '#be185d',
            strokeWeight: 1,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 20),
          },
        }),
      );
    }

    return () => {
      waterMarkersRef.current.forEach((marker) => {
        marker.setMap(null);
      });
      waterMarkersRef.current = [];
      restroomMarkersRef.current.forEach((marker) => {
        marker.setMap(null);
      });
      restroomMarkersRef.current = [];
    };
  }, [map, waterStops]);

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
