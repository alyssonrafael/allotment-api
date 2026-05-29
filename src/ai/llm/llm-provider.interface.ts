export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  complete(messages: ChatMessage[], schema: Record<string, unknown>): Promise<unknown>;
}
