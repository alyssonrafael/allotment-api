import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

const EVENT_EXAMPLE = {
  id: 'e1f2g3h4-e5f6-7890-abcd-ef1234567890',
  name: 'Expo Tech 2025',
  type: 'FEIRA',
  startDate: '2025-09-11T00:00:00.000Z',
  endDate: '2025-09-14T00:00:00.000Z',
  status: 'upcoming',
  venueId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  canvasWidth: 100,
  canvasHeight: 60,
  createdAt: '2025-05-23T12:00:00.000Z',
  updatedAt: '2025-05-23T12:00:00.000Z',
};

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Evento criado com sucesso',
    schema: {
      example: {
        ...EVENT_EXAMPLE,
        venue: { id: 'a1b2c3d4-...', name: 'Pavilhão Norte' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos ou endDate anterior a startDate',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        detail: [
          'name must be longer than or equal to 3 characters',
          'type must be one of the following values: FEIRA, CONGRESSO, EXPO, CORPORATE',
          'startDate must be a valid ISO 8601 date string',
          'venueId must be a UUID',
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Venue não encontrado',
    schema: {
      example: { statusCode: 404, message: 'Venue a1b2c3d4-... not found', detail: 'Venue a1b2c3d4-... not found' },
    },
  })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'venueId', required: false, description: 'Filtra por pavilhão' })
  @ApiQuery({ name: 'type', required: false, enum: EventType, description: 'Filtra por tipo de evento' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['upcoming', 'active', 'finished'],
    description: 'Filtra por status computado (derivado das datas)',
  })
  @ApiOkResponse({
    description: 'Lista de eventos com venue, contagem de allotments e status computado',
    schema: {
      example: [
        {
          ...EVENT_EXAMPLE,
          venue: { id: 'a1b2c3d4-...', name: 'Pavilhão Norte' },
          _count: { allotments: 12 },
        },
      ],
    },
  })
  findAll(
    @Query('venueId') venueId?: string,
    @Query('type') type?: EventType,
    @Query('status') status?: 'upcoming' | 'active' | 'finished',
  ) {
    return this.eventsService.findAll({ venueId, type, status });
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Evento com venue, allotments e status computado',
    schema: {
      example: {
        ...EVENT_EXAMPLE,
        venue: { id: 'a1b2c3d4-...', name: 'Pavilhão Norte', width: 100, height: 60 },
        allotments: [
          {
            id: 'b2c3d4e5-...',
            name: 'Stand A01',
            code: 'A01',
            x: 0,
            y: 0,
            width: 4,
            height: 3,
            status: 'AVAILABLE',
            price: 12000,
            eventId: 'e1f2g3h4-...',
            createdAt: '2025-05-23T12:00:00.000Z',
            updatedAt: '2025-05-23T12:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Evento não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Event e1f2g3h4-... not found',
        detail: 'Event e1f2g3h4-... not found',
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Put(':id')
  @ApiOkResponse({
    description: 'Evento atualizado',
    schema: {
      example: {
        ...EVENT_EXAMPLE,
        name: 'Expo Tech 2025 — Edição Especial',
        endDate: '2025-09-16T00:00:00.000Z',
        canvasWidth: 80,
        updatedAt: '2025-05-23T13:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos ou endDate anterior a startDate',
    schema: {
      example: { statusCode: 400, message: 'endDate must be >= startDate', detail: 'endDate must be >= startDate' },
    },
  })
  @ApiNotFoundResponse({
    description: 'Evento não encontrado',
    schema: {
      example: { statusCode: 404, message: 'Event e1f2g3h4-... not found', detail: 'Event e1f2g3h4-... not found' },
    },
  })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Evento removido (allotments removidos em cascata)' })
  @ApiNotFoundResponse({
    description: 'Evento não encontrado',
    schema: {
      example: { statusCode: 404, message: 'Event e1f2g3h4-... not found', detail: 'Event e1f2g3h4-... not found' },
    },
  })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Get(':id/revenue')
  @ApiOkResponse({
    description: 'Receita do evento separada por status dos lotes',
    schema: {
      example: {
        realized: 15000,
        inNegotiation: 8500,
        total: 23500,
        counts: { sold: 5, reserved: 3, available: 10, blocked: 2 },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Evento não encontrado',
    schema: {
      example: { statusCode: 404, message: 'Event e1f2g3h4-... not found', detail: 'Event e1f2g3h4-... not found' },
    },
  })
  getRevenue(@Param('id') id: string) {
    return this.eventsService.getRevenue(id);
  }

  @Get(':id/activities')
  @ApiOkResponse({
    description: 'Atividades recentes do evento nas últimas 24h',
    schema: {
      example: [
        {
          id: 'uuid',
          action: 'Lote A01 foi reservado',
          type: 'RESERVED',
          createdAt: '2026-05-25T14:32:00.000Z',
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: 'Evento não encontrado',
    schema: {
      example: { statusCode: 404, message: 'Event e1f2g3h4-... not found', detail: 'Event e1f2g3h4-... not found' },
    },
  })
  getActivities(@Param('id') id: string) {
    return this.eventsService.getActivities(id);
  }
}
