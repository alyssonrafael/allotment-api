import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, EventType } from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from '../venues/venues.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type EventStatus = 'upcoming' | 'active' | 'finished';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venuesService: VenuesService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async create(dto: CreateEventDto) {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be >= startDate');
    }
    const venue = await this.venuesService.findOne(dto.venueId);
    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        venueId: dto.venueId,
        canvasWidth: dto.canvasWidth ?? venue.width,
        canvasHeight: dto.canvasHeight ?? venue.height,
      },
      include: { venue: { select: { id: true, name: true } } },
    });
    await this.activitiesService.log(
      event.id,
      `Evento "${event.name}" foi criado`,
      ActivityType.CREATED,
    );
    return this.withStatus(event);
  }

  async findAll(filters: {
    venueId?: string;
    type?: EventType;
    status?: EventStatus;
  }) {
    const events = await this.prisma.event.findMany({
      where: {
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      orderBy: { startDate: 'asc' },
      include: {
        venue: { select: { id: true, name: true } },
        _count: { select: { allotments: true } },
      },
    });
    const withStatus = events.map((e) => this.withStatus(e));
    if (filters.status) {
      return withStatus.filter((e) => e.status === filters.status);
    }
    return withStatus;
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true, width: true, height: true } },
        allotments: true,
      },
    });
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return this.withStatus(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.findOne(id);
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    await this.activitiesService.log(
      id,
      `Evento "${event.name}" foi atualizado`,
      ActivityType.UPDATED,
    );
    return this.withStatus(event);
  }

  async remove(id: string) {
    const event = await this.findOne(id);
    await this.activitiesService.log(
      id,
      `Evento "${event.name}" foi removido`,
      ActivityType.DELETED,
    );
    await this.prisma.event.delete({ where: { id } });
  }

  async getRevenue(id: string) {
    await this.findOne(id);
    const groups = await this.prisma.allotment.groupBy({
      by: ['status'],
      where: { eventId: id },
      _sum: { price: true },
      _count: { id: true },
    });

    const byStatus = Object.fromEntries(
      groups.map((g) => [
        g.status,
        { sum: g._sum.price ?? 0, count: g._count.id },
      ]),
    );

    const realized = byStatus['SOLD']?.sum ?? 0;
    const inNegotiation = byStatus['RESERVED']?.sum ?? 0;

    return {
      realized,
      inNegotiation,
      total: realized + inNegotiation,
      counts: {
        sold: byStatus['SOLD']?.count ?? 0,
        reserved: byStatus['RESERVED']?.count ?? 0,
        available: byStatus['AVAILABLE']?.count ?? 0,
        blocked: byStatus['BLOCKED']?.count ?? 0,
      },
    };
  }

  async getActivities(id: string) {
    await this.findOne(id);
    return this.activitiesService.findRecent(id);
  }

  private computeStatus(start: Date, end: Date): EventStatus {
    const now = new Date();
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (now > endOfDay) return 'finished';
    if (now >= start) return 'active';
    return 'upcoming';
  }

  private withStatus<T extends { startDate: Date; endDate: Date }>(event: T) {
    return {
      ...event,
      status: this.computeStatus(event.startDate, event.endDate),
    };
  }
}
