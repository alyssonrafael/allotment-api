import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { EventsModule } from '../events/events.module';
import { AllotmentsController } from './allotments.controller';
import { AllotmentsService } from './allotments.service';

@Module({
  imports: [EventsModule, ActivitiesModule],
  controllers: [AllotmentsController],
  providers: [AllotmentsService],
})
export class AllotmentsModule {}
