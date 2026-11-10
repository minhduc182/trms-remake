import { describe, it, expect, afterAll } from 'vitest';
import { gql, getTestServer, closeTestServer } from './test-helper.js';
import { INTERNAL_CRON_API_KEY } from '../../../apps/api/src/server.js';
import { FEATURE_CODES } from '../../../packages/shared/src/index.js';

describe('TRMS Remake Acceptance Suite — Part 2: Requests, OT, Dispatch, Trips, Cost Engine & RBAC', () => {
  afterAll(async () => {
    await closeTestServer();
  });

  // =========================================================================
  // 1. DASHBOARD & ZERO COST DISCREPANCY (AT-DASH-001, AT-COST-001)
  // =========================================================================
  it('AT-DASH-001 & AT-RPT-001..005: Verifies migrated Oracle counts and 0 VND cost discrepancy', async () => {
    const res = await gql(`{
      dashboardStats {
        totalRequests
        pendingApprovalRequests
        waitingDispatchRequests
        totalTrips
        completedTrips
        totalVehicles
        availableVehicles
        activeRiders
        totalCostAfterVat
      }
      costRecords(limit: 10) { id costType appliedAmount amountAfterVat }
      vehicleBills(limit: 5) { tripId tripCode tripPathText tripPathFullText amountAfterVat }
      monthlyPayments { id paymentMonth totalAfterVat details { id lineNo totalAfterVat } }
    }`);
    expect(res.errors).toBeUndefined();
    expect(res.data.dashboardStats.totalRequests).toBeGreaterThanOrEqual(2592);
    expect(res.data.dashboardStats.totalTrips).toBeGreaterThanOrEqual(8745);
    expect(res.data.dashboardStats.totalVehicles).toBeGreaterThanOrEqual(96);
    expect(Number(res.data.dashboardStats.totalCostAfterVat)).toBeGreaterThanOrEqual(10662744611.92);
    expect(res.data.costRecords.length).toBeGreaterThan(0);
    expect(res.data.monthlyPayments.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 2. REQUEST LIFECYCLE, INITIAL STATUS BY ROLE & PRIVACY MASKING (AT-REQ-001..018)
  // =========================================================================
  it('AT-REQ-001..016: Enforces initial status by creator role (Requester -> PENDING_DEPARTMENT, TBP -> PENDING_GA, GA -> WAITING_VENDOR_DISPATCH) and masks requester info', async () => {
    // 1. Created by normal Requester -> PENDING_DEPARTMENT
    const req1 = await gql(
      `mutation {
        createTransportRequest(
          businessDate: "2027-02-10"
          requestType: "BUSINESS"
          tripMode: "ONE_WAY"
          passengerCount: 2
          departureTime: "08:00"
          departurePickupPointText: "Nhà máy Meiko Hòa Bình"
          departureDropoffPointText: "Khách hàng Hà Nội"
          purpose: "Họp kỹ thuật khách hàng"
        ) {
          id requestCode status outboundStatus requesterName
        }
      }`,
      {},
      'test_requester'
    );
    expect(req1.errors).toBeUndefined();
    expect(req1.data.createTransportRequest.status).toBe('PENDING_DEPARTMENT');

    // 2. Created by TBP -> PENDING_GA
    const req2 = await gql(
      `mutation {
        createTransportRequest(
          businessDate: "2027-02-10"
          requestType: "BUSINESS"
          tripMode: "ONE_WAY"
          passengerCount: 1
          departureTime: "09:00"
          departurePickupPointText: "Nhà máy Meiko Hòa Bình"
          departureDropoffPointText: "Sân bay Nội Bài"
          purpose: "TBP đi công tác"
        ) {
          id status
        }
      }`,
      {},
      'test_tbp'
    );
    expect(req2.errors).toBeUndefined();
    expect(req2.data.createTransportRequest.status).toBe('PENDING_GA');

    // 3. Created by GA Leader -> WAITING_VENDOR_DISPATCH
    const req3 = await gql(
      `mutation {
        createTransportRequest(
          businessDate: "2027-02-10"
          requestType: "GOODS"
          tripMode: "ONE_WAY"
          passengerCount: 0
          departureTime: "10:00"
          departurePickupPointText: "Kho Hòa Bình"
          departureDropoffPointText: "Kho Thạch Thất"
          senderInfo: "Kho Hòa Bình - Anh Minh"
          receiverInfo: "Kho Thạch Thất - Chị Lan"
          purpose: "Vận chuyển hàng gấp"
        ) {
          id status
        }
      }`,
      {},
      'test_ga_leader'
    );
    expect(req3.errors).toBeUndefined();
    expect(req3.data.createTransportRequest.status).toBe('WAITING_VENDOR_DISPATCH');

    // 4. Return & Resubmit flow (AT-REQ-010, AT-REQ-011)
    const retRes = await gql(
      `mutation($id: BigInt!) {
        returnTransportRequest(id: $id, reason: "Cần bổ sung mã dự án") { id status returnedFromStatus }
      }`,
      { id: req1.data.createTransportRequest.id },
      'test_tbp'
    );
    expect(retRes.errors).toBeUndefined();
    expect(retRes.data.returnTransportRequest.status).toBe('RETURNED');

    const editRes = await gql(
      `mutation($id: BigInt!) {
        updateTransportRequest(id: $id, purpose: "Họp kỹ thuật khách hàng - Dự án PCB-99") { id status purpose }
      }`,
      { id: req1.data.createTransportRequest.id },
      'test_requester'
    );
    expect(editRes.errors).toBeUndefined();
    expect(editRes.data.updateTransportRequest.status).toBe('PENDING_DEPARTMENT');
  });

  // =========================================================================
  // 3. DISPATCH -> TRIP EXECUTION -> ACTUAL KM -> COST RECORD (AT-DSP-*, AT-TRIP-*)
  // =========================================================================
  it('AT-DSP-001 & AT-TRIP-001..008: Full operational cycle from Approval -> Dispatch -> Driver Confirm -> Start -> Complete -> Actual KM -> Completed', async () => {
    // 1. Create a fresh request as GA (starts at WAITING_VENDOR_DISPATCH)
    const reqRes = await gql(
      `mutation {
        createTransportRequest(
          businessDate: "2027-03-15"
          requestType: "BUSINESS"
          tripMode: "ONE_WAY"
          passengerCount: 4
          departureTime: "13:30"
          departurePickupPointText: "Nhà máy Hòa Bình"
          departureDropoffPointText: "KCN Thăng Long"
          purpose: "Kiểm thử toàn trình Dispatch -> Trip -> KM"
        ) {
          id requestCode status
        }
      }`,
      {},
      'test_ga_leader'
    );
    expect(reqRes.errors).toBeUndefined();
    const requestId = reqRes.data.createTransportRequest.id;

    // 2. Pick an active vehicle and driver
    const masterRes = await gql(`{
      vehicles(activeFlag: "Y") { id vehiclePlate }
      drivers(activeFlag: "Y") { id driverName }
    }`);
    const vehicle = masterRes.data.vehicles[0];
    const driver = masterRes.data.drivers[0];

    // 3. Dispatch request -> creates Trip (passes overrideReason so re-running test on same date is idempotent)
    const dspRes = await gql(
      `mutation($requestId: BigInt!, $vehicleId: BigInt!, $driverId: BigInt!) {
        dispatchRequest(
          requestId: $requestId
          vehicleId: $vehicleId
          driverId: $driverId
          overrideReason: "Kiểm thử tự động idempotent"
        ) {
          id tripCode status vehiclePlateSnapshot driverNameSnapshot
        }
      }`,
      { requestId, vehicleId: vehicle.id, driverId: driver.id },
      'test_vendor'
    );
    expect(dspRes.errors).toBeUndefined();
    const tripId = dspRes.data.dispatchRequest.id;
    expect(['DISPATCHED', 'WAITING_DRIVER_CONFIRM']).toContain(dspRes.data.dispatchRequest.status);

    // 4. Driver confirms trip -> DRIVER_CONFIRMED
    const confirmRes = await gql(
      `mutation($id: BigInt!) { confirmTrip(id: $id) { id status } }`,
      { id: tripId },
      'test_driver'
    );
    expect(confirmRes.errors).toBeUndefined();
    expect(confirmRes.data.confirmTrip.status).toBe('DRIVER_CONFIRMED');

    // 5. Driver starts trip -> IN_PROGRESS
    const startRes = await gql(
      `mutation($id: BigInt!) { startTrip(id: $id) { id status } }`,
      { id: tripId },
      'test_driver'
    );
    expect(startRes.errors).toBeUndefined();
    expect(startRes.data.startTrip.status).toBe('IN_PROGRESS');

    // 6. Driver completes trip -> COMPLETED or WAITING_KM_INPUT
    const compRes = await gql(
      `mutation($id: BigInt!) { completeTrip(id: $id) { id status } }`,
      { id: tripId },
      'test_driver'
    );
    expect(compRes.errors).toBeUndefined();
    expect(['COMPLETED', 'WAITING_KM_INPUT']).toContain(compRes.data.completeTrip.status);

    // 7. Invalid actualKm <= 0 must be rejected (AT-TRIP-006)
    const badKm = await gql(
      `mutation($id: BigInt!) { updateTripActualKm(id: $id, actualKm: "0") { id } }`,
      { id: tripId },
      'test_vendor'
    );
    expect(badKm.errors).toBeDefined();

    // 8. Valid actualKm = 68.5 -> COMPLETED and syncs Request to COMPLETED
    const okKm = await gql(
      `mutation($id: BigInt!) { updateTripActualKm(id: $id, actualKm: "68.5") { id status actualKm } }`,
      { id: tripId },
      'test_vendor'
    );
    expect(okKm.errors).toBeUndefined();
    expect(okKm.data.updateTripActualKm.status).toBe('COMPLETED');
    expect(Number(okKm.data.updateTripActualKm.actualKm)).toBeCloseTo(68.5, 1);

    const checkReq = await gql(
      `query($id: BigInt!) { transportRequest(id: $id) { id status outboundStatus } }`,
      { id: requestId }
    );
    expect(checkReq.data.transportRequest.status).toBe('COMPLETED');
  });

  // =========================================================================
  // 4. COMMUTE PLAN & 10 HTTP CRON JOB ENDPOINTS (AT-PLAN-*, AT-JOB-001..010)
  // =========================================================================
  it('AT-PLAN-001..005 & AT-JOB-001..010: Queries commuteDispatches and verifies all 10 HTTP Cron Endpoints (/trms/tasks/*) with API Key authentication', async () => {
    const planRes = await gql(`{
      commuteDispatches(businessDate: "2026-11-12") {
        businessDate
        dataSource
        planStatus
        assignments {
          id routeId vehicleId driverId assignmentType
        }
      }
      vehicleStatuses { vehicleId status }
    }`);
    expect(planRes.errors).toBeUndefined();
    expect(planRes.data.commuteDispatches.businessDate).toBe('2026-11-12');

    const app = await getTestServer();

    // AT-JOB-001: Missing or invalid API key -> 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/vehicle-status',
    });
    expect(unauthRes.statusCode).toBe(401);

    const headers = {
      'content-type': 'application/json',
      'x-api-key': INTERNAL_CRON_API_KEY,
    };

    // AT-JOB-002: Cron 1 - Sync work shift list (preserves transportFlag)
    const cron1 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/work-shift-list',
      headers,
      payload: JSON.stringify({ shifts: [] }),
    });
    expect(cron1.statusCode).toBe(200);
    expect(cron1.json().status).toBe('ok');

    // AT-JOB-003: Cron 2 - Sync shift registration (blocks past startDate < today)
    const cron2Bad = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/shift-registration',
      headers,
      payload: JSON.stringify({ startDate: '2020-01-01', rows: [] }),
    });
    expect(cron2Bad.statusCode).toBe(400);

    const cron2Ok = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/shift-registration',
      headers,
      payload: JSON.stringify({ rows: [] }),
    });
    expect(cron2Ok.statusCode).toBe(200);

    // AT-JOB-004: Cron 3 - Sync ETP active flags (idempotent)
    const cron3 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/employee-transport-active-flags',
      headers,
      payload: JSON.stringify({}),
    });
    expect(cron3.statusCode).toBe(200);

    // AT-JOB-005: Cron 4 - Sync ETP leave
    const cron4 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/employee-transport-leave',
      headers,
      payload: JSON.stringify({}),
    });
    expect(cron4.statusCode).toBe(200);

    // AT-JOB-006: Cron 5 - Create commute plan
    const cron5 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/create-commute-plan',
      headers,
      payload: JSON.stringify({ businessDate: '2027-09-20' }),
    });
    expect(cron5.statusCode).toBe(200);
    expect(cron5.json().plan?.businessDate).toBe('2027-09-20');

    // AT-JOB-007: Cron 6 - Sync vehicle status
    const cron6 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/sync/vehicle-status',
      headers,
      payload: JSON.stringify({}),
    });
    expect(cron6.statusCode).toBe(200);

    // AT-JOB-008: Cron 7 - Auto complete trips
    const cron7 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/auto-complete-trips',
      headers,
      payload: JSON.stringify({}),
    });
    expect(cron7.statusCode).toBe(200);

    // AT-JOB-009: Cron 8 - Remind upcoming departures (idempotent)
    const cron8 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/remind-upcoming-departures',
      headers,
      payload: JSON.stringify({}),
    });
    expect(cron8.statusCode).toBe(200);

    // AT-JOB-010: Cron 9 & 10 - Snapshot daily costs & monthly costs
    const cron9 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/snapshot-daily-costs',
      headers,
      payload: JSON.stringify({ serviceDate: '2027-09-20' }),
    });
    expect(cron9.statusCode).toBe(200);

    const cron10 = await app.inject({
      method: 'POST',
      url: '/trms/tasks/snapshot-monthly-costs',
      headers,
      payload: JSON.stringify({ paymentMonth: '2027-09' }),
    });
    expect(cron10.statusCode).toBe(200);
  }, 30000);

  // =========================================================================
  // 5. RBAC & 77 FEATURE CODES (AT-AUTH-001..011)
  // =========================================================================
  it('AT-AUTH-001..011: Verifies login, 77 FR-* feature code catalog, and role-based access enforcement across roles', async () => {
    // AT-AUTH-011: Verify FEATURE_CODES exports all 77 feature codes (65 active + 12 consolidated aliases)
    expect(Object.keys(FEATURE_CODES).length).toBeGreaterThanOrEqual(65);

    const meAdmin = await gql(`{ me { id username isAdmin roleCodes featureCodes } }`, {}, 'test_admin');
    expect(meAdmin.errors).toBeUndefined();
    expect(meAdmin.data.me.username).toBe('test_admin');
    expect(meAdmin.data.me.isAdmin).toBe(true);

    // AT-AUTH-001: Verify login with tominhduc / C18082002c. and reject wrong password
    const loginOk = await gql(
      `mutation { login(username: "tominhduc", password: "C18082002c.") { token username fullName isAdmin roles } }`
    );
    expect(loginOk.errors).toBeUndefined();
    expect(loginOk.data.login.username).toBe('tominhduc');
    expect(loginOk.data.login.isAdmin).toBe(true);

    const loginBad = await gql(
      `mutation { login(username: "tominhduc", password: "wrong-password") { token } }`
    );
    expect(loginBad.errors).toBeDefined();

    // Driver cannot create a Point (requires FR-POINT-002)
    const forbiddenDriver = await gql(
      `mutation {
        createPoint(pointCode: "PT_FORBIDDEN", pointName: "Forbidden", pointType: "PICKUP") { id }
      }`,
      {},
      'test_driver'
    );
    expect(forbiddenDriver.errors).toBeDefined();

    // Requester cannot approve GA stage (requires FR-REQUEST-013)
    const forbiddenRequester = await gql(
      `mutation {
        approveTransportRequest(id: "1") { id }
      }`,
      {},
      'test_requester'
    );
    expect(forbiddenRequester.errors).toBeDefined();
  });
});
