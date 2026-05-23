import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Evento criado com sucesso',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'ExpoTech 2025',
        date: '2025-09-15T10:00:00.000Z',
        pavilionName: 'Pavilhão A',
        pavilionWidth: 100.5,
        pavilionHeight: 50.0,
        createdAt: '2025-05-23T12:00:00.000Z',
        updatedAt: '2025-05-23T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        detail: [
          'name must be longer than or equal to 3 characters',
          'date must be a valid ISO 8601 date string',
          'pavilionWidth must be a positive number',
        ],
      },
    },
  })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'Lista de eventos com contagem de allotments',
    schema: {
      example: [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'ExpoTech 2025',
          date: '2025-09-15T10:00:00.000Z',
          pavilionName: 'Pavilhão A',
          pavilionWidth: 100.5,
          pavilionHeight: 50.0,
          createdAt: '2025-05-23T12:00:00.000Z',
          updatedAt: '2025-05-23T12:00:00.000Z',
          _count: { allotments: 3 },
        },
      ],
    },
  })
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Evento com allotments incluídos',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'ExpoTech 2025',
        date: '2025-09-15T10:00:00.000Z',
        pavilionName: 'Pavilhão A',
        pavilionWidth: 100.5,
        pavilionHeight: 50.0,
        createdAt: '2025-05-23T12:00:00.000Z',
        updatedAt: '2025-05-23T12:00:00.000Z',
        allotments: [
          {
            id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            name: 'Stand Central',
            code: 'A01',
            x: 5.0,
            y: 3.0,
            width: 10.0,
            height: 8.0,
            status: 'AVAILABLE',
            price: 1500.0,
            eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            createdAt: '2025-05-23T12:05:00.000Z',
            updatedAt: '2025-05-23T12:05:00.000Z',
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
        message: 'Event a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
        detail: 'Event a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }
}
