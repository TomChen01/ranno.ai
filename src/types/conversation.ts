export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type QuestionOption = {
  id: string;
  label: string;
  value: string;
  // Optional payload data for the caller to interpret (e.g. placeId, metadata)
  data?: unknown;
};

export type FollowUpQuestion = {
  id: string;
  prompt: string;
  options: QuestionOption[];
  allowSkip: boolean;
  onSelect: (option: QuestionOption | null) => void;
};

