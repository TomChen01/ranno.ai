// src/components/SafetyInsights.tsx

import type { RunGeniusIntent } from '../services/aiService';
import type { RouteRiskSummary } from '../services/riskService';

type RouteDetails = {
  summary?: string;
  distanceText?: string;
  durationText?: string;
};

type SafetyInsightsProps = {
  risk: RouteRiskSummary | null;
  route: RouteDetails | null;
  intent: RunGeniusIntent | null;
  onRequestReplan?: () => void;
  isPlanning: boolean;
};

const LEVEL_COLOR: Record<RouteRiskSummary['level'], string> = {
  low: '#22c55e',
  medium: '#facc15',
  high: '#ef4444',
};

export function SafetyInsights({ risk, route, intent, onRequestReplan, isPlanning }: SafetyInsightsProps) {
  const hasPreferences = Boolean(intent?.preferences?.safety && intent.preferences.safety.length > 0);

  return (
    <section className="panel-section">
      <header className="section-header">
        <h2>Safety Insights</h2>
        <p>Review the AI interpretation and the live safety score.</p>
      </header>

      {intent && (
        <div className="card">
          <h3>AI Interpretation</h3>
          <ul>
            <li>Context: {intent.location?.context ?? 'Not identified'}</li>
            {intent.constraints?.distance_km !== undefined && <li>Target distance: {intent.constraints.distance_km} km</li>}
            {intent.constraints?.time_of_day && <li>Time of day: {intent.constraints.time_of_day}</li>}
            {hasPreferences && <li>Safety preferences: {intent?.preferences?.safety?.join(', ')}</li>}
          </ul>
        </div>
      )}

      {risk ? (
        <div className="card">
          <h3>Safety Score</h3>
          <div className="risk-row">
            <span className="risk-dot" style={{ backgroundColor: LEVEL_COLOR[risk.level] }} />
            <span className="risk-level">{risk.level.toUpperCase()}</span>
          </div>
          <p>{risk.message}</p>
          <p>Incidents along route: {risk.incidentsAlongRoute} / {risk.incidentsSampled}</p>

          {onRequestReplan && risk.level !== 'low' && (
            <button type="button" className="secondary" onClick={onRequestReplan} disabled={isPlanning}>
              {isPlanning ? 'Replanning...' : 'Try a safer route'}
            </button>
          )}
        </div>
      ) : (
        <p className="feedback">Detailed guidance shows once a safety score is generated.</p>
      )}

      {route && (
        <div className="card">
          <h3>Route Details</h3>
          <ul>
            {route.summary && <li>Overview: {route.summary}</li>}
            {route.distanceText && <li>Total distance: {route.distanceText}</li>}
            {route.durationText && <li>Estimated time: {route.durationText}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

