import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AllotmentStatus } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAllotmentDto {
  @ApiProperty({ example: 'Stand Central' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'A01' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  @Min(0)
  x!: number;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  @Min(0)
  y!: number;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @IsPositive()
  width!: number;

  @ApiProperty({ example: 8.0 })
  @IsNumber()
  @IsPositive()
  height!: number;

  @ApiPropertyOptional({
    enum: AllotmentStatus,
    default: AllotmentStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(AllotmentStatus)
  status?: AllotmentStatus;

  @ApiPropertyOptional({
    example: 1500.0,
    description:
      'Opcional. Se ausente, usa Event.defaultAllotmentPrice; se não houver padrão, usa 0.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Obrigatório quando o evento tiver mais de um andar.',
  })
  @IsOptional()
  @IsUUID()
  eventFloorId?: string;
}
