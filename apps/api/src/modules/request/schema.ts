import { builder } from '../../builder.js';
import { prisma, writeAuditLog, GraphQLContext } from '../../context.js';
import { FEATURE_CODES, nextSnowflakeId } from '@trms/shared';
import {
  composeRequestStatus,
  doesRouteRunOnDate,
  isRegistrationEffectiveOnDate,
} from '@trms/domain';

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function canViewRequesterInfo(
  ctx: GraphQLContext,
  requesterId: bigint | null,
): boolean {
  if (!ctx.user) return false;
  if (ctx.user.isAdmin) return true;
  if (ctx.user.features.has(FEATURE_CODES.REQUEST_VIEW_REQUESTER)) return true;
  if (requesterId && ctx.user.id === requesterId) return true;
  return false;
}

function resolveInitialStatusByRole(ctx: GraphQLContext): string {
  if (!ctx.user) return 'PENDING_DEPARTMENT';
  if (
    ctx.user.isAdmin ||
    ctx.user.features.has(FEATURE_CODES.REQUEST_APPROVE_GA) ||
    ctx.user.roles.includes('GA_LEADER') ||
    ctx.user.roles.includes('GA_PIC')
  ) {
    return 'WAITING_VENDOR_DISPATCH';
  }
  if (
    ctx.user.features.has(FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT) ||
    ctx.user.roles.includes('TBP')
  ) {
    return 'PENDING_GA';
  }
  return 'PENDING_DEPARTMENT';
}

export const RequestPassengerObj = builder.prismaObject('RequestPassenger', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    requestId: t.expose('requestId', { type: 'BigInt' }),
    passengerId: t.exposeString('passengerId', { nullable: true }),
    passengerName: t.exposeString('passengerName'),
    passengerType: t.exposeString('passengerType'),
    departurePickupTime: t.exposeString('departurePickupTime', { nullable: true }),
    departurePickupPointText: t.exposeString('departurePickupPointText', { nullable: true }),
    departureArrivalTime: t.exposeString('departureArrivalTime', { nullable: true }),
    departureDropoffPointText: t.exposeString('departureDropoffPointText', { nullable: true }),
    returnPickupTime: t.exposeString('returnPickupTime', { nullable: true }),
    returnPickupPointText: t.exposeString('returnPickupPointText', { nullable: true }),
    returnDropoffPointText: t.exposeString('returnDropoffPointText', { nullable: true }),
    passengerNote: t.exposeString('passengerNote', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
  }),
});

export const RequestStatusHistoryObj = builder.prismaObject('RequestStatusHistory', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    requestId: t.expose('requestId', { type: 'BigInt' }),
    fromStatus: t.exposeString('fromStatus', { nullable: true }),
    toStatus: t.exposeString('toStatus'),
    actionBy: t.expose('actionBy', { type: 'BigInt', nullable: true }),
    actionAt: t.expose('actionAt', { type: 'DateTime', nullable: true }),
    actionReason: t.exposeString('actionReason', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
  }),
});

export const ApprovalRecordObj = builder.prismaObject('ApprovalRecord', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    requestId: t.expose('requestId', { type: 'BigInt' }),
    stepNo: t.exposeInt('stepNo'),
    approvalStage: t.exposeString('approvalStage'),
    approverId: t.expose('approverId', { type: 'BigInt', nullable: true }),
    approverName: t.exposeString('approverName', { nullable: true }),
    decision: t.exposeString('decision'),
    decisionReason: t.exposeString('decisionReason', { nullable: true }),
    decidedAt: t.expose('decidedAt', { type: 'DateTime', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
  }),
});

export const TransportRequestObj = builder.prismaObject('TransportRequest', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    requestCode: t.exposeString('requestCode'),
    businessDate: t.exposeString('businessDate'),
    requestType: t.exposeString('requestType'),
    requestSource: t.exposeString('requestSource'),
    requesterId: t.expose('requesterId', { type: 'BigInt', nullable: true }),
    requesterName: t.field({
      type: 'String',
      nullable: true,
      resolve: (parent, _args, ctx) => {
        if (!canViewRequesterInfo(ctx, parent.requesterId)) {
          return null;
        }
        return parent.requesterName;
      },
    }),
    departmentId: t.expose('departmentId', { type: 'BigInt', nullable: true }),
    departmentName: t.field({
      type: 'String',
      nullable: true,
      resolve: (parent, _args, ctx) => {
        if (!canViewRequesterInfo(ctx, parent.requesterId)) {
          return null;
        }
        return parent.departmentName;
      },
    }),
    routeId: t.expose('routeId', { type: 'BigInt', nullable: true }),
    requestedVehicleType: t.exposeString('requestedVehicleType', { nullable: true }),
    passengerCount: t.exposeInt('passengerCount'),
    status: t.exposeString('status'),
    outboundStatus: t.exposeString('outboundStatus', { nullable: true }),
    returnStatus: t.exposeString('returnStatus', { nullable: true }),
    returnedFromStatus: t.exposeString('returnedFromStatus', { nullable: true }),
    approvalBypassFlag: t.exposeString('approvalBypassFlag'),
    currentTripId: t.expose('currentTripId', { type: 'BigInt', nullable: true }),
    overrideReason: t.exposeString('overrideReason', { nullable: true }),
    tripMode: t.exposeString('tripMode'),
    departureTime: t.exposeString('departureTime', { nullable: true }),
    expectedArrivalTime: t.exposeString('expectedArrivalTime', { nullable: true }),
    returnTime: t.exposeString('returnTime', { nullable: true }),
    returnExpectedArrivalTime: t.exposeString('returnExpectedArrivalTime', { nullable: true }),
    departurePickupPointId: t.expose('departurePickupPointId', { type: 'BigInt', nullable: true }),
    departureDropoffPointId: t.expose('departureDropoffPointId', { type: 'BigInt', nullable: true }),
    returnPickupPointId: t.expose('returnPickupPointId', { type: 'BigInt', nullable: true }),
    returnDropoffPointId: t.expose('returnDropoffPointId', { type: 'BigInt', nullable: true }),
    departurePickupPointText: t.exposeString('departurePickupPointText', { nullable: true }),
    departureDropoffPointText: t.exposeString('departureDropoffPointText', { nullable: true }),
    returnPickupPointText: t.exposeString('returnPickupPointText', { nullable: true }),
    returnDropoffPointText: t.exposeString('returnDropoffPointText', { nullable: true }),
    departurePointNote: t.exposeString('departurePointNote', { nullable: true }),
    returnPointNote: t.exposeString('returnPointNote', { nullable: true }),
    contactName: t.exposeString('contactName', { nullable: true }),
    contactPhone: t.exposeString('contactPhone', { nullable: true }),
    departmentApproverIds: t.exposeString('departmentApproverIds', { nullable: true }),
    otShiftCode: t.exposeString('otShiftCode', { nullable: true }),
    otShiftDate: t.exposeString('otShiftDate', { nullable: true }),
    otPairId: t.expose('otPairId', { type: 'BigInt', nullable: true }),
    legDirection: t.exposeString('legDirection', { nullable: true }),
    pickupScope: t.exposeString('pickupScope', { nullable: true }),
    senderInfo: t.exposeString('senderInfo', { nullable: true }),
    receiverInfo: t.exposeString('receiverInfo', { nullable: true }),
    purpose: t.exposeString('purpose', { nullable: true }),
    notes: t.exposeString('notes', { nullable: true }),
    gaActions: t.exposeString('gaActions', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    passengers: t.relation('passengers', {
      query: () => ({ orderBy: { id: 'asc' } }),
    }),
    statusHistory: t.relation('statusHistory', {
      query: () => ({ orderBy: { id: 'desc' } }),
    }),
    approvals: t.relation('approvals', {
      query: () => ({ orderBy: { id: 'asc' } }),
    }),
    tripLinks: t.relation('tripLinks', {
      query: () => ({ where: { delFlag: 'N' }, orderBy: { id: 'asc' } }),
    }),
  }),
});

export interface OtShiftOptionItem {
  code: string;
  label: string;
  optionType: string; // FIXED_SLOT | OT_SHIFT
  directionMode: string; // RETURN_ONLY | BOTH | NONE
  departureTime: string | null;
  returnTime: string | null;
  nextDayReturn: boolean;
  disabled: boolean;
  disabledReason: string | null;
}

export const OtShiftOptionRef = builder.objectRef<OtShiftOptionItem>('OtShiftOptionItem').implement({
  fields: (t) => ({
    code: t.exposeString('code'),
    label: t.exposeString('label'),
    optionType: t.exposeString('optionType'),
    directionMode: t.exposeString('directionMode'),
    departureTime: t.exposeString('departureTime', { nullable: true }),
    returnTime: t.exposeString('returnTime', { nullable: true }),
    nextDayReturn: t.exposeBoolean('nextDayReturn'),
    disabled: t.exposeBoolean('disabled'),
    disabledReason: t.exposeString('disabledReason', { nullable: true }),
  }),
});

export const BulkOtItemInput = builder.inputType('BulkOtItemInput', {
  fields: (t) => ({
    employeeId: t.field({ type: 'BigInt' }),
    empCode: t.string(),
    passengerName: t.string(),
    otDate: t.string({ required: true }),
    otShiftCode: t.string({ required: true }),
    direction: t.string(), // TO_FACTORY | FROM_FACTORY | BOTH | BOTH_DIRECTIONS
    returnDayOption: t.string(), // SAME_DAY | NEXT_DAY
    pickupPointId: t.field({ type: 'BigInt' }),
    dropoffPointId: t.field({ type: 'BigInt' }),
    pickupPointText: t.string(),
    dropoffPointText: t.string(),
    departureTime: t.string(),
    returnTime: t.string(),
    note: t.string(),
  }),
});

export const RequestPassengerInput = builder.inputType('RequestPassengerInput', {
  fields: (t) => ({
    passengerId: t.string(),
    passengerName: t.string({ required: true }),
    passengerType: t.string(),
    departurePickupTime: t.string(),
    departurePickupPointText: t.string(),
    departureArrivalTime: t.string(),
    departureDropoffPointText: t.string(),
    returnPickupTime: t.string(),
    returnPickupPointText: t.string(),
    returnDropoffPointText: t.string(),
    passengerNote: t.string(),
  }),
});

builder.queryFields((t) => ({
  transportRequests: t.prismaField({
    type: ['TransportRequest'],
    authScopes: { feature: FEATURE_CODES.REQUEST_LIST },
    args: {
      status: t.arg.string(),
      statuses: t.arg.stringList(),
      requestType: t.arg.string(),
      businessDate: t.arg.string(),
      departmentId: t.arg({ type: 'BigInt' }),
      requesterId: t.arg({ type: 'BigInt' }),
      search: t.arg.string(),
      limit: t.arg.int({ defaultValue: 100 }),
    },
    resolve: (query, _root, args) => {
      const statusList: string[] = [];
      const addExpandedStatus = (st: string) => {
        statusList.push(st);
        if (st === 'WAITING_DRIVER_CONFIRM') statusList.push('DISPATCHED');
        if (st === 'DISPATCHED') statusList.push('WAITING_DRIVER_CONFIRM');
        if (st === 'APPROVED_BY_TAXI') statusList.push('APPROVED_TAXI');
        if (st === 'APPROVED_TAXI') statusList.push('APPROVED_BY_TAXI');
        if (st === 'PENDING_GA') statusList.push('PENDING_GA_DEPARTMENT');
      };
      if (args.status) addExpandedStatus(args.status);
      if (args.statuses && args.statuses.length > 0) {
        for (const st of args.statuses) addExpandedStatus(st);
      }

      let requestTypeList: string[] | undefined;
      if (args.requestType) {
        const rt = args.requestType.trim().toUpperCase();
        if (rt === 'BUSINESS' || rt === 'BUSINESS_TRIP') {
          requestTypeList = ['BUSINESS', 'BUSINESS_TRIP'];
        } else if (rt === 'GOODS' || rt === 'CARGO') {
          requestTypeList = ['GOODS', 'CARGO'];
        } else if (rt === 'OVERTIME' || rt === 'OT') {
          requestTypeList = ['OVERTIME', 'OT'];
        } else {
          requestTypeList = [args.requestType];
        }
      }

      return prisma.transportRequest.findMany({
        ...query,
        where: {
          ...(statusList.length > 0 ? { status: { in: Array.from(new Set(statusList)) } } : {}),
          ...(requestTypeList ? { requestType: { in: requestTypeList } } : {}),
          ...(args.businessDate ? { businessDate: args.businessDate } : {}),
          ...(args.departmentId ? { departmentId: BigInt(args.departmentId) } : {}),
          ...(args.requesterId ? { requesterId: BigInt(args.requesterId) } : {}),
          ...(args.search
            ? {
                OR: [
                  { requestCode: { contains: args.search, mode: 'insensitive' } },
                  { requesterName: { contains: args.search, mode: 'insensitive' } },
                  { departmentName: { contains: args.search, mode: 'insensitive' } },
                  { purpose: { contains: args.search, mode: 'insensitive' } },
                  { departurePickupPointText: { contains: args.search, mode: 'insensitive' } },
                  { departureDropoffPointText: { contains: args.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        take: args.limit ?? 100,
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      });
    },
  }),

  transportRequest: t.prismaField({
    type: 'TransportRequest',
    nullable: true,
    authScopes: {
      anyFeature: [FEATURE_CODES.REQUEST_GET, FEATURE_CODES.REQUEST_LIST],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: (query, _root, args) =>
      prisma.transportRequest.findUnique({
        ...query,
        where: { id: BigInt(args.id) },
      }),
  }),

  otShiftOptions: t.field({
    type: [OtShiftOptionRef],
    authScopes: { authenticated: true },
    args: {
      date: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const dateStr = args.date.trim().slice(0, 10);

      // Load holiday settings if any
      const holidaySetting = await prisma.setting.findUnique({
        where: { varKey: 'HOLIDAY_DATES' },
      });
      const holidayDates = new Set<string>();
      if (holidaySetting?.varValue) {
        try {
          const parsed = JSON.parse(holidaySetting.varValue);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string') holidayDates.add(item.slice(0, 10));
              else if (item?.date) holidayDates.add(String(item.date).slice(0, 10));
            }
          }
        } catch {
          for (const part of holidaySetting.varValue.split(',')) {
            if (part.trim()) holidayDates.add(part.trim().slice(0, 10));
          }
        }
      }

      const d = new Date(`${dateStr}T00:00:00+07:00`);
      const dayOfWeek = d.getDay(); // 0 = Sun, 1..5 = Mon..Fri, 6 = Sat
      const isHoliday = holidayDates.has(dateStr);
      const isWeekday = !isHoliday && dayOfWeek >= 1 && dayOfWeek <= 5;
      const isSaturday = !isHoliday && dayOfWeek === 6;
      const isSunday = !isHoliday && dayOfWeek === 0;

      // Check which shifts are already covered by STAFF fixed routes running on this Saturday/Sunday (QA §3.5 / AT-OT-003)
      const staffRouteShiftCodes = new Set<string>();
      if (isSaturday || isSunday) {
        const staffRoutes = await prisma.route.findMany({
          where: {
            delFlag: 'N',
            activeFlag: 'Y',
            passengerType: 'STAFF',
          },
          include: {
            segments: {
              where: { delFlag: 'N', activeFlag: 'Y' },
              include: {
                segmentShifts: {
                  include: { shift: true },
                },
              },
            },
          },
        });

        for (const rt of staffRoutes) {
          if (doesRouteRunOnDate(rt.runDays, dateStr, holidayDates)) {
            for (const seg of rt.segments) {
              for (const ss of seg.segmentShifts) {
                if (ss.shift?.shiftCode) {
                  staffRouteShiftCodes.add(ss.shift.shiftCode);
                }
              }
            }
          }
        }
      }

      const results: OtShiftOptionItem[] = [];

      // 1. Weekday fixed OT slots (17:30, 18:05, 18:25, 19:05, 19:20, 20:20) — QA §3.5 / AT-OT-002
      if (isWeekday) {
        const fixedSlots = ['17:30', '18:05', '18:25', '19:05', '19:20', '20:20'];
        for (const slot of fixedSlots) {
          results.push({
            code: slot,
            label: `Khung giờ ${slot}`,
            optionType: 'FIXED_SLOT',
            directionMode: 'RETURN_ONLY',
            departureTime: null,
            returnTime: slot,
            nextDayReturn: false,
            disabled: false,
            disabledReason: null,
          });
        }
      }

      // 2. Standard OT shifts per QA §3.6 table
      const otShiftCatalog = [
        {
          code: 'E20-06:00',
          label: 'E20-06:00 (Về 06:20 hôm sau)',
          returnTime: '06:20',
          nextDayReturn: true,
          weekday: { mode: 'BOTH', dep: '19:00' },
          saturday: { mode: 'BOTH', dep: '19:00' },
          sunday: { mode: 'BOTH', dep: '19:00' },
          holiday: { mode: 'BOTH', dep: '19:00' },
        },
        {
          code: 'E20-08:00',
          label: 'E20-08:00 (Về 08:20 hôm sau)',
          returnTime: '08:20',
          nextDayReturn: true,
          weekday: { mode: 'BOTH', dep: '19:00' },
          saturday: { mode: 'BOTH', dep: '19:00' },
          sunday: { mode: 'BOTH', dep: '19:00' },
          holiday: { mode: 'BOTH', dep: '19:00' },
        },
        {
          code: 'C8-16:45',
          label: 'C8-16:45 (CN)',
          returnTime: '17:05',
          nextDayReturn: false,
          weekday: { mode: 'NONE', dep: null },
          saturday: { mode: 'NONE', dep: null },
          sunday: { mode: 'BOTH', dep: '07:00' },
          holiday: { mode: 'BOTH', dep: '07:00' },
        },
        {
          code: 'C8-20:00',
          label: 'C8-20:00 (Về 20:20)',
          returnTime: '20:20',
          nextDayReturn: false,
          weekday: { mode: 'NONE', dep: null },
          saturday: { mode: 'RETURN_ONLY', dep: null },
          sunday: { mode: 'BOTH', dep: '07:00' },
          holiday: { mode: 'BOTH', dep: '07:00' },
        },
        {
          code: '12:45',
          label: '12:45 (T7)',
          returnTime: '12:45',
          nextDayReturn: false,
          weekday: { mode: 'NONE', dep: null },
          saturday: { mode: 'RETURN_ONLY', dep: null },
          sunday: { mode: 'NONE', dep: null },
          holiday: { mode: 'NONE', dep: null },
        },
      ];

      for (const sh of otShiftCatalog) {
        const rule = isHoliday
          ? sh.holiday
          : isSaturday
            ? sh.saturday
            : isSunday
              ? sh.sunday
              : sh.weekday;

        const coveredByFixedRoute = staffRouteShiftCodes.has(sh.code);
        const isNone = rule.mode === 'NONE';
        const disabled = coveredByFixedRoute || isNone;
        const disabledReason = coveredByFixedRoute
          ? 'Ca này đã có xe tuyến cố định'
          : isNone
            ? 'Ca OT này không có chuyến ở ngày đã chọn'
            : null;

        results.push({
          code: sh.code,
          label: sh.label,
          optionType: 'OT_SHIFT',
          directionMode: rule.mode,
          departureTime: rule.dep,
          returnTime: sh.returnTime,
          nextDayReturn: sh.nextDayReturn,
          disabled,
          disabledReason,
        });
      }

      // Also include any DB shifts that are marked on Saturday/Sunday STAFF routes so AT-OT-003 can verify disabled flag
      for (const routeShiftCode of staffRouteShiftCodes) {
        if (!results.some((r) => r.code === routeShiftCode)) {
          results.push({
            code: routeShiftCode,
            label: `Ca ${routeShiftCode}`,
            optionType: 'OT_SHIFT',
            directionMode: 'NONE',
            departureTime: null,
            returnTime: null,
            nextDayReturn: false,
            disabled: true,
            disabledReason: 'Ca này đã có xe tuyến cố định',
          });
        }
      }

      return results;
    },
  }),
}));

builder.mutationFields((t) => ({
  createTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: { feature: FEATURE_CODES.REQUEST_CREATE },
    args: {
      businessDate: t.arg.string({ required: true }),
      requestType: t.arg.string({ required: true }),
      tripMode: t.arg.string({ defaultValue: 'ONE_WAY' }),
      passengerCount: t.arg.int({ defaultValue: 1 }),
      requestedVehicleType: t.arg.string(),
      departureTime: t.arg.string(),
      expectedArrivalTime: t.arg.string(),
      returnTime: t.arg.string(),
      returnExpectedArrivalTime: t.arg.string(),
      departurePickupPointId: t.arg({ type: 'BigInt' }),
      departureDropoffPointId: t.arg({ type: 'BigInt' }),
      returnPickupPointId: t.arg({ type: 'BigInt' }),
      returnDropoffPointId: t.arg({ type: 'BigInt' }),
      departurePickupPointText: t.arg.string(),
      departureDropoffPointText: t.arg.string(),
      returnPickupPointText: t.arg.string(),
      returnDropoffPointText: t.arg.string(),
      departurePointNote: t.arg.string(),
      returnPointNote: t.arg.string(),
      contactName: t.arg.string(),
      contactPhone: t.arg.string(),
      departmentApproverIds: t.arg.string(),
      senderInfo: t.arg.string(),
      receiverInfo: t.arg.string(),
      purpose: t.arg.string(),
      notes: t.arg.string(),
      passengers: t.arg({ type: [RequestPassengerInput] }),
    },
    resolve: async (query, _root, args, ctx) => {
      const requestType = args.requestType.trim().toUpperCase();
      // QA §3.2 & §3.7: Non-BUSINESS requests are always ONE_WAY
      const tripMode =
        requestType === 'BUSINESS' && args.tripMode === 'ROUND_TRIP'
          ? 'ROUND_TRIP'
          : 'ONE_WAY';

      const passengerCount =
        requestType === 'GOODS' || requestType === 'CARGO'
          ? 0
          : (args.passengerCount ?? 1);

      if (requestType === 'BUSINESS') {
        if (passengerCount <= 0) {
          throw new Error('Số lượng đăng ký phải lớn hơn 0');
        }
        if (
          args.passengers &&
          args.passengers.length > 0 &&
          args.passengers.length !== passengerCount
        ) {
          throw new Error('Số tên hành khách phải khớp với Số lượng đăng ký');
        }
      }

      if (requestType === 'GOODS' || requestType === 'CARGO') {
        if (!args.senderInfo?.trim() || !args.receiverInfo?.trim()) {
          throw new Error('Đơn vận chuyển hàng hóa bắt buộc có thông tin người gửi và người nhận');
        }
      }

      // Check pickup != dropoff
      if (
        args.departurePickupPointId &&
        args.departureDropoffPointId &&
        BigInt(args.departurePickupPointId) === BigInt(args.departureDropoffPointId)
      ) {
        throw new Error('Điểm đón và điểm trả không được trùng nhau');
      }
      if (
        args.departurePickupPointText &&
        args.departureDropoffPointText &&
        args.departurePickupPointText.trim().toLowerCase() ===
          args.departureDropoffPointText.trim().toLowerCase()
      ) {
        throw new Error('Điểm đón và điểm trả không được trùng nhau');
      }

      const initialStatus = resolveInitialStatusByRole(ctx);
      if (
        initialStatus === 'PENDING_DEPARTMENT' &&
        args.departmentApproverIds !== undefined &&
        !args.departmentApproverIds?.trim()
      ) {
        throw new Error('Người yêu cầu bắt buộc chọn người duyệt bộ phận');
      }

      const id = nextSnowflakeId();
      const businessDate = args.businessDate.trim().slice(0, 10);
      const code = `REQ-${businessDate.replace(/-/g, '')}-${String(id).slice(-5)}`;

      let pickupText = args.departurePickupPointText ?? null;
      let dropoffText = args.departureDropoffPointText ?? null;
      if (!pickupText && args.departurePickupPointId) {
        const pt = await prisma.point.findUnique({
          where: { id: BigInt(args.departurePickupPointId) },
        });
        pickupText = pt?.pointName ?? null;
      }
      if (!dropoffText && args.departureDropoffPointId) {
        const pt = await prisma.point.findUnique({
          where: { id: BigInt(args.departureDropoffPointId) },
        });
        dropoffText = pt?.pointName ?? null;
      }

      let retPickupText = tripMode === 'ROUND_TRIP' ? (args.returnPickupPointText ?? dropoffText) : null;
      let retDropoffText = tripMode === 'ROUND_TRIP' ? (args.returnDropoffPointText ?? pickupText) : null;

      if (tripMode === 'ROUND_TRIP') {
        if (!args.returnTime) {
          throw new Error('Đơn khứ hồi bắt buộc nhập giờ chiều về');
        }
      }

      const created = await prisma.transportRequest.create({
        ...query,
        data: {
          id,
          requestCode: code,
          businessDate,
          requestType: requestType === 'CARGO' ? 'GOODS' : requestType,
          requestSource: 'MANUAL',
          requesterId: ctx.user?.id ?? null,
          requesterName: ctx.user?.fullName ?? 'Nhân viên',
          departmentName: 'Phòng ban',
          requestedVehicleType: args.requestedVehicleType ?? null,
          passengerCount,
          status: initialStatus,
          outboundStatus: initialStatus,
          returnStatus: tripMode === 'ROUND_TRIP' ? initialStatus : null,
          approvalBypassFlag: initialStatus === 'WAITING_VENDOR_DISPATCH' ? 'Y' : 'N',
          tripMode,
          departureTime: args.departureTime ?? null,
          expectedArrivalTime: args.expectedArrivalTime ?? null,
          returnTime: tripMode === 'ROUND_TRIP' ? (args.returnTime ?? null) : null,
          returnExpectedArrivalTime:
            tripMode === 'ROUND_TRIP' ? (args.returnExpectedArrivalTime ?? null) : null,
          departurePickupPointId: args.departurePickupPointId
            ? BigInt(args.departurePickupPointId)
            : null,
          departureDropoffPointId: args.departureDropoffPointId
            ? BigInt(args.departureDropoffPointId)
            : null,
          returnPickupPointId:
            tripMode === 'ROUND_TRIP' && args.returnPickupPointId
              ? BigInt(args.returnPickupPointId)
              : null,
          returnDropoffPointId:
            tripMode === 'ROUND_TRIP' && args.returnDropoffPointId
              ? BigInt(args.returnDropoffPointId)
              : null,
          departurePickupPointText: pickupText,
          departureDropoffPointText: dropoffText,
          returnPickupPointText: retPickupText,
          returnDropoffPointText: retDropoffText,
          departurePointNote: args.departurePointNote ?? null,
          returnPointNote: tripMode === 'ROUND_TRIP' ? (args.returnPointNote ?? null) : null,
          contactName: args.contactName ?? ctx.user?.fullName ?? null,
          contactPhone: args.contactPhone ?? null,
          departmentApproverIds: args.departmentApproverIds ?? null,
          senderInfo: args.senderInfo ?? null,
          receiverInfo: args.receiverInfo ?? null,
          purpose: args.purpose ?? null,
          notes: args.notes ?? null,
          passengers:
            args.passengers && args.passengers.length > 0
              ? {
                  create: args.passengers.map((p) => ({
                    id: nextSnowflakeId(),
                    passengerId: p.passengerId ?? null,
                    passengerName: p.passengerName.trim(),
                    passengerType: p.passengerType ?? 'STAFF',
                    departurePickupTime: p.departurePickupTime ?? null,
                    departurePickupPointText: p.departurePickupPointText ?? pickupText,
                    departureArrivalTime: p.departureArrivalTime ?? null,
                    departureDropoffPointText: p.departureDropoffPointText ?? dropoffText,
                    returnPickupTime: p.returnPickupTime ?? null,
                    returnPickupPointText: p.returnPickupPointText ?? retPickupText,
                    returnDropoffPointText: p.returnDropoffPointText ?? retDropoffText,
                    passengerNote: p.passengerNote ?? null,
                  })),
                }
              : undefined,
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: null,
              toStatus: initialStatus,
              actionBy: ctx.user?.id ?? null,
              actionReason: 'Tạo mới yêu cầu xe',
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        id,
        'CREATE',
        `Tạo yêu cầu xe ${code} (${requestType}) trạng thái ${initialStatus}`,
      );

      return created;
    },
  }),

  createBulkOtRequests: t.prismaField({
    type: ['TransportRequest'],
    authScopes: { feature: FEATURE_CODES.REQUEST_CREATE },
    args: {
      items: t.arg({ type: [BulkOtItemInput], required: true }),
      departmentApproverIds: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      // QA §3.5 / AT-OT-005: 1..50 rows
      if (args.items.length === 0) {
        throw new Error('Danh sách đăng ký OT không được để trống');
      }
      if (args.items.length > 50) {
        throw new Error('Mỗi lần tạo yêu cầu OT chỉ cho phép tối đa 50 dòng');
      }

      const initialStatus = resolveInitialStatusByRole(ctx);
      const seenKeys = new Set<string>();
      const createdIds: bigint[] = [];

      for (let idx = 0; idx < args.items.length; idx++) {
        const item = args.items[idx];
        const rowNo = idx + 1;
        const otDate = item.otDate.trim().slice(0, 10);
        const shiftCode = item.otShiftCode.trim();
        const direction = (item.direction ?? 'FROM_FACTORY').trim().toUpperCase();

        // Resolve employee & validate active ETP registration on otDate (AT-OT-001)
        let emp = null;
        if (item.employeeId) {
          emp = await prisma.employee.findUnique({ where: { id: BigInt(item.employeeId) } });
        } else if (item.empCode) {
          emp = await prisma.employee.findUnique({ where: { empCode: item.empCode.trim() } });
        }
        if (!emp) {
          throw new Error(`Dòng ${rowNo}: Không tìm thấy nhân viên`);
        }

        const empKey = `${String(emp.id)}:${otDate}:${shiftCode}:${direction}`;
        if (seenKeys.has(empKey)) {
          throw new Error(
            `Dòng ${rowNo}: Trùng nhân viên ${emp.empCode}, ca ${shiftCode} và ngày ${otDate} trong danh sách`,
          );
        }
        seenKeys.add(empKey);

        // Check active ETP on otDate
        const empEtps = await prisma.employeeTransportProfile.findMany({
          where: {
            employeeId: emp.id,
            delFlag: 'N',
            approvalStatus: 'APPROVED',
          },
          include: { pickupPoint: true, dropoffPoint: true, route: true },
          orderBy: { effectiveFrom: 'desc' },
        });

        const activeEtp = empEtps.find((r) =>
          isRegistrationEffectiveOnDate(
            {
              approvalStatus: r.approvalStatus,
              isDeleted: r.delFlag === 'Y',
              effectiveFrom: r.effectiveFrom,
              effectiveTo: r.effectiveTo,
            },
            otDate,
          ),
        );

        if (!activeEtp) {
          throw new Error(
            `Dòng ${rowNo}: Nhân viên ${emp.empCode} chưa có hồ sơ đưa đón hiệu lực tại ngày ${otDate}`,
          );
        }

        // Check duplicate active OT request in DB
        const dupExisting = await prisma.transportRequest.findFirst({
          where: {
            requestType: 'OVERTIME',
            otShiftDate: otDate,
            otShiftCode: shiftCode,
            status: { notIn: ['CANCELLED', 'REJECTED'] },
            passengers: {
              some: { passengerId: emp.empCode },
            },
          },
        });
        if (dupExisting) {
          throw new Error(
            `Dòng ${rowNo}: Nhân viên ${emp.empCode} đã có đơn OT ca ${shiftCode} ngày ${otDate}`,
          );
        }

        const basePickupText =
          item.pickupPointText ?? activeEtp.pickupPoint.pointName ?? 'Nhà máy MKVC';
        const baseDropoffText =
          item.dropoffPointText ?? activeEtp.dropoffPoint?.pointName ?? 'Điểm trả ETP';

        if (basePickupText.trim().toLowerCase() === baseDropoffText.trim().toLowerCase()) {
          throw new Error(`Dòng ${rowNo}: Điểm đón và điểm trả không được trùng nhau`);
        }

        const isBoth = direction === 'BOTH' || direction === 'BOTH_DIRECTIONS';
        const isNextDay =
          item.returnDayOption === 'NEXT_DAY' ||
          shiftCode.startsWith('E20-');

        if (isBoth) {
          // QA §3.6 / AT-OT-004: Create a pair of independent requests (TO_FACTORY & FROM_FACTORY) linked via otPairId
          const pairId = nextSnowflakeId();
          const inboundId = nextSnowflakeId();
          const outboundReturnId = nextSnowflakeId();
          const returnBusinessDate = isNextDay ? addOneDay(otDate) : otDate;

          // 1. Chặng Đi (TO_FACTORY): pickup & dropoff reversed compared to return
          const inboundCode = `OT-${otDate.replace(/-/g, '')}-${String(inboundId).slice(-5)}`;
          await prisma.transportRequest.create({
            data: {
              id: inboundId,
              requestCode: inboundCode,
              businessDate: otDate,
              requestType: 'OVERTIME',
              requestSource: 'MANUAL',
              requesterId: ctx.user?.id ?? null,
              requesterName: ctx.user?.fullName ?? 'Nhân viên',
              routeId: activeEtp.routeId,
              passengerCount: 1,
              status: initialStatus,
              outboundStatus: initialStatus,
              tripMode: 'ONE_WAY',
              departureTime: item.departureTime ?? '07:00',
              departurePickupPointText: baseDropoffText,
              departureDropoffPointText: basePickupText,
              departmentApproverIds: args.departmentApproverIds ?? null,
              otShiftCode: shiftCode,
              otShiftDate: otDate,
              otPairId: pairId,
              legDirection: 'TO_FACTORY',
              notes: item.note ?? null,
              passengers: {
                create: {
                  id: nextSnowflakeId(),
                  passengerId: emp.empCode,
                  passengerName: item.passengerName ?? emp.fullName,
                  passengerType: activeEtp.route.passengerType,
                  departurePickupPointText: baseDropoffText,
                  departureDropoffPointText: basePickupText,
                  passengerNote: item.note ?? null,
                },
              },
            },
          });

          // 2. Chặng Về (FROM_FACTORY)
          const returnCode = `OT-${returnBusinessDate.replace(/-/g, '')}-${String(outboundReturnId).slice(-5)}`;
          await prisma.transportRequest.create({
            data: {
              id: outboundReturnId,
              requestCode: returnCode,
              businessDate: returnBusinessDate,
              requestType: 'OVERTIME',
              requestSource: 'MANUAL',
              requesterId: ctx.user?.id ?? null,
              requesterName: ctx.user?.fullName ?? 'Nhân viên',
              routeId: activeEtp.routeId,
              passengerCount: 1,
              status: initialStatus,
              outboundStatus: initialStatus,
              tripMode: 'ONE_WAY',
              departureTime: item.returnTime ?? '19:00',
              departurePickupPointText: basePickupText,
              departureDropoffPointText: baseDropoffText,
              departmentApproverIds: args.departmentApproverIds ?? null,
              otShiftCode: shiftCode,
              otShiftDate: otDate,
              otPairId: pairId,
              legDirection: 'FROM_FACTORY',
              notes: item.note ?? null,
              passengers: {
                create: {
                  id: nextSnowflakeId(),
                  passengerId: emp.empCode,
                  passengerName: item.passengerName ?? emp.fullName,
                  passengerType: activeEtp.route.passengerType,
                  departurePickupPointText: basePickupText,
                  departureDropoffPointText: baseDropoffText,
                  passengerNote: item.note ?? null,
                },
              },
            },
          });

          createdIds.push(inboundId, outboundReturnId);
        } else {
          const singleId = nextSnowflakeId();
          const code = `OT-${otDate.replace(/-/g, '')}-${String(singleId).slice(-5)}`;
          const pickup = direction === 'TO_FACTORY' ? baseDropoffText : basePickupText;
          const dropoff = direction === 'TO_FACTORY' ? basePickupText : baseDropoffText;

          await prisma.transportRequest.create({
            data: {
              id: singleId,
              requestCode: code,
              businessDate: otDate,
              requestType: 'OVERTIME',
              requestSource: 'MANUAL',
              requesterId: ctx.user?.id ?? null,
              requesterName: ctx.user?.fullName ?? 'Nhân viên',
              routeId: activeEtp.routeId,
              passengerCount: 1,
              status: initialStatus,
              outboundStatus: initialStatus,
              tripMode: 'ONE_WAY',
              departureTime: item.returnTime ?? item.departureTime ?? shiftCode,
              departurePickupPointText: pickup,
              departureDropoffPointText: dropoff,
              departmentApproverIds: args.departmentApproverIds ?? null,
              otShiftCode: shiftCode,
              otShiftDate: otDate,
              legDirection: direction,
              notes: item.note ?? null,
              passengers: {
                create: {
                  id: nextSnowflakeId(),
                  passengerId: emp.empCode,
                  passengerName: item.passengerName ?? emp.fullName,
                  passengerType: activeEtp.route.passengerType,
                  departurePickupPointText: pickup,
                  departureDropoffPointText: dropoff,
                  passengerNote: item.note ?? null,
                },
              },
            },
          });

          createdIds.push(singleId);
        }
      }

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        createdIds.join(','),
        'CREATE_BULK_OT',
        `Tạo ${createdIds.length} đơn tăng ca OT`,
      );

      return prisma.transportRequest.findMany({
        ...query,
        where: { id: { in: createdIds } },
        orderBy: { id: 'asc' },
      });
    },
  }),

  updateTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: { feature: FEATURE_CODES.REQUEST_UPDATE },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      businessDate: t.arg.string(),
      tripMode: t.arg.string(),
      passengerCount: t.arg.int(),
      departureTime: t.arg.string(),
      expectedArrivalTime: t.arg.string(),
      returnTime: t.arg.string(),
      departurePickupPointText: t.arg.string(),
      departureDropoffPointText: t.arg.string(),
      returnPickupPointText: t.arg.string(),
      returnDropoffPointText: t.arg.string(),
      purpose: t.arg.string(),
      notes: t.arg.string(),
      contactName: t.arg.string(),
      contactPhone: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      const nextTripMode = args.tripMode ?? req.tripMode;
      // AT-REQ-006: If request was RETURNED, updating it re-enters initial approval flow
      let nextStatus = req.status;
      if (req.status === 'RETURNED') {
        nextStatus = resolveInitialStatusByRole(ctx);
      }

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          businessDate: args.businessDate ?? req.businessDate,
          tripMode: nextTripMode,
          passengerCount: args.passengerCount ?? req.passengerCount,
          status: nextStatus,
          outboundStatus: nextStatus,
          returnStatus: nextTripMode === 'ROUND_TRIP' ? nextStatus : null,
          departureTime: args.departureTime ?? req.departureTime,
          expectedArrivalTime: args.expectedArrivalTime ?? req.expectedArrivalTime,
          returnTime: nextTripMode === 'ROUND_TRIP' ? (args.returnTime ?? req.returnTime) : null,
          departurePickupPointText:
            args.departurePickupPointText ?? req.departurePickupPointText,
          departureDropoffPointText:
            args.departureDropoffPointText ?? req.departureDropoffPointText,
          returnPickupPointText:
            nextTripMode === 'ROUND_TRIP'
              ? (args.returnPickupPointText ?? req.returnPickupPointText)
              : null,
          returnDropoffPointText:
            nextTripMode === 'ROUND_TRIP'
              ? (args.returnDropoffPointText ?? req.returnDropoffPointText)
              : null,
          purpose: args.purpose ?? req.purpose,
          notes: args.notes ?? req.notes,
          contactName: args.contactName ?? req.contactName,
          contactPhone: args.contactPhone ?? req.contactPhone,
          statusHistory:
            nextStatus !== req.status
              ? {
                  create: {
                    id: nextSnowflakeId(),
                    fromStatus: req.status,
                    toStatus: nextStatus,
                    actionBy: ctx.user?.id ?? null,
                    actionReason: 'Cập nhật và gửi lại đơn',
                  },
                }
              : undefined,
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'UPDATE',
        `Cập nhật đơn ${req.requestCode}`,
      );

      return updated;
    },
  }),

  gaEditTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: {
      anyFeature: [FEATURE_CODES.REQUEST_APPROVE_GA, FEATURE_CODES.REQUEST_UPDATE],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      departureTime: t.arg.string(),
      returnTime: t.arg.string(),
      passengerCount: t.arg.int(),
      departurePickupPointText: t.arg.string(),
      departureDropoffPointText: t.arg.string(),
      requestedVehicleType: t.arg.string(),
      notes: t.arg.string(),
      editReason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      const diffs: string[] = [];
      if (args.departureTime && args.departureTime !== req.departureTime) {
        diffs.push(`departureTime: ${req.departureTime ?? ''} -> ${args.departureTime}`);
      }
      if (
        args.departurePickupPointText &&
        args.departurePickupPointText !== req.departurePickupPointText
      ) {
        diffs.push(
          `pickup: ${req.departurePickupPointText ?? ''} -> ${args.departurePickupPointText}`,
        );
      }
      if (
        args.departureDropoffPointText &&
        args.departureDropoffPointText !== req.departureDropoffPointText
      ) {
        diffs.push(
          `dropoff: ${req.departureDropoffPointText ?? ''} -> ${args.departureDropoffPointText}`,
        );
      }
      if (args.passengerCount !== undefined && args.passengerCount !== null && args.passengerCount !== req.passengerCount) {
        diffs.push(`passengerCount: ${req.passengerCount} -> ${args.passengerCount}`);
      }

      const gaActionsLog = JSON.stringify({
        editedBy: ctx.user?.username ?? 'GA',
        editedAt: new Date().toISOString(),
        reason: args.editReason ?? 'GA chỉnh sửa thông tin đơn',
        diffs,
      });

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          departureTime: args.departureTime ?? req.departureTime,
          returnTime: args.returnTime ?? req.returnTime,
          passengerCount: args.passengerCount ?? req.passengerCount,
          departurePickupPointText:
            args.departurePickupPointText ?? req.departurePickupPointText,
          departureDropoffPointText:
            args.departureDropoffPointText ?? req.departureDropoffPointText,
          requestedVehicleType: args.requestedVehicleType ?? req.requestedVehicleType,
          notes: args.notes ?? req.notes,
          gaActions: gaActionsLog,
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'GA_EDIT',
        `GA chỉnh sửa đơn ${req.requestCode}: ${diffs.join('; ')}`,
      );

      return updated;
    },
  }),

  cancelTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: { feature: FEATURE_CODES.REQUEST_CANCEL },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
        include: { tripLinks: { where: { delFlag: 'N' } } },
      });

      if (req.status === 'COMPLETED' || req.status === 'IN_PROGRESS') {
        throw new Error('Không thể hủy đơn khi chuyến xe đang chạy hoặc đã hoàn thành');
      }

      // AT-REQ-008: If linked to a trip that hasn't started, detach and cancel trip if empty
      for (const link of req.tripLinks) {
        await prisma.tripRequestLink.update({
          where: { id: link.id },
          data: { delFlag: 'Y' },
        });
        const remainingLinks = await prisma.tripRequestLink.count({
          where: { tripId: link.tripId, delFlag: 'N' },
        });
        if (remainingLinks === 0) {
          await prisma.trip.update({
            where: { id: link.tripId },
            data: { status: 'CANCELLED' },
          });
        }
      }

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          status: 'CANCELLED',
          outboundStatus: 'CANCELLED',
          returnStatus: req.tripMode === 'ROUND_TRIP' ? 'CANCELLED' : null,
          currentTripId: null,
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: 'CANCELLED',
              actionBy: ctx.user?.id ?? null,
              actionReason: args.reason ?? 'Hủy yêu cầu xe',
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'CANCEL',
        `Hủy đơn ${req.requestCode}: ${args.reason ?? ''}`,
      );

      return updated;
    },
  }),

  approveTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
        FEATURE_CODES.REQUEST_APPROVE_GA,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      let nextStatus = 'WAITING_VENDOR_DISPATCH';
      let stage = 'GA';

      if (req.status === 'PENDING_DEPARTMENT') {
        // AT-REQ-004: Verify departmentApproverIds if non-empty and user is not Admin/GA
        const isGaOrAdmin =
          Boolean(ctx.user?.isAdmin) ||
          Boolean(ctx.user?.features.has(FEATURE_CODES.REQUEST_APPROVE_GA));
        if (!isGaOrAdmin && req.departmentApproverIds?.trim()) {
          const allowedIds = req.departmentApproverIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const currentUserIdStr = String(ctx.user?.id ?? '');
          const currentUsername = ctx.user?.username ?? '';
          if (
            allowedIds.length > 0 &&
            !allowedIds.includes(currentUserIdStr) &&
            !allowedIds.includes(currentUsername)
          ) {
            throw new Error('Bạn không nằm trong danh sách người duyệt bộ phận của đơn này');
          }
        }
        nextStatus = 'PENDING_GA';
        stage = 'DEPARTMENT';
      } else if (req.status === 'PENDING_GA' || req.status === 'PENDING_GA_DEPARTMENT') {
        if (
          !ctx.user?.isAdmin &&
          !ctx.user?.features.has(FEATURE_CODES.REQUEST_APPROVE_GA)
        ) {
          throw new Error('Chỉ GA hoặc Admin mới có quyền duyệt bước GA');
        }
        nextStatus = 'WAITING_VENDOR_DISPATCH';
        stage = 'GA';
      } else {
        throw new Error(`Không thể duyệt đơn đang ở trạng thái ${req.status}`);
      }

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          status: nextStatus,
          outboundStatus: nextStatus,
          returnStatus: req.tripMode === 'ROUND_TRIP' ? nextStatus : req.returnStatus,
          approvals: {
            create: {
              id: nextSnowflakeId(),
              stepNo: stage === 'DEPARTMENT' ? 1 : 2,
              approvalStage: stage,
              approverId: ctx.user?.id ?? null,
              approverName: ctx.user?.fullName ?? 'Approver',
              decision: 'APPROVED',
              decisionReason: args.reason ?? null,
            },
          },
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: nextStatus,
              actionBy: ctx.user?.id ?? null,
              actionReason: args.reason ?? `Duyệt bước ${stage}`,
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'APPROVE',
        `Duyệt đơn ${req.requestCode} (${req.status} -> ${nextStatus})`,
      );

      return updated;
    },
  }),

  rejectTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
        FEATURE_CODES.REQUEST_APPROVE_GA,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const reason = args.reason.trim();
      if (!reason) {
        throw new Error('Từ chối đơn bắt buộc nhập lý do');
      }
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      const stage = req.status === 'PENDING_DEPARTMENT' ? 'DEPARTMENT' : 'GA';

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          status: 'REJECTED',
          outboundStatus: 'REJECTED',
          returnStatus: req.tripMode === 'ROUND_TRIP' ? 'REJECTED' : null,
          approvals: {
            create: {
              id: nextSnowflakeId(),
              stepNo: stage === 'DEPARTMENT' ? 1 : 2,
              approvalStage: stage,
              approverId: ctx.user?.id ?? null,
              approverName: ctx.user?.fullName ?? 'Approver',
              decision: 'REJECTED',
              decisionReason: reason,
            },
          },
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: 'REJECTED',
              actionBy: ctx.user?.id ?? null,
              actionReason: reason,
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'REJECT',
        `Từ chối đơn ${req.requestCode}: ${reason}`,
      );

      return updated;
    },
  }),

  returnTransportRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
        FEATURE_CODES.REQUEST_APPROVE_GA,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const reason = args.reason.trim();
      if (!reason) {
        throw new Error('Trả đơn về bắt buộc nhập lý do');
      }
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          returnedFromStatus: req.status,
          status: 'RETURNED',
          outboundStatus: 'RETURNED',
          returnStatus: req.tripMode === 'ROUND_TRIP' ? 'RETURNED' : null,
          approvals: {
            create: {
              id: nextSnowflakeId(),
              stepNo: req.status === 'PENDING_DEPARTMENT' ? 1 : 2,
              approvalStage: req.status === 'PENDING_DEPARTMENT' ? 'DEPARTMENT' : 'GA',
              approverId: ctx.user?.id ?? null,
              approverName: ctx.user?.fullName ?? 'Approver',
              decision: 'RETURNED',
              decisionReason: reason,
            },
          },
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: 'RETURNED',
              actionBy: ctx.user?.id ?? null,
              actionReason: reason,
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'RETURN',
        `Trả đơn ${req.requestCode} về để sửa: ${reason}`,
      );

      return updated;
    },
  }),

  approveTaxiRequest: t.prismaField({
    type: 'TransportRequest',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_GA,
        FEATURE_CODES.REQUEST_DISPATCH,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      notes: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqId = BigInt(args.id);
      const req = await prisma.transportRequest.findUniqueOrThrow({
        where: { id: reqId },
      });

      const updated = await prisma.transportRequest.update({
        ...query,
        where: { id: reqId },
        data: {
          status: 'APPROVED_TAXI',
          outboundStatus: 'APPROVED_TAXI',
          returnStatus: req.tripMode === 'ROUND_TRIP' ? 'APPROVED_TAXI' : null,
          notes: args.notes ?? req.notes,
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: 'APPROVED_TAXI',
              actionBy: ctx.user?.id ?? null,
              actionReason: args.notes ?? 'Chuyển phương án đi Taxi',
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqId,
        'APPROVE_TAXI',
        `Chuyển đơn ${req.requestCode} sang đi Taxi`,
      );

      return updated;
    },
  }),

  bulkApproveRequests: t.prismaField({
    type: ['TransportRequest'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
        FEATURE_CODES.REQUEST_APPROVE_GA,
      ],
    },
    args: {
      ids: t.arg({ type: ['BigInt'], required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const reqIds = args.ids.map((id) => BigInt(id));
      const reqs = await prisma.transportRequest.findMany({
        where: { id: { in: reqIds } },
      });

      for (const req of reqs) {
        const nextStatus =
          req.status === 'PENDING_DEPARTMENT' ? 'PENDING_GA' : 'WAITING_VENDOR_DISPATCH';
        await prisma.transportRequest.update({
          where: { id: req.id },
          data: {
            status: nextStatus,
            outboundStatus: nextStatus,
            returnStatus: req.tripMode === 'ROUND_TRIP' ? nextStatus : req.returnStatus,
            approvals: {
              create: {
                id: nextSnowflakeId(),
                stepNo: req.status === 'PENDING_DEPARTMENT' ? 1 : 2,
                approvalStage: req.status === 'PENDING_DEPARTMENT' ? 'DEPARTMENT' : 'GA',
                approverId: ctx.user?.id ?? null,
                approverName: ctx.user?.fullName ?? 'Approver',
                decision: 'APPROVED',
                decisionReason: args.reason ?? 'Duyệt hàng loạt',
              },
            },
            statusHistory: {
              create: {
                id: nextSnowflakeId(),
                fromStatus: req.status,
                toStatus: nextStatus,
                actionBy: ctx.user?.id ?? null,
                actionReason: args.reason ?? 'Duyệt hàng loạt',
              },
            },
          },
        });
      }

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqIds.join(','),
        'BULK_APPROVE',
        `Duyệt hàng loạt ${reqs.length} yêu cầu xe`,
      );

      return prisma.transportRequest.findMany({
        ...query,
        where: { id: { in: reqIds } },
      });
    },
  }),

  bulkRejectRequests: t.prismaField({
    type: ['TransportRequest'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_APPROVE_DEPARTMENT,
        FEATURE_CODES.REQUEST_APPROVE_GA,
      ],
    },
    args: {
      ids: t.arg({ type: ['BigInt'], required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const reason = args.reason.trim();
      if (!reason) {
        throw new Error('Từ chối hàng loạt bắt buộc nhập lý do');
      }
      const reqIds = args.ids.map((id) => BigInt(id));
      const reqs = await prisma.transportRequest.findMany({
        where: { id: { in: reqIds } },
      });

      for (const req of reqs) {
        await prisma.transportRequest.update({
          where: { id: req.id },
          data: {
            status: 'REJECTED',
            outboundStatus: 'REJECTED',
            returnStatus: req.tripMode === 'ROUND_TRIP' ? 'REJECTED' : null,
            approvals: {
              create: {
                id: nextSnowflakeId(),
                stepNo: req.status === 'PENDING_DEPARTMENT' ? 1 : 2,
                approvalStage: req.status === 'PENDING_DEPARTMENT' ? 'DEPARTMENT' : 'GA',
                approverId: ctx.user?.id ?? null,
                approverName: ctx.user?.fullName ?? 'Approver',
                decision: 'REJECTED',
                decisionReason: reason,
              },
            },
            statusHistory: {
              create: {
                id: nextSnowflakeId(),
                fromStatus: req.status,
                toStatus: 'REJECTED',
                actionBy: ctx.user?.id ?? null,
                actionReason: reason,
              },
            },
          },
        });
      }

      await writeAuditLog(
        ctx,
        'TRANSPORT_REQUEST',
        reqIds.join(','),
        'BULK_REJECT',
        `Từ chối hàng loạt ${reqs.length} yêu cầu xe: ${reason}`,
      );

      return prisma.transportRequest.findMany({
        ...query,
        where: { id: { in: reqIds } },
      });
    },
  }),
}));
