import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { builder } from '../../builder.js';
import { prisma, writeAuditLog } from '../../context.js';
import {
  FEATURE_CODES,
  POINT_TYPES,
  VEHICLE_CAPACITY_BY_TYPE,
  PASSENGER_TYPES,
  LEG_DIRECTIONS,
  ROUTE_RUN_DAYS,
  nextSnowflakeId,
} from '@trms/shared';

function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`trms:${plain}`).digest('hex');
}

const ACTIVE_TRIP_STATUSES = [
  'PLANNED',
  'DISPATCHED',
  'WAITING_DRIVER_CONFIRM',
  'DRIVER_CONFIRMED',
  'IN_PROGRESS',
  'WAITING_DISTANCE_INPUT',
];

export const VendorObj = builder.prismaObject('Vendor', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    vendorCode: t.exposeString('vendorCode'),
    vendorName: t.exposeString('vendorName'),
    vendorType: t.exposeString('vendorType', { nullable: true }),
    contactName: t.exposeString('contactName', { nullable: true }),
    phone: t.exposeString('phone', { nullable: true }),
    email: t.exposeString('email', { nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
  }),
});

export const PointObj = builder.prismaObject('Point', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    pointCode: t.exposeString('pointCode'),
    pointName: t.exposeString('pointName'),
    pointType: t.exposeString('pointType'),
    districtName: t.exposeString('districtName', { nullable: true }),
    address: t.exposeString('address', { nullable: true }),
    isFactory: t.exposeString('isFactory'),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    segmentUsageCount: t.int({
      resolve: (point) =>
        prisma.segmentPoint.count({
          where: {
            pointId: point.id,
            segment: { delFlag: 'N', route: { delFlag: 'N' } },
          },
        }),
    }),
  }),
});

export const VehicleStatusObj = builder.prismaObject('VehicleStatus', {
  fields: (t) => ({
    vehicleId: t.expose('vehicleId', { type: 'BigInt' }),
    status: t.exposeString('status'),
    segmentId: t.expose('segmentId', { type: 'BigInt', nullable: true }),
    routeId: t.expose('routeId', { type: 'BigInt', nullable: true }),
    currentTripId: t.expose('currentTripId', { type: 'BigInt', nullable: true }),
    plannedDepartureAt: t.expose('plannedDepartureAt', { type: 'DateTime', nullable: true }),
    plannedArrivalAt: t.expose('plannedArrivalAt', { type: 'DateTime', nullable: true }),
    lastSyncedAt: t.expose('lastSyncedAt', { type: 'DateTime', nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    vehicle: t.relation('vehicle'),
  }),
});

export const VehicleObj = builder.prismaObject('Vehicle', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    vehicleCode: t.exposeString('vehicleCode', { nullable: true }),
    vehiclePlate: t.exposeString('vehiclePlate'),
    vendorId: t.expose('vendorId', { type: 'BigInt', nullable: true }),
    vehicleType: t.exposeString('vehicleType'),
    seatCapacity: t.exposeInt('seatCapacity'),
    ownershipType: t.exposeString('ownershipType'),
    commutePackageMode: t.exposeString('commutePackageMode', { nullable: true }),
    dailyTripQuota: t.exposeInt('dailyTripQuota', { nullable: true }),
    monthlyKmQuota: t.expose('monthlyKmQuota', { type: 'Decimal', nullable: true }),
    defaultDriverId: t.expose('defaultDriverId', { type: 'BigInt', nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    vendor: t.relation('vendor', { nullable: true }),
    vehicleStatus: t.relation('vehicleStatus', { nullable: true }),
    segmentUsageCount: t.int({
      resolve: (veh) =>
        prisma.routeSegment.count({
          where: {
            defaultVehicleId: veh.id,
            delFlag: 'N',
            route: { delFlag: 'N' },
          },
        }),
    }),
  }),
});

export const DriverObj = builder.prismaObject('Driver', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    driverName: t.exposeString('driverName'),
    vendorId: t.expose('vendorId', { type: 'BigInt', nullable: true }),
    phoneNumber: t.exposeString('phoneNumber'),
    shortAddress: t.exposeString('shortAddress', { nullable: true }),
    fullAddress: t.exposeString('fullAddress', { nullable: true }),
    identityUserId: t.expose('identityUserId', { type: 'BigInt', nullable: true }),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    vendor: t.relation('vendor', { nullable: true }),
    user: t.relation('user', { nullable: true }),
    segmentUsageCount: t.int({
      resolve: (drv) =>
        prisma.routeSegment.count({
          where: {
            defaultDriverId: drv.id,
            delFlag: 'N',
            route: { delFlag: 'N' },
          },
        }),
    }),
  }),
});

export const LegDefinitionObj = builder.prismaObject('LegDefinition', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    legCode: t.exposeString('legCode'),
    legName: t.exposeString('legName'),
    passengerType: t.exposeString('passengerType'),
    displayOrder: t.exposeInt('displayOrder'),
    direction: t.exposeString('direction'),
    isDeadhead: t.exposeString('isDeadhead'),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    segmentUsageCount: t.int({
      resolve: (leg) =>
        prisma.routeSegment.count({
          where: {
            legDefinitionId: leg.id,
            delFlag: 'N',
            route: { delFlag: 'N' },
          },
        }),
    }),
  }),
});

export const SegmentPointObj = builder.prismaObject('SegmentPoint', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    segmentId: t.expose('segmentId', { type: 'BigInt' }),
    pointId: t.expose('pointId', { type: 'BigInt' }),
    pointRole: t.exposeString('pointRole'),
    stopOrder: t.exposeInt('stopOrder'),
    plannedTime: t.exposeString('plannedTime', { nullable: true }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    point: t.relation('point'),
  }),
});

export const SegmentShiftObj = builder.prismaObject('SegmentShift', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    segmentId: t.expose('segmentId', { type: 'BigInt' }),
    shiftId: t.expose('shiftId', { type: 'BigInt' }),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    shift: t.relation('shift'),
  }),
});

export const RouteSegmentObj = builder.prismaObject('RouteSegment', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    routeId: t.expose('routeId', { type: 'BigInt' }),
    legDefinitionId: t.expose('legDefinitionId', { type: 'BigInt', nullable: true }),
    legCode: t.exposeString('legCode'),
    legName: t.exposeString('legName', { nullable: true }),
    direction: t.exposeString('direction'),
    departureTime: t.exposeString('departureTime', { nullable: true }),
    arrivalTime: t.exposeString('arrivalTime', { nullable: true }),
    defaultVehicleId: t.expose('defaultVehicleId', { type: 'BigInt', nullable: true }),
    defaultDriverId: t.expose('defaultDriverId', { type: 'BigInt', nullable: true }),
    sequenceOrder: t.exposeInt('sequenceOrder'),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    legDefinition: t.relation('legDefinition', { nullable: true }),
    defaultVehicle: t.relation('defaultVehicle', { nullable: true }),
    defaultDriver: t.relation('defaultDriver', { nullable: true }),
    segmentPoints: t.relation('segmentPoints', {
      query: () => ({ orderBy: { stopOrder: 'asc' } }),
    }),
    segmentShifts: t.relation('segmentShifts'),
  }),
});

export const RouteVehicleObj = builder.prismaObject('RouteVehicle', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    routeId: t.expose('routeId', { type: 'BigInt' }),
    vehicleId: t.expose('vehicleId', { type: 'BigInt' }),
    driverId: t.expose('driverId', { type: 'BigInt', nullable: true }),
    displayOrder: t.exposeInt('displayOrder'),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    vehicle: t.relation('vehicle'),
    driver: t.relation('driver', { nullable: true }),
  }),
});

export const RouteObj = builder.prismaObject('Route', {
  fields: (t) => ({
    id: t.expose('id', { type: 'BigInt' }),
    routeCode: t.exposeString('routeCode'),
    routeName: t.exposeString('routeName'),
    defaultVendorId: t.expose('defaultVendorId', { type: 'BigInt', nullable: true }),
    routeClass: t.exposeString('routeClass'),
    passengerType: t.exposeString('passengerType'),
    runDays: t.exposeString('runDays'),
    activeFlag: t.exposeString('activeFlag'),
    delFlag: t.exposeString('delFlag'),
    createDate: t.expose('createDate', { type: 'DateTime', nullable: true }),
    editDate: t.expose('editDate', { type: 'DateTime', nullable: true }),
    vendor: t.relation('vendor', { nullable: true }),
    segments: t.relation('segments', {
      query: () => ({ where: { delFlag: 'N' }, orderBy: { sequenceOrder: 'asc' } }),
    }),
    routeVehicles: t.relation('routeVehicles', {
      query: () => ({ where: { delFlag: 'N' }, orderBy: { displayOrder: 'asc' } }),
    }),
    riderCount: t.relationCount('transportProfiles', {
      where: { delFlag: 'N', approvalStatus: 'APPROVED', activeFlag: 'Y' },
    }),
  }),
});

export const SegmentPointInput = builder.inputType('SegmentPointInput', {
  fields: (t) => ({
    pointId: t.field({ type: 'BigInt', required: true }),
    pointRole: t.string({ defaultValue: 'PICKUP' }),
    stopOrder: t.int({ defaultValue: 1 }),
    plannedTime: t.string(),
  }),
});

export const RouteSegmentInput = builder.inputType('RouteSegmentInput', {
  fields: (t) => ({
    id: t.field({ type: 'BigInt' }),
    legDefinitionId: t.field({ type: 'BigInt' }),
    legCode: t.string(),
    legName: t.string(),
    direction: t.string(),
    departureTime: t.string(),
    arrivalTime: t.string(),
    defaultVehicleId: t.field({ type: 'BigInt' }),
    defaultDriverId: t.field({ type: 'BigInt' }),
    sequenceOrder: t.int(),
    activeFlag: t.string(),
    pickupPointIds: t.field({ type: ['BigInt'] }),
    dropoffPointIds: t.field({ type: ['BigInt'] }),
    points: t.field({ type: [SegmentPointInput] }),
    shiftIds: t.field({ type: ['BigInt'] }),
  }),
});

export const RouteVehicleInput = builder.inputType('RouteVehicleInput', {
  fields: (t) => ({
    vehicleId: t.field({ type: 'BigInt', required: true }),
    driverId: t.field({ type: 'BigInt' }),
    displayOrder: t.int(),
  }),
});

async function resolveDriverAccount(args: {
  accountMode?: string | null;
  identityUserId?: bigint | string | number | null;
  username?: string | null;
  password?: string | null;
  driverName: string;
  phoneNumber: string;
  currentDriverId?: bigint;
}): Promise<bigint | null> {
  const mode = (args.accountMode || (args.identityUserId ? 'LINK_EXISTING' : args.username ? 'CREATE_NEW' : 'NONE'))
    .trim()
    .toUpperCase();

  if (mode === 'NONE') {
    return null;
  }

  if (mode === 'LINK_EXISTING') {
    if (!args.identityUserId) {
      throw new Error('Vui lòng chọn tài khoản đăng nhập có sẵn');
    }
    const targetUserId = BigInt(args.identityUserId);
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt !== null) {
      throw new Error('Tài khoản liên kết không tồn tại hoặc đang bị khóa');
    }
    const hasDriverRole = user.userRoles.some((ur) =>
      ur.role.code.toUpperCase().includes('DRIVER'),
    );
    if (!hasDriverRole) {
      throw new Error('Chỉ liên kết được tài khoản có vai trò Tài xế');
    }
    const linkedOther = await prisma.driver.findFirst({
      where: {
        identityUserId: targetUserId,
        delFlag: 'N',
        ...(args.currentDriverId ? { id: { not: args.currentDriverId } } : {}),
      },
    });
    if (linkedOther) {
      throw new Error('Tài khoản này đã được liên kết với một tài xế khác');
    }
    return targetUserId;
  }

  if (mode === 'CREATE_NEW') {
    const cleanUsername = args.username?.trim();
    const cleanPassword = args.password?.trim();
    if (!cleanUsername || !cleanPassword) {
      throw new Error('Tạo tài khoản mới bắt buộc nhập tên đăng nhập và mật khẩu');
    }
    const dupUser = await prisma.user.findFirst({
      where: { username: { equals: cleanUsername, mode: 'insensitive' } },
    });
    if (dupUser) {
      throw new Error('Tên đăng nhập đã tồn tại trong hệ thống');
    }

    const newUserId = nextSnowflakeId();
    await prisma.user.create({
      data: {
        id: newUserId,
        username: cleanUsername,
        fullName: args.driverName,
        phone: args.phoneNumber,
        passwordHash: hashPassword(cleanPassword),
        status: 'ACTIVE',
      },
    });

    // Assign Driver role
    let driverRole = await prisma.role.findFirst({
      where: {
        OR: [{ code: 'DRIVER' }, { code: 'Driver_TRMS' }, { code: { contains: 'DRIVER', mode: 'insensitive' } }],
      },
    });
    if (!driverRole) {
      driverRole = await prisma.role.create({
        data: {
          id: nextSnowflakeId(),
          code: 'DRIVER',
          name: 'Tài xế',
        },
      });
    }
    await prisma.userRole.create({
      data: {
        userId: newUserId,
        roleId: driverRole.id,
      },
    });

    // Link to GA OrgUnit if available
    const gaUnit = await prisma.orgUnit.findFirst({
      where: {
        delFlag: 0,
        OR: [
          { unitCode: { equals: 'GA', mode: 'insensitive' } },
          { name: { contains: 'GA', mode: 'insensitive' } },
        ],
      },
    });
    if (gaUnit) {
      await prisma.userOrgUnitPosition.create({
        data: {
          userId: newUserId,
          unitId: gaUnit.id,
          positionId: 0n,
          isPrimary: 'Y',
        },
      });
    }

    return newUserId;
  }

  throw new Error(`Chế độ tài khoản không hợp lệ: ${mode}`);
}

async function applyRouteSegmentsAndVehicles(
  routeId: bigint,
  routePassengerType: string,
  segmentsInput?: Array<{
    id?: bigint | string | number | null;
    legDefinitionId?: bigint | string | number | null;
    legCode?: string | null;
    legName?: string | null;
    direction?: string | null;
    departureTime?: string | null;
    arrivalTime?: string | null;
    defaultVehicleId?: bigint | string | number | null;
    defaultDriverId?: bigint | string | number | null;
    sequenceOrder?: number | null;
    activeFlag?: string | null;
    pickupPointIds?: Array<bigint | string | number> | null;
    dropoffPointIds?: Array<bigint | string | number> | null;
    points?: Array<{
      pointId: bigint | string | number;
      pointRole?: string | null;
      stopOrder?: number | null;
      plannedTime?: string | null;
    }> | null;
    shiftIds?: Array<bigint | string | number> | null;
  }> | null,
  routeVehiclesInput?: Array<{
    vehicleId: bigint | string | number;
    driverId?: bigint | string | number | null;
    displayOrder?: number | null;
  }> | null,
) {
  if (routeVehiclesInput) {
    // Validate route vehicles (for WORKER routes: must be BY_SEGMENT and require driverId)
    for (const rv of routeVehiclesInput) {
      const vehId = BigInt(rv.vehicleId);
      const veh = await prisma.vehicle.findUnique({ where: { id: vehId } });
      if (!veh || veh.delFlag !== 'N' || veh.activeFlag !== 'Y') {
        throw new Error('Xe gắn vào tuyến không tồn tại hoặc đã ngừng hoạt động');
      }
      if (routePassengerType === 'WORKER') {
        if (veh.commutePackageMode !== 'BY_SEGMENT') {
          throw new Error('Khối Xe chạy chuyến này của tuyến Công nhân chỉ chọn được xe gói Theo số lượt (BY_SEGMENT)');
        }
        if (!rv.driverId) {
          throw new Error('Đã chọn xe chạy chuyến này thì bắt buộc phải chọn tài xế đi kèm');
        }
      }
      if (rv.driverId) {
        const drvId = BigInt(rv.driverId);
        const drv = await prisma.driver.findUnique({ where: { id: drvId } });
        if (!drv || drv.delFlag !== 'N' || drv.activeFlag !== 'Y') {
          throw new Error('Tài xế gắn vào tuyến không tồn tại hoặc đã ngừng hoạt động');
        }
      }
    }

    await prisma.routeVehicle.deleteMany({ where: { routeId } });
    for (let idx = 0; idx < routeVehiclesInput.length; idx++) {
      const rv = routeVehiclesInput[idx];
      await prisma.routeVehicle.create({
        data: {
          id: nextSnowflakeId(),
          routeId,
          vehicleId: BigInt(rv.vehicleId),
          driverId: rv.driverId ? BigInt(rv.driverId) : null,
          displayOrder: rv.displayOrder ?? idx + 1,
          activeFlag: 'Y',
          delFlag: 'N',
        },
      });
    }
  }

  if (segmentsInput) {
    // Track seen (legKey, vehicleId) to prevent duplicate vehicle in the same leg of the route
    const legVehicleSet = new Set<string>();

    for (const seg of segmentsInput) {
      let legDef = null;
      if (seg.legDefinitionId) {
        legDef = await prisma.legDefinition.findUnique({
          where: { id: BigInt(seg.legDefinitionId) },
        });
      } else if (seg.legCode) {
        legDef = await prisma.legDefinition.findFirst({
          where: {
            legCode: { equals: seg.legCode.trim(), mode: 'insensitive' },
            passengerType: routePassengerType,
            delFlag: 'N',
          },
        });
      }

      if (!legDef && !seg.legCode) {
        throw new Error('Mỗi chặng trong tuyến bắt buộc phải chọn Lượt chạy');
      }

      if (legDef) {
        if (legDef.delFlag !== 'N' || legDef.activeFlag !== 'Y') {
          throw new Error(`Lượt chạy ${legDef.legCode} đang không hoạt động`);
        }
        if (legDef.passengerType !== routePassengerType) {
          throw new Error(
            `Lượt chạy ${legDef.legCode} (${legDef.passengerType}) không khớp với loại hành khách của tuyến (${routePassengerType})`,
          );
        }
      }

      const effectiveLegKey = String(legDef ? legDef.id : seg.legCode?.trim().toUpperCase());

      if (seg.defaultVehicleId) {
        const vehId = BigInt(seg.defaultVehicleId);
        const veh = await prisma.vehicle.findUnique({ where: { id: vehId } });
        if (!veh || veh.delFlag !== 'N' || veh.activeFlag !== 'Y') {
          throw new Error('Xe gắn vào lượt chạy không tồn tại hoặc đã ngừng hoạt động');
        }
        // Check if vehicle is assigned to another active route
        const otherRouteSeg = await prisma.routeSegment.findFirst({
          where: {
            defaultVehicleId: vehId,
            routeId: { not: routeId },
            delFlag: 'N',
            route: { delFlag: 'N', activeFlag: 'Y' },
          },
        });
        if (otherRouteSeg) {
          throw new Error(`Xe ${veh.vehiclePlate} đã được gắn vào tuyến khác`);
        }

        const pairKey = `${effectiveLegKey}:${String(vehId)}`;
        if (legVehicleSet.has(pairKey)) {
          throw new Error(`Không được gắn cùng một xe (${veh.vehiclePlate}) hai lần vào cùng một lượt chạy trong tuyến`);
        }
        legVehicleSet.add(pairKey);
      }

      if (seg.defaultDriverId) {
        const drvId = BigInt(seg.defaultDriverId);
        const drv = await prisma.driver.findUnique({ where: { id: drvId } });
        if (!drv || drv.delFlag !== 'N' || drv.activeFlag !== 'Y') {
          throw new Error('Tài xế gắn vào lượt chạy không tồn tại hoặc đã ngừng hoạt động');
        }
        const otherRouteDrv = await prisma.routeSegment.findFirst({
          where: {
            defaultDriverId: drvId,
            routeId: { not: routeId },
            delFlag: 'N',
            route: { delFlag: 'N', activeFlag: 'Y' },
          },
        });
        if (otherRouteDrv) {
          throw new Error(`Tài xế ${drv.driverName} đã được gắn vào tuyến khác`);
        }
      }

      if (seg.shiftIds && seg.shiftIds.length > 0) {
        for (const sId of seg.shiftIds) {
          const shift = await prisma.shift.findUnique({ where: { id: BigInt(sId) } });
          if (!shift || shift.delFlag !== 0 || shift.activeFlag !== 'Y' || shift.transportFlag !== 'Y') {
            throw new Error('Chỉ được gắn ca làm việc đang hoạt động và đã bật Đưa đón (transportFlag = Y)');
          }
        }
      }
    }

    // Replace existing segments of the route
    await prisma.routeSegment.deleteMany({ where: { routeId } });

    for (let idx = 0; idx < segmentsInput.length; idx++) {
      const seg = segmentsInput[idx];
      let legDef = null;
      if (seg.legDefinitionId) {
        legDef = await prisma.legDefinition.findUnique({
          where: { id: BigInt(seg.legDefinitionId) },
        });
      } else if (seg.legCode) {
        legDef = await prisma.legDefinition.findFirst({
          where: {
            legCode: { equals: seg.legCode.trim(), mode: 'insensitive' },
            passengerType: routePassengerType,
            delFlag: 'N',
          },
        });
      }

      const segmentId = nextSnowflakeId();
      await prisma.routeSegment.create({
        data: {
          id: segmentId,
          routeId,
          legDefinitionId: legDef ? legDef.id : seg.legDefinitionId ? BigInt(seg.legDefinitionId) : null,
          legCode: legDef ? legDef.legCode : seg.legCode?.trim().toUpperCase() || `LEG_${idx + 1}`,
          legName: legDef ? legDef.legName : seg.legName ?? null,
          direction: legDef ? legDef.direction : seg.direction || 'TO_FACTORY',
          departureTime: seg.departureTime ?? null,
          arrivalTime: seg.arrivalTime ?? null,
          defaultVehicleId: seg.defaultVehicleId ? BigInt(seg.defaultVehicleId) : null,
          defaultDriverId: seg.defaultDriverId ? BigInt(seg.defaultDriverId) : null,
          sequenceOrder: seg.sequenceOrder ?? idx + 1,
          activeFlag: seg.activeFlag ?? 'Y',
          delFlag: 'N',
        },
      });

      // Insert points
      if (seg.points && seg.points.length > 0) {
        for (let pIdx = 0; pIdx < seg.points.length; pIdx++) {
          const pt = seg.points[pIdx];
          await prisma.segmentPoint.create({
            data: {
              id: nextSnowflakeId(),
              segmentId,
              pointId: BigInt(pt.pointId),
              pointRole: pt.pointRole || 'PICKUP',
              stopOrder: pt.stopOrder ?? pIdx + 1,
              plannedTime: pt.plannedTime ?? null,
            },
          });
        }
      } else {
        let order = 1;
        if (seg.pickupPointIds) {
          for (const pId of seg.pickupPointIds) {
            await prisma.segmentPoint.create({
              data: {
                id: nextSnowflakeId(),
                segmentId,
                pointId: BigInt(pId),
                pointRole: 'PICKUP',
                stopOrder: order++,
              },
            });
          }
        }
        if (seg.dropoffPointIds) {
          for (const pId of seg.dropoffPointIds) {
            await prisma.segmentPoint.create({
              data: {
                id: nextSnowflakeId(),
                segmentId,
                pointId: BigInt(pId),
                pointRole: 'DROPOFF',
                stopOrder: order++,
              },
            });
          }
        }
      }

      // Insert shifts
      if (seg.shiftIds && seg.shiftIds.length > 0) {
        for (const sId of seg.shiftIds) {
          await prisma.segmentShift.create({
            data: {
              id: nextSnowflakeId(),
              segmentId,
              shiftId: BigInt(sId),
            },
          });
        }
      }
    }
  }
}

export function registerMasterModule() {
  builder.queryFields((t) => ({
    vendors: t.prismaField({
      type: ['Vendor'],
      authScopes: { authenticated: true },
      args: {
        activeFlag: t.arg.string(),
        search: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.vendor.findMany({
          ...query,
          where: {
            delFlag: 'N',
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { vendorCode: { contains: args.search, mode: 'insensitive' } },
                    { vendorName: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { vendorCode: 'asc' },
        }),
    }),

    points: t.prismaField({
      type: ['Point'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.POINT_LIST,
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.REQUEST_CREATE,
          FEATURE_CODES.EMP_TRANSPORT_LIST,
        ],
      },
      args: {
        search: t.arg.string(),
        pointType: t.arg.string(),
        pointTypes: t.arg.stringList(),
        activeFlag: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.point.findMany({
          ...query,
          where: {
            delFlag: 'N',
            // QA §1.1: Lọc Loại chọn đúng loại đó (PICKUP không tự gộp BOTH)
            ...(args.pointTypes && args.pointTypes.length > 0
              ? { pointType: { in: args.pointTypes } }
              : args.pointType
                ? { pointType: args.pointType }
                : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { pointCode: { contains: args.search, mode: 'insensitive' } },
                    { pointName: { contains: args.search, mode: 'insensitive' } },
                    { districtName: { contains: args.search, mode: 'insensitive' } },
                    { address: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { pointCode: 'asc' },
        }),
    }),

    point: t.prismaField({
      type: 'Point',
      nullable: true,
      authScopes: {
        anyFeature: [FEATURE_CODES.POINT_GET, FEATURE_CODES.POINT_LIST],
      },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: (query, _root, args) =>
        prisma.point.findFirst({
          ...query,
          where: { id: BigInt(args.id), delFlag: 'N' },
        }),
    }),

    vehicles: t.prismaField({
      type: ['Vehicle'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.VEHICLE_LIST,
          FEATURE_CODES.VEHICLE_STATUS_LIST,
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.REQUEST_DISPATCH,
        ],
      },
      args: {
        search: t.arg.string(),
        vehicleType: t.arg.string(),
        vehicleTypes: t.arg.stringList(),
        ownershipType: t.arg.string(),
        commutePackageMode: t.arg.string(),
        activeFlag: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.vehicle.findMany({
          ...query,
          where: {
            delFlag: 'N',
            ...(args.vehicleTypes && args.vehicleTypes.length > 0
              ? { vehicleType: { in: args.vehicleTypes } }
              : args.vehicleType
                ? { vehicleType: args.vehicleType }
                : {}),
            ...(args.ownershipType ? { ownershipType: args.ownershipType } : {}),
            ...(args.commutePackageMode ? { commutePackageMode: args.commutePackageMode } : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { vehiclePlate: { contains: args.search, mode: 'insensitive' } },
                    { vehicleCode: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { vehiclePlate: 'asc' },
        }),
    }),

    vehicle: t.prismaField({
      type: 'Vehicle',
      nullable: true,
      authScopes: {
        anyFeature: [FEATURE_CODES.VEHICLE_GET, FEATURE_CODES.VEHICLE_LIST],
      },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: (query, _root, args) =>
        prisma.vehicle.findFirst({
          ...query,
          where: { id: BigInt(args.id), delFlag: 'N' },
        }),
    }),

    availableVehicles: t.prismaField({
      type: ['Vehicle'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.VEHICLE_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_UPDATE,
          FEATURE_CODES.REQUEST_AVAILABLE_VEHICLES,
          FEATURE_CODES.REQUEST_DISPATCH,
        ],
      },
      args: {
        excludeRouteId: t.arg({ type: 'BigInt' }),
        commutePackageMode: t.arg.string(),
        vehicleType: t.arg.string(),
      },
      resolve: async (query, _root, args) => {
        const busyRouteSegments = await prisma.routeSegment.findMany({
          where: {
            delFlag: 'N',
            defaultVehicleId: { not: null },
            route: { delFlag: 'N', activeFlag: 'Y' },
            ...(args.excludeRouteId ? { routeId: { not: BigInt(args.excludeRouteId) } } : {}),
          },
          select: { defaultVehicleId: true },
        });
        const busyVehicleIds = Array.from(
          new Set(busyRouteSegments.map((s) => s.defaultVehicleId).filter((id): id is bigint => id !== null)),
        );

        const list = await prisma.vehicle.findMany({
          ...query,
          where: {
            delFlag: 'N',
            activeFlag: 'Y',
            ...(busyVehicleIds.length > 0 ? { id: { notIn: busyVehicleIds } } : {}),
            ...(args.commutePackageMode ? { commutePackageMode: args.commutePackageMode } : {}),
            ...(args.vehicleType ? { vehicleType: args.vehicleType } : {}),
          },
          orderBy: { vehiclePlate: 'asc' },
        });

        // Sort BY_SEGMENT vehicles first per QA §1.5
        return list.sort((a, b) => {
          const aBySeg = a.commutePackageMode === 'BY_SEGMENT' ? 0 : 1;
          const bBySeg = b.commutePackageMode === 'BY_SEGMENT' ? 0 : 1;
          if (aBySeg !== bBySeg) return aBySeg - bBySeg;
          return a.vehiclePlate.localeCompare(b.vehiclePlate);
        });
      },
    }),

    drivers: t.prismaField({
      type: ['Driver'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.DRIVER_LIST,
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.REQUEST_DISPATCH,
        ],
      },
      args: {
        search: t.arg.string(),
        activeFlag: t.arg.string(),
        includeDeleted: t.arg.boolean(),
      },
      resolve: (query, _root, args) =>
        prisma.driver.findMany({
          ...query,
          where: {
            ...(args.includeDeleted ? {} : { delFlag: 'N' }),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { driverName: { contains: args.search, mode: 'insensitive' } },
                    { phoneNumber: { contains: args.search, mode: 'insensitive' } },
                    { shortAddress: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { driverName: 'asc' },
        }),
    }),

    driver: t.prismaField({
      type: 'Driver',
      nullable: true,
      authScopes: {
        anyFeature: [FEATURE_CODES.DRIVER_GET, FEATURE_CODES.DRIVER_LIST],
      },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: (query, _root, args) =>
        prisma.driver.findFirst({
          ...query,
          where: { id: BigInt(args.id), delFlag: 'N' },
        }),
    }),

    legDefinitions: t.prismaField({
      type: ['LegDefinition'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.LEG_DEFINITION_LIST,
          FEATURE_CODES.LEG_DEFINITION_GET,
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_LIST,
        ],
      },
      args: {
        passengerType: t.arg.string(),
        activeFlag: t.arg.string(),
        search: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.legDefinition.findMany({
          ...query,
          where: {
            delFlag: 'N',
            ...(args.passengerType ? { passengerType: args.passengerType } : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { legCode: { contains: args.search, mode: 'insensitive' } },
                    { legName: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: [{ displayOrder: 'asc' }, { legCode: 'asc' }],
        }),
    }),

    routes: t.prismaField({
      type: ['Route'],
      authScopes: {
        anyFeature: [
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_LIST,
          FEATURE_CODES.EMP_TRANSPORT_LIST,
          FEATURE_CODES.COMMUTE_DISPATCH_LIST,
        ],
      },
      args: {
        passengerType: t.arg.string(),
        runDays: t.arg.string(),
        activeFlag: t.arg.string(),
        search: t.arg.string(),
      },
      resolve: (query, _root, args) =>
        prisma.route.findMany({
          ...query,
          where: {
            delFlag: 'N',
            ...(args.passengerType ? { passengerType: args.passengerType } : {}),
            ...(args.runDays ? { runDays: args.runDays } : {}),
            ...(args.activeFlag ? { activeFlag: args.activeFlag } : {}),
            ...(args.search
              ? {
                  OR: [
                    { routeCode: { contains: args.search, mode: 'insensitive' } },
                    { routeName: { contains: args.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: { routeCode: 'asc' },
        }),
    }),

    route: t.prismaField({
      type: 'Route',
      nullable: true,
      authScopes: {
        anyFeature: [
          FEATURE_CODES.ROUTE_LIST,
          FEATURE_CODES.ROUTE_SEGMENT_LIST,
          FEATURE_CODES.EMP_TRANSPORT_LIST,
        ],
      },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: (query, _root, args) =>
        prisma.route.findFirst({
          ...query,
          where: { id: BigInt(args.id), delFlag: 'N' },
        }),
    }),
  }));

  builder.mutationFields((t) => ({
    // =========================================================================
    // 1.1 POINT MUTATIONS
    // =========================================================================
    createPoint: t.prismaField({
      type: 'Point',
      authScopes: { feature: FEATURE_CODES.POINT_CREATE },
      args: {
        pointCode: t.arg.string({ required: true }),
        pointName: t.arg.string({ required: true }),
        pointType: t.arg.string({ required: true }),
        districtName: t.arg.string(),
        address: t.arg.string(),
        isFactory: t.arg.string(),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const code = args.pointCode.trim().toUpperCase();
        const name = args.pointName.trim();
        const type = args.pointType.trim().toUpperCase();

        if (!code || !name || !type) {
          throw new Error('Mã điểm, Tên điểm và Loại điểm là bắt buộc');
        }
        if (!(POINT_TYPES as readonly string[]).includes(type)) {
          throw new Error('Loại điểm chỉ chấp nhận PICKUP, DROPOFF hoặc BOTH');
        }

        const existing = await prisma.point.findFirst({
          where: { pointCode: { equals: code, mode: 'insensitive' }, delFlag: 'N' },
        });
        if (existing) {
          throw new Error('Trùng mã điểm đón/trả');
        }

        const created = await prisma.point.create({
          ...query,
          data: {
            id: nextSnowflakeId(),
            pointCode: code,
            pointName: name,
            pointType: type,
            districtName: args.districtName?.trim() || null,
            address: args.address?.trim() || null,
            isFactory: args.isFactory === 'Y' ? 'Y' : 'N',
            activeFlag: args.activeFlag === 'N' ? 'N' : 'Y',
            delFlag: 'N',
          },
        });

        await writeAuditLog(
          ctx,
          'POINT',
          created.id,
          'CREATE',
          `Tạo điểm đón/trả ${code} - ${name}`,
        );
        return created;
      },
    }),

    updatePoint: t.prismaField({
      type: 'Point',
      authScopes: { feature: FEATURE_CODES.POINT_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        pointCode: t.arg.string(),
        pointName: t.arg.string(),
        pointType: t.arg.string(),
        districtName: t.arg.string(),
        address: t.arg.string(),
        isFactory: t.arg.string(),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const pointId = BigInt(args.id);
        const current = await prisma.point.findUnique({ where: { id: pointId } });
        if (!current || current.delFlag !== 'N') {
          throw new Error('Điểm đón/trả không tồn tại');
        }

        const nextCode = args.pointCode !== undefined && args.pointCode !== null
          ? args.pointCode.trim().toUpperCase()
          : current.pointCode;
        const nextName = args.pointName !== undefined && args.pointName !== null
          ? args.pointName.trim()
          : current.pointName;
        const nextType = args.pointType !== undefined && args.pointType !== null
          ? args.pointType.trim().toUpperCase()
          : current.pointType;
        const nextActive = args.activeFlag !== undefined && args.activeFlag !== null
          ? args.activeFlag.trim().toUpperCase()
          : current.activeFlag;

        if (!nextCode || !nextName || !nextType) {
          throw new Error('Mã điểm, Tên điểm và Loại điểm không được để trống');
        }
        if (!(POINT_TYPES as readonly string[]).includes(nextType)) {
          throw new Error('Loại điểm chỉ chấp nhận PICKUP, DROPOFF hoặc BOTH');
        }

        if (nextCode.toUpperCase() !== current.pointCode.toUpperCase()) {
          const dup = await prisma.point.findFirst({
            where: {
              id: { not: pointId },
              pointCode: { equals: nextCode, mode: 'insensitive' },
              delFlag: 'N',
            },
          });
          if (dup) {
            throw new Error('Trùng mã điểm đón/trả');
          }
        }

        if (nextActive === 'N' && current.activeFlag === 'Y') {
          const usageCount = await prisma.segmentPoint.count({
            where: {
              pointId,
              segment: { delFlag: 'N', route: { delFlag: 'N' } },
            },
          });
          if (usageCount > 0) {
            throw new Error('Điểm đang được dùng trong lượt của tuyến, không được tắt hoạt động');
          }
        }

        const updated = await prisma.point.update({
          ...query,
          where: { id: pointId },
          data: {
            pointCode: nextCode,
            pointName: nextName,
            pointType: nextType,
            ...(args.districtName !== undefined ? { districtName: args.districtName?.trim() || null } : {}),
            ...(args.address !== undefined ? { address: args.address?.trim() || null } : {}),
            ...(args.isFactory !== undefined && args.isFactory !== null ? { isFactory: args.isFactory } : {}),
            activeFlag: nextActive,
          },
        });

        await writeAuditLog(
          ctx,
          'POINT',
          updated.id,
          'UPDATE',
          `Cập nhật điểm đón/trả ${updated.pointCode}`,
        );
        return updated;
      },
    }),

    deletePoint: t.prismaField({
      type: 'Point',
      authScopes: { feature: FEATURE_CODES.POINT_DELETE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const pointId = BigInt(args.id);
        const usageCount = await prisma.segmentPoint.count({
          where: {
            pointId,
            segment: { delFlag: 'N', route: { delFlag: 'N' } },
          },
        });
        if (usageCount > 0) {
          throw new Error('Điểm đang được dùng trong lượt của tuyến, không thể xóa');
        }

        const deleted = await prisma.point.update({
          ...query,
          where: { id: pointId },
          data: { delFlag: 'Y', activeFlag: 'N' },
        });

        await writeAuditLog(
          ctx,
          'POINT',
          deleted.id,
          'DELETE',
          `Xóa điểm đón/trả ${deleted.pointCode}`,
        );
        return deleted;
      },
    }),

    // =========================================================================
    // 1.3 VEHICLE MUTATIONS
    // =========================================================================
    createVehicle: t.prismaField({
      type: 'Vehicle',
      authScopes: { feature: FEATURE_CODES.VEHICLE_CREATE },
      args: {
        vehicleCode: t.arg.string(),
        vehiclePlate: t.arg.string({ required: true }),
        vendorId: t.arg({ type: 'BigInt' }),
        vehicleType: t.arg.string({ required: true }),
        ownershipType: t.arg.string({ defaultValue: 'RENTAL' }),
        commutePackageMode: t.arg.string(),
        dailyTripQuota: t.arg.int(),
        monthlyKmQuota: t.arg({ type: 'Decimal' }),
        defaultDriverId: t.arg({ type: 'BigInt' }),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const plate = args.vehiclePlate.trim().toUpperCase();
        const vType = args.vehicleType.trim().toUpperCase();
        const ownType = (args.ownershipType || 'RENTAL').trim().toUpperCase();

        if (!plate) {
          throw new Error('Biển số xe là bắt buộc');
        }
        if (!['VAN_16', 'BUS_29', 'BUS_45'].includes(vType)) {
          throw new Error('Loại xe chỉ chấp nhận VAN_16 (15 ghế), BUS_29 (28 ghế) hoặc BUS_45 (44 ghế)');
        }
        if (!['COMPANY', 'RENTAL', 'TAXI', 'CARGO', 'GOODS'].includes(ownType)) {
          throw new Error('Loại sở hữu xe không hợp lệ');
        }

        const dup = await prisma.vehicle.findFirst({
          where: { vehiclePlate: { equals: plate, mode: 'insensitive' }, delFlag: 'N' },
        });
        if (dup) {
          throw new Error('Biển số xe đã tồn tại');
        }

        const pkgMode = args.commutePackageMode?.trim().toUpperCase() || null;
        if (pkgMode === 'BY_SEGMENT') {
          if (!args.dailyTripQuota || args.dailyTripQuota <= 0 || !args.monthlyKmQuota || Number(args.monthlyKmQuota) <= 0) {
            throw new Error('Gói Theo số lượt (BY_SEGMENT) bắt buộc nhập Lượt/ngày và Km tối đa');
          }
        }

        const seatCapacity = VEHICLE_CAPACITY_BY_TYPE[vType] ?? (vType === 'VAN_16' ? 15 : vType === 'BUS_29' ? 28 : 44);
        const newId = nextSnowflakeId();

        const created = await prisma.vehicle.create({
          ...query,
          data: {
            id: newId,
            vehicleCode: args.vehicleCode?.trim() || plate,
            vehiclePlate: plate,
            vendorId: args.vendorId ? BigInt(args.vendorId) : null,
            vehicleType: vType,
            seatCapacity,
            ownershipType: ownType,
            commutePackageMode: pkgMode,
            dailyTripQuota: pkgMode === 'BY_SEGMENT' ? args.dailyTripQuota ?? null : null,
            monthlyKmQuota:
              pkgMode === 'BY_SEGMENT' && args.monthlyKmQuota !== undefined && args.monthlyKmQuota !== null
                ? new Prisma.Decimal(String(args.monthlyKmQuota))
                : null,
            defaultDriverId: args.defaultDriverId ? BigInt(args.defaultDriverId) : null,
            activeFlag: args.activeFlag === 'N' ? 'N' : 'Y',
            delFlag: 'N',
          },
        });

        await prisma.vehicleStatus.upsert({
          where: { vehicleId: newId },
          update: {},
          create: {
            vehicleId: newId,
            status: 'AVAILABLE',
          },
        });

        await writeAuditLog(
          ctx,
          'VEHICLE',
          created.id,
          'CREATE',
          `Thêm xe ${plate} (${vType}, ${seatCapacity} ghế)`,
        );
        return created;
      },
    }),

    updateVehicle: t.prismaField({
      type: 'Vehicle',
      authScopes: { feature: FEATURE_CODES.VEHICLE_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        vehicleCode: t.arg.string(),
        vehiclePlate: t.arg.string(),
        vendorId: t.arg({ type: 'BigInt' }),
        vehicleType: t.arg.string(),
        ownershipType: t.arg.string(),
        commutePackageMode: t.arg.string(),
        dailyTripQuota: t.arg.int(),
        monthlyKmQuota: t.arg({ type: 'Decimal' }),
        defaultDriverId: t.arg({ type: 'BigInt' }),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const vehicleId = BigInt(args.id);
        const current = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!current || current.delFlag !== 'N') {
          throw new Error('Xe không tồn tại');
        }

        const nextPlate =
          args.vehiclePlate !== undefined && args.vehiclePlate !== null
            ? args.vehiclePlate.trim().toUpperCase()
            : current.vehiclePlate;
        const nextType =
          args.vehicleType !== undefined && args.vehicleType !== null
            ? args.vehicleType.trim().toUpperCase()
            : current.vehicleType;
        const nextOwn =
          args.ownershipType !== undefined && args.ownershipType !== null
            ? args.ownershipType.trim().toUpperCase()
            : current.ownershipType;
        const nextPkg =
          args.commutePackageMode !== undefined
            ? args.commutePackageMode?.trim().toUpperCase() || null
            : current.commutePackageMode;
        const nextActive =
          args.activeFlag !== undefined && args.activeFlag !== null
            ? args.activeFlag.trim().toUpperCase()
            : current.activeFlag;

        if (!nextPlate) {
          throw new Error('Biển số xe không được để trống');
        }
        if (!['VAN_16', 'BUS_29', 'BUS_45'].includes(nextType)) {
          throw new Error('Loại xe chỉ chấp nhận VAN_16, BUS_29 hoặc BUS_45');
        }

        if (nextPlate.toUpperCase() !== current.vehiclePlate.toUpperCase()) {
          const dup = await prisma.vehicle.findFirst({
            where: {
              id: { not: vehicleId },
              vehiclePlate: { equals: nextPlate, mode: 'insensitive' },
              delFlag: 'N',
            },
          });
          if (dup) {
            throw new Error('Biển số xe đã tồn tại');
          }
        }

        const nextDailyTripQuota =
          args.dailyTripQuota !== undefined ? args.dailyTripQuota : current.dailyTripQuota;
        const nextMonthlyKmQuota =
          args.monthlyKmQuota !== undefined
            ? args.monthlyKmQuota !== null
              ? new Prisma.Decimal(String(args.monthlyKmQuota))
              : null
            : current.monthlyKmQuota;

        if (nextPkg === 'BY_SEGMENT') {
          if (!nextDailyTripQuota || nextDailyTripQuota <= 0 || !nextMonthlyKmQuota || Number(nextMonthlyKmQuota) <= 0) {
            throw new Error('Gói Theo số lượt (BY_SEGMENT) bắt buộc nhập Lượt/ngày và Km tối đa');
          }
        }

        if (nextActive === 'N' && current.activeFlag === 'Y') {
          const [segCount, rvCount, openTripCount] = await Promise.all([
            prisma.routeSegment.count({
              where: { defaultVehicleId: vehicleId, delFlag: 'N', route: { delFlag: 'N' } },
            }),
            prisma.routeVehicle.count({
              where: { vehicleId, delFlag: 'N', route: { delFlag: 'N' } },
            }),
            prisma.trip.count({
              where: {
                vehicleId,
                delFlag: 'N',
                status: { in: ACTIVE_TRIP_STATUSES },
              },
            }),
          ]);
          if (segCount > 0 || rvCount > 0 || openTripCount > 0) {
            throw new Error('Xe đang được gắn trong tuyến hoặc đang có chuyến chưa hoàn thành, không được tắt hoạt động');
          }
        }

        const seatCapacity =
          VEHICLE_CAPACITY_BY_TYPE[nextType] ?? (nextType === 'VAN_16' ? 15 : nextType === 'BUS_29' ? 28 : 44);

        const updated = await prisma.vehicle.update({
          ...query,
          where: { id: vehicleId },
          data: {
            vehiclePlate: nextPlate,
            ...(args.vehicleCode !== undefined ? { vehicleCode: args.vehicleCode?.trim() || null } : {}),
            ...(args.vendorId !== undefined ? { vendorId: args.vendorId ? BigInt(args.vendorId) : null } : {}),
            vehicleType: nextType,
            seatCapacity,
            ownershipType: nextOwn,
            commutePackageMode: nextPkg,
            dailyTripQuota: nextPkg === 'BY_SEGMENT' ? nextDailyTripQuota : null,
            monthlyKmQuota: nextPkg === 'BY_SEGMENT' ? nextMonthlyKmQuota : null,
            ...(args.defaultDriverId !== undefined
              ? { defaultDriverId: args.defaultDriverId ? BigInt(args.defaultDriverId) : null }
              : {}),
            activeFlag: nextActive,
          },
        });

        await writeAuditLog(
          ctx,
          'VEHICLE',
          updated.id,
          'UPDATE',
          `Cập nhật xe ${updated.vehiclePlate}`,
        );
        return updated;
      },
    }),

    deleteVehicle: t.prismaField({
      type: 'Vehicle',
      authScopes: { feature: FEATURE_CODES.VEHICLE_DELETE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const vehicleId = BigInt(args.id);
        const [segCount, rvCount, openTripCount] = await Promise.all([
          prisma.routeSegment.count({
            where: { defaultVehicleId: vehicleId, delFlag: 'N', route: { delFlag: 'N' } },
          }),
          prisma.routeVehicle.count({
            where: { vehicleId, delFlag: 'N', route: { delFlag: 'N' } },
          }),
          prisma.trip.count({
            where: {
              vehicleId,
              delFlag: 'N',
              status: { in: ACTIVE_TRIP_STATUSES },
            },
          }),
        ]);
        if (segCount > 0 || rvCount > 0 || openTripCount > 0) {
          throw new Error('Xe đang được gắn trong tuyến hoặc đang có chuyến chưa hoàn thành, không thể xóa');
        }

        const deleted = await prisma.vehicle.update({
          ...query,
          where: { id: vehicleId },
          data: { delFlag: 'Y', activeFlag: 'N' },
        });

        await writeAuditLog(
          ctx,
          'VEHICLE',
          deleted.id,
          'DELETE',
          `Xóa xe ${deleted.vehiclePlate}`,
        );
        return deleted;
      },
    }),

    // =========================================================================
    // 1.2 DRIVER MUTATIONS
    // =========================================================================
    createDriver: t.prismaField({
      type: 'Driver',
      authScopes: { feature: FEATURE_CODES.DRIVER_CREATE },
      args: {
        driverName: t.arg.string({ required: true }),
        phoneNumber: t.arg.string({ required: true }),
        shortAddress: t.arg.string(),
        fullAddress: t.arg.string(),
        vendorId: t.arg({ type: 'BigInt' }),
        activeFlag: t.arg.string(),
        accountMode: t.arg.string(), // NONE | LINK_EXISTING | CREATE_NEW
        identityUserId: t.arg({ type: 'BigInt' }),
        username: t.arg.string(),
        password: t.arg.string(),
        newUsername: t.arg.string(),
        newPassword: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const name = args.driverName.trim();
        const phone = args.phoneNumber.trim();
        const activeFlag = args.activeFlag === 'N' ? 'N' : 'Y';
        const effectiveUsername = args.username ?? args.newUsername;
        const effectivePassword = args.password ?? args.newPassword;

        if (!name || !phone) {
          throw new Error('Tên tài xế và Số điện thoại là bắt buộc');
        }

        const linkedUserId = await resolveDriverAccount({
          accountMode: args.accountMode,
          identityUserId: args.identityUserId,
          username: effectiveUsername,
          password: effectivePassword,
          driverName: name,
          phoneNumber: phone,
        });

        if (activeFlag === 'Y' && !linkedUserId) {
          throw new Error('Tài xế đang hoạt động bắt buộc phải có tài khoản đăng nhập');
        }

        const created = await prisma.driver.create({
          ...query,
          data: {
            id: nextSnowflakeId(),
            driverName: name,
            phoneNumber: phone,
            shortAddress: args.shortAddress?.trim() || null,
            fullAddress: args.fullAddress?.trim() || null,
            vendorId: args.vendorId ? BigInt(args.vendorId) : null,
            identityUserId: linkedUserId,
            activeFlag,
            delFlag: 'N',
          },
        });

        await writeAuditLog(
          ctx,
          'DRIVER',
          created.id,
          'CREATE',
          `Thêm tài xế ${name} (${phone})`,
        );
        return created;
      },
    }),

    updateDriver: t.prismaField({
      type: 'Driver',
      authScopes: { feature: FEATURE_CODES.DRIVER_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        driverName: t.arg.string(),
        phoneNumber: t.arg.string(),
        shortAddress: t.arg.string(),
        fullAddress: t.arg.string(),
        vendorId: t.arg({ type: 'BigInt' }),
        activeFlag: t.arg.string(),
        accountMode: t.arg.string(), // NONE | LINK_EXISTING | CREATE_NEW
        identityUserId: t.arg({ type: 'BigInt' }),
        username: t.arg.string(),
        password: t.arg.string(),
        newUsername: t.arg.string(),
        newPassword: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const driverId = BigInt(args.id);
        const current = await prisma.driver.findUnique({ where: { id: driverId } });
        if (!current || current.delFlag !== 'N') {
          throw new Error('Tài xế không tồn tại');
        }

        const nextName =
          args.driverName !== undefined && args.driverName !== null ? args.driverName.trim() : current.driverName;
        const nextPhone =
          args.phoneNumber !== undefined && args.phoneNumber !== null ? args.phoneNumber.trim() : current.phoneNumber;
        const nextActive =
          args.activeFlag !== undefined && args.activeFlag !== null
            ? args.activeFlag.trim().toUpperCase()
            : current.activeFlag;

        if (!nextName || !nextPhone) {
          throw new Error('Tên tài xế và Số điện thoại không được để trống');
        }

        const effectiveUsername = args.username ?? args.newUsername;
        const effectivePassword = args.password ?? args.newPassword;

        let nextIdentityUserId = current.identityUserId;
        if (args.accountMode || args.identityUserId !== undefined || effectiveUsername) {
          nextIdentityUserId = await resolveDriverAccount({
            accountMode: args.accountMode,
            identityUserId: args.identityUserId,
            username: effectiveUsername,
            password: effectivePassword,
            driverName: nextName,
            phoneNumber: nextPhone,
            currentDriverId: driverId,
          });
        }

        if (nextActive === 'Y' && !nextIdentityUserId) {
          throw new Error('Tài xế đang hoạt động bắt buộc phải có tài khoản đăng nhập');
        }

        if (nextActive === 'N' && current.activeFlag === 'Y') {
          const [segCount, rvCount, openTripCount] = await Promise.all([
            prisma.routeSegment.count({
              where: { defaultDriverId: driverId, delFlag: 'N', route: { delFlag: 'N' } },
            }),
            prisma.routeVehicle.count({
              where: { driverId, delFlag: 'N', route: { delFlag: 'N' } },
            }),
            prisma.trip.count({
              where: {
                driverId,
                delFlag: 'N',
                status: { in: ACTIVE_TRIP_STATUSES },
              },
            }),
          ]);
          if (segCount > 0 || rvCount > 0 || openTripCount > 0) {
            throw new Error(
              'Tài xế đang được gắn trong tuyến hoặc đang có chuyến chưa hoàn thành, không được tắt hoạt động',
            );
          }
        }

        const updated = await prisma.driver.update({
          ...query,
          where: { id: driverId },
          data: {
            driverName: nextName,
            phoneNumber: nextPhone,
            ...(args.shortAddress !== undefined ? { shortAddress: args.shortAddress?.trim() || null } : {}),
            ...(args.fullAddress !== undefined ? { fullAddress: args.fullAddress?.trim() || null } : {}),
            ...(args.vendorId !== undefined ? { vendorId: args.vendorId ? BigInt(args.vendorId) : null } : {}),
            identityUserId: nextIdentityUserId,
            activeFlag: nextActive,
          },
        });

        await writeAuditLog(
          ctx,
          'DRIVER',
          updated.id,
          'UPDATE',
          `Cập nhật tài xế ${updated.driverName}`,
        );
        return updated;
      },
    }),

    deleteDriver: t.prismaField({
      type: 'Driver',
      authScopes: { feature: FEATURE_CODES.DRIVER_DELETE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const driverId = BigInt(args.id);
        const [segCount, rvCount, openTripCount] = await Promise.all([
          prisma.routeSegment.count({
            where: { defaultDriverId: driverId, delFlag: 'N', route: { delFlag: 'N' } },
          }),
          prisma.routeVehicle.count({
            where: { driverId, delFlag: 'N', route: { delFlag: 'N' } },
          }),
          prisma.trip.count({
            where: {
              driverId,
              delFlag: 'N',
              status: { in: ACTIVE_TRIP_STATUSES },
            },
          }),
        ]);
        if (segCount > 0 || rvCount > 0 || openTripCount > 0) {
          throw new Error('Tài xế đang được gắn trong tuyến hoặc đang có chuyến chưa hoàn thành, không thể xóa');
        }

        const deleted = await prisma.driver.update({
          ...query,
          where: { id: driverId },
          data: { delFlag: 'Y', activeFlag: 'N' },
        });

        await writeAuditLog(
          ctx,
          'DRIVER',
          deleted.id,
          'DELETE',
          `Xóa tài xế ${deleted.driverName}`,
        );
        return deleted;
      },
    }),

    restoreDriver: t.prismaField({
      type: 'Driver',
      authScopes: { feature: FEATURE_CODES.DRIVER_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const driverId = BigInt(args.id);
        const current = await prisma.driver.findUnique({ where: { id: driverId } });
        if (!current) {
          throw new Error('Tài xế không tồn tại');
        }

        const nextActive = current.identityUserId ? 'Y' : 'N';
        const restored = await prisma.driver.update({
          ...query,
          where: { id: driverId },
          data: { delFlag: 'N', activeFlag: nextActive },
        });

        await writeAuditLog(
          ctx,
          'DRIVER',
          restored.id,
          'RESTORE',
          `Khôi phục tài xế ${restored.driverName}`,
        );
        return restored;
      },
    }),

    // =========================================================================
    // 1.4 LEG DEFINITION MUTATIONS
    // =========================================================================
    createLegDefinition: t.prismaField({
      type: 'LegDefinition',
      authScopes: { feature: FEATURE_CODES.LEG_DEFINITION_CREATE },
      args: {
        legCode: t.arg.string({ required: true }),
        legName: t.arg.string({ required: true }),
        passengerType: t.arg.string({ required: true }),
        displayOrder: t.arg.int({ defaultValue: 1 }),
        direction: t.arg.string({ defaultValue: 'TO_FACTORY' }),
        isDeadhead: t.arg.string({ defaultValue: 'N' }),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const code = args.legCode.trim().toUpperCase();
        const name = args.legName.trim();
        const pType = args.passengerType.trim().toUpperCase();
        const order = args.displayOrder ?? 1;
        const deadhead = args.isDeadhead?.trim().toUpperCase() === 'Y' ? 'Y' : 'N';
        // QA §1.4: Nếu isDeadhead === 'Y' thì direction khóa ở 'TO_FACTORY'
        const dir = deadhead === 'Y' ? 'TO_FACTORY' : (args.direction || 'TO_FACTORY').trim().toUpperCase();

        if (!code || !name || !pType) {
          throw new Error('Mã lượt chạy, Tên lượt chạy và Loại hành khách là bắt buộc');
        }
        if (!(PASSENGER_TYPES as readonly string[]).includes(pType)) {
          throw new Error('Loại hành khách chỉ chấp nhận STAFF hoặc WORKER');
        }
        if (order <= 0) {
          throw new Error('Thứ tự hiển thị phải lớn hơn 0');
        }
        if (!(LEG_DIRECTIONS as readonly string[]).includes(dir)) {
          throw new Error('Hướng chạy chỉ chấp nhận TO_FACTORY hoặc FROM_FACTORY');
        }

        // QA §1.4: Chặn trùng legCode trong cùng passengerType
        const dup = await prisma.legDefinition.findFirst({
          where: {
            legCode: { equals: code, mode: 'insensitive' },
            passengerType: pType,
            delFlag: 'N',
          },
        });
        if (dup) {
          throw new Error(`Mã lượt chạy ${code} đã tồn tại cho nhóm hành khách ${pType}`);
        }

        const created = await prisma.legDefinition.create({
          ...query,
          data: {
            id: nextSnowflakeId(),
            legCode: code,
            legName: name,
            passengerType: pType,
            displayOrder: order,
            direction: dir,
            isDeadhead: deadhead,
            activeFlag: args.activeFlag === 'N' ? 'N' : 'Y',
            delFlag: 'N',
          },
        });

        await writeAuditLog(
          ctx,
          'LEG_DEFINITION',
          created.id,
          'CREATE',
          `Tạo lượt chạy ${code} (${pType})`,
        );
        return created;
      },
    }),

    updateLegDefinition: t.prismaField({
      type: 'LegDefinition',
      authScopes: { feature: FEATURE_CODES.LEG_DEFINITION_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        legCode: t.arg.string(),
        legName: t.arg.string(),
        passengerType: t.arg.string(),
        displayOrder: t.arg.int(),
        direction: t.arg.string(),
        isDeadhead: t.arg.string(),
        activeFlag: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const legId = BigInt(args.id);
        const current = await prisma.legDefinition.findUnique({ where: { id: legId } });
        if (!current || current.delFlag !== 'N') {
          throw new Error('Lượt chạy không tồn tại');
        }

        const nextCode =
          args.legCode !== undefined && args.legCode !== null ? args.legCode.trim().toUpperCase() : current.legCode;
        const nextName =
          args.legName !== undefined && args.legName !== null ? args.legName.trim() : current.legName;
        const nextPType =
          args.passengerType !== undefined && args.passengerType !== null
            ? args.passengerType.trim().toUpperCase()
            : current.passengerType;
        const nextOrder =
          args.displayOrder !== undefined && args.displayOrder !== null ? args.displayOrder : current.displayOrder;
        const nextDeadhead =
          args.isDeadhead !== undefined && args.isDeadhead !== null
            ? args.isDeadhead.trim().toUpperCase() === 'Y'
              ? 'Y'
              : 'N'
            : current.isDeadhead;
        const nextDir =
          nextDeadhead === 'Y'
            ? 'TO_FACTORY'
            : args.direction !== undefined && args.direction !== null
              ? args.direction.trim().toUpperCase()
              : current.direction;
        const nextActive =
          args.activeFlag !== undefined && args.activeFlag !== null
            ? args.activeFlag.trim().toUpperCase()
            : current.activeFlag;

        if (!nextCode || !nextName) {
          throw new Error('Mã lượt chạy và Tên lượt chạy không được để trống');
        }
        if (!(PASSENGER_TYPES as readonly string[]).includes(nextPType)) {
          throw new Error('Loại hành khách chỉ chấp nhận STAFF hoặc WORKER');
        }
        if (nextOrder <= 0) {
          throw new Error('Thứ tự hiển thị phải lớn hơn 0');
        }
        if (!(LEG_DIRECTIONS as readonly string[]).includes(nextDir)) {
          throw new Error('Hướng chạy chỉ chấp nhận TO_FACTORY hoặc FROM_FACTORY');
        }

        if (nextCode !== current.legCode || nextPType !== current.passengerType) {
          const dup = await prisma.legDefinition.findFirst({
            where: {
              id: { not: legId },
              legCode: { equals: nextCode, mode: 'insensitive' },
              passengerType: nextPType,
              delFlag: 'N',
            },
          });
          if (dup) {
            throw new Error(`Mã lượt chạy ${nextCode} đã tồn tại cho nhóm hành khách ${nextPType}`);
          }
        }

        if (nextActive === 'N' && current.activeFlag === 'Y') {
          const usageCount = await prisma.routeSegment.count({
            where: { legDefinitionId: legId, delFlag: 'N', route: { delFlag: 'N' } },
          });
          if (usageCount > 0) {
            throw new Error('Lượt chạy đang được dùng trong tuyến, không được tắt hoạt động');
          }
        }

        const updated = await prisma.legDefinition.update({
          ...query,
          where: { id: legId },
          data: {
            legCode: nextCode,
            legName: nextName,
            passengerType: nextPType,
            displayOrder: nextOrder,
            direction: nextDir,
            isDeadhead: nextDeadhead,
            activeFlag: nextActive,
          },
        });

        await writeAuditLog(
          ctx,
          'LEG_DEFINITION',
          updated.id,
          'UPDATE',
          `Cập nhật lượt chạy ${updated.legCode} (${updated.passengerType})`,
        );
        return updated;
      },
    }),

    deleteLegDefinition: t.prismaField({
      type: 'LegDefinition',
      authScopes: { feature: FEATURE_CODES.LEG_DEFINITION_DELETE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const legId = BigInt(args.id);
        const usageCount = await prisma.routeSegment.count({
          where: { legDefinitionId: legId, delFlag: 'N', route: { delFlag: 'N' } },
        });
        if (usageCount > 0) {
          throw new Error('Lượt chạy đang được dùng trong tuyến, không thể xóa');
        }

        const deleted = await prisma.legDefinition.update({
          ...query,
          where: { id: legId },
          data: { delFlag: 'Y', activeFlag: 'N' },
        });

        await writeAuditLog(
          ctx,
          'LEG_DEFINITION',
          deleted.id,
          'DELETE',
          `Xóa lượt chạy ${deleted.legCode}`,
        );
        return deleted;
      },
    }),

    // =========================================================================
    // 1.5 ROUTE & SEGMENT MUTATIONS
    // =========================================================================
    createRoute: t.prismaField({
      type: 'Route',
      authScopes: { feature: FEATURE_CODES.ROUTE_CREATE },
      args: {
        routeCode: t.arg.string({ required: true }),
        routeName: t.arg.string({ required: true }),
        defaultVendorId: t.arg({ type: 'BigInt' }),
        passengerType: t.arg.string({ defaultValue: 'STAFF' }),
        runDays: t.arg.string(),
        activeFlag: t.arg.string(),
        segments: t.arg({ type: [RouteSegmentInput] }),
        routeVehicles: t.arg({ type: [RouteVehicleInput] }),
      },
      resolve: async (query, _root, args, ctx) => {
        const code = args.routeCode.trim().toUpperCase();
        const name = args.routeName.trim();
        const pType = (args.passengerType || 'STAFF').trim().toUpperCase();

        if (!code || !name) {
          throw new Error('Mã tuyến và Tên tuyến là bắt buộc');
        }
        if (!(PASSENGER_TYPES as readonly string[]).includes(pType)) {
          throw new Error('Loại hành khách chỉ chấp nhận STAFF hoặc WORKER');
        }

        const dup = await prisma.route.findFirst({
          where: { routeCode: { equals: code, mode: 'insensitive' }, delFlag: 'N' },
        });
        if (dup) {
          throw new Error('Mã tuyến đã tồn tại');
        }

        // QA §1.5: Nếu passengerType === 'WORKER' tự đặt runDays = 'MON_SUN'
        const runDays =
          pType === 'WORKER'
            ? 'MON_SUN'
            : args.runDays && (ROUTE_RUN_DAYS as readonly string[]).includes(args.runDays.trim().toUpperCase())
              ? args.runDays.trim().toUpperCase()
              : 'MON_SAT';

        const routeId = nextSnowflakeId();
        await prisma.route.create({
          data: {
            id: routeId,
            routeCode: code,
            routeName: name,
            defaultVendorId: args.defaultVendorId ? BigInt(args.defaultVendorId) : null,
            routeClass: 'FIXED_ROUTE',
            passengerType: pType,
            runDays,
            activeFlag: args.activeFlag === 'N' ? 'N' : 'Y',
            delFlag: 'N',
          },
        });

        await applyRouteSegmentsAndVehicles(routeId, pType, args.segments, args.routeVehicles);

        await writeAuditLog(
          ctx,
          'ROUTE',
          routeId,
          'CREATE',
          `Tạo tuyến cố định ${code} - ${name} (${pType})`,
        );

        return prisma.route.findUniqueOrThrow({
          ...query,
          where: { id: routeId },
        });
      },
    }),

    updateRoute: t.prismaField({
      type: 'Route',
      authScopes: { feature: FEATURE_CODES.ROUTE_UPDATE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
        routeCode: t.arg.string(),
        routeName: t.arg.string(),
        defaultVendorId: t.arg({ type: 'BigInt' }),
        passengerType: t.arg.string(),
        runDays: t.arg.string(),
        activeFlag: t.arg.string(),
        segments: t.arg({ type: [RouteSegmentInput] }),
        routeVehicles: t.arg({ type: [RouteVehicleInput] }),
      },
      resolve: async (query, _root, args, ctx) => {
        const routeId = BigInt(args.id);
        const current = await prisma.route.findUnique({ where: { id: routeId } });
        if (!current || current.delFlag !== 'N') {
          throw new Error('Tuyến xe không tồn tại');
        }

        const nextCode =
          args.routeCode !== undefined && args.routeCode !== null ? args.routeCode.trim().toUpperCase() : current.routeCode;
        const nextName =
          args.routeName !== undefined && args.routeName !== null ? args.routeName.trim() : current.routeName;
        const nextPType =
          args.passengerType !== undefined && args.passengerType !== null
            ? args.passengerType.trim().toUpperCase()
            : current.passengerType;
        const nextActive =
          args.activeFlag !== undefined && args.activeFlag !== null
            ? args.activeFlag.trim().toUpperCase()
            : current.activeFlag;

        if (!nextCode || !nextName) {
          throw new Error('Mã tuyến và Tên tuyến không được để trống');
        }
        if (!(PASSENGER_TYPES as readonly string[]).includes(nextPType)) {
          throw new Error('Loại hành khách chỉ chấp nhận STAFF hoặc WORKER');
        }

        if (nextCode !== current.routeCode) {
          const dup = await prisma.route.findFirst({
            where: {
              id: { not: routeId },
              routeCode: { equals: nextCode, mode: 'insensitive' },
              delFlag: 'N',
            },
          });
          if (dup) {
            throw new Error('Mã tuyến đã tồn tại');
          }
        }

        if (nextActive === 'N' && current.activeFlag === 'Y') {
          const [etpCount, reqCount] = await Promise.all([
            prisma.employeeTransportProfile.count({
              where: {
                routeId,
                delFlag: 'N',
                approvalStatus: { in: ['PENDING', 'APPROVED'] },
              },
            }),
            prisma.transportRequest.count({
              where: {
                routeId,
                status: { notIn: ['CANCELLED', 'REJECTED'] },
              },
            }),
          ]);
          if (etpCount > 0 || reqCount > 0) {
            throw new Error('Tuyến đang có nhân viên đăng ký hoặc đang có yêu cầu xe, không được tắt hoạt động');
          }
        }

        const nextRunDays =
          nextPType === 'WORKER'
            ? 'MON_SUN'
            : args.runDays && (ROUTE_RUN_DAYS as readonly string[]).includes(args.runDays.trim().toUpperCase())
              ? args.runDays.trim().toUpperCase()
              : current.runDays;

        // If passengerType changed and segments are not re-submitted, verify existing segments match passengerType
        if (nextPType !== current.passengerType && !args.segments) {
          const mismatchSeg = await prisma.routeSegment.findFirst({
            where: {
              routeId,
              delFlag: 'N',
              legDefinition: { passengerType: { not: nextPType } },
            },
          });
          if (mismatchSeg) {
            throw new Error('Lượt chạy đã chọn trên tuyến không khớp với loại hành khách mới của tuyến');
          }
        }

        await prisma.route.update({
          where: { id: routeId },
          data: {
            routeCode: nextCode,
            routeName: nextName,
            ...(args.defaultVendorId !== undefined
              ? { defaultVendorId: args.defaultVendorId ? BigInt(args.defaultVendorId) : null }
              : {}),
            passengerType: nextPType,
            runDays: nextRunDays,
            activeFlag: nextActive,
          },
        });

        await applyRouteSegmentsAndVehicles(routeId, nextPType, args.segments, args.routeVehicles);

        await writeAuditLog(
          ctx,
          'ROUTE',
          routeId,
          'UPDATE',
          `Cập nhật tuyến ${nextCode}`,
        );

        return prisma.route.findUniqueOrThrow({
          ...query,
          where: { id: routeId },
        });
      },
    }),

    deleteRoute: t.prismaField({
      type: 'Route',
      authScopes: { feature: FEATURE_CODES.ROUTE_DELETE },
      args: {
        id: t.arg({ type: 'BigInt', required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const routeId = BigInt(args.id);
        const [etpCount, reqCount] = await Promise.all([
          prisma.employeeTransportProfile.count({
            where: {
              routeId,
              delFlag: 'N',
              approvalStatus: { in: ['PENDING', 'APPROVED'] },
            },
          }),
          prisma.transportRequest.count({
            where: {
              routeId,
              status: { notIn: ['CANCELLED', 'REJECTED'] },
            },
          }),
        ]);
        if (etpCount > 0 || reqCount > 0) {
          throw new Error('Tuyến đang có nhân viên đăng ký hoặc đang có yêu cầu xe, không thể xóa');
        }

        const deleted = await prisma.route.update({
          ...query,
          where: { id: routeId },
          data: { delFlag: 'Y', activeFlag: 'N' },
        });

        await writeAuditLog(
          ctx,
          'ROUTE',
          deleted.id,
          'DELETE',
          `Xóa tuyến ${deleted.routeCode}`,
        );
        return deleted;
      },
    }),

    updateRouteSegments: t.prismaField({
      type: 'Route',
      authScopes: {
        anyFeature: [FEATURE_CODES.ROUTE_SEGMENT_UPDATE, FEATURE_CODES.ROUTE_UPDATE],
      },
      args: {
        routeId: t.arg({ type: 'BigInt', required: true }),
        segments: t.arg({ type: [RouteSegmentInput], required: true }),
        routeVehicles: t.arg({ type: [RouteVehicleInput] }),
      },
      resolve: async (query, _root, args, ctx) => {
        const routeId = BigInt(args.routeId);
        const route = await prisma.route.findUnique({ where: { id: routeId } });
        if (!route || route.delFlag !== 'N') {
          throw new Error('Tuyến xe không tồn tại');
        }

        await applyRouteSegmentsAndVehicles(routeId, route.passengerType, args.segments, args.routeVehicles);

        await writeAuditLog(
          ctx,
          'ROUTE',
          routeId,
          'UPDATE_SEGMENTS',
          `Cập nhật phân công chặng tuyến ${route.routeCode}`,
        );

        return prisma.route.findUniqueOrThrow({
          ...query,
          where: { id: routeId },
        });
      },
    }),
  }));
}

registerMasterModule();
