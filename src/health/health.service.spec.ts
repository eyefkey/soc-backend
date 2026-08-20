import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  const build = async (queryRaw: jest.Mock) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: queryRaw },
        },
      ],
    }).compile();

    return module.get<HealthService>(HealthService);
  };

  it('reports liveness without touching the database', async () => {
    const queryRaw = jest.fn();
    const service = await build(queryRaw);

    expect(service.live().status).toBe('ok');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness when the database answers', async () => {
    const service = await build(
      jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    );

    await expect(service.ready()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
  });

  it('returns 503 when the database is unreachable', async () => {
    const service = await build(jest.fn().mockRejectedValue(new Error('down')));

    await expect(service.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
