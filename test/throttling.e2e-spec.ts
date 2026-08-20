import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

/*
 * Rate limiting is switched off for the other end-to-end suites so their
 * setup logins do not exhaust the allowance. This suite turns it on for the
 * requests it asserts against, and off again afterwards.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    http = app.getHttpServer();
  });

  afterAll(async () => {
    process.env.THROTTLE_DISABLED = 'true';
    await app?.close();
  });

  beforeEach(async () => {
    process.env.THROTTLE_DISABLED = 'true';

    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();

    await request(http)
      .post('/auth/register')
      .send({
        email: 'admin@soc.local',
        username: 'admin',
        password: 'bootstrap-admin-pw',
      })
      .expect(201);
  });

  afterEach(() => {
    process.env.THROTTLE_DISABLED = 'true';
  });

  const attemptLogin = (password: string) =>
    request(http).post('/auth/login').send({ identifier: 'admin', password });

  /*
   * The limiter counts per client for a whole minute and its counters are
   * process-wide, so the allowance can only be spent once per run. Both
   * assertions therefore share a single sequence of attempts.
   */
  it('blocks brute force, and stays blocked even for the right password', async () => {
    process.env.THROTTLE_DISABLED = 'false';

    const statuses: number[] = [];

    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await attemptLogin('wrong-password');
      statuses.push(response.status);
    }

    /*
     * The limit is 5 a minute: the first attempts are rejected on the
     * credentials, the rest are refused before reaching the handler — and
     * so before paying for a password hash.
     */
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429, 429]);

    /*
     * The point of the exercise: an attacker who guesses correctly after
     * the limit is reached still cannot get in during this window.
     */
    await attemptLogin('bootstrap-admin-pw').expect(429);
  });

  it('never throttles health probes', async () => {
    process.env.THROTTLE_DISABLED = 'false';

    for (let probe = 0; probe < 30; probe++) {
      await request(http).get('/health').expect(200);
    }
  });
});
