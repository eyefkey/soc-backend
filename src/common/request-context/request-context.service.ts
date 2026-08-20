import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestActor {
  userId: string;
  username: string;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  actor?: RequestActor;
}

/*
 * Carries the caller's identity alongside the request without threading it
 * through every service signature.
 *
 * The store is created by RequestContextMiddleware (which runs before the
 * guards, so the actor is not known yet) and filled in by JwtAuthGuard once
 * the token has been verified. AuditService reads it to attribute entries.
 */
@Injectable()
export class RequestContextService {
  private static readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return RequestContextService.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return RequestContextService.storage.getStore();
  }

  setActor(actor: RequestActor) {
    const store = this.get();

    if (store) {
      store.actor = actor;
    }
  }
}
