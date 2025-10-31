// src/components/MainApp.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AIEngineTest } from './AIEngineTest';
import { MapView, type RouteRequest, type TravelMode } from './MapView';
import { RoutePlannerForm } from './RoutePlannerForm';
import { SafetyInsights } from './SafetyInsights';
import { fetchCrimePoints, type CrimePoint } from '../services/crimeService';
import { parseUserIntent, type RunGeniusIntent } from '../services/aiService';
import { summarizeRouteRisk, type RouteRiskSummary, type RouteLike } from '../services/riskService';

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

export function MainApp() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [crimePoints, setCrimePoints] = useState<CrimePoint[]>([]);
  const [crimeError, setCrimeError] = useState<string | null>(null);
  const [isLoadingCrime, setIsLoadingCrime] = useState<boolean>(false);

  const [userPrompt, setUserPrompt] = useState<string>(DEFAULT_PROMPT);
  const [intent, setIntent] = useState<RunGeniusIntent | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [origin, setOrigin] = useState<string>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<string>(DEFAULT_DESTINATION);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [provideAlternatives, setProvideAlternatives] = useState<boolean>(true);

  const [routeRequest, setRouteRequest] = useState<RouteRequest | null>(null);
  const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
  const [riskSummary, setRiskSummary] = useState<RouteRiskSummary | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [showDebug, setShowDebug] = useState<boolean>(false);

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

  const handleParsePrompt = useCallback(async () => {
    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parseUserIntent(userPrompt);
      setIntent(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 解析失败';
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  }, [userPrompt]);

  const requestRoute = useCallback(
    (options?: { forceAlternatives?: boolean }) => {
      if (!origin || !destination) {
        return;
      }

      const nextProvideAlternatives = options?.forceAlternatives ?? provideAlternatives;
      if (nextProvideAlternatives !== provideAlternatives) {
        setProvideAlternatives(nextProvideAlternatives);
      }

      setIsPlanning(true);
      setRouteError(null);
      setRouteRequest({ origin, destination, travelMode, provideAlternatives: nextProvideAlternatives });
    },
    [destination, origin, travelMode, provideAlternatives],
  );

  const handleRouteReady = useCallback(
    (result: DirectionsResultLike) => {
      setIsPlanning(false);
      setRouteError(null);

      const primary = result.routes[0];
      if (!primary) {
        setRouteDetails(null);
        setRiskSummary(null);
        return;
      }

      const leg = primary.legs?.[0];
      setRouteDetails({
        summary: primary.summary,
        distanceText: leg?.distance?.text,
        durationText: leg?.duration?.text,
      });

      try {
        const summary = summarizeRouteRisk(primary, crimePoints);
        setRiskSummary(summary);
      } catch (error) {
        console.error('Failed to compute risk summary', error);
        setRiskSummary(null);
      }
    },
    [crimePoints],
  );

  const handleRouteError = useCallback((status: string) => {
    setIsPlanning(false);
    setRouteError(`路线规划失败：${status}`);
  }, []);

  const handleRequestReplan = useCallback(() => {
    requestRoute({ forceAlternatives: true });
  }, [requestRoute]);

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
        <aside className="sidebar">
          <RoutePlannerForm
            origin={origin}
            destination={destination}
            userPrompt={userPrompt}
            travelMode={travelMode}
            provideAlternatives={provideAlternatives}
            isParsing={isParsing}
            isPlanning={isPlanning}
            parseError={parseError}
            intent={intent}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onPromptChange={setUserPrompt}
            onTravelModeChange={setTravelMode}
            onProvideAlternativesChange={setProvideAlternatives}
            onParsePrompt={handleParsePrompt}
            onPlanRoute={requestRoute}
          />

          <SafetyInsights
            risk={riskSummary}
            route={routeDetails}
            intent={intent}
            onRequestReplan={riskSummary && riskSummary.level !== 'low' ? handleRequestReplan : undefined}
            isPlanning={isPlanning}
          />

          <div className="panel-section">
            <label className="checkbox-field">
              <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
              <span>显示 AI 调试面板</span>
            </label>
            {showDebug && <AIEngineTest />}
          </div>

          {crimeError && <p className="feedback feedback-error">{crimeError}</p>}
        </aside>

        <main className="map-container">
          <MapView
            crimePoints={crimePoints}
            routeRequest={routeRequest}
            onRouteReady={handleRouteReady}
            onRouteError={handleRouteError}
          />

          {(isLoadingCrime || isPlanning) && (
            <div className="overlay">
              <span>{isPlanning ? '正在计算路线…' : '正在加载犯罪数据…'}</span>
            </div>
          )}

          {routeError && <div className="toast toast-error">{routeError}</div>}
        </main>
      </div>
    </APIProvider>
  );
}

