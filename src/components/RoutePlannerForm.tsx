// src/components/RoutePlannerForm.tsx

import type { FormEvent } from 'react';
import type { RunGeniusIntent } from '../services/aiService';

type RoutePlannerFormProps = {
  userPrompt: string;
  isParsing: boolean;
  isPlanning: boolean;
  parseError?: string | null;
  onPromptChange: (value: string) => void;
  onParsePrompt: () => Promise<RunGeniusIntent | null>;
  onPlanRoute: (intent: RunGeniusIntent | null) => void;
};

export function RoutePlannerForm({
  userPrompt,
  isParsing,
  isPlanning,
  parseError,
  onPromptChange,
  onParsePrompt,
  onPlanRoute,
}: RoutePlannerFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userPrompt.trim() || isParsing || isPlanning) {
      return;
    }

    const parsedIntent = await onParsePrompt();
    onPlanRoute(parsedIntent);
  };

  const isBusy = isParsing || isPlanning;

  return (
    <form className="single-input-form" onSubmit={handleSubmit}>
      <div className="prompt-input-wrapper">
        <textarea
          value={userPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={4}
          placeholder="请输入完整的跑步需求，例如：我想从 Ferry Building 到 Golden Gate Park，晚上跑 5 公里，灯光要好且安全。"
        />

        <button type="submit" className="send-button" disabled={isBusy || !userPrompt.trim()} aria-label="生成安全路线">
          {isBusy ? '…' : '➤'}
        </button>
      </div>

      {parseError && <p className="feedback feedback-error">{parseError}</p>}
    </form>
  );
}

