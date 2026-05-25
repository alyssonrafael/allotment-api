import { Injectable } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async log(eventId: string, action: string, type: ActivityType) {
    await this.prisma.recentActivity.create({
      data: { eventId, action, type },
    });
  }

  async findRecent(eventId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.recentActivity.findMany({
      where: { eventId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, type: true, createdAt: true },
    });
  }
}
