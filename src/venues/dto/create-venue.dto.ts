import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateVenueFloorDto } from './create-venue-floor.dto';

export class CreateVenueDto {
  @ApiProperty({ example: 'Pavilhão Norte' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ example: 'Pavilhão principal — Ala Norte' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Dimensão legada usada para criar o Térreo quando floors não vier.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Dimensão legada usada para criar o Térreo quando floors não vier.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @MinLength(2)
  city!: string;

  @ApiProperty({ example: 'SP', description: 'Sigla da UF — 2 caracteres' })
  @IsString()
  @Length(2, 2, {
    message: 'state deve ser a sigla da UF com 2 caracteres (ex: SP)',
  })
  state!: string;

  @ApiPropertyOptional({ example: 'Av. Olavo Fontoura, 1209' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: 'Santana' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: '02012-021' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({
    example: 'var(--primary)',
    description: 'CSS color token para detalhes visuais',
  })
  @IsString()
  accent!: string;

  @ApiProperty({
    example: 'linear-gradient(135deg, #2563eb 0%, #6366f1 60%, #8b5cf6 100%)',
    description: 'CSS gradient para a capa do card',
  })
  @IsString()
  photo!: string;

  @ApiPropertyOptional({ type: [CreateVenueFloorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVenueFloorDto)
  floors?: CreateVenueFloorDto[];
}
