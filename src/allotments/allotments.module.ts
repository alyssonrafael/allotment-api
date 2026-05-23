import { Module } from '@nestjs/common';
import { AllotmentsController } from './allotments.controller';
import { AllotmentsService } from './allotments.service';

@Module({
  controllers: [AllotmentsController],
  providers: [AllotmentsService],
})
export class AllotmentsModule {}
