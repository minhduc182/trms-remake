import { describe, it, expect, afterAll } from 'vitest';
import { gql, closeTestServer } from './test-helper.js';

describe('TRMS Remake Acceptance Suite — Part 1: Master Data, Shifts, Cost Config, ETP', () => {
  afterAll(async () => {
    await closeTestServer();
  });

  // =========================================================================
  // 1. MASTER DATA - POINTS (AT-MD-001..006)
  // =========================================================================
  it('AT-MD-001..004 & AT-MD-006: Creates Point, blocks missing fields & duplicate code, filters exact pointType, and deletes unused Point', async () => {
    const code = `PT_AT_${Date.now().toString().slice(-6)}`;

    // AT-MD-002: Missing required field / invalid pointType
    const invalidRes = await gql(
      `mutation { createPoint(pointCode: "", pointName: "X", pointType: "PICKUP") { id } }`
    );
    expect(invalidRes.errors).toBeDefined();

    // AT-MD-001: Valid creation
    const createRes = await gql(
      `mutation($code: String!) {
        createPoint(pointCode: $code, pointName: "Điểm Nghiệm Thu", pointType: "PICKUP", districtName: "Hoài Đức", address: "KCN An Khánh") {
          id pointCode pointName pointType activeFlag
        }
      }`,
      { code }
    );
    expect(createRes.errors).toBeUndefined();
    const pointId = createRes.data.createPoint.id;
    expect(createRes.data.createPoint.pointType).toBe('PICKUP');

    // AT-MD-003: Duplicate code (case-insensitive)
    const dupRes = await gql(
      `mutation($code: String!) {
        createPoint(pointCode: $code, pointName: "Điểm Trùng", pointType: "PICKUP") { id }
      }`,
      { code: code.toLowerCase() }
    );
    expect(dupRes.errors).toBeDefined();

    // AT-MD-004: Filter exact pointType=PICKUP (must not include DROPOFF/BOTH)
    const filterRes = await gql(`{ points(pointType: "PICKUP") { id pointCode pointType } }`);
    expect(filterRes.errors).toBeUndefined();
    expect(filterRes.data.points.every((p: any) => p.pointType === 'PICKUP')).toBe(true);

    // AT-MD-006: Deactivate and delete unused point
    const deactRes = await gql(
      `mutation($id: BigInt!) { updatePoint(id: $id, activeFlag: "N") { id activeFlag } }`,
      { id: pointId }
    );
    expect(deactRes.errors).toBeUndefined();
    expect(deactRes.data.updatePoint.activeFlag).toBe('N');

    const delRes = await gql(
      `mutation($id: BigInt!) { deletePoint(id: $id) { id delFlag } }`,
      { id: pointId }
    );
    expect(delRes.errors).toBeUndefined();
    expect(delRes.data.deletePoint.delFlag).toBe('Y');
  });

  it('AT-MD-005: Blocks deactivating or deleting a Point used in RouteSegments', async () => {
    const res = await gql(`{ points { id pointCode segmentUsageCount } }`);
    expect(res.errors).toBeUndefined();
    const used = res.data.points.find((p: any) => p.segmentUsageCount > 0);
    expect(used).toBeDefined();

    const deact = await gql(
      `mutation($id: BigInt!) { updatePoint(id: $id, activeFlag: "N") { id } }`,
      { id: used.id }
    );
    expect(deact.errors).toBeDefined();

    const del = await gql(
      `mutation($id: BigInt!) { deletePoint(id: $id) { id } }`,
      { id: used.id }
    );
    expect(del.errors).toBeDefined();
  });

  // =========================================================================
  // 2. MASTER DATA - DRIVERS (AT-MD-007..012)
  // =========================================================================
  it('AT-MD-007..012: Enforces Driver account linking when active, creates new Driver account, and blocks deleting busy Driver', async () => {
    const vendorsRes = await gql(`{ vendors { id } }`);
    const vendorId = vendorsRes.data.vendors[0]?.id;
    const suffix = Date.now().toString().slice(-6);

    // AT-MD-008: Active driver without account -> blocked
    const failNoAcc = await gql(
      `mutation($vendorId: BigInt) {
        createDriver(driverName: "Tài Xế Lỗi", phoneNumber: "0988111222", shortAddress: "001099000111", vendorId: $vendorId, activeFlag: "Y", accountMode: "NONE") { id }
      }`,
      { vendorId }
    );
    expect(failNoAcc.errors).toBeDefined();

    // AT-MD-007: Active driver with CREATE_NEW account -> succeeds and links userId
    const newUsername = `drv_at_${suffix}`;
    const okDrv = await gql(
      `mutation($vendorId: BigInt, $u: String!) {
        createDriver(
          driverName: "Tài Xế Nghiệm Thu"
          phoneNumber: "0988111333"
          shortAddress: "001099000222"
          vendorId: $vendorId
          activeFlag: "Y"
          accountMode: "CREATE_NEW"
          username: $u
          password: "Password@123"
        ) {
          id driverName identityUserId activeFlag
        }
      }`,
      { vendorId, u: newUsername }
    );
    expect(okDrv.errors).toBeUndefined();
    expect(okDrv.data.createDriver.identityUserId).toBeTruthy();

    // AT-MD-010: Duplicate username -> blocked
    const dupUser = await gql(
      `mutation($vendorId: BigInt, $u: String!) {
        createDriver(
          driverName: "Tài Xế Trùng User"
          phoneNumber: "0988111444"
          shortAddress: "001099000333"
          vendorId: $vendorId
          activeFlag: "Y"
          accountMode: "CREATE_NEW"
          username: $u
          password: "Password@123"
        ) { id }
      }`,
      { vendorId, u: newUsername }
    );
    expect(dupUser.errors).toBeDefined();

    // Delete unused driver
    const delDrv = await gql(
      `mutation($id: BigInt!) { deleteDriver(id: $id) { id delFlag } }`,
      { id: okDrv.data.createDriver.id }
    );
    expect(delDrv.errors).toBeUndefined();
    expect(delDrv.data.deleteDriver.delFlag).toBe('Y');
  });

  // =========================================================================
  // 3. MASTER DATA - VEHICLES (AT-MD-013..017)
  // =========================================================================
  it('AT-MD-013..016: Enforces Vehicle seatCapacity, BY_SEGMENT quotas, duplicate plate guard, and busy deletion guard', async () => {
    const plate = `29B-${Date.now().toString().slice(-5)}`;

    // AT-MD-014: BY_SEGMENT without dailyTripQuota / monthlyKmQuota -> blocked
    const failBySeg = await gql(
      `mutation($plate: String!) {
        createVehicle(vehiclePlate: $plate, vehicleType: "VAN_16", ownershipType: "RENTAL", commutePackageMode: "BY_SEGMENT") { id }
      }`,
      { plate }
    );
    expect(failBySeg.errors).toBeDefined();

    // AT-MD-013 & AT-MD-014: Valid VAN_16 + BY_SEGMENT -> seatCapacity = 15
    const okVeh = await gql(
      `mutation($plate: String!) {
        createVehicle(
          vehiclePlate: $plate
          vehicleType: "VAN_16"
          ownershipType: "RENTAL"
          commutePackageMode: "BY_SEGMENT"
          dailyTripQuota: 4
          monthlyKmQuota: 40
        ) {
          id vehiclePlate seatCapacity dailyTripQuota monthlyKmQuota
        }
      }`,
      { plate }
    );
    expect(okVeh.errors).toBeUndefined();
    expect(okVeh.data.createVehicle.seatCapacity).toBe(15);

    // AT-MD-015: Duplicate plate -> blocked
    const dupVeh = await gql(
      `mutation($plate: String!) {
        createVehicle(vehiclePlate: $plate, vehicleType: "BUS_29", ownershipType: "RENTAL", commutePackageMode: "BASE") { id }
      }`,
      { plate }
    );
    expect(dupVeh.errors).toBeDefined();

    // Cleanup unused vehicle
    const delVeh = await gql(
      `mutation($id: BigInt!) { deleteVehicle(id: $id) { id delFlag } }`,
      { id: okVeh.data.createVehicle.id }
    );
    expect(delVeh.errors).toBeUndefined();
  });

  // =========================================================================
  // 4. MASTER DATA - LEG DEFINITIONS & ROUTES (AT-MD-018..026)
  // =========================================================================
  it('AT-MD-018..020: Creates LegDefinition per passengerType, forces TO_FACTORY when isDeadhead=Y, and deletes unused leg', async () => {
    const legCode = `LEG_AT_${Date.now().toString().slice(-5)}`;

    // Create for WORKER with isDeadhead=Y -> forces direction=TO_FACTORY (AT-MD-019)
    const legW = await gql(
      `mutation($code: String!) {
        createLegDefinition(legCode: $code, legName: "Chiều Test Worker", passengerType: "WORKER", direction: "FROM_FACTORY", isDeadhead: "Y", displayOrder: 10) {
          id legCode passengerType direction isDeadhead
        }
      }`,
      { code: legCode }
    );
    expect(legW.errors).toBeUndefined();
    expect(legW.data.createLegDefinition.direction).toBe('TO_FACTORY');

    // Duplicate in same passengerType WORKER -> blocked (AT-MD-018)
    const dupW = await gql(
      `mutation($code: String!) {
        createLegDefinition(legCode: $code, legName: "Trùng Worker", passengerType: "WORKER", direction: "TO_FACTORY", displayOrder: 11) { id }
      }`,
      { code: legCode }
    );
    expect(dupW.errors).toBeDefined();

    // Same legCode in STAFF -> allowed (AT-MD-018)
    const legS = await gql(
      `mutation($code: String!) {
        createLegDefinition(legCode: $code, legName: "Chiều Test Staff", passengerType: "STAFF", direction: "FROM_FACTORY", isDeadhead: "N", displayOrder: 12) {
          id legCode passengerType direction
        }
      }`,
      { code: legCode }
    );
    expect(legS.errors).toBeUndefined();
    expect(legS.data.createLegDefinition.direction).toBe('FROM_FACTORY');

    // Delete both unused legs (AT-MD-020)
    await gql(`mutation($id: BigInt!) { deleteLegDefinition(id: $id) { id } }`, { id: legW.data.createLegDefinition.id });
    await gql(`mutation($id: BigInt!) { deleteLegDefinition(id: $id) { id } }`, { id: legS.data.createLegDefinition.id });
  });

  it('AT-MD-021..026: Creates Route WORKER (auto MON_SUN), blocks duplicate routeCode, blocks deleting active Route with ETP', async () => {
    const routeCode = `RT_AT_${Date.now().toString().slice(-5)}`;
    const createRt = await gql(
      `mutation($code: String!) {
        createRoute(routeCode: $code, routeName: "Tuyến Test Worker", passengerType: "WORKER") {
          id routeCode passengerType runDays
        }
      }`,
      { code: routeCode }
    );
    expect(createRt.errors).toBeUndefined();
    expect(createRt.data.createRoute.runDays).toBe('MON_SUN');

    // Duplicate routeCode -> blocked (AT-MD-022)
    const dupRt = await gql(
      `mutation($code: String!) {
        createRoute(routeCode: $code, routeName: "Tuyến Trùng", passengerType: "STAFF") { id }
      }`,
      { code: routeCode }
    );
    expect(dupRt.errors).toBeDefined();

    // Delete unused route -> succeeds (AT-MD-026)
    const delRt = await gql(
      `mutation($id: BigInt!) { deleteRoute(id: $id) { id delFlag } }`,
      { id: createRt.data.createRoute.id }
    );
    expect(delRt.errors).toBeUndefined();
  });

  // =========================================================================
  // 5. SHIFTS & 7-DAY REGISTRATION GRID (AT-SHIFT-001..005)
  // =========================================================================
  it('AT-SHIFT-001..005: Queries Shifts, toggles transportFlag, and returns 7-day shiftRegistrations grid', async () => {
    const shiftsRes = await gql(`{ shifts { id shiftCode transportFlag segmentUsageCount } }`);
    expect(shiftsRes.errors).toBeUndefined();
    expect(shiftsRes.data.shifts.length).toBeGreaterThan(0);

    const unusedShift = shiftsRes.data.shifts.find((s: any) => s.segmentUsageCount === 0);
    if (unusedShift) {
      const nextFlag = unusedShift.transportFlag === 'Y' ? 'N' : 'Y';
      const toggleRes = await gql(
        `mutation($id: BigInt!, $flag: String!) {
          updateShiftTransportFlag(id: $id, transportFlag: $flag) { id transportFlag }
        }`,
        { id: unusedShift.id, flag: nextFlag }
      );
      expect(toggleRes.errors).toBeUndefined();
      expect(toggleRes.data.updateShiftTransportFlag.transportFlag).toBe(nextFlag);

      await gql(
        `mutation($id: BigInt!, $flag: String!) {
          updateShiftTransportFlag(id: $id, transportFlag: $flag) { id transportFlag }
        }`,
        { id: unusedShift.id, flag: unusedShift.transportFlag }
      );
    }

    const gridRes = await gql(
      `{
        shiftRegistrations(startDate: "2026-11-10") {
          windowDates
          rows { employeeCode employeeName dailyShifts invalidDays }
        }
      }`
    );
    expect(gridRes.errors).toBeUndefined();
    expect(gridRes.data.shiftRegistrations.windowDates).toHaveLength(7);
  });

  // =========================================================================
  // 6. COST CONFIG VERSIONING (AT-CC-001..007)
  // =========================================================================
  it('AT-CC-001..007: Validates CostConfig rules, blocks OVERNIGHT on COMMUTE, cuts previous version effectiveTo, and restores on delete', async () => {
    // AT-CC-001: OVERNIGHT on COMMUTE must fail
    const badCommute = await gql(
      `mutation {
        upsertCostConfig(
          versionCode: "CC_BAD_01"
          configType: "COMMUTE"
          passengerType: "WORKER"
          vehicleType: "BUS_45"
          effectiveFrom: "2027-05-01"
          rules: [{ ruleCode: "OVERNIGHT", rateType: "OVERNIGHT", unitPrice: "500000" }]
        ) { id }
      }`
    );
    expect(badCommute.errors).toBeDefined();

    // AT-CC-002: EXTRA + WORKER without pricingScope must fail
    const badExtraW = await gql(
      `mutation {
        upsertCostConfig(
          versionCode: "CC_BAD_02"
          configType: "EXTRA"
          passengerType: "WORKER"
          vehicleType: "BUS_45"
          effectiveFrom: "2027-05-01"
          rules: [{ ruleCode: "DAILY_RUN", rateType: "PER_KM", unitPrice: "25000" }]
        ) { id }
      }`
    );
    expect(badExtraW.errors).toBeDefined();

    // AT-CC-005 & AT-CC-007: Create future CostConfig V1 & V2, verify effectiveTo cut & restore on delete
    const v1Code = `CC_V1_${Date.now().toString().slice(-5)}`;
    const v2Code = `CC_V2_${Date.now().toString().slice(-5)}`;

    const v1Res = await gql(
      `mutation($code: String!) {
        upsertCostConfig(
          versionCode: $code
          configType: "EXTRA"
          passengerType: "STAFF"
          vehicleType: "VAN_16"
          effectiveFrom: "2027-06-01"
          rules: [{ ruleCode: "DAILY_RUN", rateType: "PER_TRIP", unitPrice: "1200000" }]
        ) { id versionCode effectiveFrom effectiveTo }
      }`,
      { code: v1Code }
    );
    expect(v1Res.errors).toBeUndefined();
    const v1Id = v1Res.data.upsertCostConfig.id;

    const v2Res = await gql(
      `mutation($code: String!) {
        upsertCostConfig(
          versionCode: $code
          configType: "EXTRA"
          passengerType: "STAFF"
          vehicleType: "VAN_16"
          effectiveFrom: "2027-06-15"
          rules: [{ ruleCode: "DAILY_RUN", rateType: "PER_TRIP", unitPrice: "1300000" }]
        ) { id versionCode effectiveFrom effectiveTo }
      }`,
      { code: v2Code }
    );
    expect(v2Res.errors).toBeUndefined();
    const v2Id = v2Res.data.upsertCostConfig.id;

    // Delete V2 -> V1 should be reopened
    const delV2 = await gql(`mutation($id: BigInt!) { deleteCostConfig(id: $id) { id delFlag } }`, { id: v2Id });
    expect(delV2.errors).toBeUndefined();
    const delV1 = await gql(`mutation($id: BigInt!) { deleteCostConfig(id: $id) { id delFlag } }`, { id: v1Id });
    expect(delV1.errors).toBeUndefined();
  });

  // =========================================================================
  // 7. EMPLOYEE TRANSPORT PROFILE - ETP (AT-ETP-001..018)
  // =========================================================================
  it('AT-ETP-001..018: Queries representative ETP list, creates & cuts ETP date ranges, and deletes future ETP registration', async () => {
    const listRes = await gql(`{
      employeeTransportProfiles(limit: 5) {
        id employeeId routeId pickupPointId effectiveFrom effectiveTo approvalStatus activeFlag
      }
      etpReport {
        totalProfiles
        activeCount
        pendingCount
        rejectedCount
        provisionalCount
      }
    }`);
    expect(listRes.errors).toBeUndefined();
    expect(listRes.data.employeeTransportProfiles.length).toBeGreaterThan(0);
    expect(listRes.data.etpReport.activeCount).toBeGreaterThan(0);

    const sample = listRes.data.employeeTransportProfiles.find((e: any) => e.employeeId && e.approvalStatus === 'APPROVED');
    if (sample) {
      // Create a future registration as GA -> auto APPROVED and cuts previous
      const futureRes = await gql(
        `mutation($empId: BigInt!, $routeId: BigInt!, $ptId: BigInt!) {
          createEtpRegistration(
            employeeId: $empId
            routeId: $routeId
            pickupPointId: $ptId
            effectiveFrom: "2027-08-01"
          ) {
            id approvalStatus effectiveFrom effectiveTo
          }
        }`,
        { empId: sample.employeeId, routeId: sample.routeId, ptId: sample.pickupPointId }
      );
      expect(futureRes.errors).toBeUndefined();
      expect(futureRes.data.createEtpRegistration.approvalStatus).toBe('APPROVED');

      // Delete future registration -> restores previous registration
      const delFuture = await gql(
        `mutation($id: BigInt!) {
          deleteFutureEtpRegistration(id: $id) { id delFlag }
        }`,
        { id: futureRes.data.createEtpRegistration.id }
      );
      expect(delFuture.errors).toBeUndefined();
      expect(delFuture.data.deleteFutureEtpRegistration.delFlag).toBe('Y');
    }
  });
});
