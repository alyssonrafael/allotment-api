import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { VenuesModule } from '../venues/venues.module';
import { EventFloorsController, EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [VenuesModule, ActivitiesModule],
  controllers: [EventsController, EventFloorsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
