import { Prisma } from '@prisma/client';
import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import { FEATURE_CODES, nextSnowflakeId } from '@trms/shared';
import {
  composeRequestStatus,
  doesRouteRunOnDate,
  isRegistrationEffectiveOnDate,
  isTimeRangeOverlapping,
} from '@trms/domain';
import { VehicleStatusObj } from '../master/schema.js';

function getTodayStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function getTomorrowStr(): string {
  return new Date(Date.now() + 31 * 3600 * 1000).toISOString().slice(0, 10);
}

function parseTimeOnDate(dateStr: string, timeStr?: string | null): Date {
  if (!timeStr) {
    return new Date(`${dateStr}T08:00:00+07:00`);
  }
  if (timeStr.includes('T')) {
    const parsed = new Date(timeStr);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const hhmm = timeStr.trim().slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(hhmm)) {
    return new Date(`${dateStr}T${hhmm}:00+07:00`);
  }
  return new Date(`${dateStr}T08:00:00+07:00`);
}

export const PlanAssignmentObj = builder.prismaObject('PlanAssignment', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    planVersionId: t.expose('planVersionId', { type: 'BigInt' }),
    routeId: t.expose('routeId', { type: 'BigInt' }),
    segmentId: t.expose('segmentId', { type: 'BigInt', nullable: true }),
    legDefinitionId: t.expose('legDefinitionId', { type: 'BigInt', nullable: true }),
    legCode: t.exposeString('legCode'),
    legName: t.exposeString('legName', { nullable: true }),
    direction: t.exposeString('direction', { nullable: true }),
    passengerType: t.exposeString('passengerType', { nullable: true }),
    routeCode: t.exposeString('routeCode', { nullable: true }),
    routeName: t.exposeString('routeName', { nullable: true }),
    vehicleId: t.expose('vehicleId', { type: 'BigInt', nullable: true }),
    driverId: t.expose('driverId', { type: 'BigInt', nullable: true }),
    assignmentType: t.exposeString('assignmentType'),
    demandCount: t.exposeInt('demandCount'),
    activeFlag: t.exposeString('activeFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
  }),
});

export const PlanVersionObj = builder.prismaObject('PlanVersion', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    planId: t.expose('planId', { type: 'BigInt' }),
    versionNo: t.exposeInt('versionNo'),
    sourceBatchId: t.expose('sourceBatchId', { type: 'BigInt', nullable: true }),
    status: t.exposeString('status'),
    currentFlag: t.exposeString('currentFlag'),
    publishedBy: t.expose('publishedBy', { type: 'BigInt', nullable: true }),
    publishedAt: t.expose('publishedAt', { type: 'DateTime', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    assignments: t.relation('assignments', {
      query: () => ({ where: { activeFlag: 'Y' }, orderBy: { id: 'asc' } }),
    }),
  }),
});

export const DailyPlanObj = builder.prismaObject('DailyPlan', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    businessDate: t.exposeString('businessDate'),
    status: t.exposeString('status'),
    currentVersionId: t.expose('currentVersionId', { type: 'BigInt', nullable: true }),
    lastBatchId: t.expose('lastBatchId', { type: 'BigInt', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    versions: t.relation('versions', {
      query: () => ({ orderBy: { versionNo: 'desc' } }),
    }),
  }),
});

export const TripRequestLinkObj = builder.prismaObject('TripRequestLink', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    tripId: t.expose('tripId', { type: 'BigInt' }),
    requestId: t.expose('requestId', { type: 'BigInt' }),
    linkRole: t.exposeString('linkRole'),
    requestLeg: t.exposeString('requestLeg', { nullable: true }),
    splitGroupNo: t.exposeInt('splitGroupNo', { nullable: true }),
    delFlag: t.exposeString('delFlag'),
    trip: t.relation('trip'),
    request: t.relation('request'),
  }),
});

export const TripExecutionFactObj = builder.prismaObject('TripExecutionFact', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    tripId: t.expose('tripId', { type: 'BigInt' }),
    actualDepartureAt: t.expose('actualDepartureAt', { type: 'DateTime', nullable: true }),
    actualArrivalAt: t.expose('actualArrivalAt', { type: 'DateTime', nullable: true }),
    actualKm: t.expose('actualKm', { type: 'Decimal', nullable: true }),
    startOdometerKm: t.expose('startOdometerKm', { type: 'Decimal', nullable: true }),
    endOdometerKm: t.expose('endOdometerKm', { type: 'Decimal', nullable: true }),
    otHours: t.expose('otHours', { type: 'Decimal', nullable: true }),
    actualPassengerCount: t.exposeInt('actualPassengerCount', { nullable: true }),
    actualKmSource: t.exposeString('actualKmSource', { nullable: true }),
    completedBy: t.expose('completedBy', { type: 'BigInt', nullable: true }),
    completedAt: t.expose('completedAt', { type: 'DateTime', nullable: true }),
    executionNote: t.exposeString('executionNote', { nullable: true }),
  }),
});

export const TripObj = builder.prismaObject('Trip', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    tripCode: t.exposeString('tripCode'),
    businessDate: t.exposeString('businessDate'),
    planVersionId: t.expose('planVersionId', { type: 'BigInt', nullable: true }),
    planAssignmentId: t.expose('planAssignmentId', { type: 'BigInt', nullable: true }),
    tripType: t.exposeString('tripType'),
    dispatchType: t.exposeString('dispatchType'),
    dispatchSource: t.exposeString('dispatchSource', { nullable: true }),
    status: t.exposeString('status'),
    vendorId: t.expose('vendorId', { type: 'BigInt', nullable: true }),
    routeId: t.expose('routeId', { type: 'BigInt', nullable: true }),
    segmentId: t.expose('segmentId', { type: 'BigInt', nullable: true }),
    legCode: t.exposeString('legCode', { nullable: true }),
    shiftId: t.expose('shiftId', { type: 'BigInt', nullable: true }),
    vehicleId: t.expose('vehicleId', { type: 'BigInt', nullable: true }),
    driverId: t.expose('driverId', { type: 'BigInt', nullable: true }),
    vehiclePlateSnapshot: t.exposeString('vehiclePlateSnapshot', { nullable: true }),
    driverNameSnapshot: t.exposeString('driverNameSnapshot', { nullable: true }),
    driverPhoneSnapshot: t.exposeString('driverPhoneSnapshot', { nullable: true }),
    seatCapacitySnapshot: t.exposeInt('seatCapacitySnapshot', { nullable: true }),
    plannedDepartureAt: t.expose('plannedDepartureAt', { type: 'DateTime', nullable: true }),
    plannedArrivalAt: t.expose('plannedArrivalAt', { type: 'DateTime', nullable: true }),
    passengerCount: t.exposeInt('passengerCount'),
    passengerType: t.exposeString('passengerType', { nullable: true }),
    tripMode: t.exposeString('tripMode'),
    tripLeg: t.exposeString('tripLeg', { nullable: true }),
    pairedTripId: t.expose('pairedTripId', { type: 'BigInt', nullable: true }),
    departurePickupPointId: t.expose('departurePickupPointId', { type: 'BigInt', nullable: true }),
    departureDropoffPointId: t.expose('departureDropoffPointId', { type: 'BigInt', nullable: true }),
    returnPickupPointId: t.expose('returnPickupPointId', { type: 'BigInt', nullable: true }),
    returnDropoffPointId: t.expose('returnDropoffPointId', { type: 'BigInt', nullable: true }),
    departurePickupPointText: t.exposeString('departurePickupPointText', { nullable: true }),
    departureDropoffPointText: t.exposeString('departureDropoffPointText', { nullable: true }),
    returnPickupPointText: t.exposeString('returnPickupPointText', { nullable: true }),
    returnDropoffPointText: t.exposeString('returnDropoffPointText', { nullable: true }),
    deadheadKind: t.exposeString('deadheadKind', { nullable: true }),
    deadheadSourceTripId: t.expose('deadheadSourceTripId', { type: 'BigInt', nullable: true }),
    pricingScope: t.exposeString('pricingScope', { nullable: true }),
    pricingConfigId: t.expose('pricingConfigId', { type: 'BigInt', nullable: true }),
    overrideReason: t.exposeString('overrideReason', { nullable: true }),
    notes: t.exposeString('notes', { nullable: true }),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    route: t.relation('route', { nullable: true }),
    vehicle: t.relation('vehicle', { nullable: true }),
    driver: t.relation('driver', { nullable: true }),
    requestLinks: t.relation('requestLinks', {
      query: () => ({ where: { delFlag: 'N' }, orderBy: { id: 'asc' } }),
    }),
    executionFacts: t.relation('executionFacts', {
      query: () => ({ orderBy: { id: 'desc' } }),
    }),
    costRecords: t.relation('costRecords', {
      query: () => ({ orderBy: { id: 'desc' } }),
    }),
    actualKm: t.field({
      type: 'Decimal',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.actualKm ?? null;
      },
    }),
    actualStartAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.actualDepartureAt ?? null;
      },
    }),
    actualEndAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.actualArrivalAt ?? null;
      },
    }),
    actualPassengerCount: t.field({
      type: 'Int',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.actualPassengerCount ?? null;
      },
    }),
    startOdometerKm: t.field({
      type: 'Decimal',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.startOdometerKm ?? null;
      },
    }),
    endOdometerKm: t.field({
      type: 'Decimal',
      nullable: true,
      resolve: async (trip) => {
        const fact = await prisma.tripExecutionFact.findFirst({
          where: { tripId: trip.id },
          orderBy: { id: 'desc' },
        });
        return fact?.endOdometerKm ?? null;
      },
    }),
    tollFeeAmount: t.field({
      type: 'Decimal',
      nullable: true,
      resolve: async (trip) => {
        const rec = await prisma.costRecord.findFirst({
          where: { tripId: trip.id, costType: 'TOLL_FEE' },
          orderBy: { id: 'desc' },
        });
        return rec?.appliedAmount ?? null;
      },
    }),
  }),
});

export { VehicleStatusObj };

export interface DashboardStatsShape {
  totalRequests: number;
  pendingApprovalRequests: number;
  waitingDispatchRequests: number;
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  totalVehicles: number;
  availableVehicles: number;
  activeRiders: number;
  totalCostAfterVat: number;
}

export const DashboardStatsRef = builder.objectRef<DashboardStatsShape>('DashboardStats').implement({
  fields: (t) => ({
    totalRequests: t.exposeInt('totalRequests'),
    pendingApprovalRequests: t.exposeInt('pendingApprovalRequests'),
    waitingDispatchRequests: t.exposeInt('waitingDispatchRequests'),
    totalTrips: t.exposeInt('totalTrips'),
    activeTrips: t.exposeInt('activeTrips'),
    completedTrips: t.exposeInt('completedTrips'),
    totalVehicles: t.exposeInt('totalVehicles'),
    availableVehicles: t.exposeInt('availableVehicles'),
    activeRiders: t.exposeInt('activeRiders'),
    totalCostAfterVat: t.exposeFloat('totalCostAfterVat'),
  }),
});

export interface CommuteDispatchBoard {
  businessDate: string;
  dataSource: string; // PLAN | ACTUAL
  planStatus: string;
  planVersionId: bigint | null;
  assignments: Array<{
    id: bigint;
    planVersionId: bigint;
    routeId: bigint;
    segmentId: bigint | null;
    legDefinitionId: bigint | null;
    legCode: string;
    legName: string | null;
    direction: string | null;
    passengerType: string | null;
    routeCode: string | null;
    routeName: string | null;
    vehicleId: bigint | null;
    driverId: bigint | null;
    assignmentType: string;
    demandCount: number;
    activeFlag: string;
    createDate: Date | null;
    editDate: Date | null;
  }>;
}

export const CommuteDispatchBoardRef = builder
  .objectRef<CommuteDispatchBoard>('CommuteDispatchBoard')
  .implement({
    fields: (t) => ({
      businessDate: t.exposeString('businessDate'),
      dataSource: t.exposeString('dataSource'),
      planStatus: t.exposeString('planStatus'),
      planVersionId: t.expose('planVersionId', { type: 'BigInt', nullable: true }),
      assignments: t.field({
        type: [PlanAssignmentObj],
        resolve: (parent) => parent.assignments,
      }),
    }),
  });

/**
 * Sync overall status of a TransportRequest based on its linked Trips
 */
async function syncRequestStatusFromTrips(requestId: bigint, targetLegStatus: string) {
  const req = await prisma.transportRequest.findUnique({
    where: { id: requestId },
    include: {
      tripLinks: {
        where: { delFlag: 'N' },
        include: { trip: true },
      },
    },
  });
  if (!req) return;

  if (req.tripMode === 'ROUND_TRIP') {
    const outLinks = req.tripLinks.filter((l) => l.requestLeg !== 'RETURN');
    const retLinks = req.tripLinks.filter((l) => l.requestLeg === 'RETURN');

    const mapTripToReqStatus = (tripStatus: string): string => {
      if (tripStatus === 'DISPATCHED') return 'WAITING_DRIVER_CONFIRM';
      if (tripStatus === 'DRIVER_CONFIRMED') return 'WAITING_DRIVER_CONFIRM';
      if (tripStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
      if (tripStatus === 'COMPLETED') return 'WAITING_DISTANCE_INPUT';
      return targetLegStatus;
    };

    const nextOutbound =
      outLinks.length > 0
        ? mapTripToReqStatus(outLinks[0].trip.status)
        : (req.outboundStatus ?? targetLegStatus);
    const nextReturn =
      retLinks.length > 0
        ? mapTripToReqStatus(retLinks[0].trip.status)
        : (req.returnStatus ?? 'WAITING_VENDOR_DISPATCH');

    const composed = composeRequestStatus(req.tripMode, nextOutbound, nextReturn);
    await prisma.transportRequest.update({
      where: { id: req.id },
      data: {
        outboundStatus: nextOutbound,
        returnStatus: nextReturn,
        status: composed,
      },
    });
  } else {
    await prisma.transportRequest.update({
      where: { id: req.id },
      data: {
        outboundStatus: targetLegStatus,
        status: targetLegStatus,
      },
    });
  }
}

/**
 * Check if a vehicle has overlapping active trips on the given businessDate & time window
 * Includes 30-minute recall window before FIXED_ROUTE trips (AT-DSP-005 & AT-DSP-008)
 */
async function checkVehicleScheduleConflict(
  vehicleId: bigint,
  businessDate: string,
  plannedStart: Date,
  plannedEnd: Date,
  overrideReason?: string | null,
  excludeTripId?: bigint,
) {
  const activeTrips = await prisma.trip.findMany({
    where: {
      vehicleId,
      businessDate,
      delFlag: 'N',
      status: {
        in: ['PLANNED', 'DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED', 'IN_PROGRESS'],
      },
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
  });

  for (const t of activeTrips) {
    if (!t.plannedDepartureAt || !t.plannedArrivalAt) continue;
    const isFixedRoute = t.dispatchType === 'FIXED_ROUTE' || t.tripType === 'FIXED_ROUTE';
    // T - 30m recall buffer for fixed route trips
    const existingStart = isFixedRoute
      ? new Date(t.plannedDepartureAt.getTime() - 30 * 60 * 1000)
      : t.plannedDepartureAt;
    const existingEnd = t.plannedArrivalAt;

    if (isTimeRangeOverlapping(plannedStart, plannedEnd, existingStart, existingEnd)) {
      if (overrideReason?.trim()) {
        // Override allowed with reason (AT-DSP-006)
        continue;
      }
      throw new Error(
        `Xe bị trùng lịch với chuyến ${t.tripCode} (${existingStart.toISOString()} - ${existingEnd.toISOString()})`,
      );
    }
  }
}

builder.queryFields((t) => ({
  dailyPlans: t.prismaField({
    type: ['DailyPlan'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.COMMUTE_DISPATCH_LIST,
        FEATURE_CODES.COMMUTE_DISPATCH_GET,
      ],
    },
    args: {
      businessDate: t.arg.string(),
      limit: t.arg.int({ defaultValue: 30 }),
    },
    resolve: (query, _root, args) =>
      prisma.dailyPlan.findMany({
        ...query,
        where: {
          ...(args.businessDate ? { businessDate: args.businessDate } : {}),
        },
        take: args.limit ?? 30,
        orderBy: { businessDate: 'desc' },
      }),
  }),

  commuteDispatches: t.field({
    type: CommuteDispatchBoardRef,
    authScopes: {
      anyFeature: [
        FEATURE_CODES.COMMUTE_DISPATCH_LIST,
        FEATURE_CODES.COMMUTE_DISPATCH_GET,
      ],
    },
    args: {
      businessDate: t.arg.string({ required: true }),
      passengerType: t.arg.string(),
      routeId: t.arg({ type: 'BigInt' }),
    },
    resolve: async (_root, args) => {
      const businessDate = args.businessDate.trim().slice(0, 10);
      const today = getTodayStr();
      // AT-PLAN-001: Future date -> PLAN, today/past -> ACTUAL
      const dataSource = businessDate > today ? 'PLAN' : 'ACTUAL';

      const plan = await prisma.dailyPlan.findUnique({
        where: { businessDate },
        include: {
          versions: {
            where: { currentFlag: 'Y' },
            orderBy: { versionNo: 'desc' },
            take: 1,
          },
        },
      });

      const currentVersion = plan?.versions[0] ?? null;
      const assignments = currentVersion
        ? await prisma.planAssignment.findMany({
            where: {
              planVersionId: currentVersion.id,
              activeFlag: 'Y',
              ...(args.passengerType ? { passengerType: args.passengerType } : {}),
              ...(args.routeId ? { routeId: BigInt(args.routeId) } : {}),
            },
            orderBy: [{ routeCode: 'asc' }, { legCode: 'asc' }],
          })
        : [];

      return {
        businessDate,
        dataSource,
        planStatus: plan?.status ?? 'DRAFT',
        planVersionId: currentVersion?.id ?? null,
        assignments,
      };
    },
  }),

  trips: t.prismaField({
    type: ['Trip'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_LIST,
        FEATURE_CODES.COMMUTE_DISPATCH_LIST,
        FEATURE_CODES.DRIVER_JOURNEY_READ,
      ],
    },
    args: {
      businessDate: t.arg.string(),
      status: t.arg.string(),
      dispatchType: t.arg.string(),
      tripType: t.arg.string(),
      passengerType: t.arg.string(),
      tripLeg: t.arg.string(),
      deadheadKind: t.arg.string(),
      vehicleId: t.arg({ type: 'BigInt' }),
      driverId: t.arg({ type: 'BigInt' }),
      routeId: t.arg({ type: 'BigInt' }),
      limit: t.arg.int({ defaultValue: 100 }),
    },
    resolve: (query, _root, args) => {
      let statusFilter: string[] | undefined;
      if (args.status) {
        if (args.status === 'WAITING_DRIVER_CONFIRM' || args.status === 'DISPATCHED') {
          statusFilter = ['WAITING_DRIVER_CONFIRM', 'DISPATCHED'];
        } else {
          statusFilter = [args.status];
        }
      }
      let dispatchTypeFilter: string[] | undefined;
      if (args.dispatchType) {
        if (args.dispatchType === 'DISPATCH') {
          dispatchTypeFilter = ['DISPATCH', 'AD_HOC', 'MERGED'];
        } else {
          dispatchTypeFilter = [args.dispatchType];
        }
      }
      let tripTypeFilter: string[] | undefined;
      if (args.tripType && args.tripType !== 'ALL') {
        if (args.tripType === 'COMMUTE') {
          tripTypeFilter = ['COMMUTE', 'FIXED_ROUTE', 'SUPPLEMENT'];
        } else if (args.tripType === 'BUSINESS') {
          tripTypeFilter = ['BUSINESS', 'BUSINESS_TRIP'];
        } else if (args.tripType === 'OT') {
          tripTypeFilter = ['OT', 'OVERTIME'];
        } else if (args.tripType === 'CARGO') {
          tripTypeFilter = ['CARGO', 'GOODS'];
        } else if (args.tripType === 'MIXED') {
          tripTypeFilter = ['MIXED', 'MERGED'];
        } else {
          tripTypeFilter = [args.tripType];
        }
      }
      return prisma.trip.findMany({
        ...query,
        where: {
          delFlag: 'N',
          ...(args.businessDate ? { businessDate: args.businessDate } : {}),
          ...(statusFilter ? { status: { in: statusFilter } } : {}),
          ...(dispatchTypeFilter ? { dispatchType: { in: dispatchTypeFilter } } : {}),
          ...(tripTypeFilter ? { tripType: { in: tripTypeFilter } } : {}),
          ...(args.passengerType ? { passengerType: args.passengerType } : {}),
          ...(args.tripLeg ? { tripLeg: args.tripLeg } : {}),
          ...(args.deadheadKind ? { deadheadKind: args.deadheadKind } : {}),
          ...(args.vehicleId ? { vehicleId: BigInt(args.vehicleId) } : {}),
          ...(args.driverId ? { driverId: BigInt(args.driverId) } : {}),
          ...(args.routeId ? { routeId: BigInt(args.routeId) } : {}),
        },
        take: args.limit ?? 100,
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      });
    },
  }),

  trip: t.prismaField({
    type: 'Trip',
    nullable: true,
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_GET,
        FEATURE_CODES.TRIP_LIST,
        FEATURE_CODES.DRIVER_JOURNEY_DETAIL,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const trip = await prisma.trip.findUnique({
        ...query,
        where: { id: BigInt(args.id) },
      });
      if (!trip || trip.delFlag === 'Y') return null;

      // AT-TRIP-001: If user is strictly a DRIVER (not Admin/GA/Vendor), isolate to own driverId
      const isDriverOnly =
        ctx.user &&
        !ctx.user.isAdmin &&
        !ctx.user.features.has(FEATURE_CODES.TRIP_GET) &&
        !ctx.user.features.has(FEATURE_CODES.TRIP_LIST) &&
        ctx.user.features.has(FEATURE_CODES.DRIVER_JOURNEY_DETAIL);

      if (isDriverOnly) {
        const drv = await prisma.driver.findFirst({
          where: { identityUserId: ctx.user!.id, delFlag: 'N' },
        });
        if (!drv || trip.driverId !== drv.id) {
          throw new Error('Bạn chỉ được phép xem chuyến xe được phân công cho mình');
        }
      }

      return trip;
    },
  }),

  driverTrips: t.prismaField({
    type: ['Trip'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.DRIVER_JOURNEY_READ,
        FEATURE_CODES.TRIP_LIST,
      ],
    },
    args: {
      businessDate: t.arg.string(),
      driverId: t.arg({ type: 'BigInt' }),
      status: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      let targetDriverId: bigint | null = args.driverId ? BigInt(args.driverId) : null;

      // AT-TRIP-001: Isolate driver's own trips when logged in as DRIVER
      if (ctx.user && !ctx.user.isAdmin && !ctx.user.features.has(FEATURE_CODES.TRIP_LIST)) {
        const drv = await prisma.driver.findFirst({
          where: { identityUserId: ctx.user.id, delFlag: 'N' },
        });
        if (!drv) {
          return [];
        }
        if (targetDriverId && targetDriverId !== drv.id) {
          throw new Error('Không có quyền xem hành trình của tài xế khác');
        }
        targetDriverId = drv.id;
      }

      return prisma.trip.findMany({
        ...query,
        where: {
          delFlag: 'N',
          ...(targetDriverId ? { driverId: targetDriverId } : {}),
          ...(args.businessDate ? { businessDate: args.businessDate } : {}),
          ...(args.status ? { status: args.status } : {}),
        },
        orderBy: [{ businessDate: 'desc' }, { plannedDepartureAt: 'asc' }, { id: 'desc' }],
      });
    },
  }),

  vehicleStatuses: t.prismaField({
    type: ['VehicleStatus'],
    authScopes: {
      anyFeature: [
        FEATURE_CODES.VEHICLE_STATUS_LIST,
        FEATURE_CODES.VEHICLE_LIST,
      ],
    },
    args: {
      status: t.arg.string(),
      vehicleType: t.arg.string(),
      routeId: t.arg({ type: 'BigInt' }),
    },
    resolve: (query, _root, args) =>
      prisma.vehicleStatus.findMany({
        ...query,
        where: {
          ...(args.status ? { status: args.status } : {}),
          ...(args.routeId ? { routeId: BigInt(args.routeId) } : {}),
          ...(args.vehicleType
            ? { vehicle: { vehicleType: args.vehicleType, delFlag: 'N' } }
            : {}),
        },
        orderBy: { vehicleId: 'asc' },
      }),
  }),

  dashboardStats: t.field({
    type: DashboardStatsRef,
    authScopes: {
      anyFeature: [
        FEATURE_CODES.DASHBOARD_STATS,
        FEATURE_CODES.DASHBOARD_SNAPSHOT,
      ],
    },
    args: {
      businessDate: t.arg.string(),
    },
    resolve: async (_root, args) => {
      const dateFilter = args.businessDate ? { businessDate: args.businessDate } : {};
      const [
        totalRequests,
        pendingApprovalRequests,
        waitingDispatchRequests,
        totalTrips,
        activeTrips,
        completedTrips,
        totalVehicles,
        availableVehiclesCount,
        activeRiders,
        costAgg,
      ] = await Promise.all([
        prisma.transportRequest.count({ where: dateFilter }),
        prisma.transportRequest.count({
          where: {
            ...dateFilter,
            status: { in: ['PENDING_DEPARTMENT', 'PENDING_GA', 'PENDING_GA_DEPARTMENT'] },
          },
        }),
        prisma.transportRequest.count({
          where: {
            ...dateFilter,
            status: 'WAITING_VENDOR_DISPATCH',
          },
        }),
        prisma.trip.count({ where: { delFlag: 'N', ...dateFilter } }),
        prisma.trip.count({
          where: {
            delFlag: 'N',
            status: { in: ['DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED', 'IN_PROGRESS'] },
            ...dateFilter,
          },
        }),
        prisma.trip.count({
          where: { delFlag: 'N', status: 'COMPLETED', ...dateFilter },
        }),
        prisma.vehicle.count({ where: { delFlag: 'N' } }),
        prisma.vehicle.count({ where: { delFlag: 'N', activeFlag: 'Y' } }),
        prisma.employeeTransportProfile.count({
          where: { delFlag: 'N', approvalStatus: 'APPROVED', activeFlag: 'Y' },
        }),
        prisma.costRecord.aggregate({
          _sum: { amountAfterVat: true },
        }),
      ]);

      return {
        totalRequests,
        pendingApprovalRequests,
        waitingDispatchRequests,
        totalTrips,
        activeTrips,
        completedTrips,
        totalVehicles,
        availableVehicles: availableVehiclesCount,
        activeRiders,
        totalCostAfterVat: Number(costAgg._sum.amountAfterVat || 0),
      };
    },
  }),
}));

builder.mutationFields((t) => ({
  dispatchRequest: t.prismaField({
    type: 'Trip',
    authScopes: { feature: FEATURE_CODES.REQUEST_DISPATCH },
    args: {
      requestId: t.arg({ type: 'BigInt', required: true }),
      vehicleId: t.arg({ type: 'BigInt', required: true }),
      driverId: t.arg({ type: 'BigInt', required: true }),
      plannedDepartureAt: t.arg.string(),
      plannedArrivalAt: t.arg.string(),
      overrideReason: t.arg.string(),
      notes: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const [req, vehicle, driver] = await Promise.all([
        prisma.transportRequest.findUniqueOrThrow({
          where: { id: BigInt(args.requestId) },
        }),
        prisma.vehicle.findUniqueOrThrow({
          where: { id: BigInt(args.vehicleId) },
        }),
        prisma.driver.findUniqueOrThrow({
          where: { id: BigInt(args.driverId) },
        }),
      ]);

      const depAt = parseTimeOnDate(
        req.businessDate,
        args.plannedDepartureAt ?? req.departureTime,
      );
      const arrAt = args.plannedArrivalAt
        ? parseTimeOnDate(req.businessDate, args.plannedArrivalAt)
        : req.expectedArrivalTime
          ? parseTimeOnDate(req.businessDate, req.expectedArrivalTime)
          : new Date(depAt.getTime() + 60 * 60 * 1000);

      await checkVehicleScheduleConflict(
        vehicle.id,
        req.businessDate,
        depAt,
        arrAt,
        args.overrideReason,
      );

      const tripId = nextSnowflakeId();
      const tripCode = `TRP-${req.businessDate.replace(/-/g, '')}-${String(tripId).slice(-5)}`;

      const outboundTrip = await prisma.trip.create({
        ...query,
        data: {
          id: tripId,
          tripCode,
          businessDate: req.businessDate,
          tripType: req.requestType,
          dispatchType: 'DISPATCH',
          status: 'DISPATCHED',
          vendorId: vehicle.vendorId,
          routeId: req.routeId,
          vehicleId: vehicle.id,
          driverId: driver.id,
          vehiclePlateSnapshot: vehicle.vehiclePlate,
          driverNameSnapshot: driver.driverName,
          driverPhoneSnapshot: driver.phoneNumber,
          seatCapacitySnapshot: vehicle.seatCapacity,
          plannedDepartureAt: depAt,
          plannedArrivalAt: arrAt,
          passengerCount: req.passengerCount,
          tripMode: req.tripMode,
          tripLeg: 'OUTBOUND',
          departurePickupPointId: req.departurePickupPointId,
          departureDropoffPointId: req.departureDropoffPointId,
          departurePickupPointText: req.departurePickupPointText,
          departureDropoffPointText: req.departureDropoffPointText,
          overrideReason: args.overrideReason ?? null,
          notes: args.notes ?? req.notes,
        },
      });

      await prisma.tripRequestLink.create({
        data: {
          id: nextSnowflakeId(),
          tripId: outboundTrip.id,
          requestId: req.id,
          linkRole: 'PRIMARY',
          requestLeg: 'OUTBOUND',
        },
      });

      // AT-DSP-001: If request is ROUND_TRIP, also create paired RETURN trip
      if (req.tripMode === 'ROUND_TRIP') {
        const retTripId = nextSnowflakeId();
        const retCode = `TRP-${req.businessDate.replace(/-/g, '')}-${String(retTripId).slice(-5)}`;
        const retDepAt = parseTimeOnDate(
          req.businessDate,
          req.returnTime ?? '17:00',
        );
        const retArrAt = req.returnExpectedArrivalTime
          ? parseTimeOnDate(req.businessDate, req.returnExpectedArrivalTime)
          : new Date(retDepAt.getTime() + 60 * 60 * 1000);

        await prisma.trip.create({
          data: {
            id: retTripId,
            tripCode: retCode,
            businessDate: req.businessDate,
            tripType: req.requestType,
            dispatchType: 'DISPATCH',
            status: 'DISPATCHED',
            vendorId: vehicle.vendorId,
            routeId: req.routeId,
            vehicleId: vehicle.id,
            driverId: driver.id,
            vehiclePlateSnapshot: vehicle.vehiclePlate,
            driverNameSnapshot: driver.driverName,
            driverPhoneSnapshot: driver.phoneNumber,
            seatCapacitySnapshot: vehicle.seatCapacity,
            plannedDepartureAt: retDepAt,
            plannedArrivalAt: retArrAt,
            passengerCount: req.passengerCount,
            tripMode: req.tripMode,
            tripLeg: 'RETURN',
            pairedTripId: outboundTrip.id,
            departurePickupPointId: req.returnPickupPointId ?? req.departureDropoffPointId,
            departureDropoffPointId: req.returnDropoffPointId ?? req.departurePickupPointId,
            departurePickupPointText:
              req.returnPickupPointText ?? req.departureDropoffPointText,
            departureDropoffPointText:
              req.returnDropoffPointText ?? req.departurePickupPointText,
            overrideReason: args.overrideReason ?? null,
            notes: args.notes ?? req.notes,
          },
        });

        await prisma.trip.update({
          where: { id: outboundTrip.id },
          data: { pairedTripId: retTripId },
        });

        await prisma.tripRequestLink.create({
          data: {
            id: nextSnowflakeId(),
            tripId: retTripId,
            requestId: req.id,
            linkRole: 'PRIMARY',
            requestLeg: 'RETURN',
          },
        });
      }

      await prisma.transportRequest.update({
        where: { id: req.id },
        data: {
          status: 'WAITING_DRIVER_CONFIRM',
          outboundStatus: 'WAITING_DRIVER_CONFIRM',
          returnStatus:
            req.tripMode === 'ROUND_TRIP' ? 'WAITING_DRIVER_CONFIRM' : req.returnStatus,
          currentTripId: outboundTrip.id,
          overrideReason: args.overrideReason ?? req.overrideReason,
          statusHistory: {
            create: {
              id: nextSnowflakeId(),
              fromStatus: req.status,
              toStatus: 'WAITING_DRIVER_CONFIRM',
              actionBy: ctx.user?.id ?? null,
              actionReason: `Điều phối vào chuyến ${tripCode}`,
            },
          },
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        outboundTrip.id,
        'DISPATCH',
        `Điều phối đơn ${req.requestCode} -> chuyến ${tripCode} (${vehicle.vehiclePlate})`,
      );

      return prisma.trip.findUniqueOrThrow({
        ...query,
        where: { id: outboundTrip.id },
      });
    },
  }),

  bulkDispatchRequests: t.prismaField({
    type: 'Trip',
    authScopes: { feature: FEATURE_CODES.REQUEST_DISPATCH },
    args: {
      requestIds: t.arg({ type: ['BigInt'], required: true }),
      vehicleId: t.arg({ type: 'BigInt', required: true }),
      driverId: t.arg({ type: 'BigInt', required: true }),
      plannedDepartureAt: t.arg.string(),
      plannedArrivalAt: t.arg.string(),
      overrideReason: t.arg.string(),
      notes: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      if (args.requestIds.length === 0) {
        throw new Error('Phải chọn ít nhất 1 yêu cầu xe để điều phối');
      }

      const reqIds = args.requestIds.map((id) => BigInt(id));
      const [reqs, vehicle, driver] = await Promise.all([
        prisma.transportRequest.findMany({
          where: { id: { in: reqIds } },
          orderBy: { id: 'asc' },
        }),
        prisma.vehicle.findUniqueOrThrow({ where: { id: BigInt(args.vehicleId) } }),
        prisma.driver.findUniqueOrThrow({ where: { id: BigInt(args.driverId) } }),
      ]);

      if (reqs.length === 0) {
        throw new Error('Không tìm thấy các yêu cầu xe được chọn');
      }

      const firstReq = reqs[0];
      const totalPassengers = reqs.reduce((sum, r) => sum + r.passengerCount, 0);

      const depAt = parseTimeOnDate(
        firstReq.businessDate,
        args.plannedDepartureAt ?? firstReq.departureTime,
      );
      const arrAt = args.plannedArrivalAt
        ? parseTimeOnDate(firstReq.businessDate, args.plannedArrivalAt)
        : firstReq.expectedArrivalTime
          ? parseTimeOnDate(firstReq.businessDate, firstReq.expectedArrivalTime)
          : new Date(depAt.getTime() + 60 * 60 * 1000);

      await checkVehicleScheduleConflict(
        vehicle.id,
        firstReq.businessDate,
        depAt,
        arrAt,
        args.overrideReason,
      );

      const tripId = nextSnowflakeId();
      const tripCode = `TRP-${firstReq.businessDate.replace(/-/g, '')}-${String(tripId).slice(-5)}`;

      const pickupPoints = Array.from(
        new Set(reqs.map((r) => r.departurePickupPointText).filter(Boolean)),
      ).join(' -> ');
      const dropoffPoints = Array.from(
        new Set(reqs.map((r) => r.departureDropoffPointText).filter(Boolean)),
      ).join(' -> ');

      const trip = await prisma.trip.create({
        ...query,
        data: {
          id: tripId,
          tripCode,
          businessDate: firstReq.businessDate,
          tripType: firstReq.requestType,
          dispatchType: 'DISPATCH',
          status: 'DISPATCHED',
          vendorId: vehicle.vendorId,
          routeId: firstReq.routeId,
          vehicleId: vehicle.id,
          driverId: driver.id,
          vehiclePlateSnapshot: vehicle.vehiclePlate,
          driverNameSnapshot: driver.driverName,
          driverPhoneSnapshot: driver.phoneNumber,
          seatCapacitySnapshot: vehicle.seatCapacity,
          plannedDepartureAt: depAt,
          plannedArrivalAt: arrAt,
          passengerCount: totalPassengers,
          tripMode: 'ONE_WAY',
          tripLeg: 'OUTBOUND',
          departurePickupPointText: pickupPoints || firstReq.departurePickupPointText,
          departureDropoffPointText: dropoffPoints || firstReq.departureDropoffPointText,
          overrideReason: args.overrideReason ?? null,
          notes: args.notes ?? null,
        },
      });

      for (let i = 0; i < reqs.length; i++) {
        const r = reqs[i];
        await prisma.tripRequestLink.create({
          data: {
            id: nextSnowflakeId(),
            tripId: trip.id,
            requestId: r.id,
            linkRole: i === 0 ? 'PRIMARY' : 'MERGED',
            requestLeg: 'OUTBOUND',
          },
        });

        await prisma.transportRequest.update({
          where: { id: r.id },
          data: {
            status: 'WAITING_DRIVER_CONFIRM',
            outboundStatus: 'WAITING_DRIVER_CONFIRM',
            currentTripId: trip.id,
            statusHistory: {
              create: {
                id: nextSnowflakeId(),
                fromStatus: r.status,
                toStatus: 'WAITING_DRIVER_CONFIRM',
                actionBy: ctx.user?.id ?? null,
                actionReason: `Điều phối gộp vào chuyến ${tripCode}`,
              },
            },
          },
        });
      }

      await writeAuditLog(
        ctx,
        'TRIP',
        trip.id,
        'BULK_DISPATCH',
        `Điều phối gộp ${reqs.length} đơn vào chuyến ${tripCode}`,
      );

      return prisma.trip.findUniqueOrThrow({
        ...query,
        where: { id: trip.id },
      });
    },
  }),

  attachRequestsToTrip: t.prismaField({
    type: 'Trip',
    authScopes: { feature: FEATURE_CODES.REQUEST_DISPATCH },
    args: {
      tripId: t.arg({ type: 'BigInt', required: true }),
      requestIds: t.arg({ type: ['BigInt'], required: true }),
      requestLeg: t.arg.string({ defaultValue: 'OUTBOUND' }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.tripId);
      const reqIds = args.requestIds.map((id) => BigInt(id));

      const [trip, reqs] = await Promise.all([
        prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
        prisma.transportRequest.findMany({
          where: { id: { in: reqIds } },
          include: { passengers: true },
        }),
      ]);

      // AT-OT-006: Check passenger duplicate on trip
      const existingLinks = await prisma.tripRequestLink.findMany({
        where: { tripId, delFlag: 'N' },
        include: { request: { include: { passengers: true } } },
      });
      const existingPassengerCodes = new Set<string>();
      for (const l of existingLinks) {
        for (const p of l.request.passengers) {
          if (p.passengerId) existingPassengerCodes.add(p.passengerId);
        }
      }

      let addedPassengers = 0;
      for (const r of reqs) {
        for (const p of r.passengers) {
          if (p.passengerId && existingPassengerCodes.has(p.passengerId)) {
            throw new Error(`Hành khách ${p.passengerName} (${p.passengerId}) đã có trên chuyến xe`);
          }
        }
        addedPassengers += r.passengerCount;

        await prisma.tripRequestLink.create({
          data: {
            id: nextSnowflakeId(),
            tripId,
            requestId: r.id,
            linkRole: 'ADDED_LATE',
            requestLeg: args.requestLeg ?? 'OUTBOUND',
          },
        });

        await prisma.transportRequest.update({
          where: { id: r.id },
          data: {
            status: 'WAITING_DRIVER_CONFIRM',
            outboundStatus:
              args.requestLeg === 'RETURN' ? r.outboundStatus : 'WAITING_DRIVER_CONFIRM',
            returnStatus:
              args.requestLeg === 'RETURN' ? 'WAITING_DRIVER_CONFIRM' : r.returnStatus,
            currentTripId: tripId,
          },
        });
      }

      const updatedTrip = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: {
          passengerCount: trip.passengerCount + addedPassengers,
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'ATTACH_REQUESTS',
        `Gắn thêm ${reqs.length} đơn vào chuyến ${trip.tripCode}`,
      );

      return updatedTrip;
    },
  }),

  detachRequestsFromTrip: t.prismaField({
    type: 'Trip',
    authScopes: { feature: FEATURE_CODES.REQUEST_DISPATCH },
    args: {
      tripId: t.arg({ type: 'BigInt', required: true }),
      requestIds: t.arg({ type: ['BigInt'], required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.tripId);
      const reqIds = args.requestIds.map((id) => BigInt(id));

      const [trip, reqs] = await Promise.all([
        prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
        prisma.transportRequest.findMany({ where: { id: { in: reqIds } } }),
      ]);

      const removedPassengers = reqs.reduce((sum, r) => sum + r.passengerCount, 0);

      await prisma.tripRequestLink.updateMany({
        where: {
          tripId,
          requestId: { in: reqIds },
          delFlag: 'N',
        },
        data: { delFlag: 'Y' },
      });

      for (const r of reqs) {
        await prisma.transportRequest.update({
          where: { id: r.id },
          data: {
            status: 'WAITING_VENDOR_DISPATCH',
            outboundStatus: 'WAITING_VENDOR_DISPATCH',
            currentTripId: null,
          },
        });
      }

      const remainingLinksCount = await prisma.tripRequestLink.count({
        where: { tripId, delFlag: 'N' },
      });

      // AT-DSP-004: Auto-cancel non-fixed trip if last request is detached
      const nextStatus =
        remainingLinksCount === 0 && trip.dispatchType !== 'FIXED_ROUTE'
          ? 'CANCELLED'
          : trip.status;

      const updatedTrip = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: {
          passengerCount: Math.max(0, trip.passengerCount - removedPassengers),
          status: nextStatus,
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'DETACH_REQUESTS',
        `Gỡ ${reqs.length} đơn khỏi chuyến ${trip.tripCode} (trạng thái chuyến: ${nextStatus})`,
      );

      return updatedTrip;
    },
  }),

  cancelTrip: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.REQUEST_DISPATCH,
        FEATURE_CODES.TRIP_REASSIGN,
        FEATURE_CODES.COMMUTE_DISPATCH_EDIT,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.id);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: { requestLinks: { where: { delFlag: 'N' } } },
      });

      const tripIdsToCancel = [tripId];
      if (trip.pairedTripId) {
        tripIdsToCancel.push(trip.pairedTripId);
      }

      const allLinks = await prisma.tripRequestLink.findMany({
        where: { tripId: { in: tripIdsToCancel }, delFlag: 'N' },
      });

      // AT-DSP-010: Return all linked requests back to WAITING_VENDOR_DISPATCH
      for (const link of allLinks) {
        await prisma.tripRequestLink.update({
          where: { id: link.id },
          data: { delFlag: 'Y' },
        });
        await prisma.transportRequest.update({
          where: { id: link.requestId },
          data: {
            status: 'WAITING_VENDOR_DISPATCH',
            outboundStatus: 'WAITING_VENDOR_DISPATCH',
            returnStatus: 'WAITING_VENDOR_DISPATCH',
            currentTripId: null,
          },
        });
      }

      if (trip.pairedTripId) {
        await prisma.trip.updateMany({
          where: { id: trip.pairedTripId },
          data: {
            status: 'CANCELLED',
            notes: args.reason ? `[Hủy cặp chuyến: ${args.reason}]` : undefined,
          },
        });
      }

      const updated = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: {
          status: 'CANCELLED',
          notes: args.reason ? `${trip.notes ?? ''} [Hủy: ${args.reason}]`.trim() : trip.notes,
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'CANCEL',
        `Hủy chuyến ${trip.tripCode}: ${args.reason ?? ''}`,
      );

      return updated;
    },
  }),

  reassignTripVehicle: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [FEATURE_CODES.TRIP_REASSIGN, FEATURE_CODES.REQUEST_DISPATCH],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      vehicleId: t.arg({ type: 'BigInt', required: true }),
      driverId: t.arg({ type: 'BigInt', required: true }),
      actualKm: t.arg({ type: 'Decimal' }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.id);
      const [trip, vehicle, driver] = await Promise.all([
        prisma.trip.findUniqueOrThrow({
          where: { id: tripId },
          include: { executionFacts: { orderBy: { id: 'desc' }, take: 1 } },
        }),
        prisma.vehicle.findUniqueOrThrow({ where: { id: BigInt(args.vehicleId) } }),
        prisma.driver.findUniqueOrThrow({ where: { id: BigInt(args.driverId) } }),
      ]);

      const updated = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: {
          vehicleId: vehicle.id,
          driverId: driver.id,
          vendorId: vehicle.vendorId,
          vehiclePlateSnapshot: vehicle.vehiclePlate,
          driverNameSnapshot: driver.driverName,
          driverPhoneSnapshot: driver.phoneNumber,
          seatCapacitySnapshot: vehicle.seatCapacity,
          overrideReason: args.reason ?? trip.overrideReason,
        },
      });

      if (args.actualKm !== undefined && args.actualKm !== null && Number(args.actualKm) > 0) {
        const kmDec = new Prisma.Decimal(Number(args.actualKm).toFixed(2));
        if (trip.executionFacts.length > 0) {
          await prisma.tripExecutionFact.update({
            where: { id: trip.executionFacts[0].id },
            data: { actualKm: kmDec, actualKmSource: 'MANUAL' },
          });
        } else {
          await prisma.tripExecutionFact.create({
            data: {
              id: nextSnowflakeId(),
              tripId,
              actualDepartureAt: trip.plannedDepartureAt ?? new Date(),
              actualArrivalAt: trip.plannedArrivalAt ?? new Date(),
              actualKm: kmDec,
              actualKmSource: 'MANUAL',
            },
          });
        }
      }

      // AT-DSP-009 / AT-TRIP-009: If trip is already COMPLETED, sync vehicleId on its costRecords
      if (trip.status === 'COMPLETED') {
        await prisma.costRecord.updateMany({
          where: { tripId },
          data: { vehicleId: vehicle.id },
        });
      }

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'REASSIGN',
        `Đổi xe/tài xế chuyến ${trip.tripCode} sang ${vehicle.vehiclePlate} - ${driver.driverName}`,
      );

      return updated;
    },
  }),

  confirmTrip: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_CONFIRM,
        FEATURE_CODES.DRIVER_JOURNEY_CONFIRM,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.id);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: { requestLinks: { where: { delFlag: 'N' } } },
      });

      const updated = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: { status: 'DRIVER_CONFIRMED' },
      });

      for (const link of trip.requestLinks) {
        await syncRequestStatusFromTrips(link.requestId, 'WAITING_DRIVER_CONFIRM');
      }

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'CONFIRM',
        `Tài xế xác nhận chuyến ${trip.tripCode}`,
      );

      return updated;
    },
  }),

  startTrip: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_START,
        FEATURE_CODES.DRIVER_JOURNEY_START,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      startOdometerKm: t.arg({ type: 'Decimal' }),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.id);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: { requestLinks: { where: { delFlag: 'N' } } },
      });

      // AT-TRIP-003: Block manual Start on FIXED_ROUTE trips
      if (trip.dispatchType === 'FIXED_ROUTE') {
        throw new Error(
          'Chuyến tuyến cố định không hỗ trợ Bắt đầu thủ công (hệ thống tự hoàn thành theo giờ kế hoạch)',
        );
      }

      const now = new Date();
      await prisma.tripExecutionFact.create({
        data: {
          id: nextSnowflakeId(),
          tripId,
          actualDepartureAt: now,
          startOdometerKm: args.startOdometerKm
            ? new Prisma.Decimal(String(args.startOdometerKm))
            : null,
        },
      });

      const updated = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: { status: 'IN_PROGRESS' },
      });

      for (const link of trip.requestLinks) {
        await syncRequestStatusFromTrips(link.requestId, 'IN_PROGRESS');
      }

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'START',
        `Bắt đầu chuyến ${trip.tripCode}`,
      );

      return updated;
    },
  }),

  completeTrip: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_COMPLETE,
        FEATURE_CODES.DRIVER_JOURNEY_COMPLETE,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      endOdometerKm: t.arg({ type: 'Decimal' }),
      actualPassengerCount: t.arg.int(),
      tollFeeAmount: t.arg({ type: 'Decimal' }),
      executionNote: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const tripId = BigInt(args.id);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: {
          requestLinks: { where: { delFlag: 'N' } },
          executionFacts: { orderBy: { id: 'desc' }, take: 1 },
        },
      });

      // AT-TRIP-003: Block manual Complete on FIXED_ROUTE trips
      if (trip.dispatchType === 'FIXED_ROUTE') {
        throw new Error(
          'Chuyến tuyến cố định không hỗ trợ Hoàn thành thủ công (hệ thống tự hoàn thành theo giờ kế hoạch)',
        );
      }

      const now = new Date();
      const latestFact = trip.executionFacts[0];
      const endOdoDec = args.endOdometerKm
        ? new Prisma.Decimal(String(args.endOdometerKm))
        : (latestFact?.endOdometerKm ?? null);
      const startOdoDec = latestFact?.startOdometerKm ?? null;
      let computedActualKm = latestFact?.actualKm ?? null;
      if (startOdoDec !== null && endOdoDec !== null) {
        const diff = Number(endOdoDec) - Number(startOdoDec);
        if (diff > 0) {
          computedActualKm = new Prisma.Decimal(diff.toFixed(2));
        }
      }

      if (latestFact) {
        await prisma.tripExecutionFact.update({
          where: { id: latestFact.id },
          data: {
            actualArrivalAt: now,
            endOdometerKm: endOdoDec,
            actualKm: computedActualKm,
            actualPassengerCount:
              args.actualPassengerCount ?? trip.passengerCount,
            completedBy: ctx.user?.id ?? null,
            completedAt: now,
            executionNote: args.executionNote ?? latestFact.executionNote,
          },
        });
      } else {
        await prisma.tripExecutionFact.create({
          data: {
            id: nextSnowflakeId(),
            tripId,
            actualDepartureAt: trip.plannedDepartureAt ?? now,
            actualArrivalAt: now,
            endOdometerKm: endOdoDec,
            actualKm: computedActualKm,
            actualPassengerCount:
              args.actualPassengerCount ?? trip.passengerCount,
            completedBy: ctx.user?.id ?? null,
            completedAt: now,
            executionNote: args.executionNote ?? null,
          },
        });
      }

      if (args.tollFeeAmount !== undefined && args.tollFeeAmount !== null && Number(args.tollFeeAmount) > 0) {
        const tollDec = new Prisma.Decimal(Number(args.tollFeeAmount).toFixed(2));
        const tollKey = `TRIP_TOLL:${String(tripId)}`;
        await prisma.costRecord.upsert({
          where: { idempotencyKey: tollKey },
          update: {
            quantity: new Prisma.Decimal('1'),
            appliedUnitPrice: tollDec,
            appliedAmount: tollDec,
            vatRate: new Prisma.Decimal('0'),
            vatAmount: new Prisma.Decimal('0'),
            amountAfterVat: tollDec,
            costStatus: 'DRAFT',
            pricedAt: new Date(),
          },
          create: {
            id: nextSnowflakeId(),
            idempotencyKey: tollKey,
            costSource: 'AUTO',
            costType: 'TOLL_FEE',
            costScope: 'TRIP',
            tripId,
            vehicleId: trip.vehicleId,
            routeId: trip.routeId,
            serviceDate: trip.businessDate,
            costMonth: trip.businessDate.slice(0, 7),
            quantity: new Prisma.Decimal('1'),
            appliedUnitPrice: tollDec,
            appliedAmount: tollDec,
            vatRate: new Prisma.Decimal('0'),
            vatAmount: new Prisma.Decimal('0'),
            amountAfterVat: tollDec,
            description: `Phí cầu đường chuyến ${trip.tripCode}`,
            costStatus: 'DRAFT',
          },
        });
      }

      const updated = await prisma.trip.update({
        ...query,
        where: { id: tripId },
        data: { status: 'COMPLETED' },
      });

      // AT-TRIP-002: Linked requests transition to WAITING_DISTANCE_INPUT
      for (const link of trip.requestLinks) {
        await syncRequestStatusFromTrips(link.requestId, 'WAITING_DISTANCE_INPUT');
      }

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'COMPLETE',
        `Hoàn thành chuyến ${trip.tripCode}`,
      );

      return updated;
    },
  }),

  updateTripActualKm: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.TRIP_ACTUAL_KM,
        FEATURE_CODES.TRIP_REASSIGN_VEHICLE,
        FEATURE_CODES.TRIP_LIST,
        FEATURE_CODES.REQUEST_DISPATCH,
      ],
    },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      actualKm: t.arg({ type: 'Decimal', required: true }),
      otHours: t.arg({ type: 'Decimal' }),
      tollFeeAmount: t.arg({ type: 'Decimal' }),
      actualStartAt: t.arg.string(),
      actualEndAt: t.arg.string(),
      overnightNights: t.arg.int(),
      targetStatus: t.arg.string(),
      executionNote: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const kmVal = Number(args.actualKm);
      // AT-TRIP-004: Block actualKm <= 0
      if (!Number.isFinite(kmVal) || kmVal <= 0) {
        throw new Error('Số KM thực tế phải lớn hơn 0');
      }

      const tripId = BigInt(args.id);
      const trip = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: {
          requestLinks: {
            where: { delFlag: 'N' },
            include: { request: true },
          },
          executionFacts: { orderBy: { id: 'desc' }, take: 1 },
        },
      });

      const kmDec = new Prisma.Decimal(kmVal.toFixed(2));
      const otDec = args.otHours ? new Prisma.Decimal(String(args.otHours)) : null;
      const parsedStart = args.actualStartAt
        ? (args.actualStartAt.includes('T')
            ? new Date(args.actualStartAt)
            : parseTimeOnDate(trip.businessDate, args.actualStartAt))
        : null;
      const parsedEnd = args.actualEndAt
        ? (args.actualEndAt.includes('T')
            ? new Date(args.actualEndAt)
            : parseTimeOnDate(trip.businessDate, args.actualEndAt))
        : null;

      if (trip.executionFacts.length > 0) {
        await prisma.tripExecutionFact.update({
          where: { id: trip.executionFacts[0].id },
          data: {
            actualKm: kmDec,
            otHours: otDec ?? trip.executionFacts[0].otHours,
            actualDepartureAt: parsedStart ?? trip.executionFacts[0].actualDepartureAt,
            actualArrivalAt: parsedEnd ?? trip.executionFacts[0].actualArrivalAt,
            actualKmSource: 'MANUAL',
            executionNote: args.executionNote ?? trip.executionFacts[0].executionNote,
          },
        });
      } else {
        await prisma.tripExecutionFact.create({
          data: {
            id: nextSnowflakeId(),
            tripId,
            actualDepartureAt: parsedStart ?? trip.plannedDepartureAt ?? new Date(),
            actualArrivalAt: parsedEnd ?? trip.plannedArrivalAt ?? new Date(),
            actualKm: kmDec,
            otHours: otDec,
            actualKmSource: 'MANUAL',
            completedBy: ctx.user?.id ?? null,
            completedAt: new Date(),
            executionNote: args.executionNote ?? null,
          },
        });
      }

      if (args.targetStatus || args.overnightNights !== undefined) {
        const extraNotes =
          args.overnightNights && args.overnightNights > 0
            ? `${trip.notes ?? ''} [Lưu đêm: ${args.overnightNights} đêm]`.trim()
            : trip.notes;
        await prisma.trip.update({
          where: { id: tripId },
          data: {
            ...(args.targetStatus ? { status: args.targetStatus } : {}),
            notes: extraNotes,
          },
        });
      }

      if (args.tollFeeAmount !== undefined && args.tollFeeAmount !== null && Number(args.tollFeeAmount) >= 0) {
        const tollDec = new Prisma.Decimal(Number(args.tollFeeAmount).toFixed(2));
        const tollKey = `TRIP_TOLL:${String(tripId)}`;
        if (Number(args.tollFeeAmount) > 0) {
          await prisma.costRecord.upsert({
            where: { idempotencyKey: tollKey },
            update: {
              quantity: new Prisma.Decimal('1'),
              appliedUnitPrice: tollDec,
              appliedAmount: tollDec,
              vatRate: new Prisma.Decimal('0'),
              vatAmount: new Prisma.Decimal('0'),
              amountAfterVat: tollDec,
              costStatus: 'DRAFT',
              pricedAt: new Date(),
            },
            create: {
              id: nextSnowflakeId(),
              idempotencyKey: tollKey,
              costSource: 'AUTO',
              costType: 'TOLL_FEE',
              costScope: 'TRIP',
              tripId,
              vehicleId: trip.vehicleId,
              routeId: trip.routeId,
              serviceDate: trip.businessDate,
              costMonth: trip.businessDate.slice(0, 7),
              quantity: new Prisma.Decimal('1'),
              appliedUnitPrice: tollDec,
              appliedAmount: tollDec,
              vatRate: new Prisma.Decimal('0'),
              vatAmount: new Prisma.Decimal('0'),
              amountAfterVat: tollDec,
              description: `Phí cầu đường chuyến ${trip.tripCode}`,
              costStatus: 'DRAFT',
            },
          });
        }
      }

      // Transition linked requests from WAITING_DISTANCE_INPUT -> COMPLETED (handling ROUND_TRIP via composeRequestStatus)
      for (const link of trip.requestLinks) {
        const req = link.request;
        if (req.tripMode === 'ROUND_TRIP') {
          const nextOutbound =
            link.requestLeg === 'RETURN' ? (req.outboundStatus ?? 'COMPLETED') : 'COMPLETED';
          const nextReturn =
            link.requestLeg === 'RETURN' ? 'COMPLETED' : (req.returnStatus ?? 'WAITING_DRIVER_CONFIRM');
          const composed = composeRequestStatus(req.tripMode, nextOutbound, nextReturn);
          await prisma.transportRequest.update({
            where: { id: req.id },
            data: {
              outboundStatus: nextOutbound,
              returnStatus: nextReturn,
              status: composed,
            },
          });
        } else {
          await prisma.transportRequest.update({
            where: { id: req.id },
            data: {
              outboundStatus: 'COMPLETED',
              status: 'COMPLETED',
            },
          });
        }
      }

      // Auto-sync daily cost record for this trip (AT-TRIP-004)
      const unitPrice = new Prisma.Decimal('15000');
      const appliedAmount = kmDec.mul(unitPrice);
      const vatRate = new Prisma.Decimal('0.08');
      const vatAmount = appliedAmount.mul(vatRate);
      const amountAfterVat = appliedAmount.add(vatAmount);
      const idempotencyKey = `TRIP_KM:${String(tripId)}`;

      await prisma.costRecord.upsert({
        where: { idempotencyKey },
        update: {
          quantity: kmDec,
          appliedUnitPrice: unitPrice,
          appliedAmount,
          vatAmount,
          amountAfterVat,
          costStatus: 'DRAFT',
          pricedAt: new Date(),
        },
        create: {
          id: nextSnowflakeId(),
          idempotencyKey,
          costSource: 'AUTO',
          costType: 'TRIP',
          costScope: 'TRIP',
          tripId,
          vehicleId: trip.vehicleId,
          routeId: trip.routeId,
          serviceDate: trip.businessDate,
          costMonth: trip.businessDate.slice(0, 7),
          quantity: kmDec,
          appliedUnitPrice: unitPrice,
          appliedAmount,
          vatRate,
          vatAmount,
          amountAfterVat,
          description: `Chi phí chuyến ${trip.tripCode} (${kmVal} km)`,
          costStatus: 'DRAFT',
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'UPDATE_ACTUAL_KM',
        `Cập nhật KM thực tế chuyến ${trip.tripCode}: ${kmVal} km`,
      );

      return prisma.trip.findUniqueOrThrow({
        ...query,
        where: { id: tripId },
      });
    },
  }),

  createPlanAssignment: t.prismaField({
    type: 'PlanAssignment',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.COMMUTE_DISPATCH_CREATE,
        FEATURE_CODES.COMMUTE_DISPATCH_EDIT,
      ],
    },
    args: {
      businessDate: t.arg.string({ required: true }),
      routeId: t.arg({ type: 'BigInt', required: true }),
      segmentId: t.arg({ type: 'BigInt' }),
      legDefinitionId: t.arg({ type: 'BigInt' }),
      legCode: t.arg.string({ required: true }),
      legName: t.arg.string(),
      direction: t.arg.string(),
      vehicleId: t.arg({ type: 'BigInt', required: true }),
      driverId: t.arg({ type: 'BigInt', required: true }),
      assignmentType: t.arg.string({ defaultValue: 'SUPPLEMENT' }),
      demandCount: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _root, args, ctx) => {
      const businessDate = args.businessDate.trim().slice(0, 10);
      const route = await prisma.route.findUniqueOrThrow({
        where: { id: BigInt(args.routeId) },
      });

      let plan = await prisma.dailyPlan.findUnique({
        where: { businessDate },
        include: { versions: { where: { currentFlag: 'Y' }, take: 1 } },
      });

      let versionId: bigint;
      if (!plan) {
        const planId = nextSnowflakeId();
        versionId = nextSnowflakeId();
        plan = await prisma.dailyPlan.create({
          data: {
            id: planId,
            businessDate,
            status: 'CURRENT',
            currentVersionId: versionId,
            versions: {
              create: {
                id: versionId,
                versionNo: 1,
                status: 'CURRENT',
                currentFlag: 'Y',
              },
            },
          },
          include: { versions: true },
        });
      } else if (plan.versions.length === 0) {
        versionId = nextSnowflakeId();
        await prisma.planVersion.create({
          data: {
            id: versionId,
            planId: plan.id,
            versionNo: 1,
            status: 'CURRENT',
            currentFlag: 'Y',
          },
        });
      } else {
        versionId = plan.versions[0].id;
      }

      const id = nextSnowflakeId();
      const created = await prisma.planAssignment.create({
        ...query,
        data: {
          id,
          planVersionId: versionId,
          routeId: route.id,
          segmentId: args.segmentId ? BigInt(args.segmentId) : null,
          legDefinitionId: args.legDefinitionId ? BigInt(args.legDefinitionId) : null,
          legCode: args.legCode,
          legName: args.legName ?? args.legCode,
          direction: args.direction ?? 'TO_FACTORY',
          passengerType: route.passengerType,
          routeCode: route.routeCode,
          routeName: route.routeName,
          vehicleId: BigInt(args.vehicleId),
          driverId: BigInt(args.driverId),
          assignmentType: args.assignmentType ?? 'SUPPLEMENT',
          demandCount: args.demandCount ?? 0,
          activeFlag: 'Y',
        },
      });

      await writeAuditLog(
        ctx,
        'PLAN_ASSIGNMENT',
        id,
        'CREATE',
        `Thêm phân công xe kế hoạch ngày ${businessDate} tuyến ${route.routeCode}`,
      );

      return created;
    },
  }),

  updatePlanAssignment: t.prismaField({
    type: 'PlanAssignment',
    authScopes: { feature: FEATURE_CODES.COMMUTE_DISPATCH_EDIT },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
      vehicleId: t.arg({ type: 'BigInt' }),
      driverId: t.arg({ type: 'BigInt' }),
      demandCount: t.arg.int(),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = BigInt(args.id);
      const existing = await prisma.planAssignment.findUniqueOrThrow({
        where: { id },
      });

      const updated = await prisma.planAssignment.update({
        ...query,
        where: { id },
        data: {
          vehicleId: args.vehicleId ? BigInt(args.vehicleId) : existing.vehicleId,
          driverId: args.driverId ? BigInt(args.driverId) : existing.driverId,
          demandCount: args.demandCount ?? existing.demandCount,
        },
      });

      await writeAuditLog(
        ctx,
        'PLAN_ASSIGNMENT',
        id,
        'UPDATE',
        `Cập nhật phân công kế hoạch #${String(id)}`,
      );

      return updated;
    },
  }),

  cancelPlanAssignment: t.prismaField({
    type: 'PlanAssignment',
    authScopes: { feature: FEATURE_CODES.COMMUTE_DISPATCH_EDIT },
    args: {
      id: t.arg({ type: 'BigInt', required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = BigInt(args.id);
      const updated = await prisma.planAssignment.update({
        ...query,
        where: { id },
        data: { activeFlag: 'N' },
      });

      await writeAuditLog(
        ctx,
        'PLAN_ASSIGNMENT',
        id,
        'CANCEL',
        `Hủy phân công kế hoạch #${String(id)}`,
      );

      return updated;
    },
  }),

  finalizePlan: t.prismaField({
    type: ['Trip'],
    authScopes: { feature: FEATURE_CODES.COMMUTE_DISPATCH_FINALIZE },
    args: {
      businessDate: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const businessDate = args.businessDate.trim().slice(0, 10);

      let plan = await prisma.dailyPlan.findUnique({
        where: { businessDate },
        include: {
          versions: {
            where: { currentFlag: 'Y' },
            include: { assignments: { where: { activeFlag: 'Y' } } },
          },
        },
      });

      if (!plan || plan.versions.length === 0) {
        throw new Error(`Chưa có kế hoạch xe tuyến cố định cho ngày ${businessDate}`);
      }

      const currentVersion = plan.versions[0];
      const createdTripIds: bigint[] = [];

      for (const assign of currentVersion.assignments) {
        if (!assign.vehicleId || !assign.driverId) continue;

        const [vehicle, driver, costConfig] = await Promise.all([
          prisma.vehicle.findUnique({ where: { id: assign.vehicleId } }),
          prisma.driver.findUnique({ where: { id: assign.driverId } }),
          prisma.costConfig.findFirst({
            where: {
              delFlag: 'N',
              activeFlag: 'Y',
              configType: 'COMMUTE',
              passengerType: assign.passengerType ?? 'STAFF',
              effectiveFrom: { lte: businessDate },
            },
            orderBy: { effectiveFrom: 'desc' },
          }),
        ]);

        const tripId = nextSnowflakeId();
        const tripCode = `FX-${businessDate.replace(/-/g, '')}-${String(tripId).slice(-5)}`;
        const depAt = parseTimeOnDate(businessDate, '06:30');
        const arrAt = parseTimeOnDate(businessDate, '07:45');

        await prisma.trip.create({
          data: {
            id: tripId,
            tripCode,
            businessDate,
            planVersionId: currentVersion.id,
            planAssignmentId: assign.id,
            tripType: 'FIXED_ROUTE',
            dispatchType: 'FIXED_ROUTE',
            status: 'DISPATCHED',
            vendorId: vehicle?.vendorId ?? null,
            routeId: assign.routeId,
            segmentId: assign.segmentId,
            legCode: assign.legCode,
            vehicleId: assign.vehicleId,
            driverId: assign.driverId,
            vehiclePlateSnapshot: vehicle?.vehiclePlate ?? null,
            driverNameSnapshot: driver?.driverName ?? null,
            driverPhoneSnapshot: driver?.phoneNumber ?? null,
            seatCapacitySnapshot: vehicle?.seatCapacity ?? null,
            plannedDepartureAt: depAt,
            plannedArrivalAt: arrAt,
            passengerCount: assign.demandCount,
            passengerType: assign.passengerType,
            tripMode: 'ONE_WAY',
            pricingConfigId: costConfig?.id ?? null,
          },
        });

        createdTripIds.push(tripId);
      }

      await prisma.dailyPlan.update({
        where: { id: plan.id },
        data: { status: 'FINALIZED' },
      });

      await prisma.planVersion.update({
        where: { id: currentVersion.id },
        data: {
          status: 'FINALIZED',
          publishedBy: ctx.user?.id ?? null,
          publishedAt: new Date(),
        },
      });

      await writeAuditLog(
        ctx,
        'DAILY_PLAN',
        plan.id,
        'FINALIZE',
        `Chốt kế hoạch xe tuyến cố định ngày ${businessDate} (${createdTripIds.length} chuyến)`,
      );

      return prisma.trip.findMany({
        ...query,
        where: { id: { in: createdTripIds } },
      });
    },
  }),

  createSupplementTrip: t.prismaField({
    type: 'Trip',
    authScopes: {
      anyFeature: [
        FEATURE_CODES.COMMUTE_DISPATCH_CREATE,
        FEATURE_CODES.COMMUTE_DISPATCH_EDIT,
      ],
    },
    args: {
      businessDate: t.arg.string({ required: true }),
      routeId: t.arg({ type: 'BigInt', required: true }),
      segmentId: t.arg({ type: 'BigInt' }),
      legCode: t.arg.string({ required: true }),
      vehicleId: t.arg({ type: 'BigInt', required: true }),
      driverId: t.arg({ type: 'BigInt', required: true }),
      passengerCount: t.arg.int({ defaultValue: 0 }),
      notes: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const businessDate = args.businessDate.trim().slice(0, 10);
      const today = getTodayStr();

      // AT-PLAN-007: Block CreateSupplementTrip for future dates
      if (businessDate > today) {
        throw new Error(
          'Không thể tạo chuyến điều bù thực tế cho ngày tương lai. Vui lòng thêm xe bổ sung trên Kế hoạch.',
        );
      }

      const [route, vehicle, driver] = await Promise.all([
        prisma.route.findUniqueOrThrow({ where: { id: BigInt(args.routeId) } }),
        prisma.vehicle.findUniqueOrThrow({ where: { id: BigInt(args.vehicleId) } }),
        prisma.driver.findUniqueOrThrow({ where: { id: BigInt(args.driverId) } }),
      ]);

      const tripId = nextSnowflakeId();
      const tripCode = `SUP-${businessDate.replace(/-/g, '')}-${String(tripId).slice(-5)}`;

      const created = await prisma.trip.create({
        ...query,
        data: {
          id: tripId,
          tripCode,
          businessDate,
          tripType: 'FIXED_ROUTE',
          dispatchType: 'SUPPLEMENT',
          status: 'DISPATCHED',
          vendorId: vehicle.vendorId,
          routeId: route.id,
          segmentId: args.segmentId ? BigInt(args.segmentId) : null,
          legCode: args.legCode,
          vehicleId: vehicle.id,
          driverId: driver.id,
          vehiclePlateSnapshot: vehicle.vehiclePlate,
          driverNameSnapshot: driver.driverName,
          driverPhoneSnapshot: driver.phoneNumber,
          seatCapacitySnapshot: vehicle.seatCapacity,
          plannedDepartureAt: new Date(),
          plannedArrivalAt: new Date(Date.now() + 60 * 60 * 1000),
          passengerCount: args.passengerCount ?? 0,
          passengerType: route.passengerType,
          tripMode: 'ONE_WAY',
          notes: args.notes ?? 'Chuyến điều bù thực tế',
        },
      });

      await writeAuditLog(
        ctx,
        'TRIP',
        tripId,
        'CREATE_SUPPLEMENT',
        `Tạo chuyến điều bù ${tripCode} tuyến ${route.routeCode}`,
      );

      return created;
    },
  }),

  // ==========================================================================
  // BACKGROUND / CRON JOB MUTATIONS (AT-JOB-006, AT-JOB-007, AT-JOB-008)
  // ==========================================================================

  runSyncVehicleStatus: t.field({
    type: 'Int',
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      const now = new Date();
      const vehicles = await prisma.vehicle.findMany({
        where: { delFlag: 'N' },
      });

      const activeTrips = await prisma.trip.findMany({
        where: {
          delFlag: 'N',
          status: {
            in: ['PLANNED', 'DISPATCHED', 'WAITING_DRIVER_CONFIRM', 'DRIVER_CONFIRMED', 'IN_PROGRESS'],
          },
          vehicleId: { not: null },
        },
      });

      let changedCount = 0;

      for (const veh of vehicles) {
        let nextStatus = 'AVAILABLE';
        let currentTripId: bigint | null = null;
        let routeId: bigint | null = null;
        let segmentId: bigint | null = null;
        let plannedDep: Date | null = null;
        let plannedArr: Date | null = null;

        // AT-JOB-007 Priority:
        // 1. Inactive vehicle -> NOT_AVAILABLE
        if (veh.activeFlag === 'N') {
          nextStatus = 'NOT_AVAILABLE';
        } else {
          const vehTrips = activeTrips.filter((t) => t.vehicleId === veh.id);
          // 2. Fixed route within [departure - 30m, arrival) -> ON_FIXED_ROUTE
          const fixedMatch = vehTrips.find((t) => {
            if (t.dispatchType !== 'FIXED_ROUTE' && t.tripType !== 'FIXED_ROUTE') return false;
            if (!t.plannedDepartureAt || !t.plannedArrivalAt) return false;
            const windowStart = new Date(t.plannedDepartureAt.getTime() - 30 * 60 * 1000);
            return now >= windowStart && now < t.plannedArrivalAt;
          });

          if (fixedMatch) {
            nextStatus = 'ON_FIXED_ROUTE';
            currentTripId = fixedMatch.id;
            routeId = fixedMatch.routeId;
            segmentId = fixedMatch.segmentId;
            plannedDep = fixedMatch.plannedDepartureAt;
            plannedArr = fixedMatch.plannedArrivalAt;
          } else {
            // 3. Special assignment within [departure, arrival) or IN_PROGRESS -> ON_SPECIAL_ASSIGNMENT
            const specialMatch = vehTrips.find((t) => {
              if (t.status === 'IN_PROGRESS') return true;
              if (!t.plannedDepartureAt || !t.plannedArrivalAt) return false;
              return now >= t.plannedDepartureAt && now < t.plannedArrivalAt;
            });

            if (specialMatch) {
              nextStatus = 'ON_SPECIAL_ASSIGNMENT';
              currentTripId = specialMatch.id;
              routeId = specialMatch.routeId;
              segmentId = specialMatch.segmentId;
              plannedDep = specialMatch.plannedDepartureAt;
              plannedArr = specialMatch.plannedArrivalAt;
            }
          }
        }

        const existing = await prisma.vehicleStatus.findUnique({
          where: { vehicleId: veh.id },
        });

        if (!existing || existing.status !== nextStatus || existing.currentTripId !== currentTripId) {
          changedCount++;
          await prisma.vehicleStatus.upsert({
            where: { vehicleId: veh.id },
            update: {
              status: nextStatus,
              currentTripId,
              routeId,
              segmentId,
              plannedDepartureAt: plannedDep,
              plannedArrivalAt: plannedArr,
              lastSyncedAt: now,
            },
            create: {
              vehicleId: veh.id,
              status: nextStatus,
              currentTripId,
              routeId,
              segmentId,
              plannedDepartureAt: plannedDep,
              plannedArrivalAt: plannedArr,
              lastSyncedAt: now,
            },
          });

          if (existing && existing.status !== nextStatus) {
            await writeAuditLog(
              ctx,
              'VEHICLE_STATUS',
              veh.id,
              'SYNC_STATUS',
              `Xe ${veh.vehiclePlate}: ${existing.status} -> ${nextStatus}`,
            );
          }
        } else {
          await prisma.vehicleStatus.update({
            where: { vehicleId: veh.id },
            data: { lastSyncedAt: now },
          });
        }
      }

      return changedCount;
    },
  }),

  runAutoCompleteTrips: t.field({
    type: 'Int',
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      const now = new Date();
      // AT-JOB-008:
      // 1. Special dispatch trips in IN_PROGRESS with plannedArrivalAt <= now
      // 2. FIXED_ROUTE trips in DRIVER_CONFIRMED (or DISPATCHED) with plannedArrivalAt <= now
      const dueTrips = await prisma.trip.findMany({
        where: {
          delFlag: 'N',
          plannedArrivalAt: { lte: now },
          OR: [
            { status: 'IN_PROGRESS' },
            {
              dispatchType: 'FIXED_ROUTE',
              status: { in: ['DRIVER_CONFIRMED', 'IN_PROGRESS'] },
            },
          ],
        },
        include: {
          requestLinks: { where: { delFlag: 'N' } },
        },
      });

      for (const trip of dueTrips) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { status: 'COMPLETED' },
        });

        await prisma.tripExecutionFact.create({
          data: {
            id: nextSnowflakeId(),
            tripId: trip.id,
            actualDepartureAt: trip.plannedDepartureAt ?? now,
            actualArrivalAt: trip.plannedArrivalAt ?? now,
            actualPassengerCount: trip.passengerCount,
            completedAt: now,
            executionNote: 'Tự động hoàn thành theo giờ kế hoạch',
          },
        });

        for (const link of trip.requestLinks) {
          await syncRequestStatusFromTrips(link.requestId, 'WAITING_DISTANCE_INPUT');
        }
      }

      if (dueTrips.length > 0) {
        await writeAuditLog(
          ctx,
          'TRIP',
          dueTrips.map((t) => String(t.id)).join(','),
          'AUTO_COMPLETE',
          `Tự động hoàn thành ${dueTrips.length} chuyến đã qua giờ đến`,
        );
      }

      return dueTrips.length;
    },
  }),

  runCreateCommutePlan: t.prismaField({
    type: 'DailyPlan',
    authScopes: { authenticated: true },
    args: {
      businessDate: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const businessDate = args.businessDate?.trim().slice(0, 10) || getTomorrowStr();

      // Load holiday dates
      const holidaySetting = await prisma.setting.findUnique({
        where: { varKey: 'HOLIDAY_DATES' },
      });
      const holidayDates = new Set<string>();
      if (holidaySetting?.varValue) {
        for (const part of holidaySetting.varValue.split(',')) {
          if (part.trim()) holidayDates.add(part.trim().slice(0, 10));
        }
      }

      // Load active routes with segments
      const routes = await prisma.route.findMany({
        where: { delFlag: 'N', activeFlag: 'Y' },
        include: {
          segments: {
            where: { delFlag: 'N', activeFlag: 'Y' },
            orderBy: { sequenceOrder: 'asc' },
          },
        },
      });

      // Load all APPROVED ETP registrations to count demand per route on businessDate
      const etps = await prisma.employeeTransportProfile.findMany({
        where: {
          delFlag: 'N',
          approvalStatus: 'APPROVED',
        },
      });

      const demandByRoute = new Map<bigint, number>();
      for (const reg of etps) {
        if (
          isRegistrationEffectiveOnDate(
            {
              approvalStatus: reg.approvalStatus,
              isDeleted: reg.delFlag === 'Y',
              effectiveFrom: reg.effectiveFrom,
              effectiveTo: reg.effectiveTo,
            },
            businessDate,
          )
        ) {
          demandByRoute.set(reg.routeId, (demandByRoute.get(reg.routeId) ?? 0) + 1);
        }
      }

      const existingPlan = await prisma.dailyPlan.findUnique({
        where: { businessDate },
        include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
      });

      if (existingPlan && existingPlan.status === 'FINALIZED') {
        throw new Error(`Kế hoạch ngày ${businessDate} đã chốt, không thể tạo đè`);
      }

      const versionId = nextSnowflakeId();
      const nextVersionNo = existingPlan?.versions[0]
        ? existingPlan.versions[0].versionNo + 1
        : 1;

      let planId: bigint;
      if (existingPlan) {
        planId = existingPlan.id;
        await prisma.planVersion.updateMany({
          where: { planId },
          data: { currentFlag: 'N' },
        });
        await prisma.planVersion.create({
          data: {
            id: versionId,
            planId,
            versionNo: nextVersionNo,
            status: 'CURRENT',
            currentFlag: 'Y',
          },
        });
        await prisma.dailyPlan.update({
          where: { id: planId },
          data: { currentVersionId: versionId, status: 'CURRENT' },
        });
      } else {
        planId = nextSnowflakeId();
        await prisma.dailyPlan.create({
          data: {
            id: planId,
            businessDate,
            status: 'CURRENT',
            currentVersionId: versionId,
            versions: {
              create: {
                id: versionId,
                versionNo: 1,
                status: 'CURRENT',
                currentFlag: 'Y',
              },
            },
          },
        });
      }

      for (const rt of routes) {
        if (!doesRouteRunOnDate(rt.runDays, businessDate, holidayDates)) {
          continue;
        }
        const demandCount = demandByRoute.get(rt.id) ?? 0;

        for (const seg of rt.segments) {
          await prisma.planAssignment.create({
            data: {
              id: nextSnowflakeId(),
              planVersionId: versionId,
              routeId: rt.id,
              segmentId: seg.id,
              legDefinitionId: seg.legDefinitionId,
              legCode: seg.legCode,
              legName: seg.legName ?? seg.legCode,
              direction: seg.direction,
              passengerType: rt.passengerType,
              routeCode: rt.routeCode,
              routeName: rt.routeName,
              vehicleId: seg.defaultVehicleId,
              driverId: seg.defaultDriverId,
              assignmentType: 'BASE',
              demandCount,
              activeFlag: 'Y',
            },
          });
        }
      }

      await writeAuditLog(
        ctx,
        'DAILY_PLAN',
        planId,
        'CREATE_COMMUTE_PLAN',
        `Tự động lập kế hoạch xe tuyến cố định ngày ${businessDate} (v${nextVersionNo})`,
      );

      return prisma.dailyPlan.findUniqueOrThrow({
        ...query,
        where: { id: planId },
      });
    },
  }),
}));
