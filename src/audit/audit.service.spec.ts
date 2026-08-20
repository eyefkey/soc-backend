import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context/request-context.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditAction, AuditEntity } from '../../generated/prisma/enums';

describe('AuditService', () => {
  let service: AuditService;
  let create: jest.Mock;
  let context: { get: jest.Mock };

  beforeEach(async () => {
    create = jest
      .fn()
      .mockImplementation(
        (args: { data: Record<string, unknown> }) => args.data,
      );
    context = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: { auditLog: { create } },
        },
        {
          provide: RequestContextService,
          useValue: context,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  /*
   * Reads the row that was actually handed to Prisma, rather than nesting
   * asymmetric matchers, which keeps the assertions typed.
   */
  const writtenRow = (): Record<string, unknown> => {
    const [args] = create.mock.calls[0] as [{ data: Record<string, unknown> }];

    return args.data;
  };

  const entry = (over: Partial<CreateAuditLogDto> = {}): CreateAuditLogDto => ({
    action: AuditAction.CREATED,
    entity: AuditEntity.INCIDENT,
    entityId: 'i1',
    ...over,
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('attributes the entry to the current request actor', async () => {
    context.get.mockReturnValue({
      ipAddress: '10.1.1.1',
      userAgent: 'curl/8',
      actor: { userId: 'u1', username: 'analyst' },
    });

    await service.create(entry());

    expect(writtenRow()).toMatchObject({
      userId: 'u1',
      username: 'analyst',
      ipAddress: '10.1.1.1',
      userAgent: 'curl/8',
    });
  });

  it('leaves attribution empty when there is no request context', async () => {
    await service.create(entry());

    const row = writtenRow();

    expect(row.userId).toBeUndefined();
    expect(row.username).toBeUndefined();
  });

  it('lets an explicit value override the ambient context', async () => {
    context.get.mockReturnValue({
      actor: { userId: 'u1', username: 'analyst' },
    });

    await service.create(entry({ userId: 'backfill', username: 'importer' }));

    expect(writtenRow()).toMatchObject({
      userId: 'backfill',
      username: 'importer',
    });
  });
});
