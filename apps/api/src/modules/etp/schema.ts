import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import { FEATURE_CODES, nextSnowflakeId } from '@trms/shared';
import { isRegistrationEffectiveOnDate, subtractOneDay } from '@trms/domain';

function getTodayStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export const EmployeeTransportProfileObj = builder.prismaObject('EmployeeTransportProfile', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    employeeId: t.expose('employeeId', { type: 'BigInt', nullable: true }),
    routeId: t.expose('routeId', { type: 'BigInt' }),
    pickupPointId: t.expose('pickupPointId', { type: 'BigInt' }),
    dropoffPointId: t.expose('dropoffPointId', { type: 'BigInt', nullable: true }),
    effectiveFrom: t.exposeString('effectiveFrom'),
    effectiveTo: t.exposeString('effectiveTo', { nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    approvalStatus: t.exposeString('approvalStatus'),
    rejectReason: t.exposeString('rejectReason', { nullable: true }),
    leaveDate: t.exposeString('leaveDate', { nullable: true }),
    endReasonCode: t.exposeString('endReasonCode', { nullable: true }),
    isProvisional: t.exposeString('isProvisional'),
    provTempCode: t.exposeString('provTempCode', { nullable: true }),
    provFullName: t.exposeString('provFullName', { nullable: true }),
    provOrgUnitId: t.expose('provOrgUnitId', { type: 'BigInt', nullable: true }),
    provShiftId: t.expose('provShiftId', { type: 'BigInt', nullable: true }),
    provWorkDayMask: t.exposeString('provWorkDayMask', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    employee: t.relation('employee', { nullable: true }),
    route: t.relation('route'),
    pickupPoint: t.relation('pickupPoint'),
    dropoffPoint: t.relation('dropoffPoint', { nullable: true }),
  }),
});

export interface EtpRouteStatItem {
  routeId: bigint;
  routeCode: string;
  routeName: string;
  passengerType: string;
  activeCount: number;
  pendingCount: number;
}

export interface EtpReportResult {
  totalProfiles: number;
  activeCount: number;
  pendingCount: number;
  rejectedCount: number;
  provisionalCount: number;
  byRoute: EtpRouteStatItem[];
}

export const EtpRouteStatRef = builder.objectRef<EtpRouteStatItem>('EtpRouteStatItem').implement({
  fields: (t) => ({
    routeId: t.expose('routeId', { type: 'BigInt' }),
    routeCode: t.exposeString('routeCode'),
    routeName: t.exposeString('routeName'),
    passengerType: t.exposeString('passengerType'),
    activeCount: t.exposeInt('activeCount'),
    pendingCount: t.exposeInt('pendingCount'),
  }),
});

export const EtpReportRef = builder.objectRef<EtpReportResult>('EtpReportResult').implement({
  fields: (t) => ({
    totalProfiles: t.exposeInt('totalProfiles'),
    activeCount: t.exposeInt('activeCount'),
    pendingCount: t.exposeInt('pendingCount'),
    rejectedCount: t.exposeInt('rejectedCount'),
    provisionalCount: t.exposeInt('provisionalCount'),
    byRoute: t.field({
      type: [EtpRouteStatRef],
      resolve: (parent) => parent.byRoute,
    }),
  }),
});

/**
 * Helper to apply approval cutting and future cleanup rules (QA §1.6.1 & §1.6.2)
 * when an ETP registration is APPROVED with a target effectiveFrom date.
 */
async function applyApprovedRegistrationCutRules(
  employeeId: bigint | null,
  provTempCode: string | null,
  approvedId: bigint,
  effectiveFrom: string,
) {
  if (!employeeId && !provTempCode) return;

  const ownerWhere = employeeId ? { employeeId } : { provTempCode: provTempCode! };

  // 1. Auto-reject any other open PENDING registrations of the same employee
  await prisma.employeeTransportProfile.updateMany({
    where: {
      ...ownerWhere,
      id: { not: approvedId },
      delFlag: 'N',
      approvalStatus: 'PENDING',
    },
    data: {
      approvalStatus: 'REJECTED',
      rejectReason: 'Bị thay bằng đăng ký mới',
      activeFlag: 'N',
    },
  });

  // 2. Latest wins rule (QA §1.6.1 / ETP-05, ETP-10):
  // Any future APPROVED registration with effectiveFrom >= new effectiveFrom is soft-deleted
  await prisma.employeeTransportProfile.updateMany({
    where: {
      ...ownerWhere,
      id: { not: approvedId },
      delFlag: 'N',
      approvalStatus: 'APPROVED',
      effectiveFrom: { gte: effectiveFrom },
    },
    data: {
      delFlag: 'Y',
      activeFlag: 'N',
    },
  });

  // 3. Cut previous APPROVED registration whose effectiveFrom < new effectiveFrom
  // If it has no effectiveTo or effectiveTo >= new effectiveFrom, cut effectiveTo = effectiveFrom - 1
  const prevApprovedList = await prisma.employeeTransportProfile.findMany({
    where: {
      ...ownerWhere,
      id: { not: approvedId },
      delFlag: 'N',
      approvalStatus: 'APPROVED',
      effectiveFrom: { lt: effectiveFrom },
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const cutDate = subtractOneDay(effectiveFrom);
  const today = getTodayStr();

  for (const prev of prevApprovedList) {
    if (!prev.effectiveTo || prev.effectiveTo >= effectiveFrom) {
      const nextActiveFlag =
        prev.effectiveFrom <= today && cutDate >= today ? 'Y' : 'N';
      await prisma.employeeTransportProfile.update({
        where: { id: prev.id },
        data: {
          effectiveTo: cutDate,
          activeFlag: nextActiveFlag,
          // Keep endReasonCode if already manually deactivated, otherwise mark AUTO_CUT
          endReasonCode: prev.endReasonCode ?? 'AUTO_CUT',
        },
      });
    }
  }
}

builder.queryFields((t) => ({
  employeeTransportProfiles: t.prismaField({
    type: ['EmployeeTransportProfile'],
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_LIST },
    args: {
      passengerType: t.arg.string(),
      approvalStatus: t.arg.string(),
      activeFlag: t.arg.string(),
      routeId: t.arg({ type: 'BigInt' }),
      routeIds: t.arg({ type: ['BigInt'] }),
      pickupPointIds: t.arg({ type: ['BigInt'] }),
      dropoffPointIds: t.arg({ type: ['BigInt'] }),
      isProvisional: t.arg.string(),
      search: t.arg.string(),
      limit: t.arg.int({ defaultValue: 200 }),
    },
    resolve: async (query, _root, args) => {
      const routeIdList: bigint[] = [];
      if (args.routeId !== undefined && args.routeId !== null) {
        routeIdList.push(BigInt(args.routeId));
      }
      if (args.routeIds && args.routeIds.length > 0) {
        for (const rId of args.routeIds) {
          routeIdList.push(BigInt(rId));
        }
      }

      // QA §1.6: Filter on registrations first, then pick 1 representative row per employee
      // Priority:
      // 1. Open PENDING registration (effectiveTo == null)
      // 2. Currently effective registration (APPROVED, effectiveFrom <= today <= effectiveTo)
      // 3. Most recent registration (effectiveFrom desc, id desc)
      const candidates = await prisma.employeeTransportProfile.findMany({
        where: {
          delFlag: 'N',
          ...(args.approvalStatus ? { approvalStatus: args.approvalStatus } : {}),
          ...(args.isProvisional ? { isProvisional: args.isProvisional } : {}),
          ...(routeIdList.length > 0 ? { routeId: { in: routeIdList } } : {}),
          ...(args.pickupPointIds && args.pickupPointIds.length > 0
            ? { pickupPointId: { in: args.pickupPointIds.map((id) => BigInt(id)) } }
            : {}),
          ...(args.dropoffPointIds && args.dropoffPointIds.length > 0
            ? { dropoffPointId: { in: args.dropoffPointIds.map((id) => BigInt(id)) } }
            : {}),
          ...(args.passengerType
            ? { route: { passengerType: args.passengerType } }
            : {}),
          ...(args.search
            ? {
                OR: [
                  { provFullName: { contains: args.search, mode: 'insensitive' } },
                  { provTempCode: { contains: args.search, mode: 'insensitive' } },
                  { employee: { fullName: { contains: args.search, mode: 'insensitive' } } },
                  { employee: { empCode: { contains: args.search, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          employeeId: true,
          provTempCode: true,
          provFullName: true,
          approvalStatus: true,
          delFlag: true,
          effectiveFrom: true,
          effectiveTo: true,
          activeFlag: true,
          employee: { select: { fullName: true } },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      });

      const today = getTodayStr();
      const grouped = new Map<string, (typeof candidates)[number][]>();

      for (const row of candidates) {
        const key = row.employeeId
          ? `EMP:${String(row.employeeId)}`
          : row.provTempCode
            ? `PROV:${row.provTempCode}`
            : `ID:${String(row.id)}`;
        const arr = grouped.get(key);
        if (arr) {
          arr.push(row);
        } else {
          grouped.set(key, [row]);
        }
      }

      const rankRegistration = (r: (typeof candidates)[number]): number => {
        if (r.approvalStatus === 'PENDING' && !r.effectiveTo) return 1;
        if (
          isRegistrationEffectiveOnDate(
            {
              approvalStatus: r.approvalStatus,
              isDeleted: r.delFlag === 'Y',
              effectiveFrom: r.effectiveFrom,
              effectiveTo: r.effectiveTo,
            },
            today,
          )
        ) {
          return 2;
        }
        return 3;
      };

      let representatives: (typeof candidates)[number][] = [];
      for (const rows of grouped.values()) {
        rows.sort((a, b) => {
          const rankDiff = rankRegistration(a) - rankRegistration(b);
          if (rankDiff !== 0) return rankDiff;
          if (a.effectiveFrom !== b.effectiveFrom) {
            return b.effectiveFrom.localeCompare(a.effectiveFrom);
          }
          return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
        });
        representatives.push(rows[0]);
      }

      // Apply activeFlag filter on the representative row (QA §1.6: "Hoạt động là bản đại diện đang có hiệu lực")
      if (args.activeFlag) {
        representatives = representatives.filter((r) => {
          const isEff = isRegistrationEffectiveOnDate(
            {
              approvalStatus: r.approvalStatus,
              isDeleted: r.delFlag === 'Y',
              effectiveFrom: r.effectiveFrom,
              effectiveTo: r.effectiveTo,
            },
            today,
          );
          if (args.activeFlag === 'Y') {
            return isEff || r.activeFlag === 'Y';
          }
          return !isEff && r.activeFlag === 'N';
        });
      }

      // Sort order per QA §1.6: PENDING -> APPROVED -> REJECTED, then by employee name
      const statusOrder: Record<string, number> = {
        PENDING: 1,
        APPROVED: 2,
        REJECTED: 3,
      };
      representatives.sort((a, b) => {
        const nameA = (a.employee?.fullName ?? a.provFullName ?? '').trim();
        const nameB = (b.employee?.fullName ?? b.provFullName ?? '').trim();
        if (!nameA && nameB) return 1;
        if (nameA && !nameB) return -1;
        const sA = statusOrder[a.approvalStatus] ?? 9;
        const sB = statusOrder[b.approvalStatus] ?? 9;
        if (sA !== sB) return sA - sB;
        return nameA.localeCompare(nameB, 'vi');
      });

      const limit = args.limit ?? 200;
      const topIds = representatives.slice(0, limit).map((r) => r.id);
      if (topIds.length === 0) return [];

      const fullRows = await prisma.employeeTransportProfile.findMany({
        ...query,
        where: { id: { in: topIds } },
      });
      const rowById = new Map(fullRows.map((r) => [String(r.id), r]));
      return topIds.map((id) => rowById.get(String(id))!).filter(Boolean);
    },
  }),

  employeeTransportRegistrations: t.prismaField({
    type: ['EmployeeTransportProfile'],
    authScopes: {
      anyFeature: [FEATURE_CODES.EMP_TRANSPORT_LIST, FEATURE_CODES.EMP_TRANSPORT_GET],
    },
    args: {
      employeeId: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: (query, _root, args) =>
      prisma.employeeTransportProfile.findMany({
        ...query,
        where: {
          employeeId: BigInt(args.employeeId),
          delFlag: 'N',
        },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      }),
  }),

  provisionalCount: t.field({
    type: 'Int',
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_LIST },
    resolve: () =>
      prisma.employeeTransportProfile.count({
        where: {
          delFlag: 'N',
          isProvisional: 'Y',
        },
      }),
  }),

  etpReport: t.field({
    type: EtpReportRef,
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_LIST },
    args: {
      passengerType: t.arg.string(),
    },
    resolve: async (_root, args) => {
      const today = getTodayStr();
      const allProfiles = await prisma.employeeTransportProfile.findMany({
        where: {
          delFlag: 'N',
          ...(args.passengerType ? { route: { passengerType: args.passengerType } } : {}),
        },
        include: { route: true },
      });

      let activeCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;
      let provisionalCount = 0;

      const routeMap = new Map<bigint, EtpRouteStatItem>();

      for (const p of allProfiles) {
        const isEff = isRegistrationEffectiveOnDate(
          {
            approvalStatus: p.approvalStatus,
            isDeleted: p.delFlag === 'Y',
            effectiveFrom: p.effectiveFrom,
            effectiveTo: p.effectiveTo,
          },
          today,
        );
        if (isEff) activeCount++;
        if (p.approvalStatus === 'PENDING') pendingCount++;
        if (p.approvalStatus === 'REJECTED') rejectedCount++;
        if (p.isProvisional === 'Y') provisionalCount++;

        let stat = routeMap.get(p.routeId);
        if (!stat) {
          stat = {
            routeId: p.routeId,
            routeCode: p.route.routeCode,
            routeName: p.route.routeName,
            passengerType: p.route.passengerType,
            activeCount: 0,
            pendingCount: 0,
          };
          routeMap.set(p.routeId, stat);
        }
        if (isEff) stat.activeCount++;
        if (p.approvalStatus === 'PENDING') stat.pendingCount++;
      }

      return {
        totalProfiles: allProfiles.length,
        activeCount,
        pendingCount,
        rejectedCount,
        provisionalCount,
        byRoute: Array.from(routeMap.values()).sort((a, b) =>
          a.routeCode.localeCompare(b.routeCode),
        ),
      };
    },
  }),
}));

builder.mutationFields((t) => ({
  createEtpRegistration: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.EMP_TRANSPORT_CREATE,
        FEATURE_CODES.EMP_TRANSPORT_ADD_REGISTRATION,
      ],
    },
    args: {
      employeeId: t.arg({ type: 'BigInt', required: true }),
      routeId: t.arg({ type: 'BigInt', required: true }),
      pickupPointId: t.arg({ type: 'BigInt', required: true }),
      dropoffPointId: t.arg({ type: 'BigInt' }),
      effectiveFrom: t.arg.string({ required: true }),
      effectiveTo: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const today = getTodayStr();
      const effectiveFrom = args.effectiveFrom.trim().slice(0, 10);

      // ETP-07 / AT-ETP-008: Block effectiveFrom in the past
      if (effectiveFrom < today) {
        throw new Error('Ngày bắt đầu hiệu lực không được ở trong quá khứ');
      }

      const empId = BigInt(args.employeeId);
      const routeId = BigInt(args.routeId);
      const pickupPointId = BigInt(args.pickupPointId);
      const dropoffPointId = args.dropoffPointId ? BigInt(args.dropoffPointId) : null;

      if (dropoffPointId && pickupPointId === dropoffPointId) {
        throw new Error('Điểm đón và điểm trả không được trùng nhau');
      }

      const employee = await prisma.employee.findUnique({ where: { id: empId } });
      if (!employee) {
        throw new Error('Không tìm thấy nhân viên');
      }
      if (employee.activeFlag === 'N') {
        throw new Error('Nhân viên đã nghỉ việc');
      }
      if (employee.leaveDate) {
        const leaveStr = employee.leaveDate.toISOString().slice(0, 10);
        if (leaveStr <= today) {
          throw new Error('Nhân viên đã nghỉ việc');
        }
      }

      const route = await prisma.route.findUnique({ where: { id: routeId } });
      if (!route || route.delFlag === 'Y' || route.activeFlag === 'N') {
        throw new Error('Tuyến đang không hoạt động hoặc không tồn tại');
      }

      // ETP-08, ETP-09 / AT-ETP-006, AT-ETP-009:
      // Block if effectiveFrom conflicts with any open registration (PENDING, open APPROVED, or active APPROVED with future stop date)
      const existingRegs = await prisma.employeeTransportProfile.findMany({
        where: {
          employeeId: empId,
          delFlag: 'N',
          approvalStatus: { in: ['PENDING', 'APPROVED'] },
        },
      });

      for (const reg of existingRegs) {
        const isOpenPending = reg.approvalStatus === 'PENDING' && !reg.effectiveTo;
        const isOpenApproved =
          reg.approvalStatus === 'APPROVED' &&
          (!reg.effectiveTo || reg.effectiveTo >= today);

        if ((isOpenPending || isOpenApproved) && reg.effectiveFrom === effectiveFrom) {
          throw new Error('Đã có đăng ký cùng ngày hiệu lực đang mở');
        }
      }

      // QA §1.6.1: Replace any open PENDING registrations -> REJECTED
      await prisma.employeeTransportProfile.updateMany({
        where: {
          employeeId: empId,
          delFlag: 'N',
          approvalStatus: 'PENDING',
          effectiveTo: null,
        },
        data: {
          approvalStatus: 'REJECTED',
          rejectReason: 'Bị thay bằng đăng ký mới',
          activeFlag: 'N',
        },
      });

      const canAutoApprove =
        Boolean(ctx.user?.isAdmin) ||
        Boolean(ctx.user?.features.has(FEATURE_CODES.EMP_TRANSPORT_APPROVE));

      const approvalStatus = canAutoApprove ? 'APPROVED' : 'PENDING';
      const activeFlag = canAutoApprove && effectiveFrom <= today ? 'Y' : 'N';
      const newId = nextSnowflakeId();

      const created = await prisma.employeeTransportProfile.create({
        ...query,
        data: {
          id: newId,
          employeeId: empId,
          routeId,
          pickupPointId,
          dropoffPointId,
          effectiveFrom,
          effectiveTo: null,
          activeFlag,
          delFlag: 'N',
          approvalStatus,
          isProvisional: 'N',
        },
      });

      if (canAutoApprove) {
        await applyApprovedRegistrationCutRules(empId, null, newId, effectiveFrom);
      }

      await writeAuditLog(
        ctx,
        'ETP',
        newId,
        'CREATE',
        `Đăng ký tuyến ${route.routeCode} cho NV ${employee.empCode} từ ${effectiveFrom} (${approvalStatus})`,
      );

      return prisma.employeeTransportProfile.findUniqueOrThrow({
        ...query,
        where: { id: newId },
      });
    },
  }),

  approveEtpRegistration: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_APPROVE },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const regId = BigInt(args.id);
      const reg = await prisma.employeeTransportProfile.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.delFlag === 'Y') {
        throw new Error('Không tìm thấy bản đăng ký');
      }
      if (reg.approvalStatus !== 'PENDING') {
        throw new Error('Bản đăng ký không còn ở trạng thái chờ duyệt');
      }

      const today = getTodayStr();
      // Late approval rule (QA §1.6.2 / ETP-12 / AT-ETP-011 & AT-ETP-012):
      // If effectiveFrom < today, shift effectiveFrom to today.
      const targetEffectiveFrom = reg.effectiveFrom < today ? today : reg.effectiveFrom;

      // Check conflict with another open APPROVED registration starting on targetEffectiveFrom
      if (reg.employeeId || reg.provTempCode) {
        const ownerWhere = reg.employeeId
          ? { employeeId: reg.employeeId }
          : { provTempCode: reg.provTempCode! };
        const conflict = await prisma.employeeTransportProfile.findFirst({
          where: {
            ...ownerWhere,
            id: { not: reg.id },
            delFlag: 'N',
            approvalStatus: 'APPROVED',
            effectiveFrom: targetEffectiveFrom,
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          },
        });
        if (conflict) {
          throw new Error('Xung đột ngày bắt đầu hiệu lực với bản đăng ký đang mở');
        }
      }

      const activeFlag = targetEffectiveFrom <= today ? 'Y' : 'N';
      await prisma.employeeTransportProfile.update({
        where: { id: reg.id },
        data: {
          approvalStatus: 'APPROVED',
          effectiveFrom: targetEffectiveFrom,
          activeFlag,
          rejectReason: null,
        },
      });

      await applyApprovedRegistrationCutRules(
        reg.employeeId,
        reg.provTempCode,
        reg.id,
        targetEffectiveFrom,
      );

      await writeAuditLog(
        ctx,
        'ETP',
        reg.id,
        'APPROVE',
        `Duyệt đăng ký xe tuyến #${String(reg.id)} (hiệu lực từ ${targetEffectiveFrom})`,
      );

      return prisma.employeeTransportProfile.findUniqueOrThrow({
        ...query,
        where: { id: reg.id },
      });
    },
  }),

  rejectEtpRegistration: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_REJECT },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const regId = BigInt(args.id);
      const reg = await prisma.employeeTransportProfile.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.delFlag === 'Y') {
        throw new Error('Không tìm thấy bản đăng ký');
      }
      if (reg.approvalStatus !== 'PENDING') {
        throw new Error('Chỉ được từ chối bản đăng ký đang chờ duyệt');
      }

      const updated = await prisma.employeeTransportProfile.update({
        ...query,
        where: { id: regId },
        data: {
          approvalStatus: 'REJECTED',
          rejectReason: args.reason?.trim() || 'Từ chối phê duyệt',
          activeFlag: 'N',
        },
      });

      await writeAuditLog(
        ctx,
        'ETP',
        regId,
        'REJECT',
        `Từ chối đăng ký xe tuyến #${String(regId)}: ${args.reason ?? ''}`,
      );

      return updated;
    },
  }),

  rejectOpenEtpRegistrations: t.field({
    type: 'Int',
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_REJECT },
    args: {
      employeeIds: t.arg({ type: ['BigInt'], required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const reason = args.reason.trim();
      if (!reason) {
        throw new Error('Từ chối hàng loạt bắt buộc nhập lý do');
      }
      const empIds = args.employeeIds.map((id) => BigInt(id));
      const res = await prisma.employeeTransportProfile.updateMany({
        where: {
          employeeId: { in: empIds },
          delFlag: 'N',
          approvalStatus: 'PENDING',
        },
        data: {
          approvalStatus: 'REJECTED',
          rejectReason: reason,
          activeFlag: 'N',
        },
      });

      await writeAuditLog(
        ctx,
        'ETP',
        empIds.join(','),
        'BULK_REJECT',
        `Từ chối ${res.count} đăng ký chờ duyệt: ${reason}`,
      );

      return res.count;
    },
  }),

  deactivateEtpRegistration: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: { feature: FEATURE_CODES.EMP_TRANSPORT_DEACTIVATE_REG },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      effectiveTo: t.arg.string({ required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const today = getTodayStr();
      const effectiveTo = args.effectiveTo.trim().slice(0, 10);

      // ETP-17 / AT-ETP-018: Block past effectiveTo
      if (effectiveTo < today) {
        throw new Error('Ngày ngừng sử dụng xe không được ở trong quá khứ');
      }

      const regId = BigInt(args.id);
      const reg = await prisma.employeeTransportProfile.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.delFlag === 'Y') {
        throw new Error('Không tìm thấy bản đăng ký');
      }
      if (reg.approvalStatus !== 'APPROVED') {
        throw new Error('Chỉ có thể ngừng sử dụng bản đăng ký đã duyệt');
      }
      if (effectiveTo < reg.effectiveFrom) {
        throw new Error('Ngày ngừng sử dụng không được nhỏ hơn ngày bắt đầu hiệu lực');
      }

      // ETP-19a / AT-ETP-017: Cannot exceed day before next future APPROVED registration
      if (reg.employeeId || reg.provTempCode) {
        const ownerWhere = reg.employeeId
          ? { employeeId: reg.employeeId }
          : { provTempCode: reg.provTempCode! };
        const nextFuture = await prisma.employeeTransportProfile.findFirst({
          where: {
            ...ownerWhere,
            id: { not: reg.id },
            delFlag: 'N',
            approvalStatus: 'APPROVED',
            effectiveFrom: { gt: reg.effectiveFrom },
          },
          orderBy: { effectiveFrom: 'asc' },
        });

        if (nextFuture && effectiveTo >= nextFuture.effectiveFrom) {
          throw new Error(
            `Ngày ngừng sử dụng không được vượt quá ngày liền trước đăng ký kế tiếp (${subtractOneDay(nextFuture.effectiveFrom)})`,
          );
        }

        // Also reject any open PENDING registrations per QA §4.1
        await prisma.employeeTransportProfile.updateMany({
          where: {
            ...ownerWhere,
            delFlag: 'N',
            approvalStatus: 'PENDING',
          },
          data: {
            approvalStatus: 'REJECTED',
            rejectReason: 'Ngừng sử dụng xe',
            activeFlag: 'N',
          },
        });
      }

      const nextActiveFlag = reg.effectiveFrom <= today && effectiveTo >= today ? 'Y' : 'N';

      const updated = await prisma.employeeTransportProfile.update({
        ...query,
        where: { id: reg.id },
        data: {
          effectiveTo,
          activeFlag: nextActiveFlag,
          // ETP-24, ETP-25: Mark MANUAL_STOP even when reason is empty so deleteFutureEtpRegistration knows not to reopen!
          endReasonCode: args.reason?.trim() ? `MANUAL_STOP:${args.reason.trim()}` : 'MANUAL_STOP',
        },
      });

      await writeAuditLog(
        ctx,
        'ETP',
        reg.id,
        'DEACTIVATE',
        `Ngừng sử dụng xe #${String(reg.id)} đến hết ngày ${effectiveTo}`,
      );

      return updated;
    },
  }),

  deleteFutureEtpRegistration: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.EMP_TRANSPORT_DEACTIVATE_REG,
        FEATURE_CODES.EMP_TRANSPORT_ADD_REGISTRATION,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const today = getTodayStr();
      const regId = BigInt(args.id);
      const reg = await prisma.employeeTransportProfile.findUnique({
        where: { id: regId },
      });

      if (!reg || reg.delFlag === 'Y') {
        throw new Error('Không tìm thấy bản đăng ký');
      }

      // ETP-26 / AT-ETP-021: Only allow deleting future registrations (effectiveFrom > today)
      if (reg.effectiveFrom <= today) {
        throw new Error(
          'Không xóa được đăng ký đã bắt đầu từ hôm nay trở về trước. Vui lòng dùng Ngừng sử dụng xe.',
        );
      }

      const deleted = await prisma.employeeTransportProfile.update({
        ...query,
        where: { id: reg.id },
        data: {
          delFlag: 'Y',
          activeFlag: 'N',
        },
      });

      // ETP-22, ETP-23, ETP-24, ETP-25, ETP-30 / AT-ETP-019, AT-ETP-020:
      // Re-open or bridge the immediately preceding APPROVED registration ONLY IF:
      // - It was auto-cut (effectiveTo == subtractOneDay(reg.effectiveFrom))
      // - It was NOT manually stopped (endReasonCode does not start with MANUAL_STOP)
      // - Employee has NOT left (no leaveDate)
      if (reg.employeeId || reg.provTempCode) {
        const ownerWhere = reg.employeeId
          ? { employeeId: reg.employeeId }
          : { provTempCode: reg.provTempCode! };

        const prevReg = await prisma.employeeTransportProfile.findFirst({
          where: {
            ...ownerWhere,
            id: { not: reg.id },
            delFlag: 'N',
            approvalStatus: 'APPROVED',
            effectiveFrom: { lt: reg.effectiveFrom },
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        let empHasLeave = Boolean(reg.leaveDate);
        if (reg.employeeId) {
          const emp = await prisma.employee.findUnique({ where: { id: reg.employeeId } });
          if (emp?.leaveDate) empHasLeave = true;
        }

        if (prevReg && !empHasLeave && !prevReg.leaveDate) {
          const expectedAutoCutDate = subtractOneDay(reg.effectiveFrom);
          const isManuallyStopped = prevReg.endReasonCode?.startsWith('MANUAL_STOP') ?? false;

          if (!isManuallyStopped && prevReg.effectiveTo === expectedAutoCutDate) {
            // Check if there is another future APPROVED registration after `reg` (ETP-23 middle of chain)
            const nextFutureAfterDeleted = await prisma.employeeTransportProfile.findFirst({
              where: {
                ...ownerWhere,
                id: { not: reg.id },
                delFlag: 'N',
                approvalStatus: 'APPROVED',
                effectiveFrom: { gt: reg.effectiveFrom },
              },
              orderBy: { effectiveFrom: 'asc' },
            });

            const bridgedEffectiveTo = nextFutureAfterDeleted
              ? subtractOneDay(nextFutureAfterDeleted.effectiveFrom)
              : null;

            await prisma.employeeTransportProfile.update({
              where: { id: prevReg.id },
              data: {
                effectiveTo: bridgedEffectiveTo,
                endReasonCode: bridgedEffectiveTo ? 'AUTO_CUT' : null,
                activeFlag: prevReg.effectiveFrom <= today ? 'Y' : prevReg.activeFlag,
              },
            });
          }
        }
      }

      await writeAuditLog(
        ctx,
        'ETP',
        reg.id,
        'DELETE_FUTURE',
        `Xóa đăng ký tương lai #${String(reg.id)} (từ ${reg.effectiveFrom})`,
      );

      return deleted;
    },
  }),

  createProvisionalEtp: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.EMP_TRANSPORT_CREATE,
        FEATURE_CODES.EMP_TRANSPORT_ADD_REGISTRATION,
      ],
    },
    args: {
      provTempCode: t.arg.string({ required: true }),
      provFullName: t.arg.string({ required: true }),
      provOrgUnitId: t.arg({ type: 'BigInt' }),
      provShiftId: t.arg({ type: 'BigInt' }),
      provWorkDayMask: t.arg.string(),
      routeId: t.arg({ type: 'BigInt', required: true }),
      pickupPointId: t.arg({ type: 'BigInt', required: true }),
      dropoffPointId: t.arg({ type: 'BigInt' }),
      effectiveFrom: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const today = getTodayStr();
      const effectiveFrom = args.effectiveFrom.trim().slice(0, 10);
      if (effectiveFrom < today) {
        throw new Error('Ngày bắt đầu hiệu lực không được ở trong quá khứ');
      }

      const canAutoApprove =
        Boolean(ctx.user?.isAdmin) ||
        Boolean(ctx.user?.features.has(FEATURE_CODES.EMP_TRANSPORT_APPROVE));

      const approvalStatus = canAutoApprove ? 'APPROVED' : 'PENDING';
      const activeFlag = canAutoApprove && effectiveFrom <= today ? 'Y' : 'N';
      const newId = nextSnowflakeId();

      const created = await prisma.employeeTransportProfile.create({
        ...query,
        data: {
          id: newId,
          employeeId: null,
          routeId: BigInt(args.routeId),
          pickupPointId: BigInt(args.pickupPointId),
          dropoffPointId: args.dropoffPointId ? BigInt(args.dropoffPointId) : null,
          effectiveFrom,
          effectiveTo: null,
          activeFlag,
          delFlag: 'N',
          approvalStatus,
          isProvisional: 'Y',
          provTempCode: args.provTempCode.trim(),
          provFullName: args.provFullName.trim(),
          provOrgUnitId: args.provOrgUnitId ? BigInt(args.provOrgUnitId) : null,
          provShiftId: args.provShiftId ? BigInt(args.provShiftId) : null,
          provWorkDayMask: args.provWorkDayMask ?? '63',
        },
      });

      await writeAuditLog(
        ctx,
        'ETP',
        newId,
        'CREATE_PROVISIONAL',
        `Tạo hồ sơ tạm ${args.provTempCode} - ${args.provFullName}`,
      );

      return created;
    },
  }),

  linkProvisionalEtp: t.prismaField({
    type: 'EmployeeTransportProfile',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.EMP_TRANSPORT_CREATE,
        FEATURE_CODES.EMP_TRANSPORT_ADD_REGISTRATION,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      employeeId: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const regId = BigInt(args.id);
      const empId = BigInt(args.employeeId);

      const [reg, emp] = await Promise.all([
        prisma.employeeTransportProfile.findUnique({ where: { id: regId } }),
        prisma.employee.findUnique({ where: { id: empId } }),
      ]);

      if (!reg || reg.delFlag === 'Y') {
        throw new Error('Không tìm thấy hồ sơ tạm');
      }
      if (!emp) {
        throw new Error('Không tìm thấy nhân viên chính thức');
      }

      // Link all registrations sharing this provTempCode or this id to the official employeeId
      if (reg.provTempCode) {
        await prisma.employeeTransportProfile.updateMany({
          where: { provTempCode: reg.provTempCode, delFlag: 'N' },
          data: {
            employeeId: empId,
            isProvisional: 'N',
          },
        });
      }

      const updated = await prisma.employeeTransportProfile.update({
        ...query,
        where: { id: regId },
        data: {
          employeeId: empId,
          isProvisional: 'N',
        },
      });

      await writeAuditLog(
        ctx,
        'ETP',
        regId,
        'LINK_PROVISIONAL',
        `Liên kết hồ sơ tạm #${String(regId)} với nhân viên ${emp.empCode}`,
      );

      return updated;
    },
  }),
}));
