import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../../generated/prisma/enums';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (client: typeof prisma) => unknown) =>
          fn(prisma),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('token') },
        },
        {
          provide: AuditService,
          useValue: { create: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  const asCreated = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'a@b.c',
    username: 'analyst',
    role: UserRole.VIEWER,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    passwordHash: 'x',
    ...over,
  });

  it('promotes the first account to ADMIN', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockImplementation(
      (args: { data: { role: UserRole } }) =>
        asCreated({ role: args.data.role }),
    );

    const user = await service.register({
      email: 'a@b.c',
      username: 'first',
      password: 'a-long-enough-password',
    });

    expect(user.role).toBe(UserRole.ADMIN);
  });

  it('refuses anonymous registration once an account exists', async () => {
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.register({
        email: 'a@b.c',
        username: 'second',
        password: 'a-long-enough-password',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses registration by a non-ADMIN', async () => {
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.register(
        {
          email: 'a@b.c',
          username: 'second',
          password: 'a-long-enough-password',
        },
        {
          id: 'u2',
          username: 'analyst',
          email: 'x@y.z',
          role: UserRole.ANALYST,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('defaults an ADMIN-created account to VIEWER', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.create.mockImplementation(
      (args: { data: { role: UserRole } }) =>
        asCreated({ role: args.data.role }),
    );

    const user = await service.register(
      {
        email: 'a@b.c',
        username: 'second',
        password: 'a-long-enough-password',
      },
      { id: 'u2', username: 'boss', email: 'x@y.z', role: UserRole.ADMIN },
    );

    expect(user.role).toBe(UserRole.VIEWER);
  });

  it('never returns the password hash', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockImplementation(
      (args: { data: { role: UserRole } }) =>
        asCreated({ role: args.data.role }),
    );

    const user = await service.register({
      email: 'a@b.c',
      username: 'first',
      password: 'a-long-enough-password',
    });

    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects login for an unknown account', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ identifier: 'nobody', password: 'whatever-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for a disabled account', async () => {
    const passwords = new PasswordService();
    const passwordHash = await passwords.hash('a-long-enough-password');

    prisma.user.findFirst.mockResolvedValue(
      asCreated({ passwordHash, isActive: false }),
    );

    await expect(
      service.login({
        identifier: 'analyst',
        password: 'a-long-enough-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a token on a valid login', async () => {
    const passwords = new PasswordService();
    const passwordHash = await passwords.hash('a-long-enough-password');

    prisma.user.findFirst.mockResolvedValue(asCreated({ passwordHash }));

    const result = await service.login({
      identifier: 'analyst',
      password: 'a-long-enough-password',
    });

    expect(result.accessToken).toBe('token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
