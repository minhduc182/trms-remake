import { Prisma } from '@prisma/client';
import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import { FEATURE_CODES, nextSnowflakeId } from '@trms/shared';

function shortenTripPath(fullPath: string): string {
  const stops = fullPath
    .split('->')
    .map((s) => s.trim())
    .filter(Boolean);
  if (stops.length <= 3) {
    return stops.join(' -> ');
  }
  return `${stops[0]} -> ${stops[1]} -> ... -> ${stops[stops.length - 1]}`;
}

export const CostRecordObj = builder.prismaObject('CostRecord', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    idempotencyKey: t.exposeString('idempotencyKey', { nullable: true }),
    costRuleId: t.expose('costRuleId', { type: 'BigInt', nullable: true }),
    costSource: t.exposeString('costSource'),
    costType: t.exposeString('costType'),
    costScope: t.exposeString('costScope'),
    tripId: t.expose('tripId', { type: 'BigInt', nullable: true }),
    vehicleId: t.expose('vehicleId', { type: 'BigInt', nullable: true }),
    routeId: t.expose('routeId', { type: 'BigInt', nullable: true }),
    serviceDate: t.exposeString('serviceDate', { nullable: true }),
    costMonth: t.exposeString('costMonth', { nullable: true }),
    quantity: t.expose('quantity', { type: 'Decimal' }),
    appliedUnitPrice: t.expose('appliedUnitPrice', { type: 'Decimal' }),
    appliedAmount: t.expose('appliedAmount', { type: 'Decimal' }),
    vatRate: t.expose('vatRate', { type: 'Decimal' }),
    vatAmount: t.expose('vatAmount', { type: 'Decimal' }),
    amountAfterVat: t.expose('amountAfterVat', { type: 'Decimal' }),
    description: t.exposeString('description', { nullable: true }),
    costStatus: t.exposeString('costStatus'),
    pricedAt: t.expose('pricedAt', { type: 'DateTime', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    trip: t.relation('trip', { nullable: true }),
  }),
});

export const MonthlyCostDetailObj = builder.prismaObject('MonthlyCostDetail', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    monthlyPaymentId: t.expose('monthlyPaymentId', { type: 'BigInt' }),
    lineNo: t.exposeInt('lineNo'),
    lineType: t.exposeString('lineType'),
    driverId: t.expose('driverId', { type: 'BigInt', nullable: true }),
    driverNameSnapshot: t.exposeString('driverNameSnapshot', { nullable: true }),
    vehicleId: t.expose('vehicleId', { type: 'BigInt', nullable: true }),
    vehiclePlateSnapshot: t.exposeString('vehiclePlateSnapshot', { nullable: true }),
    routeId: t.expose('routeId', { type: 'BigInt', nullable: true }),
    routeNameSnapshot: t.exposeString('routeNameSnapshot', { nullable: true }),
    tripDescription: t.exposeString('tripDescription', { nullable: true }),
    dailyTripCount: t.exposeInt('dailyTripCount', { nullable: true }),
    basicChargeAmount: t.expose('basicChargeAmount', { type: 'Decimal' }),
    overtimeHours: t.expose('overtimeHours', { type: 'Decimal' }),
    overtimeUnitPrice: t.expose('overtimeUnitPrice', { type: 'Decimal' }),
    overtimeAmount: t.expose('overtimeAmount', { type: 'Decimal' }),
    totalDistanceKm: t.expose('totalDistanceKm', { type: 'Decimal' }),
    includedDistanceKm: t.expose('includedDistanceKm', { type: 'Decimal' }),
    excessKm: t.expose('excessKm', { type: 'Decimal' }),
    excessKmUnitPrice: t.expose('excessKmUnitPrice', { type: 'Decimal' }),
    excessKmAmount: t.expose('excessKmAmount', { type: 'Decimal' }),
    overnightAmount: t.expose('overnightAmount', { type: 'Decimal' }),
    tollFeeAmount: t.expose('tollFeeAmount', { type: 'Decimal' }),
    extraTripAmount: t.expose('extraTripAmount', { type: 'Decimal' }),
    totalBeforeVat: t.expose('totalBeforeVat', { type: 'Decimal' }),
    vatAmount: t.expose('vatAmount', { type: 'Decimal' }),
    totalAfterVat: t.expose('totalAfterVat', { type: 'Decimal' }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
  }),
});

export const MonthlyPaymentObj = builder.prismaObject('MonthlyPayment', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    paymentMonth: t.exposeString('paymentMonth'),
    vendorId: t.expose('vendorId', { type: 'BigInt', nullable: true }),
    totalBeforeVat: t.expose('totalBeforeVat', { type: 'Decimal' }),
    totalVatAmount: t.expose('totalVatAmount', { type: 'Decimal' }),
    totalAfterVat: t.expose('totalAfterVat', { type: 'Decimal' }),
    status: t.exposeString('status'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    details: t.relation('details', {
      query: () => ({ orderBy: { lineNo: 'asc' } }),
    }),
  }),
});

export interface VehicleBillItem {
  tripId: bigint;
  tripCode: string;
  businessDate: string;
  vehicleId: bigint | null;
  vehiclePlate: string | null;
  driverName: string | null;
  passengerType: string | null;
  routeName: string | null;
  tripPathText: string;
  tripPathFullText: string;
  actualKm: number;
  overtimeHours: number;
  amountBeforeVat: number;
  vatAmount: number;
  amountAfterVat: number;
}

export const VehicleBillRef = builder.objectRef<VehicleBillItem>('VehicleBillItem').implement({
  fields: (t) => ({
    tripId: t.expose('tripId', { type: 'BigInt' }),
    tripCode: t.exposeString('tripCode'),
    businessDate: t.exposeString('businessDate'),
    vehicleId: t.expose('vehicleId', { type: 'BigInt', nullable: true }),
    vehiclePlate: t.exposeString('vehiclePlate', { nullable: true }),
    driverName: t.exposeString('driverName', { nullable: true }),
    passengerType: t.exposeString('passengerType', { nullable: true }),
    routeName: t.exposeString('routeName', { nullable: true }),
    tripPathText: t.exposeString('tripPathText'),
    tripPathFullText: t.exposeString('tripPathFullText'),
    actualKm: t.exposeFloat('actualKm'),
    overtimeHours: t.exposeFloat('overtimeHours'),
    amountBeforeVat: t.exposeFloat('amountBeforeVat'),
    vatAmount: t.exposeFloat('vatAmount'),
    amountAfterVat: t.exposeFloat('amountAfterVat'),
  }),
});

builder.queryFields((t) => ({
  costRecords: t.prismaField({
    type: ['CostRecord'],
    authScopes: { feature: FEATURE_CODES.COST_REPORT_DAILY },
    args: {
      serviceDate: t.arg.string(),
      costMonth: t.arg.string(),
      costType: t.arg.string(),
      vehicleId: t.arg({ type: 'BigInt' }),
      routeId: t.arg({ type: 'BigInt' }),
      costStatus: t.arg.string(),
      limit: t.arg.int({ defaultValue: 100 }),
    },
    resolve: (query, _root, args) =>
      prisma.costRecord.findMany({
        ...query,
        where: {
          ...(args.serviceDate ? { serviceDate: args.serviceDate } : {}),
          ...(args.costMonth ? { costMonth: args.costMonth } : {}),
          ...(args.costType ? { costType: args.costType } : {}),
          ...(args.vehicleId ? { vehicleId: BigInt(args.vehicleId) } : {}),
          ...(args.routeId ? { routeId: BigInt(args.routeId) } : {}),
          ...(args.costStatus
            ? { costStatus: args.costStatus }
            : { costStatus: { not: 'CANCELLED' } }),
        },
        take: args.limit ?? 100,
        orderBy: [{ serviceDate: 'desc' }, { id: 'desc' }],
      }),
  }),

  vehicleBills: t.field({
    type: [VehicleBillRef],
    authScopes: { feature: FEATURE_CODES.COST_REPORT_VEHICLE_BILL },
    args: {
      businessDate: t.arg.string(),
      passengerType: t.arg.string(),
      plateNumber: t.arg.string(),
      driverName: t.arg.string(),
      tripId: t.arg({ type: 'BigInt' }),
      limit: t.arg.int({ defaultValue: 100 }),
    },
    resolve: async (_root, args) => {
      const trips = await prisma.trip.findMany({
        where: {
          delFlag: 'N',
          status: 'COMPLETED',
          ...(args.businessDate ? { businessDate: args.businessDate } : {}),
          ...(args.passengerType ? { passengerType: args.passengerType } : {}),
          ...(args.tripId ? { id: BigInt(args.tripId) } : {}),
          ...(args.plateNumber
            ? {
                vehiclePlateSnapshot: {
                  contains: args.plateNumber,
                  mode: 'insensitive',
                },
              }
            : {}),
          ...(args.driverName
            ? {
                driverNameSnapshot: {
                  contains: args.driverName,
                  mode: 'insensitive',
                },
              }
            : {}),
        },
        include: {
          route: {
            include: {
              segments: {
                where: { delFlag: 'N' },
                include: {
                  segmentPoints: {
                    include: { point: true },
                    orderBy: { stopOrder: 'asc' },
                  },
                },
              },
            },
          },
          executionFacts: { orderBy: { id: 'desc' }, take: 1 },
          costRecords: { where: { costStatus: { not: 'CANCELLED' } } },
        },
        take: args.limit ?? 100,
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
      });

      return trips.map((t): VehicleBillItem => {
        const fact = t.executionFacts[0];
        const actualKm = Number(fact?.actualKm ?? 0);
        const overtimeHours = Number(fact?.otHours ?? 0);

        let fullPath = '';
        if (t.route && t.route.segments.length > 0) {
          const pts = t.route.segments[0].segmentPoints.map((sp) => sp.point.pointName);
          if (pts.length > 0) {
            fullPath = pts.join(' -> ');
          }
        }
        if (!fullPath) {
          const p1 = t.departurePickupPointText ?? 'Điểm đón';
          const p2 = t.departureDropoffPointText ?? 'Nhà máy MKVC';
          fullPath = `${p1} -> ${p2}`;
        }

        const beforeVat = t.costRecords.reduce(
          (sum, c) => sum + Number(c.appliedAmount),
          0,
        );
        const vatAmt = t.costRecords.reduce(
          (sum, c) => sum + Number(c.vatAmount),
          0,
        );
        const afterVat = t.costRecords.reduce(
          (sum, c) => sum + Number(c.amountAfterVat),
          0,
        );

        return {
          tripId: t.id,
          tripCode: t.tripCode,
          businessDate: t.businessDate,
          vehicleId: t.vehicleId,
          vehiclePlate: t.vehiclePlateSnapshot,
          driverName: t.driverNameSnapshot,
          passengerType: t.passengerType,
          routeName: t.route?.routeName ?? null,
          tripPathText: shortenTripPath(fullPath),
          tripPathFullText: fullPath,
          actualKm,
          overtimeHours,
          amountBeforeVat: beforeVat,
          vatAmount: vatAmt,
          amountAfterVat: afterVat,
        };
      });
    },
  }),

  monthlyPayments: t.prismaField({
    type: ['MonthlyPayment'],
    authScopes: { feature: FEATURE_CODES.COST_REPORT_MONTHLY_PAYMENT },
    args: {
      paymentMonth: t.arg.string(),
    },
    resolve: (query, _root, args) =>
      prisma.monthlyPayment.findMany({
        ...query,
        where: {
          ...(args.paymentMonth ? { paymentMonth: args.paymentMonth } : {}),
        },
        orderBy: { paymentMonth: 'desc' },
      }),
  }),

  monthlyPayment: t.prismaField({
    type: 'MonthlyPayment',
    nullable: true,
    authScopes: { feature: FEATURE_CODES.COST_REPORT_MONTHLY_PAYMENT },
    args: {
      id: t.arg({ type: 'BigInt' }),
      paymentMonth: t.arg.string(),
    },
    resolve: (query, _root, args) => {
      if (args.id) {
        return prisma.monthlyPayment.findUnique({
          ...query,
          where: { id: BigInt(args.id) },
        });
      }
      if (args.paymentMonth) {
        return prisma.monthlyPayment.findUnique({
          ...query,
          where: { paymentMonth: args.paymentMonth },
        });
      }
      return prisma.monthlyPayment.findFirst({
        ...query,
        orderBy: { paymentMonth: 'desc' },
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  recalculateDailyCosts: t.prismaField({
    type: ['CostRecord'],
    authScopes: { feature: FEATURE_CODES.COST_REPORT_RECALCULATE_DAILY },
    args: {
      serviceDate: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const serviceDate = args.serviceDate.trim().slice(0, 10);
      const costMonth = serviceDate.slice(0, 7);

      const trips = await prisma.trip.findMany({
        where: {
          businessDate: serviceDate,
          delFlag: 'N',
        },
        include: {
          executionFacts: { orderBy: { id: 'desc' }, take: 1 },
          vehicle: true,
          route: true,
        },
      });

      const expectedKeys = new Set<string>();
      const vatRate = new Prisma.Decimal('0.08');

      // Group vehicle actual departure/arrival for OVERTIME_HOUR calculation (outside 06:30 - 18:30, AT-COST-003)
      const vehicleWindowMap = new Map<
        bigint,
        { minStart: Date | null; maxEnd: Date | null; routeId: bigint | null }
      >();

      for (const trip of trips) {
        if (trip.status === 'DISPATCHED') {
          // AT-COST-005: Record COST_DAILY issue if trip is stuck in DISPATCHED
          await writeAuditLog(
            ctx,
            'COST_DAILY',
            trip.id,
            'ISSUE_DISPATCHED_STUCK',
            `Chuyến ${trip.tripCode} ngày ${serviceDate} còn kẹt trạng thái DISPATCHED`,
          );
          continue;
        }

        if (trip.status !== 'COMPLETED') continue;

        const fact = trip.executionFacts[0];
        const actualKmNum = Number(fact?.actualKm ?? 25);
        const kmDec = new Prisma.Decimal(actualKmNum.toFixed(2));

        const d = new Date(`${serviceDate}T00:00:00+07:00`);
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // AT-COST-001: ChooseDayCharge (DAILY_RUN on weekend fixed route vs TRIP)
        const isFixedRoute =
          trip.dispatchType === 'FIXED_ROUTE' || trip.tripType === 'FIXED_ROUTE';
        const costType = isFixedRoute && isWeekend ? 'DAILY_RUN' : 'TRIP';
        const idempotencyKey =
          costType === 'DAILY_RUN'
            ? `DAILY_RUN:${serviceDate}:${String(trip.vehicleId ?? 0n)}:${String(trip.routeId ?? 0n)}`
            : `TRIP:${serviceDate}:${String(trip.id)}`;

        expectedKeys.add(idempotencyKey);

        const unitPrice =
          costType === 'DAILY_RUN'
            ? new Prisma.Decimal('1200000')
            : new Prisma.Decimal('15000');
        const qty = costType === 'DAILY_RUN' ? new Prisma.Decimal('1') : kmDec;
        const appliedAmount = qty.mul(unitPrice);
        const vatAmount = appliedAmount.mul(vatRate);
        const amountAfterVat = appliedAmount.add(vatAmount);

        await prisma.costRecord.upsert({
          where: { idempotencyKey },
          update: {
            costType,
            tripId: trip.id,
            vehicleId: trip.vehicleId,
            routeId: trip.routeId,
            serviceDate,
            costMonth,
            quantity: qty,
            appliedUnitPrice: unitPrice,
            appliedAmount,
            vatRate,
            vatAmount,
            amountAfterVat,
            costStatus: 'DRAFT',
            pricedAt: new Date(),
          },
          create: {
            id: nextSnowflakeId(),
            idempotencyKey,
            costSource: 'AUTO',
            costType,
            costScope: costType === 'DAILY_RUN' ? 'DAILY' : 'TRIP',
            tripId: trip.id,
            vehicleId: trip.vehicleId,
            routeId: trip.routeId,
            serviceDate,
            costMonth,
            quantity: qty,
            appliedUnitPrice: unitPrice,
            appliedAmount,
            vatRate,
            vatAmount,
            amountAfterVat,
            description: `Chi phí ${costType} ngày ${serviceDate} (${trip.tripCode})`,
            costStatus: 'DRAFT',
          },
        });

        // Track vehicle minStart / maxEnd for OVERTIME_HOUR
        if (trip.vehicleId && (fact?.actualDepartureAt || trip.plannedDepartureAt)) {
          const startAt = fact?.actualDepartureAt ?? trip.plannedDepartureAt!;
          const endAt = fact?.actualArrivalAt ?? trip.plannedArrivalAt ?? startAt;
          const cur = vehicleWindowMap.get(trip.vehicleId) ?? {
            minStart: null,
            maxEnd: null,
            routeId: trip.routeId,
          };
          if (!cur.minStart || startAt < cur.minStart) cur.minStart = startAt;
          if (!cur.maxEnd || endAt > cur.maxEnd) cur.maxEnd = endAt;
          vehicleWindowMap.set(trip.vehicleId, cur);
        }
      }

      // AT-COST-003: Calculate OVERTIME_HOUR outside 06:30 - 18:30 per vehicle-day
      const stdStart = new Date(`${serviceDate}T06:30:00+07:00`);
      const stdEnd = new Date(`${serviceDate}T18:30:00+07:00`);

      for (const [vehicleId, win] of vehicleWindowMap.entries()) {
        let earlyMs = 0;
        let lateMs = 0;
        if (win.minStart && win.minStart < stdStart) {
          earlyMs = stdStart.getTime() - win.minStart.getTime();
        }
        if (win.maxEnd && win.maxEnd > stdEnd) {
          lateMs = win.maxEnd.getTime() - stdEnd.getTime();
        }
        const totalOtHours = Number(((earlyMs + lateMs) / (3600 * 1000)).toFixed(2));
        if (totalOtHours > 0) {
          const otKey = `OVERTIME_HOUR:${serviceDate}:${String(vehicleId)}`;
          expectedKeys.add(otKey);
          const otQty = new Prisma.Decimal(totalOtHours.toFixed(2));
          const otUnitPrice = new Prisma.Decimal('100000');
          const otAmount = otQty.mul(otUnitPrice);
          const otVat = otAmount.mul(vatRate);
          const otAfterVat = otAmount.add(otVat);

          await prisma.costRecord.upsert({
            where: { idempotencyKey: otKey },
            update: {
              quantity: otQty,
              appliedUnitPrice: otUnitPrice,
              appliedAmount: otAmount,
              vatAmount: otVat,
              amountAfterVat: otAfterVat,
              costStatus: 'DRAFT',
              pricedAt: new Date(),
            },
            create: {
              id: nextSnowflakeId(),
              idempotencyKey: otKey,
              costSource: 'AUTO',
              costType: 'OVERTIME_HOUR',
              costScope: 'DAILY',
              vehicleId,
              routeId: win.routeId,
              serviceDate,
              costMonth,
              quantity: otQty,
              appliedUnitPrice: otUnitPrice,
              appliedAmount: otAmount,
              vatRate,
              vatAmount: otVat,
              amountAfterVat: otAfterVat,
              description: `Phí ngoài giờ xe #${String(vehicleId)} ngày ${serviceDate} (${totalOtHours}h)`,
              costStatus: 'DRAFT',
            },
          });
        }
      }

      // AT-COST-010: Cancel stale DRAFT snapshot cost records not in expectedKeys
      if (expectedKeys.size > 0) {
        await prisma.costRecord.updateMany({
          where: {
            serviceDate,
            costSource: 'AUTO',
            costStatus: 'DRAFT',
            idempotencyKey: { notIn: Array.from(expectedKeys) },
          },
          data: { costStatus: 'CANCELLED' },
        });
      }

      await writeAuditLog(
        ctx,
        'COST_DAILY',
        serviceDate,
        'RECALCULATE_DAILY',
        `Tính lại chi phí ngày ${serviceDate} (${expectedKeys.size} dòng)`,
      );

      return prisma.costRecord.findMany({
        ...query,
        where: {
          serviceDate,
          costStatus: { not: 'CANCELLED' },
        },
        orderBy: { id: 'asc' },
      });
    },
  }),

  recalculateMonthlyCosts: t.prismaField({
    type: 'MonthlyPayment',
    authScopes: { feature: FEATURE_CODES.COST_REPORT_RECALCULATE_MONTHLY },
    args: {
      paymentMonth: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const paymentMonth = args.paymentMonth.trim().slice(0, 7);
      const vatRate = new Prisma.Decimal('0.08');

      // Load active routes with assigned vehicles and daily cost records for this month
      const [routeVehicles, dailyCosts] = await Promise.all([
        prisma.routeVehicle.findMany({
          where: { delFlag: 'N', activeFlag: 'Y' },
          include: { route: true, vehicle: true, driver: true },
          orderBy: { id: 'asc' },
        }),
        prisma.costRecord.findMany({
          where: {
            costMonth: paymentMonth,
            costStatus: { not: 'CANCELLED' },
          },
        }),
      ]);

      let payment = await prisma.monthlyPayment.findUnique({
        where: { paymentMonth },
      });

      if (!payment) {
        payment = await prisma.monthlyPayment.create({
          data: {
            id: nextSnowflakeId(),
            paymentMonth,
            status: 'DRAFT',
          },
        });
      } else {
        await prisma.monthlyCostDetail.deleteMany({
          where: { monthlyPaymentId: payment.id },
        });
      }

      let lineNo = 1;
      let sumBeforeVat = new Prisma.Decimal('0');
      let sumVat = new Prisma.Decimal('0');
      let sumAfterVat = new Prisma.Decimal('0');

      const coveredVehicleIds = new Set<bigint>();

      // AT-COST-006, AT-COST-009: Create VEHICLE_ROUTE lines for fixed-route vehicles
      for (const rv of routeVehicles) {
        coveredVehicleIds.add(rv.vehicleId);
        const vehCosts = dailyCosts.filter((c) => c.vehicleId === rv.vehicleId);

        const basicCharge =
          rv.vehicle.commutePackageMode === 'BY_SEGMENT'
            ? new Prisma.Decimal('32000000')
            : new Prisma.Decimal('26000000');

        const otAmount = vehCosts
          .filter((c) => c.costType === 'OVERTIME_HOUR')
          .reduce((acc, c) => acc.add(c.appliedAmount), new Prisma.Decimal('0'));
        const otHours = vehCosts
          .filter((c) => c.costType === 'OVERTIME_HOUR')
          .reduce((acc, c) => acc.add(c.quantity), new Prisma.Decimal('0'));
        const extraTripAmount = vehCosts
          .filter((c) => c.costType === 'TRIP' || c.costType === 'DAILY_RUN')
          .reduce((acc, c) => acc.add(c.appliedAmount), new Prisma.Decimal('0'));

        const totalBeforeVat = basicCharge.add(otAmount).add(extraTripAmount);
        const vatAmount = totalBeforeVat.mul(vatRate);
        const totalAfterVat = totalBeforeVat.add(vatAmount);

        sumBeforeVat = sumBeforeVat.add(totalBeforeVat);
        sumVat = sumVat.add(vatAmount);
        sumAfterVat = sumAfterVat.add(totalAfterVat);

        await prisma.monthlyCostDetail.create({
          data: {
            id: nextSnowflakeId(),
            monthlyPaymentId: payment.id,
            lineNo: lineNo++,
            lineType: 'VEHICLE_ROUTE',
            driverId: rv.driverId,
            driverNameSnapshot: rv.driver?.driverName ?? null,
            vehicleId: rv.vehicleId,
            vehiclePlateSnapshot: rv.vehicle.vehiclePlate,
            routeId: rv.routeId,
            routeNameSnapshot: rv.route.routeName,
            tripDescription: `Cước trọn gói tháng ${paymentMonth} - ${rv.route.routeCode}`,
            dailyTripCount: rv.vehicle.dailyTripQuota ?? 2,
            basicChargeAmount: basicCharge,
            overtimeHours: otHours,
            overtimeUnitPrice: new Prisma.Decimal('100000'),
            overtimeAmount: otAmount,
            includedDistanceKm: rv.vehicle.monthlyKmQuota ?? new Prisma.Decimal('1500'),
            extraTripAmount,
            totalBeforeVat,
            vatAmount,
            totalAfterVat,
          },
        });
      }

      // AT-COST-009: Create EXTRA_ROUTE line for non-fixed-route extra trips if any
      const extraCosts = dailyCosts.filter(
        (c) => !c.vehicleId || !coveredVehicleIds.has(c.vehicleId),
      );
      if (extraCosts.length > 0) {
        const extraBeforeVat = extraCosts.reduce(
          (acc, c) => acc.add(c.appliedAmount),
          new Prisma.Decimal('0'),
        );
        const extraVat = extraBeforeVat.mul(vatRate);
        const extraAfterVat = extraBeforeVat.add(extraVat);

        sumBeforeVat = sumBeforeVat.add(extraBeforeVat);
        sumVat = sumVat.add(extraVat);
        sumAfterVat = sumAfterVat.add(extraAfterVat);

        await prisma.monthlyCostDetail.create({
          data: {
            id: nextSnowflakeId(),
            monthlyPaymentId: payment.id,
            lineNo: lineNo++,
            lineType: 'EXTRA_ROUTE',
            tripDescription: `Chuyến phát sinh ngoài tuyến tháng ${paymentMonth}`,
            extraTripAmount: extraBeforeVat,
            totalBeforeVat: extraBeforeVat,
            vatAmount: extraVat,
            totalAfterVat: extraAfterVat,
          },
        });
      }

      await prisma.monthlyPayment.update({
        where: { id: payment.id },
        data: {
          totalBeforeVat: sumBeforeVat,
          totalVatAmount: sumVat,
          totalAfterVat: sumAfterVat,
          status: 'DRAFT',
        },
      });

      await writeAuditLog(
        ctx,
        'COST_MONTHLY',
        payment.id,
        'RECALCULATE_MONTHLY',
        `Tính lại bảng thanh toán tháng ${paymentMonth}`,
      );

      return prisma.monthlyPayment.findUniqueOrThrow({
        ...query,
        where: { id: payment.id },
      });
    },
  }),
}));
