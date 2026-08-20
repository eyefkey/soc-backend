import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('User management (e2e)', () => {
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
    await app?.close();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.user.deleteMany();
  });

  const login = (identifier: string, password: string) =>
    request(http).post('/auth/login').send({ identifier, password });

  const setup = async () => {
    await request(http)
      .post('/auth/register')
      .send({
        email: 'admin@soc.local',
        username: 'admin',
        password: 'bootstrap-admin-pw',
      })
      .expect(201);

    const adminToken = (await login('admin', 'bootstrap-admin-pw').expect(200))
      .body.accessToken as string;

    const analyst = await request(http)
      .post('/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'analyst@soc.local',
        username: 'analyst',
        password: 'analyst-password-1',
        role: 'ANALYST',
      })
      .expect(201);

    const analystToken = (
      await login('analyst', 'analyst-password-1').expect(200)
    ).body.accessToken as string;

    return { adminToken, analystToken, analystId: analyst.body.id as string };
  };

  it('lists users for an ADMIN only', async () => {
    const { adminToken, analystToken } = await setup();

    const listed = await request(http)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listed.body.meta.total).toBe(2);
    expect(listed.body.data[0]).not.toHaveProperty('passwordHash');

    await request(http)
      .get('/auth/users')
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(403);
  });

  it('applies a role change to the existing session immediately', async () => {
    const { adminToken, analystToken, analystId } = await setup();

    await request(http)
      .post('/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'before demotion', severity: 'LOW' })
      .expect(201);

    await request(http)
      .patch(`/auth/users/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' })
      .expect(200);

    /*
     * Same token as before: the role is re-read per request rather than
     * trusted from the token payload.
     */
    await request(http)
      .post('/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'after demotion', severity: 'LOW' })
      .expect(403);
  });

  it('cuts off a deactivated account without waiting for expiry', async () => {
    const { adminToken, analystToken, analystId } = await setup();

    await request(http)
      .get('/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(200);

    await request(http)
      .patch(`/auth/users/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(http)
      .get('/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(401);

    await login('analyst', 'analyst-password-1').expect(401);
  });

  it('reactivates an account', async () => {
    const { adminToken, analystId } = await setup();

    await request(http)
      .patch(`/auth/users/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(http)
      .patch(`/auth/users/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    await login('analyst', 'analyst-password-1').expect(200);
  });

  it('stops an ADMIN locking themselves out', async () => {
    const { adminToken } = await setup();

    const me = await request(http)
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(http)
      .patch(`/auth/users/${me.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(400);

    await request(http)
      .patch(`/auth/users/${me.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' })
      .expect(400);
  });

  it('records deactivation in the audit trail', async () => {
    const { adminToken, analystId } = await setup();

    await request(http)
      .patch(`/auth/users/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    const audit = await request(http)
      .get(`/audit/entity/USER/${analystId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const rows = audit.body as Array<{ action: string; username: string }>;

    expect(rows.map((row) => row.action)).toContain('STATUS_CHANGED');
    expect(rows[rows.length - 1].username).toBe('admin');
  });

  describe('password change', () => {
    it('requires the current password', async () => {
      const { analystToken } = await setup();

      await request(http)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'a-brand-new-password',
        })
        .expect(401);
    });

    it('rejects a short new password', async () => {
      const { analystToken } = await setup();

      await request(http)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ currentPassword: 'analyst-password-1', newPassword: 'short' })
        .expect(400);
    });

    it('changes the password and invalidates the old one', async () => {
      const { analystToken } = await setup();

      await request(http)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          currentPassword: 'analyst-password-1',
          newPassword: 'a-brand-new-password',
        })
        .expect(200);

      await login('analyst', 'analyst-password-1').expect(401);
      await login('analyst', 'a-brand-new-password').expect(200);
    });
  });
});
