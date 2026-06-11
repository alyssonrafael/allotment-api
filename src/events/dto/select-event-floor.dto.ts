import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class SelectEventFloorDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  venueFloorId!: string;

  @ApiPropertyOptional({
    example: 80,
    description: 'Largura parcial do andar para este evento.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Altura parcial do andar para este evento.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;
}
