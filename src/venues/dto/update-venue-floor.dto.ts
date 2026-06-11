import { PartialType } from '@nestjs/swagger';
import { CreateVenueFloorDto } from './create-venue-floor.dto';

export class UpdateVenueFloorDto extends PartialType(CreateVenueFloorDto) {}
