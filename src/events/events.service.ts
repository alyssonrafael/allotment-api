import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: { ...dto, date: new Date(dto.date) },
    });
  }

  findAll() {
    return this.prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { allotments: true } } },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { allotments: true },
    });
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }
}
