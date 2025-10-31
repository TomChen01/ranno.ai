// src/services/promptApi.ts

export type ModelStatus =
  | 'LOADING...'
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | string;

export type PromptMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  prefix?: boolean;
};

export type PromptSession = {
  prompt: (input: string | PromptMessage[]) => Promise<string>;
};

export type ExpectedIO = {
  type: 'text' | 'image' | 'audio';
  // supported language codes for the Prompt API
  languages: ('en' | 'ja' | 'es')[];
};

export type LanguageModelApi = {
  availability?: () => Promise<ModelStatus>;
  create?: (options?: {
    initialPrompts?: PromptMessage[];
    expectedInputs?: ExpectedIO[];
    expectedOutputs?: ExpectedIO[];
  }) => Promise<PromptSession>;
};

export type SummarizerApi = {
  create?: () => Promise<unknown>;
};

type PromptEnabledGlobal = typeof globalThis & {
  LanguageModel?: LanguageModelApi;
  Summarizer?: SummarizerApi;
};

export function getLanguageModel(): LanguageModelApi | undefined {
  return (globalThis as PromptEnabledGlobal).LanguageModel;
}

export function getSummarizer(): SummarizerApi | undefined {
  return (globalThis as PromptEnabledGlobal).Summarizer;
}

