import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { LayoutIntent, PlacedStand } from '../layout.engine';
import { MessageDto } from './message.dto';

export class ParseEventDto {
  @ApiProperty({
    example:
      '10 stands de 2x2 e 20 stands de 3x3, corredores de 2 metros entre linhas',
    description:
      'Mensagem atual do usuário em linguagem natural (10–1000 caracteres)',
  })
  @IsString()
  @Length(1, 1000)
  prompt!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  venueId!: string;

  @ApiProperty({
    example: 50,
    description: 'Largura disponível do canvas em metros',
  })
  @IsNumber()
  @IsPositive()
  canvasWidth!: number;

  @ApiProperty({
    example: 35,
    description: 'Altura disponível do canvas em metros',
  })
  @IsNumber()
  @IsPositive()
  canvasHeight!: number;

  @ApiPropertyOptional({
    type: [MessageDto],
    description:
      'Histórico da conversa (turnos anteriores). Vazio ou ausente na primeira mensagem.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  history?: MessageDto[];
}

const nullableString = { anyOf: [{ type: 'null' }, { type: 'string' }] };
const nullableNumber = { anyOf: [{ type: 'null' }, { type: 'number' }] };

// OpenAI strict-mode JSON Schema for parse-event.
// Suporta dois estados via "status": complete (event + layoutIntent) e needs_info.
// Dimensões dos stands restritas a números inteiros e mínimo 1 (reforçado no backend).
export const PARSE_EVENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'status',
    'event',
    'layoutIntent',
    'missing',
    'questions',
    'collected',
    'assistantMessage',
  ],
  properties: {
    status: { type: 'string', enum: ['complete', 'needs_info'] },
    event: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'type',
            'startDate',
            'endDate',
            'canvasWidth',
            'canvasHeight',
          ],
          properties: {
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['FEIRA', 'CONGRESSO', 'EXPO', 'CORPORATE'],
            },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            canvasWidth: { type: 'number' },
            canvasHeight: { type: 'number' },
          },
        },
      ],
    },
    layoutIntent: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'groups',
            'corridorH',
            'corridorV',
            'mainCorridorH',
            'mainCorridorV',
            'basePrice',
            'startCorner',
          ],
          properties: {
            groups: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['width', 'height', 'count', 'label', 'pricePerSqm'],
                properties: {
                  width: { type: 'integer', minimum: 1 },
                  height: { type: 'integer', minimum: 1 },
                  count: { type: 'integer', minimum: 1 },
                  label: nullableString,
                  pricePerSqm: nullableNumber,
                },
              },
            },
            corridorH: { type: 'number' },
            corridorV: { type: 'number' },
            mainCorridorH: nullableNumber,
            mainCorridorV: nullableNumber,
            basePrice: nullableNumber,
            startCorner: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'string',
                  enum: [
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right',
                    'center',
                  ],
                },
              ],
            },
          },
        },
      ],
    },
    missing: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    collected: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'type', 'startDate', 'endDate'],
      properties: {
        name: nullableString,
        type: {
          anyOf: [
            { type: 'null' },
            {
              type: 'string',
              enum: ['FEIRA', 'CONGRESSO', 'EXPO', 'CORPORATE'],
            },
          ],
        },
        startDate: nullableString,
        endDate: nullableString,
      },
    },
    assistantMessage: { type: 'string' },
  },
};

export interface ParsedEvent {
  name: string;
  type: 'FEIRA' | 'CONGRESSO' | 'EXPO' | 'CORPORATE';
  startDate: string;
  endDate: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ParsedEventCollected {
  name: string;
  type: 'FEIRA' | 'CONGRESSO' | 'EXPO' | 'CORPORATE';
  startDate: string;
  endDate: string;
}

export interface ParseEventComplete {
  status: 'complete';
  event: ParsedEvent;
  allotments: PlacedStand[];
  summary: {
    total: number;
    placed: number;
    discarded: number;
    groups: Array<{
      width: number;
      height: number;
      count: number;
      placed: number;
    }>;
  };
  warnings: string[];
  missing: string[];
}

export interface ParseEventNeedsInfo {
  status: 'needs_info';
  questions: string[];
  collected: Partial<ParsedEventCollected>;
  assistantMessage: string;
}

export type ParseEventResponse = ParseEventComplete | ParseEventNeedsInfo;

// Forma bruta retornada pelo LLM (sempre traz todos os campos do schema).
export interface RawParseEventResponse {
  status: 'complete' | 'needs_info';
  event: ParsedEvent | null;
  layoutIntent: LayoutIntent | null;
  missing: string[];
  questions: string[];
  collected: Partial<ParsedEventCollected>;
  assistantMessage: string;
}
