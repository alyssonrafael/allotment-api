import { PartialType } from '@nestjs/swagger';
import { CreateAllotmentDto } from './create-allotment.dto';

export class UpdateAllotmentDto extends PartialType(CreateAllotmentDto) {}
