import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Allotment } from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAllotmentDto } from './dto/create-allotment.dto';
import { UpdateAllotmentDto } from './dto/update-allotment.dto';
import { UpdateAllotmentPositionDto } from './dto/update-allotment-position.dto';
import { UpdateAllotmentStatusDto } from './dto/update-allotment-status.dto';

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponível',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
  BLOCKED: 'Bloqueado',
};

@Injectable()
export class AllotmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly activitiesService: ActivitiesService,
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

    const allotment = await this.prisma.allotment.create({ data: { ...dto, eventId } });
    await this.activitiesService.log(eventId, `Lote "${dto.code}" foi criado`, ActivityType.CREATED);
    return allotment;
  }

  findAllByEvent(eventId: string) {
    return this.prisma.allotment.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const allotment = await this.prisma.allotment.findUnique({ where: { id } });
    if (!allotment) throw new NotFoundException(`Allotment ${id} not found`);
    return allotment;
  }

  async update(id: string, dto: UpdateAllotmentDto) {
    const allotment = await this.findOne(id);
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

    const updated = await this.prisma.allotment.update({ where: { id }, data: dto });
    await this.activitiesService.log(allotment.eventId, `Lote "${allotment.code}" foi atualizado`, ActivityType.UPDATED);
    return updated;
  }

  async updatePosition(id: string, dto: UpdateAllotmentPositionDto) {
    const allotment = await this.findOne(id);
    const event = await this.eventsService.findOne(allotment.eventId);
    const candidate = { x: dto.x, y: dto.y, width: allotment.width, height: allotment.height };
    this.validateBounds(candidate, event);
    const siblings = await this.prisma.allotment.findMany({
      where: { eventId: allotment.eventId, id: { not: id } },
    });
    this.validateCollision(candidate, siblings);
    const updated = await this.prisma.allotment.update({ where: { id }, data: dto });
    await this.activitiesService.log(allotment.eventId, `Lote "${allotment.code}" teve posição ajustada`, ActivityType.UPDATED);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateAllotmentStatusDto) {
    const allotment = await this.findOne(id);
    const updated = await this.prisma.allotment.update({ where: { id }, data: dto });
    const activityType = ActivityType[dto.status as keyof typeof ActivityType];
    const statusLabel = STATUS_LABELS[dto.status] || dto.status;
    await this.activitiesService.log(allotment.eventId, `Lote "${allotment.code}" passou para ${statusLabel}`, activityType);
    return updated;
  }

  async remove(id: string) {
    const allotment = await this.findOne(id);
    await this.activitiesService.log(allotment.eventId, `Lote "${allotment.code}" foi removido`, ActivityType.DELETED);
    await this.prisma.allotment.delete({ where: { id } });
  }

  private validateBounds(
    a: { x: number; y: number; width: number; height: number },
    event: { canvasWidth: number; canvasHeight: number },
  ) {
    if (
      a.x < 0 ||
      a.y < 0 ||
      a.x + a.width > event.canvasWidth ||
      a.y + a.height > event.canvasHeight
    ) {
      throw new ConflictException('Allotment exceeds canvas boundaries');
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
