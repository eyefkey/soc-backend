import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAlertDto: CreateAlertDto) {
    if (createAlertDto.incidentId) {
      const incident = await this.prisma.incident.findUnique({
        where: {
          id: createAlertDto.incidentId,
        },
      });

      if (!incident) {
        throw new NotFoundException('Incident not found');
      }
    }

    return this.prisma.alert.create({
      data: {
        title: createAlertDto.title,
        description: createAlertDto.description,
        severity: createAlertDto.severity,
        source: createAlertDto.source,
        sourceIp: createAlertDto.sourceIp,
        targetIp: createAlertDto.targetIp,
        incidentId: createAlertDto.incidentId,
      },
    });
  }

  async findAll() {
    return this.prisma.alert.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        incident: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.alert.findUnique({
      where: {
        id,
      },
      include: {
        incident: true,
      },
    });
  }
}
