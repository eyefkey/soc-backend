import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('AssetsService', () => {
  let service: AssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('passes monitoredUrl through to the asset record, so the uptime checker can find it via GET /assets', async () => {
      type Tx = {
        asset: { create: (args: unknown) => Promise<{ id: string }> };
      };

      const assetCreate = jest.fn<Promise<{ id: string }>, [unknown]>();
      assetCreate.mockResolvedValue({ id: 'asset-1' });
      const tx: Tx = { asset: { create: assetCreate } };
      const prismaMock = {
        $transaction: (fn: (tx: Tx) => unknown) => fn(tx),
      };
      const auditMock = { create: jest.fn().mockResolvedValue(undefined) };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AssetsService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: AuditService, useValue: auditMock },
        ],
      }).compile();

      const testService = module.get<AssetsService>(AssetsService);

      await testService.create({
        name: 'checker-smoke-site',
        type: 'SERVER',
        monitoredUrl: 'https://example.com',
      });

      expect(assetCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          monitoredUrl: 'https://example.com',
        }) as unknown,
      });
    });
  });
});
