import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/enums';

export const MIN_ROLE_KEY = 'minRole';

/*
 * Requires the caller to hold at least this role. Roles are ranked
 * VIEWER < ANALYST < ADMIN, so a higher role always satisfies a lower
 * requirement without having to list every role on every route.
 */
export const MinRole = (role: UserRole) => SetMetadata(MIN_ROLE_KEY, role);
