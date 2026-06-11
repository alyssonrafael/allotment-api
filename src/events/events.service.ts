import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  AllotmentStatus,
  EventType,
  Prisma,
  VenueFloor,
} from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from '../venues/venues.service';
import { CreateEventFloorDto } from './dto/create-event-floor.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { SelectEventFloorDto } from './dto/select-event-floor.dto';
import { UpdateEventFloorDto } from './dto/update-event-floor.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type EventStatus = 'upcoming' | 'active' | 'finished';

const ALLOTMENT_STATUSES: AllotmentStatus[] = [
  AllotmentStatus.AVAILABLE,
  AllotmentStatus.RESERVED,
  AllotmentStatus.SOLD,
  AllotmentStatus.BLOCKED,
];

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
    const selectedFloors = this.resolveSelectedFloors(
      venue.floors,
      dto.selectedFloors,
      dto.canvasWidth,
      dto.canvasHeight,
    );
    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        venueId: dto.venueId,
        canvasWidth: selectedFloors[0].width,
        canvasHeight: selectedFloors[0].height,
        allowFloorDimensionChanges: dto.allowFloorDimensionChanges ?? true,
        defaultAllotmentPrice: dto.defaultAllotmentPrice,
        eventFloors: {
          create: selectedFloors.map((floor) => ({
            venueFloorId: floor.venueFloorId,
            name: floor.name,
            level: floor.level,
            width: floor.width,
            height: floor.height,
            sortOrder: floor.sortOrder,
          })),
        },
      },
      include: {
        venue: { select: { id: true, name: true } },
        eventFloors: { orderBy: { sortOrder: 'asc' } },
      },
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
        eventFloors: { orderBy: { sortOrder: 'asc' } },
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
        venue: {
          select: {
            id: true,
            name: true,
            width: true,
            height: true,
            floors: { orderBy: { sortOrder: 'asc' } },
          },
        },
        eventFloors: { orderBy: { sortOrder: 'asc' } },
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
    const { canvasWidth, canvasHeight, ...data } = dto;
    if (
      (canvasWidth !== undefined || canvasHeight !== undefined) &&
      !existing.allowFloorDimensionChanges
    ) {
      throw new ConflictException(
        'Event does not allow floor dimension changes',
      );
    }
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...data,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        canvasWidth,
        canvasHeight,
      },
      include: { eventFloors: { orderBy: { sortOrder: 'asc' } } },
    });
    if (canvasWidth || canvasHeight) {
      const firstFloor = event.eventFloors[0];
      if (firstFloor) {
        await this.updateFloor(firstFloor.id, {
          width: canvasWidth ?? firstFloor.width,
          height: canvasHeight ?? firstFloor.height,
        });
      }
    }
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

  async getRevenue(id: string, eventFloorId?: string) {
    await this.ensureEventFloorBelongsToEvent(id, eventFloorId);
    const groups = await this.prisma.allotment.groupBy({
      by: ['status'],
      where: { eventId: id, ...(eventFloorId ? { eventFloorId } : {}) },
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

  async getDashboard(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            width: true,
            height: true,
            floors: { orderBy: { sortOrder: 'asc' } },
          },
        },
        eventFloors: {
          orderBy: { sortOrder: 'asc' },
          include: { allotments: true },
        },
      },
    });
    if (!event) throw new NotFoundException(`Event ${id} not found`);

    const eventFloors = event.eventFloors.map(({ allotments, ...floor }) => floor);
    const allotments = event.eventFloors.flatMap((floor) => floor.allotments);
    const totals = this.buildTotals(event.eventFloors, allotments);
    const revenue = this.buildRevenue(allotments);

    return {
      event: this.withStatus({
        id: event.id,
        name: event.name,
        type: event.type,
        startDate: event.startDate,
        endDate: event.endDate,
        venueId: event.venueId,
        canvasWidth: event.canvasWidth,
        canvasHeight: event.canvasHeight,
        allowFloorDimensionChanges: event.allowFloorDimensionChanges,
        defaultAllotmentPrice: event.defaultAllotmentPrice,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        eventFloors,
      }),
      venue: event.venue,
      eventFloors,
      totals,
      revenue,
      statusCounts: revenue.counts,
      floors: event.eventFloors.map((floor) =>
        this.buildFloorDashboardSummary(floor, floor.allotments),
      ),
    };
  }

  async getFloorDashboard(eventFloorId: string) {
    const floor = await this.prisma.eventFloor.findUnique({
      where: { id: eventFloorId },
      include: {
        allotments: true,
        event: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
                floors: { orderBy: { sortOrder: 'asc' } },
              },
            },
            eventFloors: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!floor) {
      throw new NotFoundException(`EventFloor ${eventFloorId} not found`);
    }

    const { event, allotments, ...eventFloor } = floor;
    const totals = this.buildTotals([eventFloor], allotments);
    const revenue = this.buildRevenue(allotments);

    return {
      event: this.withStatus({
        id: event.id,
        name: event.name,
        type: event.type,
        startDate: event.startDate,
        endDate: event.endDate,
        venueId: event.venueId,
        canvasWidth: event.canvasWidth,
        canvasHeight: event.canvasHeight,
        allowFloorDimensionChanges: event.allowFloorDimensionChanges,
        defaultAllotmentPrice: event.defaultAllotmentPrice,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        eventFloors: event.eventFloors,
      }),
      venue: event.venue,
      eventFloor,
      totals,
      revenue,
      statusCounts: revenue.counts,
      allotments,
      heatmap: {
        width: eventFloor.width,
        height: eventFloor.height,
        allotments,
      },
    };
  }

  private async ensureEventFloorBelongsToEvent(
    eventId: string,
    eventFloorId?: string,
  ) {
    if (!eventFloorId) {
      await this.findOne(eventId);
      return;
    }

    const floor = await this.prisma.eventFloor.findUnique({
      where: { id: eventFloorId },
      select: { eventId: true },
    });
    if (!floor) {
      throw new NotFoundException(`EventFloor ${eventFloorId} not found`);
    }
    if (floor.eventId !== eventId) {
      throw new BadRequestException('eventFloorId does not belong to event');
    }
  }

  async findFloors(eventId: string) {
    await this.findOne(eventId);
    return this.prisma.eventFloor.findMany({
      where: { eventId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addFloor(eventId: string, dto: CreateEventFloorDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { eventFloors: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    const venueFloor = await this.prisma.venueFloor.findUnique({
      where: { id: dto.venueFloorId },
    });
    if (!venueFloor || venueFloor.venueId !== event.venueId) {
      throw new BadRequestException('venueFloorId does not belong to event venue');
    }

    const snapshot = this.buildEventFloorSnapshot(venueFloor, dto);
    try {
      return await this.prisma.eventFloor.create({
        data: { ...snapshot, eventId },
      });
    } catch (error) {
      this.throwUniqueConflict(error, 'Event already uses this floor level');
    }
  }

  async updateFloor(id: string, dto: UpdateEventFloorDto) {
    const floor = await this.prisma.eventFloor.findUnique({
      where: { id },
      include: {
        venueFloor: true,
        event: { include: { eventFloors: { orderBy: { sortOrder: 'asc' } } } },
        allotments: true,
      },
    });
    if (!floor) throw new NotFoundException(`EventFloor ${id} not found`);

    const nextWidth = dto.width ?? floor.width;
    const nextHeight = dto.height ?? floor.height;
    const dimensionChanged =
      nextWidth !== floor.width || nextHeight !== floor.height;
    if (dimensionChanged && !floor.event.allowFloorDimensionChanges) {
      throw new ConflictException(
        'Event does not allow floor dimension changes',
      );
    }
    if (
      floor.venueFloor &&
      (nextWidth > floor.venueFloor.width || nextHeight > floor.venueFloor.height)
    ) {
      throw new BadRequestException('Event floor exceeds venue floor dimensions');
    }

    const outOfBounds = floor.allotments.some(
      (allotment) =>
        allotment.x + allotment.width > nextWidth ||
        allotment.y + allotment.height > nextHeight,
    );
    if (outOfBounds) {
      throw new ConflictException('Event floor contains allotments outside new dimensions');
    }

    const updated = await this.prisma.eventFloor.update({
      where: { id },
      data: dto,
    });

    if (floor.event.eventFloors[0]?.id === id) {
      await this.prisma.event.update({
        where: { id: floor.eventId },
        data: { canvasWidth: updated.width, canvasHeight: updated.height },
      });
    }

    return updated;
  }

  async removeFloor(id: string) {
    const floor = await this.prisma.eventFloor.findUnique({
      where: { id },
      include: { _count: { select: { allotments: true } } },
    });
    if (!floor) throw new NotFoundException(`EventFloor ${id} not found`);
    if (floor._count.allotments > 0) {
      throw new ConflictException('Cannot delete event floor with allotments');
    }

    const floors = await this.prisma.eventFloor.findMany({
      where: { eventId: floor.eventId },
      orderBy: { sortOrder: 'asc' },
    });
    if (floors.length <= 1) {
      throw new ConflictException('Cannot delete the last event floor');
    }

    await this.prisma.eventFloor.delete({ where: { id } });

    if (floors[0]?.id === id) {
      const nextFloor = floors.find((candidate) => candidate.id !== id);
      if (nextFloor) {
        await this.prisma.event.update({
          where: { id: floor.eventId },
          data: { canvasWidth: nextFloor.width, canvasHeight: nextFloor.height },
        });
      }
    }
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
    const firstFloor = (
      event as T & { eventFloors?: Array<{ width: number; height: number }> }
    ).eventFloors?.[0];
    return {
      ...event,
      ...(firstFloor
        ? { canvasWidth: firstFloor.width, canvasHeight: firstFloor.height }
        : {}),
      status: this.computeStatus(event.startDate, event.endDate),
    };
  }

  private buildTotals(
    floors: Array<{ width: number; height: number }>,
    allotments: Array<{ width: number; height: number; price: number }>,
  ) {
    const area = floors.reduce((sum, floor) => sum + floor.width * floor.height, 0);
    const occupiedArea = allotments.reduce(
      (sum, allotment) => sum + allotment.width * allotment.height,
      0,
    );
    const revenuePotential = allotments.reduce(
      (sum, allotment) => sum + allotment.price,
      0,
    );

    return {
      area,
      occupiedArea,
      occupancy: area > 0 ? (occupiedArea / area) * 100 : 0,
      totalStands: allotments.length,
      revenuePotential,
    };
  }

  private buildRevenue(
    allotments: Array<{ status: AllotmentStatus; price: number }>,
  ) {
    const counts = this.emptyStatusCounts();
    const sums = this.emptyStatusSums();
    for (const allotment of allotments) {
      counts[this.statusKey(allotment.status)] += 1;
      sums[allotment.status] += allotment.price;
    }
    return {
      realized: sums[AllotmentStatus.SOLD],
      inNegotiation: sums[AllotmentStatus.RESERVED],
      total: sums[AllotmentStatus.SOLD] + sums[AllotmentStatus.RESERVED],
      counts,
    };
  }

  private buildFloorDashboardSummary<
    TFloor extends { width: number; height: number },
  >(
    floor: TFloor,
    allotments: Array<{ status: AllotmentStatus; width: number; height: number; price: number }>,
  ) {
    const totals = this.buildTotals([floor], allotments);
    const revenue = this.buildRevenue(allotments);
    return {
      ...floor,
      totals,
      revenue,
      statusCounts: revenue.counts,
    };
  }

  private emptyStatusCounts() {
    return {
      sold: 0,
      reserved: 0,
      available: 0,
      blocked: 0,
    };
  }

  private emptyStatusSums() {
    return Object.fromEntries(
      ALLOTMENT_STATUSES.map((status) => [status, 0]),
    ) as Record<AllotmentStatus, number>;
  }

  private statusKey(status: AllotmentStatus) {
    return status.toLowerCase() as keyof ReturnType<typeof this.emptyStatusCounts>;
  }

  private resolveSelectedFloors(
    venueFloors: VenueFloor[],
    selectedFloors: SelectEventFloorDto[] | undefined,
    legacyCanvasWidth?: number,
    legacyCanvasHeight?: number,
  ) {
    if (venueFloors.length === 0) {
      throw new BadRequestException('Venue must have at least one floor');
    }

    const selected =
      selectedFloors?.length
        ? selectedFloors
        : [
            {
              venueFloorId:
                venueFloors.find((floor) => floor.isDefault)?.id ??
                venueFloors[0].id,
              width: legacyCanvasWidth,
              height: legacyCanvasHeight,
            },
          ];

    const seen = new Set<string>();
    return selected.map((input, index) => {
      if (seen.has(input.venueFloorId)) {
        throw new BadRequestException('selectedFloors cannot contain duplicates');
      }
      seen.add(input.venueFloorId);
      const venueFloor = venueFloors.find((floor) => floor.id === input.venueFloorId);
      if (!venueFloor) {
        throw new BadRequestException('selectedFloors must belong to the venue');
      }
      return this.buildEventFloorSnapshot(venueFloor, input, index);
    });
  }

  private buildEventFloorSnapshot(
    venueFloor: VenueFloor,
    input: SelectEventFloorDto,
    fallbackSortOrder = venueFloor.sortOrder,
  ) {
    const width = input.width ?? venueFloor.width;
    const height = input.height ?? venueFloor.height;
    if (width > venueFloor.width || height > venueFloor.height) {
      throw new BadRequestException('Event floor exceeds venue floor dimensions');
    }
    return {
      venueFloorId: venueFloor.id,
      name: venueFloor.name,
      level: venueFloor.level,
      width,
      height,
      sortOrder: venueFloor.sortOrder ?? fallbackSortOrder,
    };
  }

  private throwUniqueConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
