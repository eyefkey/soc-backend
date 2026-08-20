import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateAssetDto) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          name: dto.name,
          type: dto.type,
          status: dto.status,
          hostname: dto.hostname,
          ipAddress: dto.ipAddress,
          description: dto.description,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.ASSET,
          entityId: asset.id,
          description: `Asset registered: ${asset.name}`,
          metadata: {
            assetType: asset.type,
            status: asset.status,
            hostname: asset.hostname,
            ipAddress: asset.ipAddress,
          },
        },
        tx,
      );

      return asset;
    });
  }

  async findAll(query: QueryAssetsDto) {
    const { skip = 0, take = 25, type, status, ipAddress } = query;

    const where = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: {
        id,
      },
      include: {
        incidents: {
          include: {
            incident: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async update(id: string, dto: UpdateAssetDto) {
    const existing = await this.prisma.asset.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== existing.status;

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({
        where: {
          id,
        },
        data: dto,
      });

      /*
       * Marking an asset COMPROMISED is a security event in its own right,
       * so status changes are recorded distinctly from ordinary edits.
       */
      await this.audit.create(
        statusChanged
          ? {
              action: AuditAction.STATUS_CHANGED,
              entity: AuditEntity.ASSET,
              entityId: asset.id,
              description: `Asset status changed: ${existing.status} to ${asset.status}`,
              metadata: {
                from: existing.status,
                to: asset.status,
              },
            }
          : {
              action: AuditAction.UPDATED,
              entity: AuditEntity.ASSET,
              entityId: asset.id,
              description: `Asset updated: ${asset.name}`,
              metadata: {
                fields: Object.keys(dto),
              },
            },
        tx,
      );

      return asset;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.asset.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.delete({
        where: {
          id,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.DELETED,
          entity: AuditEntity.ASSET,
          entityId: asset.id,
          description: `Asset deleted: ${asset.name}`,
        },
        tx,
      );

      return asset;
    });
  }

  async attachToIncident(assetId: string, incidentId: string) {
    const { asset } = await this.assertPairExists(assetId, incidentId);

    const existing = await this.prisma.incidentAsset.findUnique({
      where: {
        incidentId_assetId: {
          incidentId,
          assetId,
        },
      },
      include: {
        asset: true,
        incident: true,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.incidentAsset.create({
        data: {
          assetId,
          incidentId,
        },
        include: {
          asset: true,
          incident: true,
        },
      });

      /*
       * Recorded against the incident: asset attachment has no record of
       * its own in the timeline, so the audit entry is what surfaces it.
       */
      await this.audit.create(
        {
          action: AuditAction.ATTACHED,
          entity: AuditEntity.INCIDENT,
          entityId: incidentId,
          description: `Asset attached: ${asset.name}`,
          metadata: {
            assetId,
            assetName: asset.name,
            ipAddress: asset.ipAddress,
          },
        },
        tx,
      );

      return link;
    });
  }

  async detachFromIncident(assetId: string, incidentId: string) {
    const { asset } = await this.assertPairExists(assetId, incidentId);

    const link = await this.prisma.incidentAsset.findUnique({
      where: {
        incidentId_assetId: {
          incidentId,
          assetId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Asset is not attached to this incident');
    }

    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.incidentAsset.delete({
        where: {
          incidentId_assetId: {
            incidentId,
            assetId,
          },
        },
      });

      await this.audit.create(
        {
          action: AuditAction.DETACHED,
          entity: AuditEntity.INCIDENT,
          entityId: incidentId,
          description: `Asset detached: ${asset.name}`,
          metadata: {
            assetId,
            assetName: asset.name,
          },
        },
        tx,
      );

      return removed;
    });
  }

  private async assertPairExists(assetId: string, incidentId: string) {
    const [asset, incident] = await Promise.all([
      this.prisma.asset.findUnique({
        where: {
          id: assetId,
        },
      }),
      this.prisma.incident.findUnique({
        where: {
          id: incidentId,
        },
      }),
    ]);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return { asset, incident };
  }
}
