import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateAllotmentDto } from './create-allotment.dto';

export class BulkCreateAllotmentsDto {
  @ApiProperty({ type: [CreateAllotmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAllotmentDto)
  allotments!: CreateAllotmentDto[];
}
