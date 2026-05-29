import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LLM_PROVIDER } from './llm/llm-provider.interface';
import { OpenAiProvider } from './llm/openai.provider';

@Module({
  controllers: [AiController],
  providers: [AiService, { provide: LLM_PROVIDER, useClass: OpenAiProvider }],
})
export class AiModule {}
