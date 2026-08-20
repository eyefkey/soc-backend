import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateFindingDto } from './dto/create-finding.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
  investigationId: string,
  dto: CreateFindingDto,
) {
  const investigation =
    await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
    });

  if (!investigation) {
    throw new NotFoundException(
      'Investigation not found',
    );
  }

  return this.prisma.finding.create({
    data: {
      investigationId,
      title: dto.title,
      description: dto.description,
      confidence: dto.confidence,
      impact: dto.impact,
      recommendation: dto.recommendation,
    },
  });
}

  async findAll() {
    return this.prisma.finding.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByInvestigation(
    investigationId: string,
  ) {
    return this.prisma.finding.findMany({
      where: {
        investigationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const finding =
      await this.prisma.finding.findUnique({
        where: {
          id,
        },
      });

    if (!finding) {
      throw new NotFoundException(
        'Finding not found',
      );
    }

    return finding;
  }

  async update(
  investigationId: string,
  findingId: string,
  dto: UpdateFindingDto,
) {
  const finding =
    await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        investigationId,
      },
    });

  if (!finding) {
    throw new NotFoundException(
      'Finding not found',
    );
  }

  return this.prisma.finding.update({
    where: {
      id: findingId,
    },
    data: dto,
  });
}

async remove(
  investigationId: string,
  findingId: string,
) {
  const finding =
    await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        investigationId,
      },
    });

  if (!finding) {
    throw new NotFoundException(
      'Finding not found',
    );
  }

  return this.prisma.finding.delete({
    where: {
      id: findingId,
    },
  });
  }
}
