import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEvidenceDto) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id: dto.incidentId,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return this.prisma.evidence.create({
      data: {
        type: dto.type,
        value: dto.value,
        description: dto.description,
        incidentId: dto.incidentId,
      },
    });
  }

  async findAll() {
    return this.prisma.evidence.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        incident: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.evidence.findUnique({
      where: {
        id,
      },
      include: {
        incident: true,
      },
    });
  }
}
