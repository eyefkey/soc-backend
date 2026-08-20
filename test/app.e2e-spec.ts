import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

/*
 * Exercises the real stack — guards, pipes, Prisma, PostgreSQL — against the
 * dedicated end-to-end database created by global-setup.
 *
 * The unit specs mock everything below the service under test, so this is
 * the only place the guard chain, validation pipe and database constraints
 * are proved to work together.
 */
describe('SOC API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    /*
     * main.ts configures this on the real server; the test app has to match
     * or validation behaviour would differ from production.
     */
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

  /*
   * Each run starts from an empty database so the bootstrap-admin rule is
   * exercised for real rather than assumed.
   */
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.finding.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.incidentAsset.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.user.deleteMany();
  });

  const register = (body: Record<string, unknown>, token?: string) => {
    const req = request(http).post('/auth/register');

    return token
      ? req.set('Authorization', `Bearer ${token}`).send(body)
      : req.send(body);
  };

  const login = (identifier: string, password: string) =>
    request(http).post('/auth/login').send({ identifier, password });

  const bootstrapAdmin = async () => {
    await register({
      email: 'admin@soc.local',
      username: 'admin',
      password: 'bootstrap-admin-pw',
    }).expect(201);

    const response = await login('admin', 'bootstrap-admin-pw').expect(200);

    return response.body.accessToken as string;
  };

  describe('health', () => {
    it('reports liveness without a token', () =>
      request(http).get('/health').expect(200));

    it('reports readiness against the real database', async () => {
      const response = await request(http).get('/health/ready').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    });
  });

  describe('authentication', () => {
    it('rejects an unauthenticated request', () =>
      request(http).get('/incidents').expect(401));

    it('makes the first registered account an ADMIN', async () => {
      const response = await register({
        email: 'admin@soc.local',
        username: 'admin',
        password: 'bootstrap-admin-pw',
      }).expect(201);

      expect(response.body.role).toBe('ADMIN');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('refuses anonymous registration once an account exists', async () => {
      await bootstrapAdmin();

      await register({
        email: 'sneaky@soc.local',
        username: 'sneaky',
        password: 'another-long-pw',
      }).expect(403);
    });

    it('rejects a wrong password and an unknown user alike', async () => {
      await bootstrapAdmin();

      await login('admin', 'wrong-password').expect(401);
      await login('nobody', 'wrong-password').expect(401);
    });

    it('rejects a malformed or missing bearer token', async () => {
      await request(http)
        .get('/incidents')
        .set('Authorization', 'Bearer nonsense')
        .expect(401);

      await request(http)
        .get('/incidents')
        .set('Authorization', 'nonsense')
        .expect(401);
    });

    it('returns the caller from /auth/me', async () => {
      const token = await bootstrapAdmin();

      const response = await request(http)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        username: 'admin',
        role: 'ADMIN',
      });
    });
  });

  describe('roles', () => {
    it('lets a VIEWER read but not write, and an ANALYST write but not delete', async () => {
      const adminToken = await bootstrapAdmin();

      await register(
        {
          email: 'viewer@soc.local',
          username: 'viewer',
          password: 'viewer-password-1',
          role: 'VIEWER',
        },
        adminToken,
      ).expect(201);

      await register(
        {
          email: 'analyst@soc.local',
          username: 'analyst',
          password: 'analyst-password-1',
          role: 'ANALYST',
        },
        adminToken,
      ).expect(201);

      const viewerToken = (await login('viewer', 'viewer-password-1')).body
        .accessToken as string;
      const analystToken = (await login('analyst', 'analyst-password-1')).body
        .accessToken as string;

      await request(http)
        .get('/incidents')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      await request(http)
        .post('/incidents')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'denied', severity: 'LOW' })
        .expect(403);

      const created = await request(http)
        .post('/incidents')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ title: 'allowed', severity: 'HIGH' })
        .expect(201);

      await request(http)
        .delete(`/incidents/${created.body.id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .expect(403);

      await request(http)
        .delete(`/incidents/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('validation', () => {
    it('rejects an unknown status and an unknown field', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'validation', severity: 'LOW' })
        .expect(201);

      await request(http)
        .patch(`/incidents/${incident.body.id}`)
        .set(auth)
        .send({ status: 'BANANA' })
        .expect(400);

      await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'x', severity: 'LOW', notAField: true })
        .expect(400);
    });

    it('caps page size', async () => {
      const token = await bootstrapAdmin();

      await request(http)
        .get('/alerts?take=999')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('audit trail', () => {
    it('attributes writes to the acting user', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'attributed', severity: 'CRITICAL' })
        .expect(201);

      const audit = await request(http)
        .get('/audit?entity=INCIDENT&action=CREATED')
        .set(auth)
        .expect(200);

      expect(audit.body.data).toHaveLength(1);
      expect(audit.body.data[0]).toMatchObject({
        username: 'admin',
        entity: 'INCIDENT',
        action: 'CREATED',
      });
    });

    it('records a status transition distinctly from an edit', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'transition', severity: 'LOW' })
        .expect(201);

      await request(http)
        .patch(`/incidents/${incident.body.id}`)
        .set(auth)
        .send({ status: 'INVESTIGATING' })
        .expect(200);

      await request(http)
        .patch(`/incidents/${incident.body.id}`)
        .set(auth)
        .send({ title: 'renamed' })
        .expect(200);

      const audit = await request(http)
        .get(`/audit/entity/INCIDENT/${incident.body.id}`)
        .set(auth)
        .expect(200);

      const actions = (audit.body as Array<{ action: string }>).map(
        (row) => row.action,
      );

      expect(actions).toEqual(['CREATED', 'STATUS_CHANGED', 'UPDATED']);
    });
  });

  describe('investigation workflow', () => {
    it('correlates an alert to an asset and scores the risk', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'intrusion', severity: 'HIGH' })
        .expect(201);

      const asset = await request(http)
        .post('/assets')
        .set(auth)
        .send({ name: 'web-01', type: 'SERVER', ipAddress: '10.0.0.5' })
        .expect(201);

      await request(http)
        .post('/assets/' + asset.body.id + '/incidents/' + incident.body.id)
        .set(auth)
        .expect(201);

      await request(http)
        .post('/alerts')
        .set(auth)
        .send({
          title: 'Brute force',
          severity: 'HIGH',
          sourceIp: '203.0.113.9',
          targetIp: '10.0.0.5',
          incidentId: incident.body.id,
        })
        .expect(201);

      await request(http)
        .post('/evidence')
        .set(auth)
        .send({
          type: 'IP_ADDRESS',
          value: '203.0.113.9',
          incidentId: incident.body.id,
        })
        .expect(201);

      const investigation = await request(http)
        .post('/investigations')
        .set(auth)
        .send({ incidentId: incident.body.id })
        .expect(201);

      const correlations = await request(http)
        .get(`/investigations/${investigation.body.id}/correlations`)
        .set(auth)
        .expect(200);

      const types = (
        correlations.body.correlations as Array<{ type: string }>
      ).map((c) => c.type);

      expect(types).toContain('ALERT_ASSET');
      expect(types).toContain('ALERT_EVIDENCE');

      /*
       * Both endpoints must agree; they used to be separate implementations
       * returning different answers.
       */
      const viaCorrelations = await request(http)
        .get(`/correlations/investigation/${investigation.body.id}`)
        .set(auth)
        .expect(200);

      expect(viaCorrelations.body.risk).toEqual(correlations.body.risk);

      const risk = await request(http)
        .get(`/investigations/${investigation.body.id}/risk`)
        .set(auth)
        .expect(200);

      expect(risk.body.score).toBe(correlations.body.risk.score);
      expect(risk.body.level).toBe('HIGH');
    });

    it('stamps completedAt on resolution and clears it on reopen', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'lifecycle', severity: 'LOW' })
        .expect(201);

      const investigation = await request(http)
        .post('/investigations')
        .set(auth)
        .send({ incidentId: incident.body.id })
        .expect(201);

      const resolved = await request(http)
        .patch(`/investigations/${investigation.body.id}`)
        .set(auth)
        .send({ status: 'RESOLVED', conclusion: 'Contained' })
        .expect(200);

      expect(resolved.body.completedAt).not.toBeNull();

      const reopened = await request(http)
        .patch(`/investigations/${investigation.body.id}`)
        .set(auth)
        .send({ status: 'INVESTIGATING' })
        .expect(200);

      expect(reopened.body.completedAt).toBeNull();
    });

    it('returns one investigation per incident', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'single', severity: 'LOW' })
        .expect(201);

      const first = await request(http)
        .post('/investigations')
        .set(auth)
        .send({ incidentId: incident.body.id })
        .expect(201);

      const second = await request(http)
        .post('/investigations')
        .set(auth)
        .send({ incidentId: incident.body.id })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
    });
  });

  describe('cascades', () => {
    it('removes dependent records with the incident but keeps the audit trail', async () => {
      const token = await bootstrapAdmin();
      const auth = { Authorization: `Bearer ${token}` };

      const incident = await request(http)
        .post('/incidents')
        .set(auth)
        .send({ title: 'cascade', severity: 'LOW' })
        .expect(201);

      await request(http)
        .post('/evidence')
        .set(auth)
        .send({
          type: 'LOG',
          value: 'entry',
          incidentId: incident.body.id,
        })
        .expect(201);

      await request(http)
        .post('/investigations')
        .set(auth)
        .send({ incidentId: incident.body.id })
        .expect(201);

      await request(http)
        .delete(`/incidents/${incident.body.id}`)
        .set(auth)
        .expect(200);

      expect(await prisma.evidence.count()).toBe(0);
      expect(await prisma.investigation.count()).toBe(0);

      const audit = await request(http)
        .get(`/audit/entity/INCIDENT/${incident.body.id}`)
        .set(auth)
        .expect(200);

      expect(
        (audit.body as Array<{ action: string }>).map((row) => row.action),
      ).toContain('DELETED');
    });
  });
});
