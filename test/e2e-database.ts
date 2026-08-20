/*
 * End-to-end tests run against their own database so a run can never touch
 * development data. The name is fixed rather than random so a crashed run
 * leaves something inspectable instead of orphaning databases.
 */
const BASE =
  process.env.E2E_DATABASE_URL ??
  'postgresql://soc:password@localhost:5432/soc_e2e?schema=public';

export const E2E_DATABASE_URL = BASE;

export const E2E_DATABASE_NAME = new URL(BASE).pathname.replace(/^\//, '');

export const ADMIN_DATABASE_URL = (() => {
  const url = new URL(BASE);
  url.pathname = '/postgres';
  return url.toString();
})();
