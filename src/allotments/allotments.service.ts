import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Allotment } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAllotmentDto } from './dto/create-allotment.dto';
import { UpdateAllotmentDto } from './dto/update-allotment.dto';

@Injectable()
export class AllotmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async create(eventId: string, dto: CreateAllotmentDto) {
    const event = await this.eventsService.findOne(eventId);

    const existing = await this.prisma.allotment.findUnique({
      where: { eventId_code: { eventId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Code "${dto.code}" already exists in this event`);
    }

    this.validateBounds(dto, event);

    const allotments = await this.prisma.allotment.findMany({ where: { eventId } });
    this.validateCollision(dto, allotments);

    return this.prisma.allotment.create({ data: { ...dto, eventId } });
  }

  async update(id: string, dto: UpdateAllotmentDto) {
    const allotment = await this.prisma.allotment.findUnique({ where: { id } });
    if (!allotment) throw new NotFoundException(`Allotment ${id} not found`);

    const event = await this.eventsService.findOne(allotment.eventId);

    const candidate = {
      x: dto.x ?? allotment.x,
      y: dto.y ?? allotment.y,
      width: dto.width ?? allotment.width,
      height: dto.height ?? allotment.height,
    };

    this.validateBounds(candidate, event);

    const siblings = await this.prisma.allotment.findMany({
      where: { eventId: allotment.eventId, id: { not: id } },
    });
    this.validateCollision(candidate, siblings);

    return this.prisma.allotment.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const allotment = await this.prisma.allotment.findUnique({ where: { id } });
    if (!allotment) throw new NotFoundException(`Allotment ${id} not found`);
    await this.prisma.allotment.delete({ where: { id } });
  }

  private validateBounds(
    a: { x: number; y: number; width: number; height: number },
    event: { pavilionWidth: number; pavilionHeight: number },
  ) {
    if (
      a.x < 0 ||
      a.y < 0 ||
      a.x + a.width > event.pavilionWidth ||
      a.y + a.height > event.pavilionHeight
    ) {
      throw new ConflictException('Allotment exceeds pavilion boundaries');
    }
  }

  private validateCollision(
    a: { x: number; y: number; width: number; height: number },
    others: Allotment[],
  ) {
    const collides = others.some(
      (b) =>
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y,
    );
    if (collides) throw new ConflictException('Allotment collides with an existing stand');
  }
}
