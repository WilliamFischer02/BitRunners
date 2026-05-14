import { TICK_HZ } from '@bitrunners/game-core';
import { PROTOCOL_VERSION } from '@bitrunners/shared';
import { Server as ColyseusServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import Fastify from 'fastify';
import { SphereRoom } from './sphere-room.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const fastify = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

const startedAt = Date.now();

fastify.get('/health', async () => ({
  ok: true,
  uptimeMs: Date.now() - startedAt,
  protocol: PROTOCOL_VERSION,
  tickHz: TICK_HZ,
}));

fastify.get('/', async () => ({
  service: 'bitrunners-server',
  status: 'idle',
  phase: 'phase-2-scaffold',
  rooms: ['sphere'],
}));

const gameServer = new ColyseusServer({
  transport: new WebSocketTransport({ server: fastify.server }),
});

gameServer.define('sphere', SphereRoom);

async function start(): Promise<void> {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`bitrunners-server listening on ${HOST}:${PORT}`);
    fastify.log.info('colyseus sphere room registered');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

const shutdown = async (signal: string): Promise<void> => {
  fastify.log.info(`received ${signal}, shutting down`);
  try {
    await gameServer.gracefullyShutdown(false);
    await fastify.close();
    process.exit(0);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
