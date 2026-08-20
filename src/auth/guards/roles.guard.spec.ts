import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../../generated/prisma/enums';

const contextFor = (role?: UserRole) =>
  ({
    switchToHttp: () => ({
      getRequest: () => (role ? { user: { role } } : {}),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const guardRequiring = (required?: UserRole) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;

    return new RolesGuard(reflector);
  };

  it('allows a route with no role requirement', () => {
    expect(guardRequiring(undefined).canActivate(contextFor())).toBe(true);
  });

  it('allows an exact role match', () => {
    expect(
      guardRequiring(UserRole.ANALYST).canActivate(
        contextFor(UserRole.ANALYST),
      ),
    ).toBe(true);
  });

  it('allows a higher role to satisfy a lower requirement', () => {
    expect(
      guardRequiring(UserRole.ANALYST).canActivate(contextFor(UserRole.ADMIN)),
    ).toBe(true);
  });

  it('rejects a lower role', () => {
    expect(() =>
      guardRequiring(UserRole.ANALYST).canActivate(contextFor(UserRole.VIEWER)),
    ).toThrow(ForbiddenException);
  });

  it('rejects an anonymous caller on a role-guarded route', () => {
    expect(() =>
      guardRequiring(UserRole.VIEWER).canActivate(contextFor()),
    ).toThrow(ForbiddenException);
  });
});
