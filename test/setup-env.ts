import { E2E_DATABASE_URL } from './e2e-database';

/*
 * Runs in every worker before the app is imported. global-setup.ts has
 * already created and migrated the database these point at.
 */
process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.JWT_SECRET = 'e2e-signing-key-not-used-outside-tests';
process.env.JWT_EXPIRES_IN = '5m';

/*
 * Off by default so setup logins do not exhaust the allowance; the
 * throttling suite turns it back on for the requests it asserts against.
 */
process.env.THROTTLE_DISABLED = 'true';
