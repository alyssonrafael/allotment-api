import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EventType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SelectEventFloorDto } from './select-event-floor.dto';

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

  @ApiPropertyOptional({
    example: 80,
    description: 'Sobrescreve a largura do venue (área parcial)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  canvasWidth?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Sobrescreve a altura do venue (área parcial)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  canvasHeight?: number;

  @ApiPropertyOptional({
    type: [SelectEventFloorDto],
    description:
      'Andares do pavilhão usados no evento. Ausente = andar default.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectEventFloorDto)
  selectedFloors?: SelectEventFloorDto[];

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Permite alterar width/height dos EventFloors depois do evento criado.',
  })
  @IsOptional()
  @IsBoolean()
  allowFloorDimensionChanges?: boolean;

  @ApiPropertyOptional({
    example: 1500,
    nullable: true,
    description:
      'Preço padrão usado quando um allotment for criado sem price.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultAllotmentPrice?: number | null;
}
