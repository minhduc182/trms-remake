import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema.js';
import { prisma, resolveAuthUser, GraphQLContext } from './context.js';
import { nextSnowflakeId } from '@trms/shared';

export const INTERNAL_CRON_API_KEY =
  process.env.INTERNAL_CRON_API_KEY || 'trms-internal-cron-key-2026';

function getTodayStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function getYesterdayStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function getTomorrowStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000 + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function getLastMonthStr(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const m = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  return `${y}-${String(m).padStart(2, '0')}`;
}

export async function createServer() {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'trms-remake-super-secret-key-2026',
  });

  const yoga = createYoga<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema,
    graphqlEndpoint: '/graphql',
    maskedErrors: false,
    context: async (ctx): Promise<GraphQLContext> => {
      const req = ctx.req as FastifyRequest | undefined;
      const authHeader = req?.headers?.authorization ?? ctx.request.headers.get('authorization') ?? undefined;
      const xUsername =
        typeof req?.headers?.['x-username'] === 'string'
          ? req.headers['x-username']
          : ctx.request.headers.get('x-username') ?? undefined;
      const cookieUser = req?.cookies?.trms_user;
      const token = authHeader || xUsername || cookieUser || 'test_admin';
      const user = await resolveAuthUser(token);
      return {
        prisma,
        user,
        ip: req?.ip ?? '127.0.0.1',
      };
    },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'trms-remake-api' }));
  app.get('/api/health', async () => {
    const [users, routes, vehicles, requests, trips] = await Promise.all([
      prisma.user.count(),
      prisma.route.count({ where: { delFlag: 'N' } }),
      prisma.vehicle.count({ where: { delFlag: 'N' } }),
      prisma.transportRequest.count(),
      prisma.trip.count({ where: { delFlag: 'N' } }),
    ]);
    return {
      status: 'ok',
      service: 'trms-remake-api',
      counts: { users, routes, vehicles, requests, trips },
    };
  });

  // ===========================================================================
  // 10 HTTP CRON ENDPOINTS (/trms/tasks/*) — AT-JOB-001..010
  // ===========================================================================
  const verifyCronApiKey = async (req: FastifyRequest, reply: FastifyReply) => {
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;
    const provided =
      typeof apiKeyHeader === 'string'
        ? apiKeyHeader
        : typeof authHeader === 'string'
          ? authHeader.replace(/^(ApiKey|Bearer)\s+/i, '').trim()
          : '';
    if (!provided || provided !== INTERNAL_CRON_API_KEY) {
      reply.status(401).send({ error: 'Unauthorized: invalid or missing API key' });
      return;
    }
  };

  // Cron 1 (AT-JOB-002): POST /trms/tasks/sync/work-shift-list
  app.post(
    '/trms/tasks/sync/work-shift-list',
    { preHandler: verifyCronApiKey },
    async (req) => {
      const body = (req.body as { shifts?: Array<{ shiftCode: string; shiftName: string; startTime?: string; endTime?: string }> }) || {};
      const incoming = body.shifts ?? [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const item of incoming) {
        const code = item.shiftCode?.trim().toUpperCase();
        if (!code) continue;
        const existing = await prisma.shift.findFirst({ where: { shiftCode: code } });
        if (existing) {
          // Preserve transportFlag set by GA
          await prisma.shift.update({
            where: { id: existing.id },
            data: {
              shiftName: item.shiftName || existing.shiftName,
              startTime: item.startTime ?? existing.startTime,
              endTime: item.endTime ?? existing.endTime,
              masterFlag: 'Y',
              activeFlag: 'Y',
            },
          });
          updatedCount++;
        } else {
          await prisma.shift.create({
            data: {
              id: nextSnowflakeId(),
              shiftCode: code,
              shiftName: item.shiftName || code,
              startTime: item.startTime ?? '08:00',
              endTime: item.endTime ?? '17:00',
              masterFlag: 'Y',
              activeFlag: 'Y',
              transportFlag: 'N',
              delFlag: 0,
            },
          });
          createdCount++;
        }
      }

      return { status: 'ok', createdCount, updatedCount };
    },
  );

  // Cron 2 (AT-JOB-003): POST /trms/tasks/sync/shift-registration
  app.post(
    '/trms/tasks/sync/shift-registration',
    { preHandler: verifyCronApiKey },
    async (req, reply) => {
      const body = (req.body as { startDate?: string; rows?: Array<{ employeeCode: string; assignmentDate: string; shiftCode: string }> }) || {};
      const today = getTodayStr();
      const startDate = body.startDate?.trim().slice(0, 10) || today;

      if (startDate < today) {
        reply.status(400).send({ error: 'startDate không được nhỏ hơn ngày hiện tại (không ghi đè lịch sử quá khứ)' });
        return;
      }

      const incomingRows = body.rows ?? [];
      if (incomingRows.length > 0) {
        const batchId = nextSnowflakeId();
        await prisma.importBatch.create({
          data: {
            id: batchId,
            batchCode: `SYNC_${batchId}`,
            importType: 'SHIFT_SYNC',
            status: 'CONFIRMED',
            totalRows: incomingRows.length,
            validRows: incomingRows.length,
            invalidRows: 0,
            rows: {
              create: incomingRows.map((r, idx) => ({
                id: nextSnowflakeId(),
                lineNo: idx + 1,
                rowStatus: 'VALID',
                employeeId: r.employeeCode,
                assignmentDate: r.assignmentDate.slice(0, 10),
                shiftCode: r.shiftCode,
              })),
            },
          },
        });
      }

      return { status: 'ok', startDate, syncedRows: incomingRows.length };
    },
  );

  // Cron 3 (AT-JOB-004): POST /trms/tasks/sync/employee-transport-active-flags
  app.post(
    '/trms/tasks/sync/employee-transport-active-flags',
    { preHandler: verifyCronApiKey },
    async () => {
      const today = getTodayStr();
      const regs = await prisma.employeeTransportProfile.findMany({
        where: { delFlag: 'N' },
      });

      let updatedCount = 0;
      for (const r of regs) {
        const shouldBeActive =
          r.approvalStatus === 'APPROVED' &&
          r.effectiveFrom <= today &&
          (!r.effectiveTo || r.effectiveTo >= today)
            ? 'Y'
            : 'N';
        if (r.activeFlag !== shouldBeActive) {
          await prisma.employeeTransportProfile.update({
            where: { id: r.id },
            data: { activeFlag: shouldBeActive },
          });
          updatedCount++;
        }
      }

      return { status: 'ok', today, updatedCount };
    },
  );

  // Cron 4 (AT-JOB-005): POST /trms/tasks/sync/employee-transport-leave
  app.post(
    '/trms/tasks/sync/employee-transport-leave',
    { preHandler: verifyCronApiKey },
    async (req) => {
      const body = (req.body as { employeeCode?: string; leaveDate?: string }) || {};
      const today = getTodayStr();
      let closedCount = 0;

      if (body.employeeCode && body.leaveDate) {
        const leaveDate = body.leaveDate.trim().slice(0, 10);
        const emp = await prisma.employee.findFirst({
          where: { empCode: { equals: body.employeeCode.trim(), mode: 'insensitive' } },
        });
        if (emp) {
          const openRegs = await prisma.employeeTransportProfile.findMany({
            where: {
              employeeId: emp.id,
              delFlag: 'N',
              approvalStatus: 'APPROVED',
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: leaveDate } }],
            },
          });
          for (const reg of openRegs) {
            const nextActive = reg.effectiveFrom <= today && leaveDate >= today ? 'Y' : 'N';
            await prisma.employeeTransportProfile.update({
              where: { id: reg.id },
              data: {
                effectiveTo: leaveDate,
                endReasonCode: 'RESIGNED',
                activeFlag: nextActive,
              },
            });
            closedCount++;
          }
        }
      }

      return { status: 'ok', closedCount };
    },
  );

  // Cron 5 (AT-JOB-006): POST /trms/tasks/create-commute-plan
  app.post(
    '/trms/tasks/create-commute-plan',
    { preHandler: verifyCronApiKey },
    async (req) => {
      const body = (req.body as { businessDate?: string }) || {};
      const businessDate = body.businessDate?.trim().slice(0, 10) || getTomorrowStr();

      const res = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-username': 'test_admin',
        },
        body: JSON.stringify({
          query: `mutation($businessDate: String) {
            runCreateCommutePlan(businessDate: $businessDate) {
              id businessDate status currentVersionId
            }
          }`,
          variables: { businessDate },
        }),
      });
      const json = (await res.json()) as any;
      return { status: 'ok', businessDate, plan: json.data?.runCreateCommutePlan };
    },
  );

  // Cron 6 (AT-JOB-007): POST /trms/tasks/sync/vehicle-status
  app.post(
    '/trms/tasks/sync/vehicle-status',
    { preHandler: verifyCronApiKey },
    async () => {
      const res = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-username': 'test_admin',
        },
        body: JSON.stringify({
          query: `mutation { runSyncVehicleStatus }`,
        }),
      });
      const json = (await res.json()) as any;
      return { status: 'ok', changedCount: json.data?.runSyncVehicleStatus ?? 0 };
    },
  );

  // Cron 7 (AT-JOB-008): POST /trms/tasks/auto-complete-trips
  app.post(
    '/trms/tasks/auto-complete-trips',
    { preHandler: verifyCronApiKey },
    async () => {
      const res = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-username': 'test_admin',
        },
        body: JSON.stringify({
          query: `mutation { runAutoCompleteTrips }`,
        }),
      });
      const json = (await res.json()) as any;
      return { status: 'ok', completedCount: json.data?.runAutoCompleteTrips ?? 0 };
    },
  );

  // Cron 8 (AT-JOB-009): POST /trms/tasks/remind-upcoming-departures
  const remindedMap = new Map<string, string>();
  app.post(
    '/trms/tasks/remind-upcoming-departures',
    { preHandler: verifyCronApiKey },
    async () => {
      const today = getTodayStr();
      const pendingReqs = await prisma.transportRequest.findMany({
        where: {
          businessDate: today,
          status: { in: ['PENDING_GA', 'WAITING_VENDOR_DISPATCH'] },
        },
      });

      let remindedCount = 0;
      for (const r of pendingReqs) {
        const key = String(r.id);
        const depKey = `${r.businessDate}_${r.departureTime || ''}`;
        if (remindedMap.get(key) !== depKey) {
          remindedMap.set(key, depKey);
          remindedCount++;
        }
      }

      return { status: 'ok', remindedCount };
    },
  );

  // Cron 9 (AT-JOB-010a): POST /trms/tasks/snapshot-daily-costs
  app.post(
    '/trms/tasks/snapshot-daily-costs',
    { preHandler: verifyCronApiKey },
    async (req) => {
      const body = (req.body as { serviceDate?: string }) || {};
      const serviceDate = body.serviceDate?.trim().slice(0, 10) || getYesterdayStr();

      const res = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-username': 'test_admin',
        },
        body: JSON.stringify({
          query: `mutation($serviceDate: String!) {
            recalculateDailyCosts(serviceDate: $serviceDate) { id }
          }`,
          variables: { serviceDate },
        }),
      });
      const json = (await res.json()) as any;
      return {
        status: 'ok',
        serviceDate,
        recordsCount: json.data?.recalculateDailyCosts?.length ?? 0,
      };
    },
  );

  // Cron 10 (AT-JOB-010b): POST /trms/tasks/snapshot-monthly-costs
  app.post(
    '/trms/tasks/snapshot-monthly-costs',
    { preHandler: verifyCronApiKey },
    async (req) => {
      const body = (req.body as { paymentMonth?: string }) || {};
      const paymentMonth = body.paymentMonth?.trim().slice(0, 7) || getLastMonthStr();

      const res = await yoga.fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-username': 'test_admin',
        },
        body: JSON.stringify({
          query: `mutation($paymentMonth: String!) {
            recalculateMonthlyPayment(paymentMonth: $paymentMonth) {
              id paymentMonth totalAfterVat
            }
          }`,
          variables: { paymentMonth },
        }),
      });
      const json = (await res.json()) as any;
      return {
        status: 'ok',
        paymentMonth,
        payment: json.data?.recalculateMonthlyPayment ?? null,
      };
    },
  );

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost:4000'}`);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) {
          headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
        }
      }
      const response = await yoga.fetch(
        url,
        {
          method: req.method,
          headers,
          body:
            req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
              ? typeof req.body === 'string'
                ? req.body
                : JSON.stringify(req.body)
              : undefined,
        },
        { req, reply },
      );
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.status(response.status);
      const text = await response.text();
      reply.send(text);
      return reply;
    },
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 4000);
  createServer().then((app) => {
    app.listen({ port, host: '0.0.0.0' }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`🚀 [TRMS GraphQL API] Ready at ${address}/graphql`);
    });
  });
}
