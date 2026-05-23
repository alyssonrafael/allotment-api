import { Controller } from '@nestjs/common';
import { AllotmentsService } from './allotments.service';

@Controller('allotments')
export class AllotmentsController {
  constructor(private readonly allotmentsService: AllotmentsService) {}
}
