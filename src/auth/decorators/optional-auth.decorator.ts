import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/*
 * Verifies a bearer token when one is supplied but does not require it.
 *
 * Used by registration, which must stay reachable on an empty system to
 * create the first ADMIN, yet still needs to know who the caller is once
 * accounts exist.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
