import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

import {
  ADMIN_DATABASE_URL,
  E2E_DATABASE_NAME,
  E2E_DATABASE_URL,
} from './e2e-database';

/*
 * Creates the end-to-end database if it is missing and brings it up to the
 * current schema, so a run never depends on the state left by the last one.
 *
 * Requires a reachable PostgreSQL instance — `docker compose up postgres`.
 */
export default async function globalSetup() {
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL });

  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach PostgreSQL for end-to-end tests at ${ADMIN_DATABASE_URL}. ` +
        `Start it with \`docker compose up -d postgres\`. Original error: ${
          (error as Error).message
        }`,
    );
  }

  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [E2E_DATABASE_NAME],
    );

    if (existing.rowCount === 0) {
      /*
       * The identifier cannot be parameterised, so it is quoted instead.
       * It comes from our own config, not from user input.
       */
      await admin.query(`CREATE DATABASE "${E2E_DATABASE_NAME}"`);
    }
  } finally {
    await admin.end();
  }

  /*
   * Runs the Prisma CLI entry point with the current Node binary. Invoking
   * npx would mean spawning a .cmd on Windows, which execFileSync refuses.
   */
  execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: E2E_DATABASE_URL,
      },
      stdio: 'pipe',
    },
  );
}
