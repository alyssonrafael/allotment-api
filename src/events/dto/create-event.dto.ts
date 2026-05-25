import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Expo Tech 2025' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ enum: EventType, example: EventType.FEIRA })
  @IsEnum(EventType)
  type!: EventType;

  @ApiProperty({ example: '2025-09-11T00:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2025-09-14T00:00:00.000Z' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  venueId!: string;

  @ApiPropertyOptional({ example: 80, description: 'Sobrescreve a largura do venue (área parcial)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  canvasWidth?: number;

  @ApiPropertyOptional({ example: 50, description: 'Sobrescreve a altura do venue (área parcial)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  canvasHeight?: number;
}
