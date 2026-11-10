import type { FastifyInstance } from 'fastify';
import { createServer } from '../../../apps/api/src/server.js';

let serverInstance: FastifyInstance | null = null;

export async function getTestServer(): Promise<FastifyInstance> {
  if (!serverInstance) {
    process.env.NODE_ENV = 'test';
    serverInstance = await createServer();
    await serverInstance.ready();
  }
  return serverInstance;
}

export async function closeTestServer(): Promise<void> {
  if (serverInstance) {
    await serverInstance.close();
    serverInstance = null;
  }
}

export async function gql<T = any>(
  query: string,
  variables?: Record<string, unknown>,
  username = 'test_admin'
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const app = await getTestServer();
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'content-type': 'application/json',
      'x-username': username,
    },
    payload: JSON.stringify({ query, variables }),
  });
  return res.json() as { data?: T; errors?: Array<{ message: string }> };
}
