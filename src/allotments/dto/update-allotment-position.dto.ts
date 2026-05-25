import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateAllotmentPositionDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  x!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  y!: number;
}
