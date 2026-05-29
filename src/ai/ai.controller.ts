import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ParseVenueDto } from './dto/parse-venue.dto';
import { ParseEventDto } from './dto/parse-event.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('parse-venue')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'Resposta em união discriminada por "status": ' +
      '"complete" (venue pronto para preview) ou "needs_info" (faltam dados obrigatórios — exibir questions/assistantMessage no chat e reenviar com history).',
    schema: {
      oneOf: [
        {
          title: 'complete',
          example: {
            status: 'complete',
            venue: {
              name: 'Pavilhão SP Feiras',
              description: null,
              width: 50,
              height: 35,
              city: 'São Paulo',
              state: 'SP',
              street: null,
              neighborhood: null,
              zipCode: null,
              accent: '#2563eb',
              photo: 'linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)',
            },
            suggestedEvent: null,
            confidence: 0.85,
            missing: ['endereço', 'CEP'],
          },
        },
        {
          title: 'needs_info',
          example: {
            status: 'needs_info',
            questions: ['Qual é o nome do pavilhão?', 'Em qual cidade e estado ficará?'],
            collected: { width: 50, height: 30, accent: '#2563eb' },
            assistantMessage:
              'Ótimo! Pavilhão de 50×30m com tema azul. Falta só: qual o nome e a cidade/estado?',
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Prompt inválido (muito curto, muito longo ou malformado)' })
  @ApiResponse({ status: 422, description: 'A IA não conseguiu extrair os dados mínimos do prompt' })
  @ApiResponse({ status: 503, description: 'Serviço de IA temporariamente indisponível' })
  parseVenue(@Body() dto: ParseVenueDto) {
    return this.aiService.parseVenue(dto);
  }

  @Post('parse-event')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'Resposta em união discriminada por "status": ' +
      '"complete" (evento + layout posicionado) ou "needs_info" (faltam dados obrigatórios — exibir questions/assistantMessage no chat e reenviar com history).',
    schema: {
      oneOf: [
        {
          title: 'complete',
          example: {
            status: 'complete',
            event: {
              name: 'Feira de Tecnologia 2026',
              type: 'FEIRA',
              startDate: '2026-03-10T00:00:00.000Z',
              endDate: '2026-03-15T00:00:00.000Z',
              canvasWidth: 50,
              canvasHeight: 35,
            },
            allotments: [
              { code: 'A-01', name: 'Stand A-01', x: 0, y: 0, width: 2, height: 2, status: 'AVAILABLE', price: 4000 },
            ],
            summary: { total: 30, placed: 28, discarded: 2, groups: [{ width: 2, height: 2, count: 10, placed: 10 }] },
            warnings: ['Dimensão 5.1m ajustada para 5m (o sistema aceita apenas medidas inteiras em metros).'],
            missing: [],
          },
        },
        {
          title: 'needs_info',
          example: {
            status: 'needs_info',
            questions: ['Qual o nome do evento e as datas?'],
            collected: { type: 'EXPO' },
            assistantMessage: 'Entendi: 30 stands de 3x3. Qual o nome do evento e as datas de início e término?',
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos ou canvas maior que o venue' })
  @ApiNotFoundResponse({ description: 'Venue não encontrado' })
  @ApiResponse({ status: 422, description: 'A IA não conseguiu extrair os dados mínimos do prompt' })
  @ApiResponse({ status: 503, description: 'Serviço de IA temporariamente indisponível' })
  parseEvent(@Body() dto: ParseEventDto) {
    return this.aiService.parseEvent(dto);
  }
}
