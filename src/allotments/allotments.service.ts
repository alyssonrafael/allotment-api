import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { BulkCreateAllotmentsDto } from './dto/bulk-create-allotments.dto';
import { CreateAllotmentDto } from './dto/create-allotment.dto';
import { UpdateAllotmentFloorDto } from './dto/update-allotment-floor.dto';
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
    const eventFloor = this.resolveEventFloor(event, dto.eventFloorId);
    const price = dto.price ?? event.defaultAllotmentPrice ?? 0;
    const candidate = { ...dto, price };

    const existing = await this.prisma.allotment.findUnique({
      where: { eventId_code: { eventId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(
        `Code "${dto.code}" already exists in this event`,
      );
    }

    this.validateBounds(candidate, eventFloor);

    const allotments = await this.prisma.allotment.findMany({
      where: { eventFloorId: eventFloor.id },
    });
    this.validateCollision(candidate, allotments);

    const { eventFloorId: _eventFloorId, ...data } = dto;
    const allotment = await this.prisma.allotment.create({
      data: { ...data, price, eventId, eventFloorId: eventFloor.id },
    });
    await this.activitiesService.log(
      eventId,
      `Lote "${dto.code}" foi criado`,
      ActivityType.CREATED,
    );
    return allotment;
  }

  async bulkCreate(eventId: string, dto: BulkCreateAllotmentsDto) {
    const event = await this.eventsService.findOne(eventId);
    const codes = new Set<string>();
    const prepared = dto.allotments.map((item) => {
      if (codes.has(item.code)) {
        throw new ConflictException(`Code "${item.code}" is duplicated in payload`);
      }
      codes.add(item.code);
      const eventFloor = this.resolveEventFloor(event, item.eventFloorId);
      const price = item.price ?? event.defaultAllotmentPrice ?? 0;
      const candidate = { ...item, price };
      this.validateBounds(candidate, eventFloor);
      const { eventFloorId: _eventFloorId, ...data } = item;
      return { ...data, price, eventId, eventFloorId: eventFloor.id };
    });

    const existingCodes = await this.prisma.allotment.findMany({
      where: { eventId, code: { in: Array.from(codes) } },
      select: { code: true },
    });
    if (existingCodes.length > 0) {
      throw new ConflictException(
        `Code "${existingCodes[0].code}" already exists in this event`,
      );
    }

    for (const eventFloorId of new Set(prepared.map((item) => item.eventFloorId))) {
      const existing = await this.prisma.allotment.findMany({
        where: { eventFloorId },
      });
      const candidates = prepared.filter((item) => item.eventFloorId === eventFloorId);
      candidates.forEach((candidate, index) => {
        this.validateCollision(candidate, [
          ...existing,
          ...candidates.slice(0, index),
        ]);
      });
    }

    const created = await this.prisma.$transaction(
      prepared.map((data) => this.prisma.allotment.create({ data })),
    );
    await this.activitiesService.log(
      eventId,
      `${created.length} lote(s) foram criados`,
      ActivityType.CREATED,
    );
    return created;
  }

  async findAllByEvent(eventId: string, eventFloorId?: string) {
    await this.eventsService.findOne(eventId);
    return this.prisma.allotment.findMany({
      where: { eventId, ...(eventFloorId ? { eventFloorId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const allotment = await this.prisma.allotment.findUnique({ where: { id } });
    if (!allotment) throw new NotFoundException(`Allotment ${id} not found`);
    return allotment;
  }

  async update(id: string, dto: UpdateAllotmentDto) {
    const allotment = await this.findOne(id);
    const event = await this.eventsService.findOne(allotment.eventId);
    const eventFloor = this.resolveEventFloor(
      event,
      dto.eventFloorId ?? allotment.eventFloorId,
    );

    const candidate = {
      x: dto.x ?? allotment.x,
      y: dto.y ?? allotment.y,
      width: dto.width ?? allotment.width,
      height: dto.height ?? allotment.height,
    };

    this.validateBounds(candidate, eventFloor);

    const siblings = await this.prisma.allotment.findMany({
      where: { eventFloorId: eventFloor.id, id: { not: id } },
    });
    this.validateCollision(candidate, siblings);

    const updated = await this.prisma.allotment.update({
      where: { id },
      data: dto,
    });
    await this.activitiesService.log(
      allotment.eventId,
      `Lote "${allotment.code}" foi atualizado`,
      ActivityType.UPDATED,
    );
    return updated;
  }

  async updatePosition(id: string, dto: UpdateAllotmentPositionDto) {
    const allotment = await this.findOne(id);
    const event = await this.eventsService.findOne(allotment.eventId);
    const eventFloor = this.resolveEventFloor(event, allotment.eventFloorId);
    const candidate = {
      x: dto.x,
      y: dto.y,
      width: allotment.width,
      height: allotment.height,
    };
    this.validateBounds(candidate, eventFloor);
    const siblings = await this.prisma.allotment.findMany({
      where: { eventFloorId: eventFloor.id, id: { not: id } },
    });
    this.validateCollision(candidate, siblings);
    const updated = await this.prisma.allotment.update({
      where: { id },
      data: dto,
    });
    await this.activitiesService.log(
      allotment.eventId,
      `Lote "${allotment.code}" teve posição ajustada`,
      ActivityType.UPDATED,
    );
    return updated;
  }

  async updateFloor(id: string, dto: UpdateAllotmentFloorDto) {
    const allotment = await this.findOne(id);
    const event = await this.eventsService.findOne(allotment.eventId);
    const eventFloor = this.resolveEventFloor(event, dto.eventFloorId);
    const candidate = {
      x: allotment.x,
      y: allotment.y,
      width: allotment.width,
      height: allotment.height,
    };
    this.validateBounds(candidate, eventFloor);
    const siblings = await this.prisma.allotment.findMany({
      where: { eventFloorId: eventFloor.id, id: { not: id } },
    });
    this.validateCollision(candidate, siblings);
    const updated = await this.prisma.allotment.update({
      where: { id },
      data: { eventFloorId: eventFloor.id },
    });
    await this.activitiesService.log(
      allotment.eventId,
      `Lote "${allotment.code}" foi movido de andar`,
      ActivityType.UPDATED,
    );
    return updated;
  }

  async updateStatus(id: string, dto: UpdateAllotmentStatusDto) {
    const allotment = await this.findOne(id);
    const updated = await this.prisma.allotment.update({
      where: { id },
      data: dto,
    });
    const activityType = ActivityType[dto.status as keyof typeof ActivityType];
    const statusLabel = STATUS_LABELS[dto.status] || dto.status;
    await this.activitiesService.log(
      allotment.eventId,
      `Lote "${allotment.code}" passou para ${statusLabel}`,
      activityType,
    );
    return updated;
  }

  async remove(id: string) {
    const allotment = await this.findOne(id);
    await this.activitiesService.log(
      allotment.eventId,
      `Lote "${allotment.code}" foi removido`,
      ActivityType.DELETED,
    );
    await this.prisma.allotment.delete({ where: { id } });
  }

  private validateBounds(
    a: { x: number; y: number; width: number; height: number },
    eventFloor: { width: number; height: number },
  ) {
    if (
      a.x < 0 ||
      a.y < 0 ||
      a.x + a.width > eventFloor.width ||
      a.y + a.height > eventFloor.height
    ) {
      throw new ConflictException('Allotment exceeds floor boundaries');
    }
  }

  private validateCollision(
    a: { x: number; y: number; width: number; height: number },
    others: Array<{ x: number; y: number; width: number; height: number }>,
  ) {
    const collides = others.some(
      (b) =>
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y,
    );
    if (collides)
      throw new ConflictException('Allotment collides with an existing stand');
  }

  private resolveEventFloor(
    event: { eventFloors?: Array<{ id: string; width: number; height: number }> },
    eventFloorId?: string,
  ) {
    const eventFloors = event.eventFloors ?? [];
    if (eventFloorId) {
      const eventFloor = eventFloors.find((floor) => floor.id === eventFloorId);
      if (!eventFloor) {
        throw new ConflictException('eventFloorId does not belong to this event');
      }
      return eventFloor;
    }
    if (eventFloors.length === 1) return eventFloors[0];
    throw new ConflictException('eventFloorId is required for events with multiple floors');
  }
}
