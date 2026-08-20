import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

import {
  AuditAction,
  AuditEntity,
  UserRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  /*
   * A real hash of a throwaway secret, derived once and reused, so that a
   * login for a non-existent account costs the same as one for a real
   * account. A short placeholder would return far too quickly and leak
   * account existence through response time.
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwords.hash(randomBytes(32).toString('hex'));

    return this.dummyHash;
  }

  async register(dto: RegisterDto, actor?: AuthenticatedUser) {
    const userCount = await this.prisma.user.count();
    const isBootstrap = userCount === 0;

    /*
     * The first account bootstraps the system and becomes ADMIN. After
     * that, only an ADMIN may create accounts — open registration on an
     * incident-response tool would let anyone read live case data.
     */
    if (!isBootstrap && actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only an ADMIN may register additional users',
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const role = isBootstrap ? UserRole.ADMIN : (dto.role ?? UserRole.VIEWER);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          role,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.USER,
          entityId: user.id,
          description: `User registered: ${user.username}`,
          metadata: {
            role: user.role,
            bootstrap: isBootstrap,
          },
        },
        tx,
      );

      return this.toPublicUser(user);
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
      },
    });

    /*
     * The password is verified even when no user matched, so a missing
     * account and a wrong password take comparable time.
     */
    const valid = await this.passwords.verify(
      dto.password,
      user ? user.passwordHash : await this.getDummyHash(),
    );

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.toPublicUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return this.toPublicUser(user);
  }

  /*
   * Never let passwordHash escape the service layer.
   */
  private toPublicUser(user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
