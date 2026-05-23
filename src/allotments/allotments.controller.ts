import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateAllotmentDto } from './dto/create-allotment.dto';
import { UpdateAllotmentDto } from './dto/update-allotment.dto';
import { AllotmentsService } from './allotments.service';

@ApiTags('Allotments')
@Controller()
export class AllotmentsController {
  constructor(private readonly allotmentsService: AllotmentsService) {}

  @Post('events/:eventId/allotments')
  @ApiCreatedResponse({
    description: 'Allotment criado com sucesso',
    schema: {
      example: {
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
    },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        detail: ['width must be a positive number', 'x must not be less than 0'],
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
  @ApiConflictResponse({
    description: 'Código duplicado ou colisão/limite excedido',
    schema: {
      example: {
        statusCode: 409,
        message: 'Code "A01" already exists in this event',
        detail: 'Code "A01" already exists in this event',
      },
    },
  })
  create(@Param('eventId') eventId: string, @Body() dto: CreateAllotmentDto) {
    return this.allotmentsService.create(eventId, dto);
  }

  @Put('allotments/:id')
  @ApiOkResponse({
    description: 'Allotment atualizado',
    schema: {
      example: {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Stand Central Atualizado',
        code: 'A01',
        x: 6.0,
        y: 4.0,
        width: 12.0,
        height: 9.0,
        status: 'RESERVED',
        price: 1800.0,
        eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        createdAt: '2025-05-23T12:05:00.000Z',
        updatedAt: '2025-05-23T13:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Dados inválidos',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        detail: ['width must be a positive number'],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Allotment não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Allotment b2c3d4e5-f6a7-8901-bcde-f12345678901 not found',
        detail: 'Allotment b2c3d4e5-f6a7-8901-bcde-f12345678901 not found',
      },
    },
  })
  @ApiConflictResponse({
    description: 'Colisão com stand existente ou limite do pavilhão excedido',
    schema: {
      example: {
        statusCode: 409,
        message: 'Allotment collides with an existing stand',
        detail: 'Allotment collides with an existing stand',
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: UpdateAllotmentDto) {
    return this.allotmentsService.update(id, dto);
  }

  @Delete('allotments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Allotment removido' })
  @ApiNotFoundResponse({
    description: 'Allotment não encontrado',
    schema: {
      example: {
        statusCode: 404,
        message: 'Allotment b2c3d4e5-f6a7-8901-bcde-f12345678901 not found',
        detail: 'Allotment b2c3d4e5-f6a7-8901-bcde-f12345678901 not found',
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.allotmentsService.remove(id);
  }
}
