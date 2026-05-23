import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'ExpoTech 2025' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: '2025-09-15T10:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Pavilhão A' })
  @IsString()
  pavilionName!: string;

  @ApiProperty({ example: 100.5 })
  @IsNumber()
  @IsPositive()
  pavilionWidth!: number;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @IsPositive()
  pavilionHeight!: number;
}
