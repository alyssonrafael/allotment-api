import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { MessageDto } from './message.dto';

export class ParseVenueDto {
  @ApiProperty({
    example:
      'Pavilhão em São Paulo, 50x35 metros, tema azul, para feiras de tecnologia',
    description:
      'Mensagem atual do usuário em linguagem natural (10–1000 caracteres)',
  })
  @IsString()
  @Length(1, 1000)
  prompt!: string;

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

const venueFloorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'level', 'width', 'height', 'sortOrder', 'isDefault'],
  properties: {
    name: { type: 'string' },
    level: { type: 'integer', minimum: 0 },
    width: { type: 'number' },
    height: { type: 'number' },
    sortOrder: { type: 'integer', minimum: 0 },
    isDefault: { type: 'boolean' },
  },
};

// OpenAI strict-mode JSON Schema for parse-venue.
// Suporta dois estados via "status": complete (venue preenchido) e needs_info
// (questions + collected + assistantMessage). Campos anuláveis usam anyOf.
export const PARSE_VENUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'status',
    'venue',
    'suggestedEvent',
    'confidence',
    'missing',
    'questions',
    'collected',
    'assistantMessage',
  ],
  properties: {
    status: { type: 'string', enum: ['complete', 'needs_info'] },
    venue: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'description',
            'width',
            'height',
            'city',
            'state',
            'street',
            'neighborhood',
            'zipCode',
            'accent',
            'photo',
            'floors',
          ],
          properties: {
            name: { type: 'string' },
            description: nullableString,
            width: { type: 'number' },
            height: { type: 'number' },
            city: { type: 'string' },
            state: { type: 'string' },
            street: nullableString,
            neighborhood: nullableString,
            zipCode: nullableString,
            accent: { type: 'string' },
            photo: { type: 'string' },
            floors: { type: 'array', items: venueFloorSchema },
          },
        },
      ],
    },
    suggestedEvent: {
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
    confidence: { type: 'number' },
    missing: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    collected: {
      type: 'object',
      additionalProperties: false,
      required: [
        'name',
        'description',
        'width',
        'height',
        'city',
        'state',
        'street',
        'neighborhood',
        'zipCode',
        'accent',
        'photo',
        'floors',
      ],
      properties: {
        name: nullableString,
        description: nullableString,
        width: nullableNumber,
        height: nullableNumber,
        city: nullableString,
        state: nullableString,
        street: nullableString,
        neighborhood: nullableString,
        zipCode: nullableString,
        accent: nullableString,
        photo: nullableString,
        floors: { type: 'array', items: venueFloorSchema },
      },
    },
    assistantMessage: { type: 'string' },
  },
};

export interface ParsedVenue {
  name: string;
  description: string | null;
  width: number;
  height: number;
  city: string;
  state: string;
  street: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  accent: string;
  photo: string;
  floors: ParsedVenueFloor[];
}

export interface ParsedVenueFloor {
  name: string;
  level: number;
  width: number;
  height: number;
  sortOrder: number;
  isDefault: boolean;
}

export interface SuggestedEvent {
  name: string;
  type: 'FEIRA' | 'CONGRESSO' | 'EXPO' | 'CORPORATE';
  startDate: string;
  endDate: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ParseVenueComplete {
  status: 'complete';
  venue: ParsedVenue;
  suggestedEvent: SuggestedEvent | null;
  confidence: number;
  missing: string[];
  warnings: string[];
}

export interface ParseVenueNeedsInfo {
  status: 'needs_info';
  questions: string[];
  collected: Partial<ParsedVenue>;
  assistantMessage: string;
}

export type ParseVenueResponse = ParseVenueComplete | ParseVenueNeedsInfo;

// Forma bruta retornada pelo LLM (sempre traz todos os campos do schema).
export interface RawParseVenueResponse {
  status: 'complete' | 'needs_info';
  venue: ParsedVenue | null;
  suggestedEvent: SuggestedEvent | null;
  confidence: number;
  missing: string[];
  questions: string[];
  collected: Partial<ParsedVenue>;
  assistantMessage: string;
}
