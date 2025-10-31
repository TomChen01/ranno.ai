// src/components/MainApp.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapView, type RouteRequest, type TravelMode } from './MapView';
import { RoutePlannerForm } from './RoutePlannerForm';
import { SafetyInsights } from './SafetyInsights';
import { fetchCrimePoints } from '../services/crimeService';
import type { CrimePoint } from '../services/crimeService';
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';
import { type RouteLike } from '../services/riskService';

const DEFAULT_PROMPT = '我想在旧金山晚上跑一条安全的 5 公里路线，沿途需要光线好。';
const DEFAULT_ORIGIN = 'Ferry Building, San Francisco, CA';
const DEFAULT_DESTINATION = 'Crissy Field, San Francisco, CA';

type RouteDetails = {
  summary?: string;
  distanceText?: string;
  durationText?: string;
};

type DirectionsResultLike = {
  routes: RouteLike[];
};

interface MainAppProps {
  crimePoints?: CrimePoint[];
}

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
  const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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
  }, [crimePointsProp]);

  const handleParsePrompt = useCallback(async () => {
    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parseUserIntent(userPrompt);
      setIntent(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 解析失败';
      setParseError(message);
      return null;
    } finally {
      setIsParsing(false);
    }
  }, [userPrompt]);

  const requestRoute = useCallback(
    (parsedIntent?: RunGeniusIntent | null) => {
      const activeIntent = parsedIntent ?? intent;
      const originText =
        activeIntent?.location?.origin?.text ?? activeIntent?.location?.context ?? DEFAULT_ORIGIN;
      const destinationText =
        activeIntent?.location?.destination?.text ?? DEFAULT_DESTINATION;
      const travelMode = activeIntent?.preferences?.route_type === 'point_to_point' ? 'DRIVING' : 'WALKING';

      if (!originText || !destinationText) {
        setRouteError('未识别到起点或终点，请在提示中明确说明。');
        return;
      }

      setIsPlanning(true);
      setRouteError(null);
      setRouteRequest({
        origin: originText,
        destination: destinationText,
        travelMode: travelMode as TravelMode,
        provideAlternatives: true,
      });
    },
    [intent],
  );

  const handleRouteReady = useCallback(
    (result: DirectionsResultLike) => {
      setIsPlanning(false);
      setRouteError(null);

      const primary = result.routes[0];
      if (!primary) {
        setRouteDetails(null);
        // 安全摘要当前不显示，只保留路线信息
        return;
      }

      const leg = primary.legs?.[0];
      setRouteDetails({
        summary: primary.summary,
        distanceText: leg?.distance?.text,
        durationText: leg?.duration?.text,
      });

      // 安全摘要当前不显示，只保留路线信息
    },
    [],
  );

  const handleRouteError = useCallback((status: string) => {
    setIsPlanning(false);
    setRouteError(`路线规划失败：${status}`);
  }, []);

  const libraries = useMemo<string[]>(() => ['routes', 'visualization', 'geometry'], []);

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
          />

          <div className="prompt-overlay">
            <RoutePlannerForm
              userPrompt={userPrompt}
              isParsing={isParsing}
              isPlanning={isPlanning}
              parseError={parseError}
              onPromptChange={setUserPrompt}
              onParsePrompt={handleParsePrompt}
              onPlanRoute={requestRoute}
            />

            {routeDetails && (
              <p className="route-summary">
                {routeDetails.summary && `${routeDetails.summary} · `}
                {routeDetails.distanceText} · {routeDetails.durationText}
              </p>
            )}

            {crimeError && <p className="feedback feedback-error">{crimeError}</p>}
            {routeError && <p className="feedback feedback-error">{routeError}</p>}
          </div>

          {(isLoadingCrime || isPlanning) && (
            <div className="overlay">
              <span>{isPlanning ? '正在计算路线…' : '正在加载犯罪数据…'}</span>
            </div>
          )}
        </div>
      </div>
    </APIProvider>
  );
}

