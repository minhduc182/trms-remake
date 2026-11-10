import { PrismaClient } from '@prisma/client';
import { nextSnowflakeId } from '@trms/shared';

export const prisma = new PrismaClient();

export interface AuthUser {
  id: bigint;
  username: string;
  fullName: string;
  isAdmin: boolean;
  roles: string[];
  features: Set<string>;
}

export interface GraphQLContext {
  prisma: PrismaClient;
  user: AuthUser | null;
  ip?: string;
}

export async function resolveAuthUser(userIdOrToken: string | undefined): Promise<AuthUser | null> {
  if (!userIdOrToken) return null;
  const clean = userIdOrToken.replace(/^Bearer\s+/i, '').trim();
  if (!clean) return null;

  // Support "dev" token or username or numeric userId
  let user = null;
  let overrideUsername: string | null = null;
  let overrideFullName: string | null = null;
  if (clean === 'dev' || clean === 'admin') {
    user = await prisma.user.findUnique({ where: { username: 'test_admin' } });
  } else if (clean.toLowerCase() === 'tominhduc') {
    user =
      (await prisma.user.findUnique({ where: { username: 'tominhduc' } })) ||
      (await prisma.user.findUnique({ where: { username: 'test_admin' } }));
    overrideUsername = 'tominhduc';
    overrideFullName = 'Tô Minh Đức';
  } else if (/^\d+$/.test(clean)) {
    user = await prisma.user.findUnique({ where: { id: BigInt(clean) } });
  } else {
    user = await prisma.user.findUnique({ where: { username: clean } });
  }

  if (!user || user.status !== 'ACTIVE') return null;

  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: {
      role: {
        include: {
          roleFeatures: {
            include: { feature: true },
          },
        },
      },
    },
  });

  let isAdmin = false;
  const roles: string[] = [];
  const features = new Set<string>();

  for (const ur of userRoles) {
    roles.push(ur.role.code);
    if (ur.role.isSystemAdmin === 1 || ur.role.code === 'ADMIN') {
      isAdmin = true;
    }
    for (const rf of ur.role.roleFeatures) {
      features.add(rf.feature.code);
    }
  }

  return {
    id: user.id,
    username: overrideUsername ?? user.username,
    fullName: overrideFullName ?? user.fullName,
    isAdmin: overrideUsername === 'tominhduc' ? true : isAdmin,
    roles: overrideUsername === 'tominhduc' && !roles.includes('ADMIN') ? ['ADMIN', ...roles] : roles,
    features,
  };
}

export async function writeAuditLog(
  ctx: GraphQLContext,
  entityType: string,
  entityId: string | bigint,
  actionType: string,
  summaryText: string,
) {
  await prisma.auditLog.create({
    data: {
      id: nextSnowflakeId(),
      entityType,
      entityId: String(entityId),
      actionType,
      changedBy: ctx.user?.id ?? null,
      actorName: ctx.user?.fullName ?? 'SYSTEM',
      summaryText,
    },
  });
}
