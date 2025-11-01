// src/components/MainApp.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapView, type RouteEndpoint } from './MapView';
import { RoutePlannerForm } from './RoutePlannerForm';
import { fetchCrimePoints } from '../services/crimeService';
import type { CrimePoint } from '../services/crimeService';
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';
import { summarizeRouteRisk, type RouteLike } from '../services/riskService';
import {
  generateRoute,
  type GeneratedRoute,
  type GenerateRouteOptions,
  type LatLng,
} from '../services/routeService';
import { fetchWaterPoints, fetchRestroomPoints, type PublicAmenityPoint } from '../services/waterService';
import type { ConversationMessage, FollowUpQuestion, QuestionOption } from '../types/conversation';
import promptLogo from '../assets/r-logo.svg';

const DEFAULT_PROMPT = '';
const DEFAULT_ORIGIN = 'Ferry Building, San Francisco, CA';
const DEFAULT_DESTINATION = 'Crissy Field, San Francisco, CA';
const DEFAULT_MAP_CENTER = { lat: 37.7749, lng: -122.4194 };
const RUNNING_PACE_MIN_PER_KM = 6;
const WALKING_PACE_MIN_PER_KM = 10;
const MAX_FOLLOW_UP = Number.POSITIVE_INFINITY;

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return 'Unknown';
  }

  const kilometers = meters / 1000;
  const miles = meters / 1609.344;
  const kmPrecision = kilometers >= 10 ? 0 : 1;
  const miPrecision = miles >= 10 ? 0 : 1;

  return `${kilometers.toFixed(kmPrecision)} km (${miles.toFixed(miPrecision)} mi)`;
}

function formatDurationFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Unknown';
  }

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${Math.max(totalMinutes, 1)} mins`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} mins` : `${hours} hr`;
}

function computePacedSeconds(distanceMeters: number, paceMinPerKm: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }
  return (distanceMeters / 1000) * paceMinPerKm * 60;
}

interface MainAppProps {
  crimePoints?: CrimePoint[];
}

type RouteSummary = {
  origin: string;
  destination: string;
  walkingDuration: string;
  runningDuration: string;
  distance: string;
  slope: string;
  safety: string;
  highlights: string[];
  waterStops?: string[];
  restroomStops?: string[];
};

type PlaceCandidate = {
  placeId?: string;
  description: string;
  location?: { lat: number; lng: number };
};

export function MainApp({ crimePoints: crimePointsProp }: MainAppProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [crimePoints, setCrimePoints] = useState<CrimePoint[]>(crimePointsProp ?? []);
  const [crimeError, setCrimeError] = useState<string | null>(null);
  const [isLoadingCrime, setIsLoadingCrime] = useState<boolean>(false);
  const [waterPoints, setWaterPoints] = useState<PublicAmenityPoint[]>([]);
  const [restroomPoints, setRestroomPoints] = useState<PublicAmenityPoint[]>([]);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [restroomError, setRestroomError] = useState<string | null>(null);
  const [isLoadingWater, setIsLoadingWater] = useState<boolean>(false);
  const [isLoadingRestrooms, setIsLoadingRestrooms] = useState<boolean>(false);

  const [userPrompt, setUserPrompt] = useState<string>(DEFAULT_PROMPT);
  const [intent, setIntent] = useState<RunGeniusIntent | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null);

  const [conversationLog, setConversationLog] = useState<ConversationMessage[]>([
    { role: 'assistant', content: 'Where should we start? Share your running goal, location, or distance.' },
  ]);
  const [activeQuestion, setActiveQuestion] = useState<FollowUpQuestion | null>(null);
  const questionsQueueRef = useRef<FollowUpQuestion[]>([]);
  const questionsAskedRef = useRef(0);

  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const [isOverlayMinimized, setOverlayMinimized] = useState<boolean>(false);

  const [routeEndpoints, setRouteEndpoints] = useState<{
    origin: RouteEndpoint;
    destination: RouteEndpoint;
  }>({
    origin: { description: DEFAULT_ORIGIN },
    destination: { description: DEFAULT_DESTINATION },
  });

  useEffect(() => {
    if (crimePointsProp && crimePointsProp.length > 0) {
      setCrimePoints(crimePointsProp);
      setIsLoadingCrime(false);
      setCrimeError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingCrime(true);
    fetchCrimePoints({ limit: 1000 })
      .then((points) => {
        if (!cancelled) {
          setCrimePoints(points);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setCrimeError(`Failed to load crime data: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCrime(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [crimePointsProp]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingWater(true);
    fetchWaterPoints({ limit: 500 })
      .then((points) => {
        if (!cancelled) {
          setWaterPoints(points);
          setWaterError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setWaterError(`Failed to load water fountains: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingWater(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingRestrooms(true);
    fetchRestroomPoints({ limit: 500 })
      .then((points) => {
        if (!cancelled) {
          setRestroomPoints(points);
          setRestroomError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setRestroomError(`Failed to load restrooms: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRestrooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const appendMessage = useCallback((message: ConversationMessage) => {
    setConversationLog((prev) => [...prev, message]);
  }, []);

  const parsePrompt = useCallback(async (prompt: string) => {
    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parseUserIntent(prompt);
      setIntent(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI parsing failed';
      setParseError(message);
      appendMessage({ role: 'assistant', content: `Parsing failed: ${message}` });
      return null;
    } finally {
      setIsParsing(false);
    }
  }, [appendMessage]);

  const findPlaceCandidates = useCallback(
    async (query: string): Promise<PlaceCandidate[]> => {
      const maps = window.google?.maps;
      if (!placesService || !query || !maps) {
        return [];
      }

      return await new Promise<PlaceCandidate[]>((resolve) => {
        const request = {
          query,
          location: new maps.LatLng(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng),
          radius: 20000,
        };

        placesService.textSearch(request, (results, status) => {
          if (status === maps.places.PlacesServiceStatus.OK && results) {
            const candidates = results.slice(0, 5).map((result) => ({
              placeId: result.place_id ?? undefined,
              description: result.formatted_address ?? result.name ?? query,
              location: result.geometry?.location
                ? { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() }
                : undefined,
            }));
            resolve(candidates);
          } else {
            resolve([]);
          }
        });
      });
    },
    [placesService],
  );

  const clearQuestions = useCallback(() => {
    questionsQueueRef.current = [];
    setActiveQuestion(null);
    questionsAskedRef.current = 0;
  }, []);

  const evaluateSlope = useCallback(async (route: RouteLike) => {
    const rawPath = route.overview_path ?? [];
    const maps = window.google?.maps;
    if (!rawPath.length || !maps?.ElevationService) {
      return null;
    }

    const path = rawPath.map((point) =>
      point instanceof maps.LatLng
        ? point
        : new maps.LatLng(point.lat(), point.lng()),
    );

    const elevationService = new maps.ElevationService();
    const samples = Math.min(200, Math.max(path.length, 50));

    return await new Promise<number | null>((resolve) => {
      elevationService.getElevationAlongPath(
        {
          path,
          samples,
        },
        (results, status) => {
          if (status !== window.google.maps.ElevationStatus.OK || !results || results.length < 2) {
            resolve(null);
            return;
          }

          let maxGrade = 0;
          for (let i = 1; i < results.length; i += 1) {
            const prevPoint = results[i - 1];
            const currentPoint = results[i];
            if (!prevPoint.location || !currentPoint.location) {
              continue;
            }
            const distance = maps.geometry?.spherical.computeDistanceBetween
              ? maps.geometry.spherical.computeDistanceBetween(prevPoint.location, currentPoint.location)
              : NaN;
            const elevationDiff = currentPoint.elevation - prevPoint.elevation;
            if (distance && distance > 0) {
              const grade = Math.abs((elevationDiff / distance) * 100);
              maxGrade = Math.max(maxGrade, grade);
            }
          }
          resolve(maxGrade);
        },
      );
    });
  }, []);

  const buildHighlights = useCallback(
    (currentIntent: RunGeniusIntent | null, riskLevel: string, maxSlope: number | null) => {
      const highlights: string[] = [];

      if (currentIntent?.preferences?.safety?.includes('prefer_well_lit_streets')) {
        highlights.push('Prioritizes well-lit segments.');
      }
      if (currentIntent?.preferences?.safety?.includes('avoid_high_crime_areas')) {
        highlights.push('Avoids recently high-risk areas.');
      }
      if (currentIntent?.preferences?.route_type === 'loop') {
        highlights.push('Loop route that returns to the start.');
      }
      if (currentIntent?.preferences?.environment?.includes('prefer_low_traffic')) {
        highlights.push('Sticks to lower-traffic streets when possible.');
      }
      if (riskLevel === 'low') {
        highlights.push('Area has had fewer recent incidents - lower risk.');
      }
      if (maxSlope !== null) {
        if (maxSlope < 4) {
          highlights.push('Gentle grade, good for an easy run.');
        } else if (maxSlope < 8) {
          highlights.push('Includes some hills for a little challenge.');
        } else {
          highlights.push('Steeper sections - pace yourself.');
        }
      }

      return highlights;
    },
    [],
  );

  const finalizeRoute = useCallback(
    async (
      activeIntent?: RunGeniusIntent,
      endpointsOverride?: { origin: RouteEndpoint; destination: RouteEndpoint },
    ) => {
      const intentToUse = activeIntent ?? intent;
      if (!intentToUse) {
        return;
      }

      const currentEndpoints = endpointsOverride ?? routeEndpoints;
      const travelMode: GenerateRouteOptions['travelMode'] =
        intentToUse.preferences?.route_type === 'point_to_point' ? 'DRIVING' : 'WALKING';
      const needsWaterAmenity = intentToUse.preferences?.amenities?.includes('has_water_fountains');
      const needsRestroomAmenity = intentToUse.preferences?.amenities?.includes('has_restrooms');

      let adjustedEndpoints = currentEndpoints;

      if (
        (!intentToUse.location?.destination?.text ||
          intentToUse.location?.destination?.text === intentToUse.location?.origin?.text) &&
        intentToUse.constraints?.distance_km &&
        currentEndpoints.origin.location &&
        !currentEndpoints.destination.placeId
      ) {
        const geometry = window.google?.maps?.geometry;
        if (geometry) {
          const meters = Math.max(intentToUse.constraints.distance_km * 1000 * 0.6, 800);
          const originLatLng = new window.google.maps.LatLng(
            currentEndpoints.origin.location.lat,
            currentEndpoints.origin.location.lng,
          );
          const offset = geometry.spherical.computeOffset(originLatLng, meters, 60);
          adjustedEndpoints = {
            origin: currentEndpoints.origin,
            destination: {
              description: `Route near ${currentEndpoints.origin.description}`,
              location: { lat: offset.lat(), lng: offset.lng() },
            },
          };
        }
      }

      setRouteEndpoints(adjustedEndpoints);
      setIsPlanning(true);
      setRouteError(null);
      setGeneratedRoute(null);

      const options: GenerateRouteOptions = {
        travelMode,
      };

      if (adjustedEndpoints.origin.location) {
        options.originLatLng = {
          lat: adjustedEndpoints.origin.location.lat,
          lng: adjustedEndpoints.origin.location.lng,
        } satisfies LatLng;
      }

      try {
        const route = await generateRoute(intentToUse, crimePoints, waterPoints, restroomPoints, options);
        setGeneratedRoute(route);

        const primaryRoute = route.directionsResult?.routes?.[0];
        if (!primaryRoute) {
          setRouteSummary(null);
          setRouteError('Route generation did not return any paths.');
          return;
        }

        const legs = primaryRoute.legs ?? [];
        const firstLeg = legs[0];
        const totalDistanceMeters =
          route.distance_m ?? legs.reduce((acc: number, current: google.maps.DirectionsLeg) => acc + (current.distance?.value ?? 0), 0);
        const totalDurationSeconds =
          route.duration_s ?? legs.reduce((acc: number, current: google.maps.DirectionsLeg) => acc + (current.duration?.value ?? 0), 0);
        const riskSummary = route.riskSummary ?? summarizeRouteRisk(primaryRoute, crimePoints);

        const slope = await evaluateSlope(primaryRoute);
        const distanceText = totalDistanceMeters > 0 ? formatDistance(totalDistanceMeters) : firstLeg?.distance?.text ?? 'Unknown';

        const walkingSecondsFromPace = computePacedSeconds(totalDistanceMeters, WALKING_PACE_MIN_PER_KM);
        const runningSecondsFromPace = computePacedSeconds(totalDistanceMeters, RUNNING_PACE_MIN_PER_KM);

        const walkingDuration = walkingSecondsFromPace
          ? formatDurationFromSeconds(walkingSecondsFromPace)
          : totalDurationSeconds > 0
          ? formatDurationFromSeconds(totalDurationSeconds)
          : firstLeg?.duration?.text ?? 'Unknown';

        const runningDuration = runningSecondsFromPace
          ? `${formatDurationFromSeconds(runningSecondsFromPace)} (estimated at ${RUNNING_PACE_MIN_PER_KM} min/km)`
          : totalDistanceMeters > 0
          ? `${formatDurationFromSeconds((totalDurationSeconds || 0) * 0.6)} (estimated)`
          : 'Unknown';

        const waterStops = route.waterStops ?? [];
        const restroomStops = route.restroomStops ?? [];
        const highlights = buildHighlights(intentToUse, riskSummary.level, slope);
        if (waterStops.length > 0) {
          const closestWater = waterStops[0];
          highlights.push(
            `Water fountain nearby: ${closestWater.name ?? 'Water fountain'} (${formatDistance(closestWater.distanceMeters)} away)`,
          );
        } else if (needsWaterAmenity) {
          highlights.push('No water fountains detected along this route. Consider carrying water.');
        }

        if (restroomStops.length > 0) {
          const closestRestroom = restroomStops[0];
          highlights.push(
            `Restroom nearby: ${closestRestroom.name ?? 'Restroom'} (${formatDistance(closestRestroom.distanceMeters)} away)`,
          );
        } else if (needsRestroomAmenity) {
          highlights.push('No restrooms detected along this route. Plan a pit stop before your run.');
        }

        const waterStopSummaries = waterStops.map((stop) =>
          `${stop.name ?? 'Water fountain'} (${formatDistance(stop.distanceMeters)})`,
        );
        const restroomStopSummaries = restroomStops.map((stop) =>
          `${stop.name ?? 'Restroom'} (${formatDistance(stop.distanceMeters)})`,
        );

        setRouteSummary({
          origin: firstLeg?.start_address ?? adjustedEndpoints.origin.description,
          destination: firstLeg?.end_address ?? adjustedEndpoints.destination.description,
          walkingDuration,
          runningDuration,
          distance: distanceText,
          slope: slope !== null ? `Max grade about ${slope.toFixed(1)}%` : 'Slope information currently unavailable',
          safety: `${riskSummary.level.toUpperCase()} - ${riskSummary.message}`,
          highlights,
          waterStops: waterStopSummaries,
          restroomStops: restroomStopSummaries,
        });

        appendMessage({
          role: 'assistant',
          content: `Route ready: ${firstLeg?.start_address ?? adjustedEndpoints.origin.description} -> ${firstLeg?.end_address ?? adjustedEndpoints.destination.description}. Walking about ${walkingDuration}, running about ${runningDuration}.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRouteError(`Route planning failed: ${message}`);
        appendMessage({ role: 'assistant', content: `Route planning failed: ${message}` });
      } finally {
        setIsPlanning(false);
      }
    },
    [appendMessage, buildHighlights, crimePoints, evaluateSlope, intent, restroomPoints, routeEndpoints, waterPoints],
  );

  const processNextQuestion = useCallback(() => {
    if (questionsAskedRef.current >= MAX_FOLLOW_UP) {
      clearQuestions();
      void finalizeRoute();
      return;
    }

    const nextQuestion = questionsQueueRef.current.shift() ?? null;
    setActiveQuestion(nextQuestion);

    if (!nextQuestion) {
      void finalizeRoute();
    }
  }, [clearQuestions, finalizeRoute]);

  const enqueueQuestion = useCallback(
    (question: FollowUpQuestion) => {
      questionsQueueRef.current.push(question);
    },
    [],
  );

  const handleQuestionAnswered = useCallback(
    (option: QuestionOption | null) => {
      const question = activeQuestion;
      if (!question) {
        return;
      }

      questionsAskedRef.current += 1;

      if (option) {
        appendMessage({ role: 'user', content: option.label });
      } else {
        appendMessage({ role: 'user', content: 'User chose to skip.' });
      }

      question.onSelect(option ?? null);

      if (questionsAskedRef.current >= MAX_FOLLOW_UP) {
        clearQuestions();
        void finalizeRoute();
      } else {
        processNextQuestion();
      }
    },
    [activeQuestion, appendMessage, clearQuestions, finalizeRoute, processNextQuestion],
  );

  const buildPreferenceQuestions = useCallback(
    (currentIntent: RunGeniusIntent) => {
      const questions: FollowUpQuestion[] = [];

      if (!currentIntent.preferences?.route_type) {
        questions.push({
          id: 'route_type',
          prompt: 'What type of route do you prefer?',
          allowSkip: true,
          options: [
            { id: 'loop', label: 'Loop', value: 'loop' },
            { id: 'point_to_point', label: 'Point to point', value: 'point_to_point' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        route_type: option.value as 'loop' | 'point_to_point',
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.environment) {
        questions.push({
          id: 'environment',
          prompt: 'What environment do you prefer?',
          allowSkip: true,
          options: [
            { id: 'prefer_shaded_paths', label: 'Shaded paths', value: 'prefer_shaded_paths' },
            { id: 'prefer_low_traffic', label: 'Quieter streets', value: 'prefer_low_traffic' },
            { id: 'avoid_heavy_traffic', label: 'Avoid heavy traffic', value: 'avoid_heavy_traffic' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        environment: [
                          option.value as 'prefer_shaded_paths' | 'avoid_heavy_traffic' | 'prefer_low_traffic',
                        ],
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.safety) {
        questions.push({
          id: 'safety',
          prompt: 'Any additional safety preferences?',
          allowSkip: true,
          options: [
            { id: 'avoid_high_crime_areas', label: 'Avoid higher-risk areas', value: 'avoid_high_crime_areas' },
            { id: 'prefer_well_lit_streets', label: 'Prefer well-lit streets', value: 'prefer_well_lit_streets' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        safety: [option.value as 'avoid_high_crime_areas' | 'prefer_well_lit_streets'],
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.incline) {
        questions.push({
          id: 'incline',
          prompt: 'How much incline are you looking for?',
          allowSkip: true,
          options: [
            { id: 'incline_low', label: 'Keep it flat', value: 'low' },
            { id: 'incline_medium', label: 'Moderate hills', value: 'medium' },
            { id: 'incline_high', label: 'Challenging climbs', value: 'high' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        incline: option.value as 'low' | 'medium' | 'high',
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.surface) {
        questions.push({
          id: 'surface',
          prompt: 'Preferred surface?',
          allowSkip: true,
          options: [
            { id: 'surface_paved', label: 'Paved', value: 'paved' },
            { id: 'surface_trail', label: 'Trail', value: 'trail' },
            { id: 'surface_track', label: 'Track', value: 'track' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        surface: [option.value as 'paved' | 'trail' | 'track'],
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.scenery) {
        questions.push({
          id: 'scenery',
          prompt: 'Any scenery you want to prioritize?',
          allowSkip: true,
          options: [
            { id: 'scenery_water', label: 'Water views', value: 'water_view' },
            { id: 'scenery_bridge', label: 'Bridge views', value: 'bridge_view' },
            { id: 'scenery_park', label: 'Green parks', value: 'park_view' },
            { id: 'scenery_city', label: 'City skyline', value: 'cityscape' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        scenery: [
                          option.value as 'water_view' | 'bridge_view' | 'park_view' | 'cityscape',
                        ],
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.vibe) {
        questions.push({
          id: 'vibe',
          prompt: 'Do you prefer a specific vibe?',
          allowSkip: true,
          options: [
            { id: 'vibe_quiet', label: 'Quiet and calm', value: 'quiet' },
            { id: 'vibe_lively', label: 'Energetic and lively', value: 'lively' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        vibe: option.value as 'quiet' | 'lively',
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      if (!currentIntent.preferences?.amenities) {
        questions.push({
          id: 'amenities',
          prompt: 'Need any specific amenities along the route?',
          allowSkip: true,
          options: [
            { id: 'amenities_restrooms', label: 'Restrooms', value: 'has_restrooms' },
            { id: 'amenities_water', label: 'Water fountains', value: 'has_water_fountains' },
          ],
          onSelect: (option) => {
            if (option) {
              setIntent((prev) =>
                prev
                  ? {
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        amenities: [
                          option.value as 'has_restrooms' | 'has_water_fountains',
                        ],
                      },
                    }
                  : prev,
              );
            }
          },
        });
      }

      return questions;
    },
    [],
  );

  const summarizeIntentForConversation = useCallback((parsedIntent: RunGeniusIntent) => {
    const parts: string[] = [];
    if (parsedIntent.location?.origin?.text) {
      parts.push(`Origin: ${parsedIntent.location.origin.text}`);
    }
    if (parsedIntent.location?.destination?.text) {
      parts.push(`Destination: ${parsedIntent.location.destination.text}`);
    }
    if (parsedIntent.constraints?.distance_km) {
      parts.push(`Target distance: ${parsedIntent.constraints.distance_km} km`);
    }
    if (parsedIntent.preferences?.safety && parsedIntent.preferences.safety.length > 0) {
      parts.push(`Safety preferences: ${parsedIntent.preferences.safety.join(', ')}`);
    }

    if (parts.length === 0) {
      return 'Alright, let me interpret your running request.';
    }
    return `Understood. Here is what I captured: ${parts.join('; ')}.`;
  }, []);

  const startRouteFlow = useCallback(
    async (parsedIntent: RunGeniusIntent | null) => {
      if (!parsedIntent) {
        return;
      }

      const normalizedIntent: RunGeniusIntent = {
        ...parsedIntent,
        location: parsedIntent.location ? { ...parsedIntent.location } : undefined,
        preferences: parsedIntent.preferences ? { ...parsedIntent.preferences } : undefined,
      };

      const hasDestinationInput = Boolean(normalizedIntent.location?.destination?.text);
      const hasOriginInput = Boolean(normalizedIntent.location?.origin?.text || normalizedIntent.location?.context);
      const isSingleLocationIntent = hasOriginInput && !hasDestinationInput;

      if (isSingleLocationIntent) {
        if (!normalizedIntent.preferences) {
          normalizedIntent.preferences = {};
        }
        if (!normalizedIntent.preferences.route_type) {
          normalizedIntent.preferences.route_type = 'loop';
        }
        if (normalizedIntent.location) {
          normalizedIntent.location.destination = undefined;
        }
      }

      setRouteSummary(null);
      clearQuestions();

      appendMessage({ role: 'assistant', content: summarizeIntentForConversation(normalizedIntent) });
      setIntent(normalizedIntent);

      const originDescription =
        normalizedIntent.location?.origin?.text ?? normalizedIntent.location?.context ?? DEFAULT_ORIGIN;

      let destinationDescription =
        normalizedIntent.location?.destination?.text ?? normalizedIntent.location?.context ?? DEFAULT_DESTINATION;

      if (isSingleLocationIntent) {
        destinationDescription = originDescription;
      }

      const nextEndpoints: { origin: RouteEndpoint; destination: RouteEndpoint } = {
        origin: { description: originDescription },
        destination: { description: destinationDescription },
      };

      const originCandidates = await findPlaceCandidates(nextEndpoints.origin.description);
      if (originCandidates.length > 1) {
        appendMessage({
          role: 'assistant',
          content: `I found several places related to "${nextEndpoints.origin.description}". Please choose a starting point:`,
        });
        enqueueQuestion({
          id: 'choose_origin',
          prompt: `Please pick the origin "${nextEndpoints.origin.description}"`,
          allowSkip: false,
          options: originCandidates.map((candidate, index) => ({
            id: `origin_${index}`,
            label: candidate.description,
            value: candidate.description,
            data: candidate,
          })),
          onSelect: (option) => {
            if (option?.data) {
              const candidate = option.data as PlaceCandidate;
              setRouteEndpoints((prev) => ({
                origin: {
                  description: candidate.description,
                  placeId: candidate.placeId,
                  location: candidate.location,
                },
                destination: prev.destination,
              }));
            }
          },
        });
      } else if (originCandidates.length === 1) {
        const candidate = originCandidates[0];
        nextEndpoints.origin = {
          description: candidate.description,
          placeId: candidate.placeId,
          location: candidate.location,
        };
      }

      if (!isSingleLocationIntent) {
        const destinationCandidates = await findPlaceCandidates(nextEndpoints.destination.description);
        if (destinationCandidates.length > 1) {
          appendMessage({
            role: 'assistant',
            content: `I found several places related to "${nextEndpoints.destination.description}". Please choose a destination:`,
          });
          enqueueQuestion({
            id: 'choose_destination',
            prompt: `Please pick the destination "${nextEndpoints.destination.description}"`,
            allowSkip: false,
            options: destinationCandidates.map((candidate, index) => ({
              id: `destination_${index}`,
              label: candidate.description,
              value: candidate.description,
              data: candidate,
            })),
            onSelect: (option) => {
              if (option?.data) {
                const candidate = option.data as PlaceCandidate;
                setRouteEndpoints((prev) => ({
                  origin: prev.origin,
                  destination: {
                    description: candidate.description,
                    placeId: candidate.placeId,
                    location: candidate.location,
                  },
                }));
              }
            },
          });
        } else if (destinationCandidates.length === 1) {
          const candidate = destinationCandidates[0];
          nextEndpoints.destination = {
            description: candidate.description,
            placeId: candidate.placeId,
            location: candidate.location,
          };
        }
      }

      setRouteEndpoints(nextEndpoints);

      const prefQuestions = buildPreferenceQuestions(normalizedIntent);
      prefQuestions.forEach((question) => {
        appendMessage({ role: 'assistant', content: question.prompt });
        enqueueQuestion(question);
      });

      if (questionsQueueRef.current.length === 0) {
        void finalizeRoute(normalizedIntent, nextEndpoints);
      } else {
        processNextQuestion();
      }
    },
    [appendMessage, buildPreferenceQuestions, clearQuestions, enqueueQuestion, finalizeRoute, findPlaceCandidates, processNextQuestion, summarizeIntentForConversation],
  );

  const libraries = useMemo<string[]>(() => ['routes', 'visualization', 'geometry', 'places'], []);

  if (!apiKey) {
    return (
      <div className="missing-key">
        <h1>Missing Google Maps API Key</h1>
        <p>Create a .env.local in the project root and set VITE_GOOGLE_MAPS_API_KEY.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={libraries} language="en" region="US">
      <div className="app-shell">
        <div className="header-bar">
          <div className="header-brand">
            <img src={promptLogo} alt="Ranno.ai logo" />
            <h1>Ranno.ai</h1>
          </div>
          <div className="header-actions">
            <a href="#" className="header-link">
              About
            </a>
            <a href="#" className="header-link">
              Privacy
            </a>
            <a href="#" className="header-link">
              Terms
            </a>
          </div>
        </div>
        <div className="map-container">
          <MapView
            crimePoints={crimePoints}
            directionsResult={generatedRoute?.directionsResult ?? null}
            waterStops={generatedRoute?.waterStops ?? []}
            restroomStops={generatedRoute?.restroomStops ?? []}
            onPlacesServiceReady={setPlacesService}
          />

          {(isLoadingCrime || isLoadingWater || isLoadingRestrooms || isPlanning) && (
            <div className="overlay">
              <span>
                {isPlanning
                  ? 'Calculating route...'
                  : isLoadingCrime
                  ? 'Loading crime data...'
                  : isLoadingWater
                  ? 'Loading water fountains...'
                  : 'Loading restrooms...'}
              </span>
            </div>
          )}

          {routeError && <div className="toast toast-error">{routeError}</div>}

          {!isOverlayMinimized ? (
            <div className="prompt-overlay">
              <div className="app-brand">
                <img src={promptLogo} alt="Ranno.ai logo" />
                <h1>Ranno.ai</h1>
              </div>
              <button
                type="button"
                className="overlay-toggle"
                onClick={() => setOverlayMinimized(true)}
                aria-label="Collapse input panel"
              >
                x
              </button>
              <RoutePlannerForm
                userPrompt={userPrompt}
                isParsing={isParsing}
                isPlanning={isPlanning}
                parseError={parseError}
                conversationLog={conversationLog}
                activeQuestion={activeQuestion}
                onPromptChange={setUserPrompt}
                onParsePrompt={async () => {
                  const originalPrompt = userPrompt;
                  const trimmed = originalPrompt.trim();
                  if (!trimmed) {
                    return null;
                  }
                  appendMessage({ role: 'user', content: trimmed });
                  setUserPrompt('');
                  const result = await parsePrompt(trimmed);
                  if (!result) {
                    setUserPrompt(originalPrompt);
                  }
                  return result;
                }}
                onPlanRoute={startRouteFlow}
                onAnswerQuestion={(option) => handleQuestionAnswered(option)}
                onSkipQuestion={() => handleQuestionAnswered(null)}
              />

              {routeSummary && (
                <div className="route-summary">
                  <p className="insight-line">Origin: {routeSummary.origin}</p>
                  <p className="insight-line">Destination: {routeSummary.destination}</p>
                  <p className="insight-line">Walking estimate: {routeSummary.walkingDuration}</p>
                  <p className="insight-line">Running estimate: {routeSummary.runningDuration}</p>
                  <p className="insight-line">Distance: {routeSummary.distance}</p>
                  <p className="insight-line">Slope: {routeSummary.slope}</p>
                  <p className="insight-line">Safety: {routeSummary.safety}</p>
                  {routeSummary.highlights.length > 0 && (
                    <ul className="insight-list">
                      {routeSummary.highlights.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {routeSummary.waterStops && routeSummary.waterStops.length > 0 && (
                    <div className="insight-water">
                      <p className="insight-line">Water fountains nearby:</p>
                      <ul className="insight-list">
                        {routeSummary.waterStops.map((item, index) => (
                          <li key={`water-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {routeSummary.restroomStops && routeSummary.restroomStops.length > 0 && (
                    <div className="insight-water">
                      <p className="insight-line">Restrooms nearby:</p>
                      <ul className="insight-list">
                        {routeSummary.restroomStops.map((item, index) => (
                          <li key={`restroom-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {crimeError && <p className="feedback feedback-error">{crimeError}</p>}
              {waterError && <p className="feedback feedback-error">{waterError}</p>}
              {restroomError && <p className="feedback feedback-error">{restroomError}</p>}

              <p className="privacy-note">Privacy note: your input is used only for this route request and is not stored or used for identification.</p>
            </div>
          ) : (
            <button
              type="button"
              className="prompt-fab"
              onClick={() => setOverlayMinimized(false)}
              aria-label="Expand input panel"
            >
              <img src={promptLogo} alt="Ranno" className="prompt-fab-logo" />
            </button>
          )}
        </div>
      </div>
    </APIProvider>
  );
}

