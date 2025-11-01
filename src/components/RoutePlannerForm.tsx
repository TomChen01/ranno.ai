// src/components/RoutePlannerForm.tsx

import type { FormEvent } from 'react';
import { useState } from 'react';
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
  const [showFullConversation, setShowFullConversation] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userPrompt.trim() || isParsing || isPlanning) {
      return;
    }

    const parsedIntent = await onParsePrompt();
    onPlanRoute(parsedIntent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  };

  const isBusy = isParsing || isPlanning;

  return (
    <form className="single-input-form" onSubmit={handleSubmit}>
      {conversationLog.length > 0 && (
        <div className="conversation-log">
          {(showFullConversation ? conversationLog : conversationLog.slice(-6)).map((message, index) => (
            <div
              key={index}
              className={`message-bubble ${message.role === 'assistant' ? 'message-assistant' : 'message-user'}`}
            >
              {message.content}
            </div>
          ))}
          {conversationLog.length > 6 && (
            <button
              type="button"
              className="conversation-toggle"
              onClick={() => setShowFullConversation((prev) => !prev)}
            >
              {showFullConversation ? 'Show less' : 'See more'}
            </button>
          )}
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
                Skip
              </button>
            )}
          </div>
        </div>
      )}

      <div className="prompt-input-wrapper">
        <textarea
          value={userPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Tell us your running request, e.g., Start at Ferry Building, end at Golden Gate Park, 5 km at night with good lighting."
        />

        <button type="submit" className="send-button" disabled={isBusy || !userPrompt.trim()} aria-label="Generate safe route">
          {isBusy ? '...' : <span className="send-button-icon" aria-hidden="true"></span>}
        </button>
      </div>

      {parseError && <p className="feedback feedback-error">{parseError}</p>}
    </form>
  );
}

