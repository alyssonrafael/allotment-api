import { ApiProperty } from '@nestjs/swagger';
import { AllotmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAllotmentStatusDto {
  @ApiProperty({ enum: AllotmentStatus })
  @IsEnum(AllotmentStatus)
  status!: AllotmentStatus;
}
