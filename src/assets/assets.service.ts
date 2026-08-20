import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status,
        hostname: dto.hostname,
        ipAddress: dto.ipAddress,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.asset.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: {
        id,
      },
    });

    if (!asset) {
      throw new NotFoundException(
        'Asset not found',
      );
    }

    return asset;
  }
 async attachToIncident(
   assetId: string,
   incidentId: string,
 )  {
   const asset = await this.prisma.asset.findUnique({
     where: {
       id: assetId,
    },
  });

  if (!asset) {
    throw new NotFoundException('Asset not found');
  }

  const incident = await this.prisma.incident.findUnique({
    where: {
      id: incidentId,
    },
  });

  if (!incident) {
    throw new NotFoundException('Incident not found');
  }

  return this.prisma.incidentAsset.create({
    data: {
      assetId,
      incidentId,
    },
    include: {
      asset: true,
      incident: true,
    },
  });
}

}
