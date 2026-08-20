import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/*
 * Compiles the real module graph with only the database stubbed out.
 *
 * The per-service specs mock every injected dependency, so they cannot catch
 * a provider that is used but never exported from — or imported into — the
 * owning module. This test does: wiring mistakes fail here, not at boot.
 */
describe('AppModule wiring', () => {
  let module: TestingModule;

  beforeAll(async () => {
    /*
     * AuthModule refuses to build without a signing key, which is the
     * behaviour we want in production — supply one for the test.
     */
    process.env.JWT_SECRET ??= 'test-secret-not-used-to-sign-anything-real';

    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();
  });

  afterAll(async () => {
    await module?.close();
  });

  it('resolves every provider in the graph', () => {
    expect(module).toBeDefined();
  });
});
