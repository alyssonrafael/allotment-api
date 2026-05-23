import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AllotmentsController } from './allotments.controller';
import { AllotmentsService } from './allotments.service';

@Module({
  imports: [EventsModule],
  controllers: [AllotmentsController],
  providers: [AllotmentsService],
})
export class AllotmentsModule {}
