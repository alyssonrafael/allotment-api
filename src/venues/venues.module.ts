import { Module } from '@nestjs/common';
import { VenueFloorsController, VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

@Module({
  controllers: [VenuesController, VenueFloorsController],
  providers: [VenuesService],
  exports: [VenuesService],
})
export class VenuesModule {}
