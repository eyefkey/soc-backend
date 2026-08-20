import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    this.requestContext.run(
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      },
      () => next(),
    );
  }
}
