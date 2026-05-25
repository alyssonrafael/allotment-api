import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateVenueDto) {
    return this.prisma.venue.create({ data: dto });
  }

  findAll() {
    return this.prisma.venue.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { events: true } } },
    });
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: { events: { select: { id: true, name: true, startDate: true, endDate: true } } },
    });
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto) {
    await this.findOne(id);
    return this.prisma.venue.update({ where: { id }, data: dto });
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
      groups.map((g) => [g.status, { sum: g._sum.price ?? 0, count: g._count.id }]),
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
}
