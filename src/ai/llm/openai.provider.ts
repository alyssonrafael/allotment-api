import { HttpException, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import OpenAI, { APIConnectionError, APIConnectionTimeoutError, RateLimitError } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ChatMessage, LlmProvider } from './llm-provider.interface';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async complete(messages: ChatMessage[], schema: Record<string, unknown>): Promise<unknown> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: messages as ChatCompletionMessageParam[],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'ai_response', strict: true, schema },
        },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new UnprocessableEntityException('A IA não retornou conteúdo');

      return JSON.parse(content) as unknown;
    } catch (err) {
      if (err instanceof HttpException) throw err;

      if (
        err instanceof APIConnectionError ||
        err instanceof APIConnectionTimeoutError ||
        err instanceof RateLimitError
      ) {
        throw new ServiceUnavailableException('Serviço de IA temporariamente indisponível');
      }

      throw new UnprocessableEntityException('Não foi possível interpretar o prompt');
    }
  }
}
