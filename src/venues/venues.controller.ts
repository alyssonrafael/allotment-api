import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesService } from './venues.service';

const VENUE_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Pavilhão Norte',
  description: 'Pavilhão principal — Ala Norte',
  width: 100,
  height: 60,
  city: 'São Paulo',
  state: 'SP',
  street: 'Av. Olavo Fontoura, 1209',
  neighborhood: 'Santana',
  zipCode: '02012-021',
  accent: 'var(--primary)',
  photo: 'linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)',
  createdAt: '2025-01-10T10:00:00.000Z',
  updatedAt: '2025-01-10T10:00:00.000Z',
};

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Pavilhão criado com sucesso',
    schema: { example: VENUE_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        detail: [
          'name must be longer than or equal to 3 characters',
          'state deve ser a sigla da UF com 2 caracteres (ex: SP)',
          'width must not be less than 1',
        ],
      },
    },
  })
  create(@Body() dto: CreateVenueDto) {
    return this.venuesService.create(dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'Lista de pavilhões com contagem de eventos',
    schema: {
      example: [{ ...VENUE_EXAMPLE, _count: { events: 3 } }],
    },
  })
  findAll() {
    return this.venuesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Pavilhão com eventos incluídos',
    schema: {
      example: {
        ...VENUE_EXAMPLE,
        events: [
          {
            id: 'e1f2g3h4-...',
            name: 'Expo Tech 2025',
            startDate: '2025-09-11T00:00:00.000Z',
            endDate: '2025-09-14T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Pavilhão não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Venue a1b2c3d4-... not found',
        detail: 'Venue a1b2c3d4-... not found',
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  @Put(':id')
  @ApiOkResponse({
    description: 'Pavilhão atualizado',
    schema: {
      example: {
        ...VENUE_EXAMPLE,
        name: 'Pavilhão Norte — Reformado',
        width: 120,
        updatedAt: '2025-01-10T11:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Pavilhão não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Venue a1b2c3d4-... not found',
        detail: 'Venue a1b2c3d4-... not found',
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venuesService.update(id, dto);
  }

  @Get(':id/revenue')
  @ApiOkResponse({
    description: 'Receita do pavilhão agregada de todos os seus eventos',
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
    description: 'Pavilhão não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Venue a1b2c3d4-... not found',
        detail: 'Venue a1b2c3d4-... not found',
      },
    },
  })
  getRevenue(@Param('id') id: string) {
    return this.venuesService.getRevenue(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Pavilhão removido' })
  @ApiNotFoundResponse({
    description: 'Pavilhão não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Venue a1b2c3d4-... not found',
        detail: 'Venue a1b2c3d4-... not found',
      },
    },
  })
  @ApiConflictResponse({
    description: 'Pavilhão possui eventos vinculados',
    schema: {
      example: {
        statusCode: 409,
        message: 'Cannot delete venue with existing events',
        detail: 'Cannot delete venue with existing events',
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.venuesService.remove(id);
  }
}
