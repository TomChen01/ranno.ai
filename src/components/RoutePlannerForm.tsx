// src/components/RoutePlannerForm.tsx

import type { FormEvent } from 'react';
import type { RunGeniusIntent } from '../services/aiService';
import type { ConversationMessage, FollowUpQuestion, QuestionOption } from '../types/conversation';

type RoutePlannerFormProps = {
  userPrompt: string;
  isParsing: boolean;
  isPlanning: boolean;
  parseError?: string | null;
  conversationLog: ConversationMessage[];
  activeQuestion: FollowUpQuestion | null;
  onPromptChange: (value: string) => void;
  onParsePrompt: () => Promise<RunGeniusIntent | null>;
  onPlanRoute: (intent: RunGeniusIntent | null) => void;
  onAnswerQuestion: (option: QuestionOption) => void;
  onSkipQuestion: () => void;
};

export function RoutePlannerForm({
  userPrompt,
  isParsing,
  isPlanning,
  parseError,
  conversationLog,
  activeQuestion,
  onPromptChange,
  onParsePrompt,
  onPlanRoute,
  onAnswerQuestion,
  onSkipQuestion,
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
      {conversationLog.length > 0 && (
        <div className="conversation-log">
          {conversationLog.slice(-6).map((message, index) => (
            <div
              key={index}
              className={`message-bubble ${message.role === 'assistant' ? 'message-assistant' : 'message-user'}`}
            >
              {message.content}
            </div>
          ))}
        </div>
      )}

      {activeQuestion && (
        <div className="question-card">
          <p className="question-text">{activeQuestion.prompt}</p>
          <div className="question-options">
            {activeQuestion.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="question-option"
                onClick={() => onAnswerQuestion(option)}
              >
                {option.label}
              </button>
            ))}
            {activeQuestion.allowSkip && (
              <button type="button" className="question-option ghost" onClick={onSkipQuestion}>
                跳过
              </button>
            )}
          </div>
        </div>
      )}

      <div className="prompt-input-wrapper">
        <textarea
          value={userPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={4}
          placeholder="请输入完整的跑步需求，例如：我想从 Ferry Building 到 Golden Gate Park，晚上跑 5 公里，灯光要好且安全。"
        />

        <button type="submit" className="send-button" disabled={isBusy || !userPrompt.trim()} aria-label="生成安全路线">
          {isBusy ? '…' : <span className="send-button-icon" aria-hidden="true">↑</span>}
        </button>
      </div>

      {parseError && <p className="feedback feedback-error">{parseError}</p>}
    </form>
  );
}

