import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { ALL_FEATURE_CODES, nextSnowflakeId } from '@trms/shared';

const prisma = new PrismaClient();
const DUMP_DIR = path.resolve(process.cwd(), '../../data/oracle-dump');

async function readDump<T = Record<string, any>>(name: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(path.join(DUMP_DIR, `${name}.json`), 'utf-8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function toBigInt(v: any): bigint | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    return BigInt(String(v).trim());
  } catch {
    return null;
  }
}

function toBigIntReq(v: any, fallback = 0n): bigint {
  return toBigInt(v) ?? fallback;
}

function toStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDec(v: any, def = '0'): Prisma.Decimal {
  if (v === null || v === undefined || v === '') return new Prisma.Decimal(def);
  try {
    return new Prisma.Decimal(String(v));
  } catch {
    return new Prisma.Decimal(def);
  }
}

function toDecNull(v: any): Prisma.Decimal | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    return new Prisma.Decimal(String(v));
  } catch {
    return null;
  }
}

function toInt(v: any, def = 0): number {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function toIntNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`trms:${plain}`).digest('hex');
}

async function batchInsert<T>(items: T[], chunkSize: number, fn: (chunk: T[]) => Promise<any>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    await fn(items.slice(i, i + chunkSize));
  }
}

async function main() {
  console.log('=== [Seed] Starting Oracle -> PostgreSQL Migration & Seed ===');

  // 1. Systems
  const systems = await readDump('GA_CORE__SYSTEMS');
  if (systems.length > 0) {
    await prisma.system.createMany({
      data: systems.map((r) => ({
        id: toBigIntReq(r.SYSTEM_ID),
        code: toStr(r.CODE) || `SYS_${r.SYSTEM_ID}`,
        name: toStr(r.NAME) || 'System',
        description: toStr(r.DESCRIPTION),
        createdAt: toDate(r.CREATED_AT),
        updatedAt: toDate(r.UPDATED_AT),
      })),
      skipDuplicates: true,
    });
  }
  const systemIds = new Set((await prisma.system.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ Systems: ${systemIds.size}`);

  // 2. OrgUnits
  const orgUnits = await readDump('GA_CORE__ORG_UNITS');
  if (orgUnits.length > 0) {
    await batchInsert(orgUnits, 500, (chunk) =>
      prisma.orgUnit.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.UNIT_ID),
          unitCode: toStr(r.UNIT_CODE) || `UNIT_${r.UNIT_ID}`,
          name: toStr(r.NAME) || 'Org Unit',
          parentId: toBigInt(r.PARENT_ID),
          unitType: toStr(r.UNIT_TYPE),
          description: toStr(r.DESCRIPTION),
          syncState: toStr(r.SYNC_STATE),
          delFlag: toInt(r.DEL_FLAG, 0),
          createdAt: toDate(r.CREATED_AT),
          updatedAt: toDate(r.UPDATED_AT),
        })),
        skipDuplicates: true,
      }),
    );
  }
  const orgUnitIds = new Set((await prisma.orgUnit.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ OrgUnits: ${orgUnitIds.size}`);

  // 3. Users
  const users = await readDump('GA_CORE__USERS');
  const defaultPassHash = hashPassword('Trms@123');
  if (users.length > 0) {
    await batchInsert(users, 500, (chunk) =>
      prisma.user.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.USER_ID),
          username: toStr(r.USERNAME) || `user_${r.USER_ID}`,
          fullName: toStr(r.FULL_NAME) || toStr(r.USERNAME) || `User ${r.USER_ID}`,
          email: toStr(r.EMAIL),
          phone: toStr(r.PHONE),
          passwordHash: defaultPassHash,
          status: toStr(r.STATUS) || 'ACTIVE',
          avatarPath: toStr(r.AVATAR_PATH),
          createdAt: toDate(r.CREATED_AT),
          updatedAt: toDate(r.UPDATED_AT),
          deletedAt: toDate(r.DELETED_AT),
        })),
        skipDuplicates: true,
      }),
    );
  }
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ Users: ${userIds.size}`);

  // 4. Employees
  const employees = await readDump('GA_CORE__EMPLOYEES');
  if (employees.length > 0) {
    await batchInsert(employees, 1000, (chunk) =>
      prisma.employee.createMany({
        data: chunk.map((r) => {
          const ouId = toBigInt(r.ORG_UNIT_ID);
          return {
            id: toBigIntReq(r.EMPLOYEE_ID),
            empCode: toStr(r.EMP_CODE) || `EMP_${r.EMPLOYEE_ID}`,
            fullName: toStr(r.FULL_NAME) || `Employee ${r.EMPLOYEE_ID}`,
            orgUnitId: ouId && orgUnitIds.has(ouId) ? ouId : null,
            positionId: toBigInt(r.POSITION_ID),
            activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
            leaveDate: toDate(r.LEAVE_DATE),
            createDate: toDate(r.CREATE_DATE),
            editDate: toDate(r.EDIT_DATE),
          };
        }),
        skipDuplicates: true,
      }),
    );
  }
  const employeeIds = new Set((await prisma.employee.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ Employees: ${employeeIds.size}`);

  // 5. Roles & Features
  const roles = await readDump('GA_CORE__ROLES');
  if (roles.length > 0) {
    await prisma.role.createMany({
      data: roles.map((r) => {
        const sysId = toBigInt(r.SYSTEM_ID);
        return {
          id: toBigIntReq(r.ROLE_ID),
          code: toStr(r.CODE) || `ROLE_${r.ROLE_ID}`,
          name: toStr(r.NAME) || `Role ${r.ROLE_ID}`,
          description: toStr(r.DESCRIPTION),
          systemId: sysId && systemIds.has(sysId) ? sysId : null,
          isSystemAdmin: toInt(r.IS_SYSTEM_ADMIN, 0),
        };
      }),
      skipDuplicates: true,
    });
  }
  const roleIds = new Set((await prisma.role.findMany({ select: { id: true } })).map((x) => x.id));

  const features = await readDump('GA_CORE__FEATURES');
  if (features.length > 0) {
    await prisma.feature.createMany({
      data: features.map((r) => {
        const sysId = toBigInt(r.SYSTEM_ID);
        return {
          id: toBigIntReq(r.FEATURE_ID),
          systemId: sysId && systemIds.has(sysId) ? sysId : null,
          code: toStr(r.CODE) || `FEAT_${r.FEATURE_ID}`,
          name: toStr(r.NAME) || `Feature ${r.FEATURE_ID}`,
          description: toStr(r.DESCRIPTION),
          createdAt: toDate(r.CREATED_AT),
          updatedAt: toDate(r.UPDATED_AT),
        };
      }),
      skipDuplicates: true,
    });
  }
  // Ensure all TRMS feature codes exist
  for (const fc of ALL_FEATURE_CODES) {
    await prisma.feature.upsert({
      where: { code: fc },
      update: {},
      create: {
        id: nextSnowflakeId(),
        code: fc,
        name: fc,
      },
    });
  }
  const featureIds = new Set((await prisma.feature.findMany({ select: { id: true } })).map((x) => x.id));

  const userRoles = await readDump('GA_CORE__USER_ROLES');
  await prisma.userRole.createMany({
    data: userRoles
      .map((r) => ({ userId: toBigIntReq(r.USER_ID), roleId: toBigIntReq(r.ROLE_ID) }))
      .filter((x) => userIds.has(x.userId) && roleIds.has(x.roleId)),
    skipDuplicates: true,
  });

  const roleFeatures = await readDump('GA_CORE__ROLE_FEATURES');
  await prisma.roleFeature.createMany({
    data: roleFeatures
      .map((r) => ({
        roleId: toBigIntReq(r.ROLE_ID),
        featureId: toBigIntReq(r.FEATURE_ID),
        createdAt: toDate(r.CREATED_AT),
      }))
      .filter((x) => roleIds.has(x.roleId) && featureIds.has(x.featureId)),
    skipDuplicates: true,
  });
  console.log(`  ✓ Roles (${roleIds.size}) & Features (${featureIds.size})`);

  // 6. Settings & Shifts
  const globalVars = await readDump('GA_CORE__GLOBAL_VARIABLE');
  await prisma.setting.createMany({
    data: globalVars.map((r) => ({
      id: toBigIntReq(r.ID),
      varKey: toStr(r.VAR_KEY) || `KEY_${r.ID}`,
      varValue: toStr(r.VAR_VALUE),
      systemId: toBigInt(r.SYSTEM_ID),
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });

  const shifts = await readDump('GA_CORE__SHIFTS');
  await prisma.shift.createMany({
    data: shifts.map((r) => ({
      id: toBigIntReq(r.SHIFT_ID),
      shiftCode: toStr(r.SHIFT_CODE) || `SHIFT_${r.SHIFT_ID}`,
      shiftName: toStr(r.SHIFT_NAME) || `Ca ${r.SHIFT_CODE}`,
      startTime: toStr(r.START_TIME),
      endTime: toStr(r.END_TIME),
      workHours: toDecNull(r.WORK_HOURS),
      activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
      delFlag: toInt(r.DEL_FLAG, 0),
      masterFlag: toStr(r.MASTER_FLAG) || 'Y',
      transportFlag: toStr(r.TRANSPORT_FLAG) || 'N',
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const shiftIds = new Set((await prisma.shift.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ Shifts: ${shiftIds.size}`);

  // 7. Vendors, Points, Vehicles, Drivers, LegDefinitions
  const vendors = await readDump('TRMS_CORE__TRMS_VENDORS');
  await prisma.vendor.createMany({
    data: vendors.map((r) => ({
      id: toBigIntReq(r.ID),
      vendorCode: toStr(r.VENDOR_CODE) || `VENDOR_${r.ID}`,
      vendorName: toStr(r.VENDOR_NAME) || 'Vendor',
      vendorType: toStr(r.VENDOR_TYPE),
      contactName: toStr(r.CONTACT_NAME),
      phone: toStr(r.PHONE),
      email: toStr(r.EMAIL),
      activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
      delFlag: toStr(r.DEL_FLAG) || 'N',
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const vendorIds = new Set((await prisma.vendor.findMany({ select: { id: true } })).map((x) => x.id));

  const points = await readDump('TRMS_CORE__TRMS_POINTS');
  await prisma.point.createMany({
    data: points.map((r) => ({
      id: toBigIntReq(r.ID),
      pointCode: toStr(r.POINT_CODE) || `PT_${r.ID}`,
      pointName: toStr(r.POINT_NAME) || `Điểm ${r.ID}`,
      pointType: toStr(r.POINT_TYPE) || 'BOTH',
      districtName: toStr(r.DISTRICT_NAME),
      address: toStr(r.ADDRESS),
      isFactory: toStr(r.IS_FACTORY) || 'N',
      activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
      delFlag: toStr(r.DEL_FLAG) || 'N',
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const pointIds = new Set((await prisma.point.findMany({ select: { id: true } })).map((x) => x.id));

  const drivers = await readDump('TRMS_CORE__TRMS_DRIVERS');
  await prisma.driver.createMany({
    data: drivers.map((r) => {
      const vId = toBigInt(r.VENDOR_ID);
      const uId = toBigInt(r.IDENTITY_USER_ID);
      return {
        id: toBigIntReq(r.ID),
        driverName: toStr(r.DRIVER_NAME) || `Tài xế ${r.ID}`,
        vendorId: vId && vendorIds.has(vId) ? vId : null,
        phoneNumber: toStr(r.PHONE_NUMBER) || '0900000000',
        shortAddress: toStr(r.SHORT_ADDRESS),
        fullAddress: toStr(r.FULL_ADDRESS),
        identityUserId: uId && userIds.has(uId) ? uId : null,
        activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
        delFlag: toStr(r.DEL_FLAG) || 'N',
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      };
    }),
    skipDuplicates: true,
  });
  const driverIds = new Set((await prisma.driver.findMany({ select: { id: true } })).map((x) => x.id));

  const vehicles = await readDump('TRMS_CORE__TRMS_VEHICLES');
  await prisma.vehicle.createMany({
    data: vehicles.map((r) => {
      const vId = toBigInt(r.VENDOR_ID);
      return {
        id: toBigIntReq(r.ID),
        vehicleCode: toStr(r.VEHICLE_CODE),
        vehiclePlate: toStr(r.VEHICLE_PLATE) || `29A-${r.ID}`,
        vendorId: vId && vendorIds.has(vId) ? vId : null,
        vehicleType: toStr(r.VEHICLE_TYPE) || 'BUS_29',
        seatCapacity: toInt(r.SEAT_CAPACITY, 28),
        ownershipType: toStr(r.OWNERSHIP_TYPE) || 'RENTAL',
        commutePackageMode: toStr(r.COMMUTE_PACKAGE_MODE),
        dailyTripQuota: toIntNull(r.DAILY_TRIP_QUOTA),
        monthlyKmQuota: toDecNull(r.MONTHLY_KM_QUOTA),
        defaultDriverId: toBigInt(r.DEFAULT_DRIVER_ID),
        activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
        delFlag: toStr(r.DEL_FLAG) || 'N',
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      };
    }),
    skipDuplicates: true,
  });
  const vehicleIds = new Set((await prisma.vehicle.findMany({ select: { id: true } })).map((x) => x.id));

  const legDefs = await readDump('TRMS_CORE__TRMS_LEG_DEFINITIONS');
  await prisma.legDefinition.createMany({
    data: legDefs.map((r) => ({
      id: toBigIntReq(r.ID),
      legCode: toStr(r.LEG_CODE) || `LEG_${r.ID}`,
      legName: toStr(r.LEG_NAME) || `Lượt ${r.LEG_CODE}`,
      passengerType: toStr(r.PASSENGER_TYPE) || 'STAFF',
      displayOrder: toInt(r.DISPLAY_ORDER, 1),
      direction: toStr(r.DIRECTION) || 'TO_FACTORY',
      isDeadhead: toStr(r.IS_DEADHEAD) || 'N',
      activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
      delFlag: toStr(r.DEL_FLAG) || 'N',
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const legDefIds = new Set((await prisma.legDefinition.findMany({ select: { id: true } })).map((x) => x.id));
  console.log(`  ✓ Points (${pointIds.size}), Vehicles (${vehicleIds.size}), Drivers (${driverIds.size}), LegDefs (${legDefIds.size})`);

  // 8. Routes, Segments, SegmentPoints, SegmentShifts, RouteVehicles
  const routes = await readDump('TRMS_CORE__TRMS_ROUTES');
  await prisma.route.createMany({
    data: routes.map((r) => {
      const vId = toBigInt(r.DEFAULT_VENDOR_ID);
      return {
        id: toBigIntReq(r.ID),
        routeCode: toStr(r.ROUTE_CODE) || `RT_${r.ID}`,
        routeName: toStr(r.ROUTE_NAME) || `Tuyến ${r.ID}`,
        defaultVendorId: vId && vendorIds.has(vId) ? vId : null,
        routeClass: toStr(r.ROUTE_CLASS) || 'FIXED_ROUTE',
        passengerType: toStr(r.PASSENGER_TYPE) || 'STAFF',
        runDays: toStr(r.RUN_DAYS) || 'MON_SAT',
        activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
        delFlag: toStr(r.DEL_FLAG) || 'N',
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      };
    }),
    skipDuplicates: true,
  });
  const routeIds = new Set((await prisma.route.findMany({ select: { id: true } })).map((x) => x.id));

  const routeSegments = await readDump('TRMS_CORE__TRMS_ROUTE_SEGMENTS');
  await batchInsert(
    routeSegments.filter((r) => routeIds.has(toBigIntReq(r.ROUTE_ID))),
    500,
    (chunk) =>
      prisma.routeSegment.createMany({
        data: chunk.map((r) => {
          const ldId = toBigInt(r.LEG_DEFINITION_ID);
          const vehId = toBigInt(r.DEFAULT_VEHICLE_ID);
          const drvId = toBigInt(r.DEFAULT_DRIVER_ID);
          return {
            id: toBigIntReq(r.ID),
            routeId: toBigIntReq(r.ROUTE_ID),
            legDefinitionId: ldId && legDefIds.has(ldId) ? ldId : null,
            legCode: toStr(r.LEG_CODE) || 'OUT',
            legName: toStr(r.LEG_NAME),
            direction: toStr(r.DIRECTION) || 'TO_FACTORY',
            departureTime: toStr(r.DEPARTURE_TIME),
            arrivalTime: toStr(r.ARRIVAL_TIME),
            defaultVehicleId: vehId && vehicleIds.has(vehId) ? vehId : null,
            defaultDriverId: drvId && driverIds.has(drvId) ? drvId : null,
            sequenceOrder: toInt(r.SEQUENCE_ORDER, 1),
            activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
            delFlag: toStr(r.DEL_FLAG) || 'N',
            createDate: toDate(r.CREATE_DATE),
            editDate: toDate(r.EDIT_DATE),
          };
        }),
        skipDuplicates: true,
      }),
  );
  const segmentIds = new Set((await prisma.routeSegment.findMany({ select: { id: true } })).map((x) => x.id));

  const segPoints = await readDump('TRMS_CORE__TRMS_SEGMENT_POINTS');
  await batchInsert(
    segPoints.filter((r) => segmentIds.has(toBigIntReq(r.SEGMENT_ID)) && pointIds.has(toBigIntReq(r.POINT_ID))),
    1000,
    (chunk) =>
      prisma.segmentPoint.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          segmentId: toBigIntReq(r.SEGMENT_ID),
          pointId: toBigIntReq(r.POINT_ID),
          pointRole: toStr(r.POINT_ROLE) || 'PICKUP',
          stopOrder: toInt(r.STOP_ORDER, 1),
          plannedTime: toStr(r.PLANNED_TIME),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  const segShifts = await readDump('TRMS_CORE__TRMS_SEGMENT_SHIFTS');
  await batchInsert(
    segShifts.filter((r) => segmentIds.has(toBigIntReq(r.SEGMENT_ID)) && shiftIds.has(toBigIntReq(r.SHIFT_ID))),
    500,
    (chunk) =>
      prisma.segmentShift.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          segmentId: toBigIntReq(r.SEGMENT_ID),
          shiftId: toBigIntReq(r.SHIFT_ID),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  const routeVehicles = await readDump('TRMS_CORE__TRMS_ROUTE_VEHICLES');
  await prisma.routeVehicle.createMany({
    data: routeVehicles
      .filter((r) => routeIds.has(toBigIntReq(r.ROUTE_ID)) && vehicleIds.has(toBigIntReq(r.VEHICLE_ID)))
      .map((r) => {
        const drvId = toBigInt(r.DRIVER_ID);
        return {
          id: toBigIntReq(r.ID),
          routeId: toBigIntReq(r.ROUTE_ID),
          vehicleId: toBigIntReq(r.VEHICLE_ID),
          driverId: drvId && driverIds.has(drvId) ? drvId : null,
          displayOrder: toInt(r.DISPLAY_ORDER, 1),
          activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
          delFlag: toStr(r.DEL_FLAG) || 'N',
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        };
      }),
    skipDuplicates: true,
  });
  console.log(`  ✓ Routes (${routeIds.size}), Segments (${segmentIds.size})`);

  // 9. EmployeeTransportProfiles (ETP)
  const etps = await readDump('TRMS_CORE__TRMS_EMPLOYEE_TRANSPORT_PROFILES');
  const validEtps = etps.filter(
    (r) => routeIds.has(toBigIntReq(r.ROUTE_ID)) && pointIds.has(toBigIntReq(r.PICKUP_POINT_ID)),
  );
  await batchInsert(validEtps, 1000, (chunk) =>
    prisma.employeeTransportProfile.createMany({
      data: chunk.map((r) => {
        const empId = toBigInt(r.EMPLOYEE_ID);
        const dropId = toBigInt(r.DROPOFF_POINT_ID);
        return {
          id: toBigIntReq(r.ID),
          employeeId: empId && employeeIds.has(empId) ? empId : null,
          routeId: toBigIntReq(r.ROUTE_ID),
          pickupPointId: toBigIntReq(r.PICKUP_POINT_ID),
          dropoffPointId: dropId && pointIds.has(dropId) ? dropId : null,
          effectiveFrom: toDateStr(r.EFFECTIVE_FROM) || '2026-01-01',
          effectiveTo: toDateStr(r.EFFECTIVE_TO),
          activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
          delFlag: toStr(r.DEL_FLAG) || 'N',
          approvalStatus: toStr(r.APPROVAL_STATUS) || 'APPROVED',
          rejectReason: toStr(r.REJECT_REASON),
          leaveDate: toDateStr(r.LEAVE_DATE),
          endReasonCode: toStr(r.END_REASON_CODE),
          isProvisional: toStr(r.IS_PROVISIONAL) || 'N',
          provTempCode: toStr(r.PROV_TEMP_CODE),
          provFullName: toStr(r.PROV_FULL_NAME),
          provOrgUnitId: toBigInt(r.PROV_ORG_UNIT_ID),
          provShiftId: toBigInt(r.PROV_SHIFT_ID),
          provWorkDayMask: toStr(r.PROV_WORK_DAY_MASK),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        };
      }),
      skipDuplicates: true,
    }),
  );
  console.log(`  ✓ EmployeeTransportProfiles: ${validEtps.length}`);

  // 10. CostConfigs & CostConfigRules
  const costConfigs = await readDump('TRMS_CORE__TRMS_COST_CONFIGS');
  await prisma.costConfig.createMany({
    data: costConfigs.map((r) => ({
      id: toBigIntReq(r.ID),
      versionCode: toStr(r.VERSION_CODE) || `V_${r.ID}`,
      configType: toStr(r.CONFIG_TYPE) || 'COMMUTE',
      passengerType: toStr(r.PASSENGER_TYPE) || 'STAFF',
      vehicleType: toStr(r.VEHICLE_TYPE) || 'BUS_29',
      pricingScope: toStr(r.PRICING_SCOPE),
      currencyCode: toStr(r.CURRENCY_CODE) || 'VND',
      effectiveFrom: toDateStr(r.EFFECTIVE_FROM) || '2026-01-01',
      effectiveTo: toDateStr(r.EFFECTIVE_TO),
      activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
      delFlag: toStr(r.DEL_FLAG) || 'N',
      createBy: toBigInt(r.CREATE_BY),
      editBy: toBigInt(r.EDIT_BY),
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const costConfigIds = new Set((await prisma.costConfig.findMany({ select: { id: true } })).map((x) => x.id));

  const costRules = await readDump('TRMS_CORE__TRMS_COST_CONFIG_RULES');
  await batchInsert(
    costRules.filter((r) => costConfigIds.has(toBigIntReq(r.COST_CONFIG_ID))),
    500,
    (chunk) =>
      prisma.costConfigRule.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          costConfigId: toBigIntReq(r.COST_CONFIG_ID),
          ruleCode: toStr(r.RULE_CODE) || `RULE_${r.ID}`,
          rateType: toStr(r.RATE_TYPE) || 'BASE',
          dayType: toStr(r.DAY_TYPE),
          minDistanceKm: toDecNull(r.MIN_DISTANCE_KM),
          maxDistanceKm: toDecNull(r.MAX_DISTANCE_KM),
          minDistanceInclusiveFlag: toStr(r.MIN_DISTANCE_INCLUSIVE_FLAG) || 'Y',
          maxDistanceInclusiveFlag: toStr(r.MAX_DISTANCE_INCLUSIVE_FLAG) || 'Y',
          dailyTripCount: toIntNull(r.DAILY_TRIP_COUNT),
          includedDistanceKm: toDecNull(r.INCLUDED_DISTANCE_KM),
          unitPrice: toDec(r.UNIT_PRICE),
          priceUnit: toStr(r.PRICE_UNIT) || 'TRIP',
          stackableFlag: toStr(r.STACKABLE_FLAG) || 'N',
          priority: toInt(r.PRIORITY, 1),
          description: toStr(r.DESCRIPTION),
          activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
          delFlag: toStr(r.DEL_FLAG) || 'N',
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );
  console.log(`  ✓ CostConfigs (${costConfigIds.size}) & Rules (${costRules.length})`);

  // 11. ImportBatches & Rows
  const batches = await readDump('TRMS_DATA__TRMS_IMPORT_BATCHES');
  await prisma.importBatch.createMany({
    data: batches.map((r) => ({
      id: toBigIntReq(r.ID),
      batchCode: toStr(r.BATCH_CODE) || `BATCH_${r.ID}`,
      importType: toStr(r.IMPORT_TYPE) || 'SHIFT_DAILY_IMPORT',
      businessDate: toDateStr(r.BUSINESS_DATE),
      status: toStr(r.STATUS) || 'CONFIRMED',
      totalRows: toInt(r.TOTAL_ROWS, 0),
      validRows: toInt(r.VALID_ROWS, 0),
      invalidRows: toInt(r.INVALID_ROWS, 0),
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const batchIds = new Set((await prisma.importBatch.findMany({ select: { id: true } })).map((x) => x.id));

  const batchRows = await readDump('TRMS_DATA__TRMS_IMPORT_BATCH_ROWS');
  await batchInsert(
    batchRows.filter((r) => batchIds.has(toBigIntReq(r.BATCH_ID))),
    1000,
    (chunk) =>
      prisma.importBatchRow.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          batchId: toBigIntReq(r.BATCH_ID),
          lineNo: toInt(r.LINE_NO, 1),
          rowStatus: toStr(r.ROW_STATUS) || 'VALID',
          employeeId: toStr(r.EMPLOYEE_ID),
          assignmentDate: toDateStr(r.ASSIGNMENT_DATE),
          shiftCode: toStr(r.SHIFT_CODE),
          rawPayload: toStr(r.RAW_PAYLOAD),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  // 12. TransportRequests, Passengers, History, Approvals
  const requests = await readDump('TRMS_DATA__TRMS_TRANSPORT_REQUESTS');
  await batchInsert(requests, 500, (chunk) =>
    prisma.transportRequest.createMany({
      data: chunk.map((r) => ({
        id: toBigIntReq(r.ID),
        requestCode: toStr(r.REQUEST_CODE) || `REQ_${r.ID}`,
        businessDate: toDateStr(r.BUSINESS_DATE) || '2026-10-01',
        requestType: toStr(r.REQUEST_TYPE) || 'BUSINESS',
        requestSource: toStr(r.REQUEST_SOURCE) || 'MANUAL',
        requesterId: toBigInt(r.REQUESTER_ID),
        requesterName: toStr(r.REQUESTER_NAME),
        departmentId: toBigInt(r.DEPARTMENT_ID),
        departmentName: toStr(r.DEPARTMENT_NAME),
        routeId: toBigInt(r.ROUTE_ID),
        requestedVehicleType: toStr(r.REQUESTED_VEHICLE_TYPE),
        passengerCount: toInt(r.PASSENGER_COUNT, 1),
        status: toStr(r.STATUS) || 'PENDING_DEPARTMENT',
        outboundStatus: toStr(r.OUTBOUND_STATUS) || toStr(r.STATUS),
        returnStatus: toStr(r.RETURN_STATUS),
        returnedFromStatus: toStr(r.RETURNED_FROM_STATUS),
        approvalBypassFlag: toStr(r.APPROVAL_BYPASS_FLAG) || 'N',
        currentTripId: toBigInt(r.CURRENT_TRIP_ID),
        overrideReason: toStr(r.OVERRIDE_REASON),
        tripMode: toStr(r.TRIP_MODE) || 'ONE_WAY',
        departureTime: toStr(r.DEPARTURE_TIME),
        expectedArrivalTime: toStr(r.EXPECTED_ARRIVAL_TIME),
        returnTime: toStr(r.RETURN_TIME),
        returnExpectedArrivalTime: toStr(r.RETURN_EXPECTED_ARRIVAL_TIME),
        departurePickupPointId: toBigInt(r.DEPARTURE_PICKUP_POINT_ID),
        departureDropoffPointId: toBigInt(r.DEPARTURE_DROPOFF_POINT_ID),
        returnPickupPointId: toBigInt(r.RETURN_PICKUP_POINT_ID),
        returnDropoffPointId: toBigInt(r.RETURN_DROPOFF_POINT_ID),
        departurePickupPointText: toStr(r.DEPARTURE_PICKUP_POINT_TEXT),
        departureDropoffPointText: toStr(r.DEPARTURE_DROPOFF_POINT_TEXT),
        returnPickupPointText: toStr(r.RETURN_PICKUP_POINT_TEXT),
        returnDropoffPointText: toStr(r.RETURN_DROPOFF_POINT_TEXT),
        departurePointNote: toStr(r.DEPARTURE_POINT_NOTE),
        returnPointNote: toStr(r.RETURN_POINT_NOTE),
        contactName: toStr(r.CONTACT_NAME),
        contactPhone: toStr(r.CONTACT_PHONE),
        departmentApproverIds: toStr(r.DEPARTMENT_APPROVER_IDS),
        otShiftCode: toStr(r.OT_SHIFT_CODE),
        otShiftDate: toDateStr(r.OT_SHIFT_DATE),
        otPairId: toBigInt(r.OT_PAIR_ID),
        legDirection: toStr(r.LEG_DIRECTION),
        pickupScope: toStr(r.PICKUP_SCOPE),
        senderInfo: toStr(r.SENDER_INFO),
        receiverInfo: toStr(r.RECEIVER_INFO),
        purpose: toStr(r.PURPOSE),
        notes: toStr(r.NOTES),
        gaActions: toStr(r.GA_ACTIONS),
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      })),
      skipDuplicates: true,
    }),
  );
  const requestIds = new Set((await prisma.transportRequest.findMany({ select: { id: true } })).map((x) => x.id));

  const reqPassengers = await readDump('TRMS_DATA__TRMS_REQUEST_PASSENGERS');
  await batchInsert(
    reqPassengers.filter((r) => requestIds.has(toBigIntReq(r.REQUEST_ID))),
    500,
    (chunk) =>
      prisma.requestPassenger.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          requestId: toBigIntReq(r.REQUEST_ID),
          passengerId: toStr(r.PASSENGER_ID),
          passengerName: toStr(r.PASSENGER_NAME) || 'Hành khách',
          passengerType: toStr(r.PASSENGER_TYPE) || 'STAFF',
          departurePickupTime: toStr(r.DEPARTURE_PICKUP_TIME),
          departurePickupPointText: toStr(r.DEPARTURE_PICKUP_POINT_TEXT),
          departureArrivalTime: toStr(r.DEPARTURE_ARRIVAL_TIME),
          departureDropoffPointText: toStr(r.DEPARTURE_DROPOFF_POINT_TEXT),
          returnPickupTime: toStr(r.RETURN_PICKUP_TIME),
          returnPickupPointText: toStr(r.RETURN_PICKUP_POINT_TEXT),
          returnDropoffPointText: toStr(r.RETURN_DROPOFF_POINT_TEXT),
          passengerNote: toStr(r.PASSENGER_NOTE),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  const reqHistories = await readDump('TRMS_DATA__TRMS_REQUEST_STATUS_HISTORY');
  await prisma.requestStatusHistory.createMany({
    data: reqHistories
      .filter((r) => requestIds.has(toBigIntReq(r.REQUEST_ID)))
      .map((r) => ({
        id: toBigIntReq(r.ID),
        requestId: toBigIntReq(r.REQUEST_ID),
        fromStatus: toStr(r.FROM_STATUS),
        toStatus: toStr(r.TO_STATUS) || 'PENDING_DEPARTMENT',
        actionBy: toBigInt(r.ACTION_BY),
        actionAt: toDate(r.ACTION_AT),
        actionReason: toStr(r.ACTION_REASON),
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      })),
    skipDuplicates: true,
  });

  const approvals = await readDump('TRMS_DATA__TRMS_APPROVAL_RECORDS');
  await prisma.approvalRecord.createMany({
    data: approvals
      .filter((r) => requestIds.has(toBigIntReq(r.REQUEST_ID)))
      .map((r) => ({
        id: toBigIntReq(r.ID),
        requestId: toBigIntReq(r.REQUEST_ID),
        stepNo: toInt(r.STEP_NO, 1),
        approvalStage: toStr(r.APPROVAL_STAGE) || 'DEPARTMENT',
        approverId: toBigInt(r.APPROVER_ID),
        approverName: toStr(r.APPROVER_NAME),
        decision: toStr(r.DECISION) || 'APPROVED',
        decisionReason: toStr(r.DECISION_REASON),
        decidedAt: toDate(r.DECIDED_AT),
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      })),
    skipDuplicates: true,
  });
  console.log(`  ✓ TransportRequests: ${requestIds.size}`);

  // 13. DailyPlans, PlanVersions, PlanAssignments
  const dailyPlans = await readDump('TRMS_DATA__TRMS_DAILY_PLANS');
  await prisma.dailyPlan.createMany({
    data: dailyPlans.map((r) => ({
      id: toBigIntReq(r.ID),
      businessDate: toDateStr(r.BUSINESS_DATE) || `2026-01-${r.ID}`,
      status: toStr(r.STATUS) || 'CURRENT',
      currentVersionId: toBigInt(r.CURRENT_VERSION_ID),
      lastBatchId: toBigInt(r.LAST_BATCH_ID),
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const planIds = new Set((await prisma.dailyPlan.findMany({ select: { id: true } })).map((x) => x.id));

  const planVersions = await readDump('TRMS_DATA__TRMS_PLAN_VERSIONS');
  await batchInsert(
    planVersions.filter((r) => planIds.has(toBigIntReq(r.PLAN_ID))),
    500,
    (chunk) =>
      prisma.planVersion.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          planId: toBigIntReq(r.PLAN_ID),
          versionNo: toInt(r.VERSION_NO, 1),
          sourceBatchId: toBigInt(r.SOURCE_BATCH_ID),
          status: toStr(r.STATUS) || 'CURRENT',
          currentFlag: toStr(r.CURRENT_FLAG) || 'Y',
          publishedBy: toBigInt(r.PUBLISHED_BY),
          publishedAt: toDate(r.PUBLISHED_AT),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );
  const versionIds = new Set((await prisma.planVersion.findMany({ select: { id: true } })).map((x) => x.id));

  const planAssignments = await readDump('TRMS_DATA__TRMS_PLAN_ASSIGNMENTS');
  await batchInsert(
    planAssignments.filter((r) => versionIds.has(toBigIntReq(r.PLAN_VERSION_ID))),
    1000,
    (chunk) =>
      prisma.planAssignment.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          planVersionId: toBigIntReq(r.PLAN_VERSION_ID),
          routeId: toBigIntReq(r.ROUTE_ID),
          segmentId: toBigInt(r.SEGMENT_ID),
          legDefinitionId: toBigInt(r.LEG_DEFINITION_ID),
          legCode: toStr(r.LEG_CODE) || 'OUT',
          legName: toStr(r.LEG_NAME),
          direction: toStr(r.DIRECTION),
          passengerType: toStr(r.PASSENGER_TYPE),
          routeCode: toStr(r.ROUTE_CODE),
          routeName: toStr(r.ROUTE_NAME),
          vehicleId: toBigInt(r.VEHICLE_ID),
          driverId: toBigInt(r.DRIVER_ID),
          assignmentType: toStr(r.ASSIGNMENT_TYPE) || 'BASE',
          demandCount: toInt(r.DEMAND_COUNT, 0),
          activeFlag: toStr(r.ACTIVE_FLAG) || 'Y',
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );
  console.log(`  ✓ DailyPlans (${planIds.size}), Versions (${versionIds.size}), Assignments (${planAssignments.length})`);

  // 14. Trips, Links, ExecutionFacts, VehicleStatus
  const trips = await readDump('TRMS_DATA__TRMS_TRIPS');
  await batchInsert(trips, 1000, (chunk) =>
    prisma.trip.createMany({
      data: chunk.map((r) => {
        const rtId = toBigInt(r.ROUTE_ID);
        const vehId = toBigInt(r.VEHICLE_ID);
        const drvId = toBigInt(r.DRIVER_ID);
        return {
          id: toBigIntReq(r.ID),
          tripCode: toStr(r.TRIP_CODE) || `TRIP_${r.ID}`,
          businessDate: toDateStr(r.BUSINESS_DATE) || '2026-10-01',
          planVersionId: toBigInt(r.PLAN_VERSION_ID),
          planAssignmentId: toBigInt(r.PLAN_ASSIGNMENT_ID),
          tripType: toStr(r.TRIP_TYPE) || 'SPECIAL',
          dispatchType: toStr(r.DISPATCH_TYPE) || 'DISPATCH',
          dispatchSource: toStr(r.DISPATCH_SOURCE),
          status: toStr(r.STATUS) || 'DISPATCHED',
          vendorId: toBigInt(r.VENDOR_ID),
          routeId: rtId && routeIds.has(rtId) ? rtId : null,
          segmentId: toBigInt(r.SEGMENT_ID),
          legCode: toStr(r.LEG_CODE),
          shiftId: toBigInt(r.SHIFT_ID),
          vehicleId: vehId && vehicleIds.has(vehId) ? vehId : null,
          driverId: drvId && driverIds.has(drvId) ? drvId : null,
          vehiclePlateSnapshot: toStr(r.VEHICLE_PLATE_SNAPSHOT),
          driverNameSnapshot: toStr(r.DRIVER_NAME_SNAPSHOT),
          driverPhoneSnapshot: toStr(r.DRIVER_PHONE_SNAPSHOT),
          seatCapacitySnapshot: toIntNull(r.SEAT_CAPACITY_SNAPSHOT),
          plannedDepartureAt: toDate(r.PLANNED_DEPARTURE_AT),
          plannedArrivalAt: toDate(r.PLANNED_ARRIVAL_AT),
          passengerCount: toInt(r.PASSENGER_COUNT, 0),
          passengerType: toStr(r.PASSENGER_TYPE),
          tripMode: toStr(r.TRIP_MODE) || 'ONE_WAY',
          tripLeg: toStr(r.TRIP_LEG),
          pairedTripId: toBigInt(r.PAIRED_TRIP_ID),
          departurePickupPointId: toBigInt(r.DEPARTURE_PICKUP_POINT_ID),
          departureDropoffPointId: toBigInt(r.DEPARTURE_DROPOFF_POINT_ID),
          returnPickupPointId: toBigInt(r.RETURN_PICKUP_POINT_ID),
          returnDropoffPointId: toBigInt(r.RETURN_DROPOFF_POINT_ID),
          departurePickupPointText: toStr(r.DEPARTURE_PICKUP_POINT_TEXT),
          departureDropoffPointText: toStr(r.DEPARTURE_DROPOFF_POINT_TEXT),
          returnPickupPointText: toStr(r.RETURN_PICKUP_POINT_TEXT),
          returnDropoffPointText: toStr(r.RETURN_DROPOFF_POINT_TEXT),
          deadheadKind: toStr(r.DEADHEAD_KIND),
          deadheadSourceTripId: toBigInt(r.DEADHEAD_SOURCE_TRIP_ID),
          pricingScope: toStr(r.PRICING_SCOPE),
          pricingConfigId: toBigInt(r.PRICING_CONFIG_ID),
          overrideReason: toStr(r.OVERRIDE_REASON),
          notes: toStr(r.NOTES),
          delFlag: toStr(r.DEL_FLAG) || 'N',
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        };
      }),
      skipDuplicates: true,
    }),
  );
  const tripIds = new Set((await prisma.trip.findMany({ select: { id: true } })).map((x) => x.id));

  const tripLinks = await readDump('TRMS_DATA__TRMS_TRIP_REQUEST_LINKS');
  await batchInsert(
    tripLinks.filter((r) => tripIds.has(toBigIntReq(r.TRIP_ID)) && requestIds.has(toBigIntReq(r.REQUEST_ID))),
    500,
    (chunk) =>
      prisma.tripRequestLink.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          tripId: toBigIntReq(r.TRIP_ID),
          requestId: toBigIntReq(r.REQUEST_ID),
          linkRole: toStr(r.LINK_ROLE) || 'PRIMARY',
          requestLeg: toStr(r.REQUEST_LEG) || 'OUTBOUND',
          splitGroupNo: toInt(r.SPLIT_GROUP_NO, 1),
          delFlag: toStr(r.DEL_FLAG) || 'N',
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  const execFacts = await readDump('TRMS_DATA__TRMS_TRIP_EXECUTION_FACTS');
  await batchInsert(
    execFacts.filter((r) => tripIds.has(toBigIntReq(r.TRIP_ID))),
    1000,
    (chunk) =>
      prisma.tripExecutionFact.createMany({
        data: chunk.map((r) => ({
          id: toBigIntReq(r.ID),
          tripId: toBigIntReq(r.TRIP_ID),
          actualDepartureAt: toDate(r.ACTUAL_DEPARTURE_AT),
          actualArrivalAt: toDate(r.ACTUAL_ARRIVAL_AT),
          actualKm: toDecNull(r.ACTUAL_KM),
          startOdometerKm: toDecNull(r.START_ODOMETER_KM),
          endOdometerKm: toDecNull(r.END_ODOMETER_KM),
          otHours: toDecNull(r.OT_HOURS),
          actualPassengerCount: toIntNull(r.ACTUAL_PASSENGER_COUNT),
          actualKmSource: toStr(r.ACTUAL_KM_SOURCE),
          completedBy: toBigInt(r.COMPLETED_BY),
          completedAt: toDate(r.COMPLETED_AT),
          executionNote: toStr(r.EXECUTION_NOTE),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        })),
        skipDuplicates: true,
      }),
  );

  const vehStatuses = await readDump('TRMS_DATA__TRMS_VEHICLE_STATUS');
  await prisma.vehicleStatus.createMany({
    data: vehStatuses
      .filter((r) => vehicleIds.has(toBigIntReq(r.VEHICLE_ID)))
      .map((r) => ({
        vehicleId: toBigIntReq(r.VEHICLE_ID),
        status: toStr(r.STATUS) || 'AVAILABLE',
        segmentId: toBigInt(r.SEGMENT_ID),
        routeId: toBigInt(r.ROUTE_ID),
        currentTripId: toBigInt(r.CURRENT_TRIP_ID),
        plannedDepartureAt: toDate(r.PLANNED_DEPARTURE_AT),
        plannedArrivalAt: toDate(r.PLANNED_ARRIVAL_AT),
        lastSyncedAt: toDate(r.LAST_SYNCED_AT),
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      })),
    skipDuplicates: true,
  });
  console.log(`  ✓ Trips (${tripIds.size}) & ExecutionFacts (${execFacts.length})`);

  // 15. CostRecords, MonthlyPayments, MonthlyCostDetails
  const costRecords = await readDump('TRMS_DATA__TRMS_COST_RECORDS');
  await batchInsert(costRecords, 500, (chunk) =>
    prisma.costRecord.createMany({
      data: chunk.map((r) => {
        const tId = toBigInt(r.TRIP_ID);
        return {
          id: toBigIntReq(r.ID),
          idempotencyKey: toStr(r.IDEMPOTENCY_KEY),
          costRuleId: toBigInt(r.COST_RULE_ID),
          costSource: toStr(r.COST_SOURCE) || 'AUTO',
          costType: toStr(r.COST_TYPE) || 'COMMUTE',
          costScope: toStr(r.COST_SCOPE) || 'TRIP',
          tripId: tId && tripIds.has(tId) ? tId : null,
          vehicleId: toBigInt(r.VEHICLE_ID),
          routeId: toBigInt(r.ROUTE_ID),
          serviceDate: toDateStr(r.SERVICE_DATE),
          costMonth: toStr(r.COST_MONTH),
          quantity: toDec(r.QUANTITY, '1'),
          appliedUnitPrice: toDec(r.APPLIED_UNIT_PRICE, '0'),
          appliedAmount: toDec(r.APPLIED_AMOUNT, '0'),
          vatRate: toDec(r.VAT_RATE, '0.08'),
          vatAmount: toDec(r.VAT_AMOUNT, '0'),
          amountAfterVat: toDec(r.AMOUNT_AFTER_VAT, '0'),
          description: toStr(r.DESCRIPTION),
          costStatus: toStr(r.COST_STATUS) || 'DRAFT',
          pricedAt: toDate(r.PRICED_AT),
          createDate: toDate(r.CREATE_DATE),
          editDate: toDate(r.EDIT_DATE),
        };
      }),
      skipDuplicates: true,
    }),
  );

  const monthlyPayments = await readDump('TRMS_DATA__TRMS_MONTHLY_PAYMENTS');
  await prisma.monthlyPayment.createMany({
    data: monthlyPayments.map((r) => ({
      id: toBigIntReq(r.ID),
      paymentMonth: toStr(r.PAYMENT_MONTH) || `2026-09`,
      vendorId: toBigInt(r.VENDOR_ID),
      totalBeforeVat: toDec(r.TOTAL_BEFORE_VAT, '0'),
      totalVatAmount: toDec(r.TOTAL_VAT_AMOUNT, '0'),
      totalAfterVat: toDec(r.TOTAL_AFTER_VAT, '0'),
      status: toStr(r.STATUS) || 'DRAFT',
      createDate: toDate(r.CREATE_DATE),
      editDate: toDate(r.EDIT_DATE),
    })),
    skipDuplicates: true,
  });
  const paymentIds = new Set((await prisma.monthlyPayment.findMany({ select: { id: true } })).map((x) => x.id));

  const monthlyDetails = await readDump('TRMS_DATA__TRMS_MONTHLY_COST_DETAILS');
  await prisma.monthlyCostDetail.createMany({
    data: monthlyDetails
      .filter((r) => paymentIds.has(toBigIntReq(r.MONTHLY_PAYMENT_ID)))
      .map((r) => ({
        id: toBigIntReq(r.ID),
        monthlyPaymentId: toBigIntReq(r.MONTHLY_PAYMENT_ID),
        lineNo: toInt(r.LINE_NO, 1),
        lineType: toStr(r.LINE_TYPE) || 'VEHICLE_ROUTE',
        driverId: toBigInt(r.DRIVER_ID),
        driverNameSnapshot: toStr(r.DRIVER_NAME_SNAPSHOT),
        vehicleId: toBigInt(r.VEHICLE_ID),
        vehiclePlateSnapshot: toStr(r.VEHICLE_PLATE_SNAPSHOT),
        routeId: toBigInt(r.ROUTE_ID),
        routeNameSnapshot: toStr(r.ROUTE_NAME_SNAPSHOT),
        tripDescription: toStr(r.TRIP_DESCRIPTION),
        dailyTripCount: toIntNull(r.DAILY_TRIP_COUNT),
        basicChargeAmount: toDec(r.BASIC_CHARGE_AMOUNT, '0'),
        overtimeHours: toDec(r.OVERTIME_HOURS, '0'),
        overtimeUnitPrice: toDec(r.OVERTIME_UNIT_PRICE, '0'),
        overtimeAmount: toDec(r.OVERTIME_AMOUNT, '0'),
        totalDistanceKm: toDec(r.TOTAL_DISTANCE_KM, '0'),
        includedDistanceKm: toDec(r.INCLUDED_DISTANCE_KM, '0'),
        excessKm: toDec(r.EXCESS_KM, '0'),
        excessKmUnitPrice: toDec(r.EXCESS_KM_UNIT_PRICE, '0'),
        excessKmAmount: toDec(r.EXCESS_KM_AMOUNT, '0'),
        overnightAmount: toDec(r.OVERNIGHT_AMOUNT, '0'),
        tollFeeAmount: toDec(r.TOLL_FEE_AMOUNT, '0'),
        extraTripAmount: toDec(r.EXTRA_TRIP_AMOUNT, '0'),
        totalBeforeVat: toDec(r.TOTAL_BEFORE_VAT, '0'),
        vatAmount: toDec(r.VAT_AMOUNT, '0'),
        totalAfterVat: toDec(r.TOTAL_AFTER_VAT, '0'),
        createDate: toDate(r.CREATE_DATE),
        editDate: toDate(r.EDIT_DATE),
      })),
    skipDuplicates: true,
  });
  console.log(`  ✓ CostRecords (${costRecords.length}), MonthlyPayments (${paymentIds.size}), Details (${monthlyDetails.length})`);

  // 16. Seed Test Users by Role (§5.3)
  const testRoles = [
    { roleCode: 'ADMIN', username: 'test_admin', fullName: 'Admin Kiểm Thử', isAdmin: 1, features: ALL_FEATURE_CODES },
    { roleCode: 'GA_LEADER', username: 'test_ga_leader', fullName: 'Trưởng Phòng GA', isAdmin: 0, features: ALL_FEATURE_CODES },
    { roleCode: 'GA_PIC', username: 'test_ga_pic', fullName: 'Chuyên Viên Điều Phối GA', isAdmin: 0, features: ALL_FEATURE_CODES },
    {
      roleCode: 'TBP',
      username: 'test_tbp',
      fullName: 'Trưởng Bộ Phận Duyệt Đơn',
      isAdmin: 0,
      features: ['FR-REQUEST-001', 'FR-REQUEST-002', 'FR-REQUEST-003', 'FR-REQUEST-012', 'FR-REQUEST-015'],
    },
    {
      roleCode: 'REQUESTER',
      username: 'test_requester',
      fullName: 'Nhân Viên Đặt Xe',
      isAdmin: 0,
      features: ['FR-REQUEST-001', 'FR-REQUEST-002', 'FR-REQUEST-003', 'FR-REQUEST-004', 'FR-REQUEST-005', 'FR-REQUEST-015'],
    },
    {
      roleCode: 'VENDOR',
      username: 'test_vendor',
      fullName: 'Điều Phối Nhà Xe',
      isAdmin: 0,
      features: ['FR-REQUEST-001', 'FR-REQUEST-002', 'FR-REQUEST-009', 'FR-REQUEST-010', 'FR-TRIP-000', 'FR-TRIP-001', 'FR-TRIP-006'],
    },
    {
      roleCode: 'DRIVER',
      username: 'test_driver',
      fullName: 'Tài Xế Kiểm Thử',
      isAdmin: 0,
      features: ['FR-DRIVER-JOURNEY-000', 'FR-DRIVER-JOURNEY-001', 'FR-DRIVER-JOURNEY-002', 'FR-DRIVER-JOURNEY-003', 'FR-DRIVER-JOURNEY-004'],
    },
  ];

  const allFeaturesMap = new Map(
    (await prisma.feature.findMany()).map((f) => [f.code, f.id]),
  );

  for (let i = 0; i < testRoles.length; i++) {
    const tr = testRoles[i];
    const role = await prisma.role.upsert({
      where: { code: tr.roleCode },
      update: { isSystemAdmin: tr.isAdmin },
      create: {
        id: nextSnowflakeId(),
        code: tr.roleCode,
        name: tr.fullName,
        isSystemAdmin: tr.isAdmin,
      },
    });

    const user = await prisma.user.upsert({
      where: { username: tr.username },
      update: { fullName: tr.fullName, passwordHash: defaultPassHash, status: 'ACTIVE' },
      create: {
        id: nextSnowflakeId(),
        username: tr.username,
        fullName: tr.fullName,
        email: `${tr.username}@mkvc.local`,
        passwordHash: defaultPassHash,
        status: 'ACTIVE',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    for (const fc of tr.features) {
      const fId = allFeaturesMap.get(fc);
      if (fId) {
        await prisma.roleFeature.upsert({
          where: { roleId_featureId: { roleId: role.id, featureId: fId } },
          update: {},
          create: { roleId: role.id, featureId: fId },
        });
      }
    }
  }

  console.log('  ✓ Test Users seeded (password: Trms@123): test_admin, test_ga_leader, test_ga_pic, test_tbp, test_requester, test_vendor, test_driver');
  console.log('=== [Seed] Completed Successfully! ===');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
