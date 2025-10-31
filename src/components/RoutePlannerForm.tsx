// src/components/RoutePlannerForm.tsx

import type { RunGeniusIntent } from '../services/aiService';

type TravelMode = 'WALKING' | 'BICYCLING' | 'DRIVING';

type RoutePlannerFormProps = {
  origin: string;
  destination: string;
  userPrompt: string;
  travelMode: TravelMode;
  provideAlternatives: boolean;
  isParsing: boolean;
  isPlanning: boolean;
  parseError?: string | null;
  intent: RunGeniusIntent | null;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onTravelModeChange: (mode: TravelMode) => void;
  onProvideAlternativesChange: (value: boolean) => void;
  onParsePrompt: () => void;
  onPlanRoute: () => void;
};

export function RoutePlannerForm({
  origin,
  destination,
  userPrompt,
  travelMode,
  provideAlternatives,
  isParsing,
  isPlanning,
  parseError,
  intent,
  onOriginChange,
  onDestinationChange,
  onPromptChange,
  onTravelModeChange,
  onProvideAlternativesChange,
  onParsePrompt,
  onPlanRoute,
}: RoutePlannerFormProps) {
  return (
    <section className="panel-section">
      <header className="section-header">
        <h2>Plan Your Run</h2>
        <p>Describe your safety requirements, then pick start and end points.</p>
      </header>

      <label className="field">
        <span className="field-label">Safety prompt</span>
        <textarea
          value={userPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={4}
          placeholder="例如：我想在旧金山晚上跑 5 公里，想要光线好且安全的路线"
        />
      </label>

      <div className="button-row">
        <button type="button" onClick={onParsePrompt} disabled={isParsing}>
          {isParsing ? '解析中…' : '解析需求'}
        </button>
      </div>

      {parseError && <p className="feedback feedback-error">{parseError}</p>}

      {intent && (
        <div className="intent-chip-list">
          <div className="intent-chip">地点：{intent.location.context || '未识别'}</div>
          {intent.constraints.distance_km && (
            <div className="intent-chip">距离：{intent.constraints.distance_km} km</div>
          )}
          {intent.constraints.time_of_day && (
            <div className="intent-chip">时间：{intent.constraints.time_of_day}</div>
          )}
          {intent.preferences?.safety && intent.preferences.safety.length > 0 && (
            <div className="intent-chip">安全偏好：{intent.preferences.safety.join(', ')}</div>
          )}
        </div>
      )}

      <label className="field">
        <span className="field-label">起点</span>
        <input
          value={origin}
          onChange={(event) => onOriginChange(event.target.value)}
          placeholder="例如：Ferry Building, San Francisco"
        />
      </label>

      <label className="field">
        <span className="field-label">终点</span>
        <input
          value={destination}
          onChange={(event) => onDestinationChange(event.target.value)}
          placeholder="例如：Golden Gate Park"
        />
      </label>

      <div className="field-inline">
        <label className="field">
          <span className="field-label">出行方式</span>
          <select
            value={travelMode}
            onChange={(event) => onTravelModeChange(event.target.value as TravelMode)}
          >
            <option value="WALKING">步行</option>
            <option value="BICYCLING">骑行</option>
            <option value="DRIVING">驾车</option>
          </select>
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={provideAlternatives}
            onChange={(event) => onProvideAlternativesChange(event.target.checked)}
          />
          <span>自动尝试备用路线</span>
        </label>
      </div>

      <div className="button-row">
        <button type="button" onClick={onPlanRoute} disabled={isPlanning || !origin || !destination}>
          {isPlanning ? '计算路线…' : '生成安全路线'}
        </button>
      </div>
    </section>
  );
}

