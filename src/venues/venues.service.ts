import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueFloorDto } from './dto/create-venue-floor.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueFloorDto } from './dto/update-venue-floor.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateVenueDto) {
    const floors = this.resolveCreateFloors(dto);
    const defaultFloor = this.pickDefaultFloor(floors);
    const { floors: _floors, width, height, ...venueData } = dto;

    return this.prisma.venue.create({
      data: {
        ...venueData,
        width: width ?? defaultFloor.width,
        height: height ?? defaultFloor.height,
        floors: {
          create: floors.map((floor, index) => ({
            ...floor,
            sortOrder: floor.sortOrder ?? index,
            isDefault: floor.level === defaultFloor.level,
          })),
        },
      },
      include: { floors: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  findAll() {
    return this.prisma.venue.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        floors: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { events: true } },
      },
    });
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: {
        floors: { orderBy: { sortOrder: 'asc' } },
        events: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
    });
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto) {
    const existing = await this.findOne(id);
    const { floors: _floors, ...data } = dto;
    await this.prisma.venue.update({
      where: { id },
      data,
    });

    if (dto.width || dto.height) {
      const defaultFloor = existing.floors.find((floor) => floor.isDefault);
      if (defaultFloor) {
        await this.prisma.venueFloor.update({
          where: { id: defaultFloor.id },
          data: {
            width: dto.width ?? defaultFloor.width,
            height: dto.height ?? defaultFloor.height,
          },
        });
      }
    }

    return this.findOne(id);
  }

  async getRevenue(id: string) {
    await this.findOne(id);
    const groups = await this.prisma.allotment.groupBy({
      by: ['status'],
      where: { event: { venueId: id } },
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

  async remove(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    if (venue._count.events > 0) {
      throw new ConflictException('Cannot delete venue with existing events');
    }
    await this.prisma.venue.delete({ where: { id } });
  }

  async createFloor(venueId: string, dto: CreateVenueFloorDto) {
    await this.findOne(venueId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.venueFloor.updateMany({
            where: { venueId },
            data: { isDefault: false },
          });
          await tx.venue.update({
            where: { id: venueId },
            data: { width: dto.width, height: dto.height },
          });
        }

        return tx.venueFloor.create({
          data: {
            venueId,
            name: dto.name,
            level: dto.level,
            width: dto.width,
            height: dto.height,
            sortOrder: dto.sortOrder ?? dto.level,
            isDefault: dto.isDefault ?? false,
          },
        });
      });
    } catch (error) {
      this.throwFloorConflict(error, 'Venue floor level already exists');
    }
  }

  async updateFloor(id: string, dto: UpdateVenueFloorDto) {
    const floor = await this.prisma.venueFloor.findUnique({ where: { id } });
    if (!floor) throw new NotFoundException(`VenueFloor ${id} not found`);
    if (dto.isDefault === false && floor.isDefault) {
      throw new BadRequestException('Venue must have one default floor');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.venueFloor.updateMany({
            where: { venueId: floor.venueId },
            data: { isDefault: false },
          });
        }

        const updated = await tx.venueFloor.update({
          where: { id },
          data: dto,
        });

        if (updated.isDefault) {
          await tx.venue.update({
            where: { id: updated.venueId },
            data: { width: updated.width, height: updated.height },
          });
        }

        return updated;
      });
    } catch (error) {
      this.throwFloorConflict(error, 'Venue floor level already exists');
    }
  }

  async removeFloor(id: string) {
    const floor = await this.prisma.venueFloor.findUnique({ where: { id } });
    if (!floor) throw new NotFoundException(`VenueFloor ${id} not found`);

    const floors = await this.prisma.venueFloor.findMany({
      where: { venueId: floor.venueId },
      orderBy: { sortOrder: 'asc' },
    });
    if (floors.length <= 1) {
      throw new ConflictException('Cannot delete the last venue floor');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.venueFloor.delete({ where: { id } });
      if (floor.isDefault) {
        const nextDefault = floors.find((candidate) => candidate.id !== id);
        if (nextDefault) {
          await tx.venueFloor.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
          await tx.venue.update({
            where: { id: floor.venueId },
            data: { width: nextDefault.width, height: nextDefault.height },
          });
        }
      }
    });
  }

  private resolveCreateFloors(dto: CreateVenueDto): CreateVenueFloorDto[] {
    if (dto.floors?.length) {
      this.assertUniqueLevels(dto.floors);
      return dto.floors;
    }
    if (!dto.width || !dto.height) {
      throw new BadRequestException(
        'width and height are required when floors is not provided',
      );
    }
    return [
      {
        name: 'Térreo',
        level: 0,
        width: dto.width,
        height: dto.height,
        sortOrder: 0,
        isDefault: true,
      },
    ];
  }

  private pickDefaultFloor(floors: CreateVenueFloorDto[]) {
    const defaults = floors.filter((floor) => floor.isDefault);
    if (defaults.length > 1) {
      throw new BadRequestException('Only one venue floor can be default');
    }
    return defaults[0] ?? floors.find((floor) => floor.level === 0) ?? floors[0];
  }

  private assertUniqueLevels(floors: CreateVenueFloorDto[]) {
    const levels = new Set<number>();
    for (const floor of floors) {
      if (levels.has(floor.level)) {
        throw new BadRequestException('Venue floor levels must be unique');
      }
      levels.add(floor.level);
    }
  }

  private throwFloorConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
