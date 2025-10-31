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
          <h3>AI 解析结果</h3>
          <ul>
            <li>地点：{intent.location.context || '未识别'}</li>
            {intent.constraints.distance_km && <li>目标距离：{intent.constraints.distance_km} km</li>}
            {intent.constraints.time_of_day && <li>时间段：{intent.constraints.time_of_day}</li>}
            {hasPreferences && <li>安全偏好：{intent?.preferences?.safety?.join('、')}</li>}
          </ul>
        </div>
      )}

      {risk ? (
        <div className="card">
          <h3>安全评分</h3>
          <div className="risk-row">
            <span className="risk-dot" style={{ backgroundColor: LEVEL_COLOR[risk.level] }} />
            <span className="risk-level">{risk.level.toUpperCase()}</span>
          </div>
          <p>{risk.message}</p>
          <p>路线覆盖事件：{risk.incidentsAlongRoute} / {risk.incidentsSampled}</p>

          {onRequestReplan && risk.level !== 'low' && (
            <button type="button" className="secondary" onClick={onRequestReplan} disabled={isPlanning}>
              {isPlanning ? '重新规划中…' : '尝试更安全路线'}
            </button>
          )}
        </div>
      ) : (
        <p className="feedback">生成安全评分后将显示详细建议。</p>
      )}

      {route && (
        <div className="card">
          <h3>路线信息</h3>
          <ul>
            {route.summary && <li>路线概述：{route.summary}</li>}
            {route.distanceText && <li>总距离：{route.distanceText}</li>}
            {route.durationText && <li>预计时间：{route.durationText}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

