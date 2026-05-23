import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AllotmentStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

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

  @ApiPropertyOptional({ enum: AllotmentStatus, default: AllotmentStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(AllotmentStatus)
  status?: AllotmentStatus;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0)
  price!: number;
}
