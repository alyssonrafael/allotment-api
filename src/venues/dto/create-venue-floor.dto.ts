import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVenueFloorDto {
  @ApiProperty({ example: 'Térreo' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 0, description: '0 = térreo, 1 = primeiro andar' })
  @IsInt()
  @Min(0)
  level!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  width!: number;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(1)
  height!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
