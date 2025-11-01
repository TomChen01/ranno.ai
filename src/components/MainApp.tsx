// src/components/MainApp.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapView, type RouteEndpoint, type RouteRequest, type TravelMode } from './MapView';
import { RoutePlannerForm } from './RoutePlannerForm';
import { fetchCrimePoints } from '../services/crimeService';
import type { CrimePoint } from '../services/crimeService';
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';
import { summarizeRouteRisk, type RouteLike } from '../services/riskService';
import type { ConversationMessage, FollowUpQuestion, QuestionOption } from '../types/conversation';
import promptLogo from '../assets/r-logo.svg';

const DEFAULT_PROMPT = '';
const DEFAULT_ORIGIN = 'Ferry Building, San Francisco, CA';
const DEFAULT_DESTINATION = 'Crissy Field, San Francisco, CA';
const DEFAULT_MAP_CENTER = { lat: 37.7749, lng: -122.4194 };
const RUNNING_PACE_MIN_PER_KM = 6;
const MAX_FOLLOW_UP = 3;

type DirectionsResultLike = {
  routes: RouteLike[];
};

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

  const [userPrompt, setUserPrompt] = useState<string>(DEFAULT_PROMPT);
  const [intent, setIntent] = useState<RunGeniusIntent | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [routeRequest, setRouteRequest] = useState<RouteRequest | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  const finalizeRoute = useCallback(() => {
    if (!intent) {
      return;
    }

    const travelMode: TravelMode = intent.preferences?.route_type === 'point_to_point' ? 'DRIVING' : 'WALKING';

    let destinationEndpoint: RouteEndpoint = routeEndpoints.destination;

    if (
      (!intent.location?.destination?.text || intent.location?.destination?.text === intent.location?.origin?.text) &&
      intent.constraints?.distance_km &&
      routeEndpoints.origin.location &&
      !routeEndpoints.destination.placeId
    ) {
      const geometry = window.google?.maps?.geometry;
      if (geometry) {
        const meters = Math.max(intent.constraints.distance_km * 1000 * 0.6, 800);
        const originLatLng = new window.google.maps.LatLng(
          routeEndpoints.origin.location.lat,
          routeEndpoints.origin.location.lng,
        );
        const offset = geometry.spherical.computeOffset(originLatLng, meters, 60);
        destinationEndpoint = {
          description: `Route near ${routeEndpoints.origin.description}`,
          location: { lat: offset.lat(), lng: offset.lng() },
        };
      }
    }

    setIsPlanning(true);
    setRouteError(null);
    setRouteRequest({
      origin: routeEndpoints.origin,
      destination: destinationEndpoint,
      travelMode,
      provideAlternatives: true,
    });
  }, [intent, routeEndpoints]);

  const processNextQuestion = useCallback(() => {
    if (questionsAskedRef.current >= MAX_FOLLOW_UP) {
      clearQuestions();
      finalizeRoute();
      return;
    }

    const nextQuestion = questionsQueueRef.current.shift() ?? null;
    setActiveQuestion(nextQuestion);

    if (!nextQuestion) {
      finalizeRoute();
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
        finalizeRoute();
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

      setRouteSummary(null);
      clearQuestions();

      appendMessage({ role: 'assistant', content: summarizeIntentForConversation(parsedIntent) });
      setIntent(parsedIntent);

      const nextEndpoints: { origin: RouteEndpoint; destination: RouteEndpoint } = {
        origin: { description: DEFAULT_ORIGIN },
        destination: { description: DEFAULT_DESTINATION },
      };

      if (parsedIntent.location?.origin?.text) {
        nextEndpoints.origin.description = parsedIntent.location.origin.text;
      } else if (parsedIntent.location?.context) {
        nextEndpoints.origin.description = parsedIntent.location.context;
      }

      if (parsedIntent.location?.destination?.text) {
        nextEndpoints.destination.description = parsedIntent.location.destination.text;
      } else if (parsedIntent.location?.context) {
        nextEndpoints.destination.description = parsedIntent.location.context;
      }

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

      setRouteEndpoints(nextEndpoints);

      const prefQuestions = buildPreferenceQuestions(parsedIntent);
      prefQuestions.forEach((question) => {
        appendMessage({ role: 'assistant', content: question.prompt });
        enqueueQuestion(question);
      });

      if (questionsQueueRef.current.length === 0) {
        finalizeRoute();
      } else {
        processNextQuestion();
      }
    },
    [appendMessage, buildPreferenceQuestions, clearQuestions, enqueueQuestion, finalizeRoute, findPlaceCandidates, processNextQuestion, summarizeIntentForConversation],
  );

  const computeRunningDuration = useCallback((distanceMeters: number) => {
    const distanceKm = distanceMeters / 1000;
    const totalMinutes = distanceKm * RUNNING_PACE_MIN_PER_KM;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours > 0) {
      return `${hours} hr ${minutes} min (estimated at ${RUNNING_PACE_MIN_PER_KM} min/km)`;
    }
    return `${minutes} min (estimated at ${RUNNING_PACE_MIN_PER_KM} min/km)`;
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

  const handleRouteReady = useCallback(
    (result: DirectionsResultLike) => {
      setIsPlanning(false);
      setRouteError(null);

      const primary = result.routes[0];
      if (!primary) {
        setRouteSummary(null);
        appendMessage({ role: 'assistant', content: 'No suitable route found yet. Please try describing your request again.' });
        return;
      }

      const leg = primary.legs?.[0];

      void (async () => {
        const risk = summarizeRouteRisk(primary, crimePoints);
        const slope = await evaluateSlope(primary);

        const distanceMeters = leg?.distance?.value ?? 0;
        const walkingDuration = leg?.duration?.text ?? 'Unknown';
        const runningDuration = distanceMeters > 0 ? computeRunningDuration(distanceMeters) : 'Unknown';
        const highlights = buildHighlights(intent, risk.level, slope);

        setRouteSummary({
          origin: leg?.start_address ?? routeEndpoints.origin.description,
          destination: leg?.end_address ?? routeEndpoints.destination.description,
          walkingDuration,
          runningDuration,
          distance: leg?.distance?.text ?? 'Unknown',
          slope: slope !== null ? `Max grade about ${slope.toFixed(1)}%` : 'Slope information currently unavailable',
          safety: `${risk.level.toUpperCase()} - ${risk.message}`,
          highlights,
        });

        appendMessage({
          role: 'assistant',
          content: `Route ready: ${leg?.start_address ?? routeEndpoints.origin.description} -> ${leg?.end_address ?? routeEndpoints.destination.description}. Walking about ${walkingDuration}, running about ${runningDuration}.`,
        });
      })();
    },
    [appendMessage, buildHighlights, computeRunningDuration, crimePoints, evaluateSlope, intent, routeEndpoints],
  );

  const handleRouteError = useCallback((status: string) => {
    setIsPlanning(false);
    const message = `Route planning failed: ${status}`;
    setRouteError(message);
    appendMessage({ role: 'assistant', content: message });
  }, [appendMessage]);

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
            routeRequest={routeRequest}
            onRouteReady={handleRouteReady}
            onRouteError={handleRouteError}
            onPlacesServiceReady={setPlacesService}
          />

          {(isLoadingCrime || isPlanning) && (
            <div className="overlay">
              <span>{isPlanning ? 'Calculating route...' : 'Loading crime data...'}</span>
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
                </div>
              )}

              {crimeError && <p className="feedback feedback-error">{crimeError}</p>}

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

