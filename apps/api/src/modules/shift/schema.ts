import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import { FEATURE_CODES } from '@trms/shared';

function buildSevenDayWindow(startDate?: string | null): string[] {
  let base: Date;
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
    const [y, m, d] = startDate.trim().split('-').map(Number);
    base = new Date(Date.UTC(y, m - 1, d));
  } else {
    const now = new Date();
    base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() + i);
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

export const ShiftObj = builder.prismaObject('Shift', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    shiftCode: t.exposeString('shiftCode'),
    shiftName: t.exposeString('shiftName'),
    startTime: t.exposeString('startTime', { nullable: true }),
    endTime: t.exposeString('endTime', { nullable: true }),
    workHours: t.expose('workHours', { type: 'Decimal', nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeInt('delFlag'),
    masterFlag: t.exposeString('masterFlag'),
    transportFlag: t.exposeString('transportFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    segmentUsageCount: t.int({
      resolve: (shift) =>
        prisma.segmentShift.count({
          where: {
            shiftId: shift.id,
            segment: { delFlag: 'N', route: { delFlag: 'N' } },
          },
        }),
    }),
  }),
});

export const ImportBatchRowObj = builder.prismaObject('ImportBatchRow', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    batchId: t.expose('batchId', { type: 'BigInt' }),
    lineNo: t.exposeInt('lineNo'),
    rowStatus: t.exposeString('rowStatus'),
    employeeId: t.exposeString('employeeId', { nullable: true }),
    assignmentDate: t.exposeString('assignmentDate', { nullable: true }),
    shiftCode: t.exposeString('shiftCode', { nullable: true }),
    rawPayload: t.exposeString('rawPayload', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
  }),
});

export const ImportBatchObj = builder.prismaObject('ImportBatch', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    batchCode: t.exposeString('batchCode'),
    importType: t.exposeString('importType'),
    businessDate: t.exposeString('businessDate', { nullable: true }),
    status: t.exposeString('status'),
    totalRows: t.exposeInt('totalRows'),
    validRows: t.exposeInt('validRows'),
    invalidRows: t.exposeInt('invalidRows'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    rows: t.relation('rows', {
      query: () => ({ orderBy: { lineNo: 'asc' } }),
    }),
  }),
});

export interface ShiftRegistrationRowData {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  dailyShifts: string[];
  invalidDays: boolean[];
}

export interface ShiftRegistrationGridData {
  windowDates: string[];
  rows: ShiftRegistrationRowData[];
}

export const ShiftRegistrationRowRef = builder.objectRef<ShiftRegistrationRowData>(
  'ShiftRegistrationRow',
);

ShiftRegistrationRowRef.implement({
  fields: (t) => ({
    employeeCode: t.exposeString('employeeCode'),
    employeeName: t.exposeString('employeeName'),
    departmentName: t.exposeString('departmentName'),
    dailyShifts: t.exposeStringList('dailyShifts'),
    invalidDays: t.exposeBooleanList('invalidDays'),
  }),
});

export const ShiftRegistrationGridRef = builder.objectRef<ShiftRegistrationGridData>(
  'ShiftRegistrationGrid',
);

ShiftRegistrationGridRef.implement({
  fields: (t) => ({
    windowDates: t.exposeStringList('windowDates'),
    rows: t.field({
      type: [ShiftRegistrationRowRef],
      resolve: (parent) => parent.rows,
    }),
  }),
});

export function registerShiftModule() {
  builder.queryFields((t) => ({
    shifts: t.prismaField({
      type: ['Shift'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.SHIFT_LIST,
          FEATURE_CODES.SHIFT_REGISTRATIONS,
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_LIST,
          FEATURE_CODES.REQUEST_CREATE,
        ],
      },
      args: {
        transportFlag: t.arg.string(),
        masterFlag: t.arg.string(),
        activeFlag: t.arg.string(),
        search: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.shift.findMany({
          ...query,
          where: {
            delFlag: 0,
            ...(args.transportFlag ? { transportFlag: args.transportFlag } : {}),
            ...(args.masterFlag ? { masterFlag: args.masterFlag } : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { shiftCode: { contains: args.search, mode: 'insensitive' } },
                    { shiftName: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { shiftCode: 'asc' },
        }),
    }),

    shiftRegistrations: t.field({
      type: ShiftRegistrationGridRef,
      authScopes: { feature: FEATURE_CODES.SHIFT_REGISTRATIONS },
      args: {
        startDate: t.arg.string(),
        departmentName: t.arg.string(),
        orgUnitId: t.arg({ type: 'BigInt' }),
        search: t.arg.string(),
        limit: t.arg.int({ defaultValue: 200 }),
      },
      resolve: async (_root, args) => {
        const windowDates = buildSevenDayWindow(args.startDate);
        const minDate = windowDates[0];
        const maxDate = windowDates[6];

        // Load known shift catalog to detect invalid shift codes (QA §2.1: red warning cell)
        const catalogShifts = await prisma.shift.findMany({
          where: { delFlag: 0 },
          select: { shiftCode: true },
        });
        const validShiftSet = new Set(
          catalogShifts.map((s) => s.shiftCode.trim().toUpperCase()),
        );

        // Fetch shift assignment rows within the 7-day window from confirmed import batches
        const batchRows = await prisma.importBatchRow.findMany({
          where: {
            assignmentDate: { gte: minDate, lte: maxDate },
            employeeId: { not: null },
            batch: { status: 'CONFIRMED' },
          },
          orderBy: { id: 'desc' },
        });

        // Map employeeCode/employeeId -> date -> shiftCodes[]
        const empDayMap = new Map<string, Map<string, string[]>>();
        for (const r of batchRows) {
          const empKey = (r.employeeId || '').trim();
          const dateKey = (r.assignmentDate || '').trim().slice(0, 10);
          const sCode = (r.shiftCode || '').trim();
          if (!empKey || !dateKey || !sCode) continue;

          let dayMap = empDayMap.get(empKey);
          if (!dayMap) {
            dayMap = new Map<string, string[]>();
            empDayMap.set(empKey, dayMap);
          }
          const existingCodes = dayMap.get(dateKey) ?? [];
          if (!existingCodes.includes(sCode)) {
            existingCodes.push(sCode);
            dayMap.set(dateKey, existingCodes);
          }
        }

        // Load employee directory
        const allEmployees = await prisma.employee.findMany({
          include: { orgUnit: true },
          orderBy: { empCode: 'asc' },
        });

        const empByCode = new Map<string, (typeof allEmployees)[number]>();
        const empById = new Map<string, (typeof allEmployees)[number]>();
        for (const emp of allEmployees) {
          empByCode.set(emp.empCode.trim().toUpperCase(), emp);
          empById.set(String(emp.id), emp);
        }

        // Collect all unique employee keys from batchRows (or fallback to employees if batchRows reference empCode/id)
        const candidateKeys = new Set<string>();
        for (const k of empDayMap.keys()) {
          candidateKeys.add(k);
        }
        // If no batch rows matched this specific 7-day window, still show employees that have assignments in latest batch
        if (candidateKeys.size === 0) {
          const latestBatch = await prisma.importBatch.findFirst({
            where: { status: 'CONFIRMED' },
            orderBy: { id: 'desc' },
            include: { rows: { take: 1000, orderBy: { lineNo: 'asc' } } },
          });
          if (latestBatch) {
            for (const r of latestBatch.rows) {
              const empKey = (r.employeeId || '').trim();
              const dateKey = (r.assignmentDate || '').trim().slice(0, 10);
              const sCode = (r.shiftCode || '').trim();
              if (!empKey) continue;
              candidateKeys.add(empKey);
              if (dateKey && sCode) {
                let dayMap = empDayMap.get(empKey);
                if (!dayMap) {
                  dayMap = new Map<string, string[]>();
                  empDayMap.set(empKey, dayMap);
                }
                const list = dayMap.get(dateKey) ?? [];
                if (!list.includes(sCode)) {
                  list.push(sCode);
                  dayMap.set(dateKey, list);
                }
              }
            }
          }
        }

        const rows: ShiftRegistrationRowData[] = [];
        const seenEmpCodes = new Set<string>();

        for (const key of candidateKeys) {
          const emp = empByCode.get(key.toUpperCase()) ?? empById.get(key);
          const employeeCode = emp ? emp.empCode : key;
          if (seenEmpCodes.has(employeeCode)) continue;
          seenEmpCodes.add(employeeCode);

          const employeeName = emp ? emp.fullName : `Nhân viên ${employeeCode}`;
          const departmentName = emp?.orgUnit?.name ?? '-';

          // QA §2.1: Filter by department; employees without department ('-') are hidden when a department filter is selected
          if (args.orgUnitId) {
            if (!emp?.orgUnitId || emp.orgUnitId !== BigInt(args.orgUnitId)) {
              continue;
            }
          }
          if (args.departmentName && args.departmentName.trim()) {
            const deptFilter = args.departmentName.trim().toLowerCase();
            if (departmentName === '-' || !departmentName.toLowerCase().includes(deptFilter)) {
              continue;
            }
          }

          const dayMap =
            empDayMap.get(key) ??
            empDayMap.get(employeeCode) ??
            (emp ? empDayMap.get(String(emp.id)) : undefined);

          const dailyShifts: string[] = [];
          const invalidDays: boolean[] = [];

          for (const d of windowDates) {
            const codes = dayMap?.get(d) ?? [];
            if (codes.length === 0) {
              dailyShifts.push('-');
              invalidDays.push(false);
            } else {
              const cellText = codes.join(', ');
              dailyShifts.push(cellText);
              const hasUnknown = codes.some((c) => !validShiftSet.has(c.trim().toUpperCase()));
              invalidDays.push(hasUnknown);
            }
          }

          if (args.search && args.search.trim()) {
            const q = args.search.trim().toLowerCase();
            const haystack = [
              employeeCode,
              employeeName,
              departmentName,
              ...dailyShifts,
            ]
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(q)) {
              continue;
            }
          }

          rows.push({
            employeeCode,
            employeeName,
            departmentName,
            dailyShifts,
            invalidDays,
          });
        }

        const take = args.limit && args.limit > 0 ? args.limit : 200;
        return {
          windowDates,
          rows: rows.slice(0, take),
        };
      },
    }),
  }));

  builder.mutationFields((t) => ({
    updateShiftTransportFlag: t.prismaField({
      type: 'Shift',
      authScopes: { feature: FEATURE_CODES.SHIFT_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        transportFlag: t.arg.string({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const shiftId = BigInt(args.id);
        const flag = args.transportFlag.trim().toUpperCase();
        if (flag !== 'Y' && flag !== 'N') {
          throw new Error('transportFlag chỉ chấp nhận Y hoặc N');
        }

        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift || shift.delFlag !== 0) {
          throw new Error('Ca làm việc không tồn tại');
        }

        // QA §2.2 / AT-SHIFT-003: Chặn tắt transportFlag = 'N' nếu ca đang gắn vào SegmentShift của tuyến
        if (flag === 'N' && shift.transportFlag === 'Y') {
          const usedCount = await prisma.segmentShift.count({
            where: {
              shiftId,
              segment: { delFlag: 'N', route: { delFlag: 'N' } },
            },
          });
          if (usedCount > 0) {
            throw new Error(
              `Ca làm việc ${shift.shiftCode} đang được gắn trong lượt của tuyến, không thể tắt Đưa đón`,
            );
          }
        }

        const updated = await prisma.shift.update({
          ...query,
          where: { id: shiftId },
          data: { transportFlag: flag },
        });

        await writeAuditLog(
          ctx,
          'SHIFT',
          updated.id,
          'UPDATE_TRANSPORT_FLAG',
          `${flag === 'Y' ? 'Bật' : 'Tắt'} đưa đón cho ca ${updated.shiftCode}`,
        );
        return updated;
      },
    }),
  }));
}

registerShiftModule();
