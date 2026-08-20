import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { UserRole } from '../../../generated/prisma/enums';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';

/*
 * Ranked so a higher role satisfies any lower requirement.
 */
const RANK: Record<UserRole, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole | undefined>(
      MIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    /*
     * No user means the route is public but still carries a role
     * requirement, which is a wiring mistake rather than a client error.
     */
    if (!user) {
      throw new ForbiddenException('Insufficient role');
    }

    if (RANK[user.role] < RANK[required]) {
      throw new ForbiddenException(
        `Requires ${required} role or higher; caller is ${user.role}`,
      );
    }

    return true;
  }
}
