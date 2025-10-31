// src/components/MainApp.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapView, type RouteEndpoint, type RouteRequest, type TravelMode } from './MapView';
import { RoutePlannerForm } from './RoutePlannerForm';
import { fetchCrimePoints, type CrimePoint } from '../services/crimeService';
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';
import { summarizeRouteRisk, type RouteLike } from '../services/riskService';
import type { ConversationMessage, FollowUpQuestion, QuestionOption } from '../types/conversation';

const DEFAULT_PROMPT = '';
const DEFAULT_ORIGIN = 'Ferry Building, San Francisco, CA';
const DEFAULT_DESTINATION = 'Crissy Field, San Francisco, CA';
const DEFAULT_MAP_CENTER = { lat: 37.7749, lng: -122.4194 };
const RUNNING_PACE_MIN_PER_KM = 6;
const MAX_FOLLOW_UP = 3;

type DirectionsResultLike = {
  routes: RouteLike[];
};

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

export function MainApp() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [crimePoints, setCrimePoints] = useState<CrimePoint[]>([]);
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
    { role: 'assistant', content: '我们先从哪里开始呢？告诉我你的跑步目标、地点或距离。' },
  ]);
  const [activeQuestion, setActiveQuestion] = useState<FollowUpQuestion | null>(null);
  const questionsQueueRef = useRef<FollowUpQuestion[]>([]);
  const questionsAskedRef = useRef(0);

  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  const [routeEndpoints, setRouteEndpoints] = useState<{
    origin: RouteEndpoint;
    destination: RouteEndpoint;
  }>({
    origin: { description: DEFAULT_ORIGIN },
    destination: { description: DEFAULT_DESTINATION },
  });

  useEffect(() => {
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
          const message = error instanceof Error ? error.message : '未知错误';
          setCrimeError(`犯罪数据加载失败：${message}`);
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
      const message = error instanceof Error ? error.message : 'AI 解析失败';
      setParseError(message);
      appendMessage({ role: 'assistant', content: `解析失败：${message}` });
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
          description: `${routeEndpoints.origin.description} 附近路线`,
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
        appendMessage({ role: 'user', content: '用户选择跳过' });
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
          prompt: '你更希望路线是哪一种？',
          allowSkip: true,
          options: [
            { id: 'loop', label: '环线', value: 'loop' },
            { id: 'point_to_point', label: '从起点到终点', value: 'point_to_point' },
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
          prompt: '你偏好哪种环境？',
          allowSkip: true,
          options: [
            { id: 'prefer_shaded_paths', label: '阴凉路线', value: 'prefer_shaded_paths' },
            { id: 'prefer_low_traffic', label: '人少的路线', value: 'prefer_low_traffic' },
            { id: 'avoid_heavy_traffic', label: '避开车多的路', value: 'avoid_heavy_traffic' },
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
          prompt: '对安全方面有额外要求吗？',
          allowSkip: true,
          options: [
            { id: 'avoid_high_crime_areas', label: '避开高风险区域', value: 'avoid_high_crime_areas' },
            { id: 'prefer_well_lit_streets', label: '优先光线充足的路段', value: 'prefer_well_lit_streets' },
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
      parts.push(`起点：${parsedIntent.location.origin.text}`);
    }
    if (parsedIntent.location?.destination?.text) {
      parts.push(`终点：${parsedIntent.location.destination.text}`);
    }
    if (parsedIntent.constraints?.distance_km) {
      parts.push(`目标距离：${parsedIntent.constraints.distance_km} km`);
    }
    if (parsedIntent.preferences?.safety && parsedIntent.preferences.safety.length > 0) {
      parts.push(`安全偏好：${parsedIntent.preferences.safety.join('、')}`);
    }

    if (parts.length === 0) {
      return '好的，我来尝试理解你的跑步需求。';
    }
    return `收到，我理解到：${parts.join('；')}。`;
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
          content: `我找到了多个与「${nextEndpoints.origin.description}」相关的地点，请选择一个起点：`,
        });
        enqueueQuestion({
          id: 'choose_origin',
          prompt: `请选择起点「${nextEndpoints.origin.description}」`,
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
          content: `我找到了多个与「${nextEndpoints.destination.description}」相关的地点，请选择一个终点：`,
        });
        enqueueQuestion({
          id: 'choose_destination',
          prompt: `请选择终点「${nextEndpoints.destination.description}」`,
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
      return `${hours}小时${minutes}分钟（按每公里${RUNNING_PACE_MIN_PER_KM}分钟估算）`;
    }
    return `${minutes}分钟（按每公里${RUNNING_PACE_MIN_PER_KM}分钟估算）`;
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
        highlights.push('路线规划优先选择光照更好的路段');
      }
      if (currentIntent?.preferences?.safety?.includes('avoid_high_crime_areas')) {
        highlights.push('路线避开近期高风险区域');
      }
      if (currentIntent?.preferences?.route_type === 'loop') {
        highlights.push('返回起点的环线路线');
      }
      if (currentIntent?.preferences?.environment?.includes('prefer_low_traffic')) {
        highlights.push('尽量选择人流较少的道路');
      }
      if (riskLevel === 'low') {
        highlights.push('整体区域近期事件较少，风险较低');
      }
      if (maxSlope !== null) {
        if (maxSlope < 4) {
          highlights.push('坡度平缓，适合放松跑');
        } else if (maxSlope < 8) {
          highlights.push('包含一些坡度，体验更具挑战');
        } else {
          highlights.push('坡度较大，注意体力分配');
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
        appendMessage({ role: 'assistant', content: '暂时没有找到合适的路线，请尝试重新描述需求。' });
        return;
      }

      const leg = primary.legs?.[0];

      void (async () => {
        const risk = summarizeRouteRisk(primary, crimePoints);
        const slope = await evaluateSlope(primary);

        const distanceMeters = leg?.distance?.value ?? 0;
        const walkingDuration = leg?.duration?.text ?? '未知';
        const runningDuration = distanceMeters > 0 ? computeRunningDuration(distanceMeters) : '未知';
        const highlights = buildHighlights(intent, risk.level, slope);

        setRouteSummary({
          origin: leg?.start_address ?? routeEndpoints.origin.description,
          destination: leg?.end_address ?? routeEndpoints.destination.description,
          walkingDuration,
          runningDuration,
          distance: leg?.distance?.text ?? '未知',
          slope: slope !== null ? `最大坡度约 ${slope.toFixed(1)}%` : '坡度信息暂不可用',
          safety: `${risk.level.toUpperCase()} - ${risk.message}`,
          highlights,
        });

        appendMessage({
          role: 'assistant',
          content: `已生成路线：从「${leg?.start_address ?? routeEndpoints.origin.description}」到「${leg?.end_address ?? routeEndpoints.destination.description}」，步行约 ${walkingDuration}，跑步约 ${runningDuration}。`,
        });
      })();
    },
    [appendMessage, buildHighlights, computeRunningDuration, crimePoints, evaluateSlope, intent, routeEndpoints],
  );

  const handleRouteError = useCallback((status: string) => {
    setIsPlanning(false);
    const message = `路线规划失败：${status}`;
    setRouteError(message);
    appendMessage({ role: 'assistant', content: message });
  }, [appendMessage]);

  const libraries = useMemo<string[]>(() => ['routes', 'visualization', 'geometry', 'places'], []);

  if (!apiKey) {
    return (
      <div className="missing-key">
        <h1>缺少 Google Maps API Key</h1>
        <p>请在根目录创建 .env.local，并设置 VITE_GOOGLE_MAPS_API_KEY。</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={libraries}>
      <div className="app-shell">
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
              <span>{isPlanning ? '正在计算路线…' : '正在加载犯罪数据…'}</span>
            </div>
          )}

          {routeError && <div className="toast toast-error">{routeError}</div>}

          <div className="prompt-overlay">
            <RoutePlannerForm
              userPrompt={userPrompt}
              isParsing={isParsing}
              isPlanning={isPlanning}
              parseError={parseError}
              conversationLog={conversationLog}
              activeQuestion={activeQuestion}
              onPromptChange={setUserPrompt}
              onParsePrompt={async () => {
                const trimmed = userPrompt.trim();
                if (!trimmed) {
                  return null;
                }
                appendMessage({ role: 'user', content: trimmed });
                const result = await parsePrompt(trimmed);
                if (result) {
                  setUserPrompt('');
                }
                return result;
              }}
              onPlanRoute={startRouteFlow}
              onAnswerQuestion={(option) => handleQuestionAnswered(option)}
              onSkipQuestion={() => handleQuestionAnswered(null)}
            />

            {routeSummary && (
              <div className="route-summary">
                <p className="insight-line">起点：{routeSummary.origin}</p>
                <p className="insight-line">终点：{routeSummary.destination}</p>
                <p className="insight-line">步行预计：{routeSummary.walkingDuration}</p>
                <p className="insight-line">跑步预计：{routeSummary.runningDuration}</p>
                <p className="insight-line">距离：{routeSummary.distance}</p>
                <p className="insight-line">坡度：{routeSummary.slope}</p>
                <p className="insight-line">安全：{routeSummary.safety}</p>
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

            <p className="privacy-note">隐私声明：你的输入仅用于本次路线规划，不会被保存或用于识别个人身份。</p>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}

