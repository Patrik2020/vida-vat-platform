import Fastify from 'fastify';
import { z } from 'zod';
import { getHungaryVatRates } from '@vida/rules-hu';

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'vida-vat-platform',
    version: '0.1.0'
  }));

  app.get('/v1/hu/vat/rates', async (request, reply) => {
    const parsed = z.object({
      effectiveDate: z.iso.date()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'effectiveDate is required in YYYY-MM-DD format'
      });
    }

    try {
      return getHungaryVatRates(parsed.data.effectiveDate);
    } catch (error) {
      return reply.code(422).send({
        error: 'unsupported_effective_date',
        message: error instanceof Error ? error.message : 'Unsupported effective date'
      });
    }
  });

  return app;
}

const app = buildServer();

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  app.listen({ port, host }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
