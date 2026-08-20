import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { AuditEntity } from '../../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { RequestContextService } from '../common/request-context/request-context.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

/*
 * Either the request-scoped Prisma client or an active transaction client.
 *
 * Audit writes are passed the surrounding transaction so an entry can never
 * be committed without the change it describes, and vice versa.
 */
type AuditWriter = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateAuditLogDto, client: AuditWriter = this.prisma) {
    /*
     * Identity and request metadata come from the ambient request context
     * so callers do not have to thread them through. An explicit value on
     * the DTO still wins, which keeps the endpoint usable for backfills.
     */
    const context = this.requestContext.get();

    return client.auditLog.create({
      data: {
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId,
        userId: dto.userId ?? context?.actor?.userId,
        username: dto.username ?? context?.actor?.username,
        description: dto.description,
        ipAddress: dto.ipAddress ?? context?.ipAddress,
        userAgent: dto.userAgent ?? context?.userAgent,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async findAll(query: QueryAuditDto) {
    const { skip = 0, take = 25, entity, action, entityId, userId } = query;

    const where = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  async findByEntity(entity: AuditEntity, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
