import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      /*
       * An optional-auth route proceeds anonymously; the handler decides
       * what an unidentified caller is allowed to do.
       */
      if (isOptional) {
        return true;
      }

      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    /*
     * The token is proof of a past login, not of present standing. Without
     * this lookup a deactivated account keeps working until its token
     * expires, and a demoted user keeps the role baked into their token.
     *
     * The cost is one primary-key lookup per request, which buys immediate
     * effect for deactivation and role changes in place of a revocation
     * mechanism the service does not yet have.
     */
    const account = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!account) {
      throw new UnauthorizedException('Account no longer exists');
    }

    if (!account.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const user: AuthenticatedUser = {
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role,
    };

    request.user = user;

    /*
     * Middleware opened the request store before the token was known, so
     * the actor is attached here — this is what lets audit entries name a
     * user without every service taking one as an argument.
     */
    this.requestContext.setActor({
      userId: user.id,
      username: user.username,
    });

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    return scheme === 'Bearer' ? token : undefined;
  }
}
