# Endpoint Mapping: Legacy REST (Go) → New GraphQL (Pothos)

> Tổng hợp 156 REST endpoints từ `backend/trms-service/internal/adapter/in/http/router.go` sang GraphQL Schema mới tại `apps/api`.

## 1. Auth, Org Units & Settings
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `POST /auth/login` | — | `login(username, password)` | Mutation |
| `GET /auth/me` | — | `me` | Query |
| `GET /trms/org-units` | `FR-ORG-UNIT-000` | `orgUnits` | Query |
| `GET /user/general-config/*` | — | `settings` | Query |
| `PUT /user/general-config/*` | `ADMIN` | `upsertSetting` | Mutation |

## 2. Dashboard (`registerDashboardRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/dashboard/snapshot` | `FR-DASHBOARD-000` | `dashboardStats` | Query |
| `GET /trms/dashboard/stats` | `FR-DASHBOARD-001` | `dashboardStats` | Query |

## 3. Master Data: Points (`registerPointRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/points` | `FR-POINT-000` | `points` | Query |
| `GET /trms/points/:id` | `FR-POINT-001` | `point(id)` | Query |
| `GET /trms/points/:id/segment-usages` | `FR-POINT-001` | `point.segmentUsageCount` | Query Field |
| `POST /trms/points` | `FR-POINT-002` | `createPoint` | Mutation |
| `PUT\|PATCH /trms/points/:id` | `FR-POINT-003` | `updatePoint` | Mutation |
| `DELETE /trms/points/:id` | `FR-POINT-004` | `deletePoint` | Mutation |

## 4. Master Data: Drivers & Driver Journey (`registerDriverRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/drivers` | `FR-DRIVER-000` | `drivers` | Query |
| `GET /trms/drivers/:id` | `FR-DRIVER-001` | `driver(id)` | Query |
| `GET /trms/drivers/:id/segment-usages` | `FR-DRIVER-001` | `driver.segmentUsageCount` | Query Field |
| `POST /trms/drivers` | `FR-DRIVER-002` | `createDriver` | Mutation |
| `POST /trms/drivers/:id/restore` | `FR-DRIVER-002` | `restoreDriver` | Mutation |
| `PUT\|PATCH /trms/drivers/:id` | `FR-DRIVER-003` | `updateDriver` | Mutation |
| `DELETE /trms/drivers/:id` | `FR-DRIVER-004` | `deleteDriver` | Mutation |
| `GET /trms/driver/me` | `FR-DRIVER-JOURNEY-000` | `me` / `driverTrips` | Query |
| `GET /trms/driver/trips` | `FR-DRIVER-JOURNEY-000` | `driverTrips` | Query |
| `GET /trms/driver/trips/:id` | `FR-DRIVER-JOURNEY-001` | `trip(id)` | Query |
| `POST /trms/driver/trips/:id/confirm` | `FR-DRIVER-JOURNEY-002` | `confirmTrip` | Mutation |
| `POST /trms/driver/trips/:id/start` | `FR-DRIVER-JOURNEY-003` | `startTrip` | Mutation |
| `POST /trms/driver/trips/:id/complete` | `FR-DRIVER-JOURNEY-004` | `completeTrip` | Mutation |

## 5. Master Data: Vehicles (`registerVehicleRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/vehicles` | `FR-VEHICLE-000` | `vehicles` | Query |
| `GET /trms/vehicles/available` | `FR-REQUEST-010` | `availableVehicles` | Query |
| `GET /trms/vehicles/:id` | `FR-VEHICLE-001` | `vehicle(id)` | Query |
| `GET /trms/vehicles/:id/segment-usages` | `FR-VEHICLE-001` | `vehicle.segmentUsageCount` | Query Field |
| `GET /trms/vehicles/:id/timeline-trips` | `FR-VEHICLE-010` | `trips(vehicleId)` | Query |
| `POST /trms/vehicles` | `FR-VEHICLE-002` | `createVehicle` | Mutation |
| `PUT\|PATCH /trms/vehicles/:id` | `FR-VEHICLE-003` | `updateVehicle` | Mutation |
| `DELETE /trms/vehicles/:id` | `FR-VEHICLE-004` | `deleteVehicle` | Mutation |

## 6. Master Data: Leg Definitions & Routes (`registerLegDefinitionRoutes`, `registerRouteRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/leg-definitions` | `FR-LEG-DEFINITION-000` | `legDefinitions` | Query |
| `POST /trms/leg-definitions` | `FR-LEG-DEFINITION-002` | `createLegDefinition` | Mutation |
| `PUT\|PATCH /trms/leg-definitions/:id` | `FR-LEG-DEFINITION-003` | `updateLegDefinition` | Mutation |
| `DELETE /trms/leg-definitions/:id` | `FR-LEG-DEFINITION-004` | `deleteLegDefinition` | Mutation |
| `GET /trms/routes` | `FR-ROUTE-000` | `routes` | Query |
| `GET /trms/routes/:id` | `FR-ROUTE-000` | `route(id)` | Query |
| `POST /trms/routes` | `FR-ROUTE-001` | `createRoute` | Mutation |
| `PUT\|PATCH /trms/routes/:id` | `FR-ROUTE-002` | `updateRoute` | Mutation |
| `DELETE /trms/routes/:id` | `FR-ROUTE-003` | `deleteRoute` | Mutation |
| `GET /trms/routes/:id/segments` | `FR-ROUTE-SEGMENT-000` | `route.segments` | Query Field |
| `PUT /trms/routes/:id/segments` | `FR-ROUTE-SEGMENT-001` | `updateRouteSegments` | Mutation |

## 7. Employee Transport Profiles — ETP (`registerEmployeeTransportProfileRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/employee-transport-profiles` | `FR-EMP-TRANSPORT-000` | `employeeTransportProfiles` | Query |
| `GET /trms/employee-transport-profiles/report` | `FR-EMP-TRANSPORT-000` | `etpReport` | Query |
| `GET /trms/employee-transport-profiles/:id/registrations` | `FR-EMP-TRANSPORT-002` | `employeeTransportRegistrations` | Query |
| `POST /trms/employee-transport-profiles` | `FR-EMP-TRANSPORT-003` | `createEtpRegistration` | Mutation |
| `POST /trms/employee-transport-profiles/:id/registrations` | `FR-EMP-TRANSPORT-006` | `createEtpRegistration` | Mutation |
| `POST /trms/employee-transport-profiles/:id/registrations/deactivate` | `FR-EMP-TRANSPORT-007` | `deactivateEtpRegistration` | Mutation |
| `POST /trms/employee-transport-profiles/:id/registrations/:regId/approve` | `FR-EMP-TRANSPORT-011` | `approveEtpRegistration` | Mutation |
| `POST /trms/employee-transport-profiles/:id/registrations/reject-open` | `FR-EMP-TRANSPORT-012` | `rejectOpenEtpRegistrations` | Mutation |
| `POST /trms/employee-transport-profiles/:id/registrations/:regId/reject` | `FR-EMP-TRANSPORT-012` | `rejectEtpRegistration` | Mutation |
| `DELETE /trms/employee-transport-profiles/:id/registrations/:regId` | `FR-EMP-TRANSPORT-006` | `deleteFutureEtpRegistration` | Mutation |
| `POST /trms/employee-transport-profiles/provisional` | `FR-EMP-TRANSPORT-003` | `createProvisionalEtp` | Mutation |
| `POST /trms/employee-transport-profiles/provisional/:tempCode/link` | `FR-EMP-TRANSPORT-006` | `linkProvisionalEtp` | Mutation |

## 8. Shifts (`registerShiftRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/shifts` | `FR-SHIFT-000` | `shifts` | Query |
| `PATCH /trms/shifts/:id/transport-flag` | `FR-SHIFT-002` | `updateShiftTransportFlag` | Mutation |
| `GET /trms/shifts/registrations` | `FR-SHIFT-001` | `shiftRegistrations` | Query |

## 9. Transport Requests & OT (`registerRequestRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/requests` | `FR-REQUEST-001` | `transportRequests` | Query |
| `GET /trms/requests/:id` | `FR-REQUEST-002` | `transportRequest(id)` | Query |
| `GET /trms/requests/ot-shift-options` | `FR-REQUEST-003` | `otShiftOptions(date)` | Query |
| `POST /trms/requests` | `FR-REQUEST-003` | `createTransportRequest` | Mutation |
| `POST /trms/requests/bulk-ot` | `FR-REQUEST-003` | `createBulkOtRequests` | Mutation |
| `PUT /trms/requests/:id` | `FR-REQUEST-004` | `updateTransportRequest` | Mutation |
| `PUT /trms/requests/:id/ga-edit` | `FR-REQUEST-013` | `gaEditTransportRequest` | Mutation |
| `POST /trms/requests/:id/cancel` | `FR-REQUEST-005` | `cancelTransportRequest` | Mutation |
| `POST /trms/requests/:id/approve` | `FR-REQUEST-012`/`013` | `approveTransportRequest` | Mutation |
| `POST /trms/requests/:id/approve-taxi` | `FR-REQUEST-013` | `approveTaxiRequest` | Mutation |
| `POST /trms/requests/:id/reject` | `FR-REQUEST-012`/`013` | `rejectTransportRequest` | Mutation |
| `POST /trms/requests/:id/return` | `FR-REQUEST-012`/`013` | `returnTransportRequest` | Mutation |
| `POST /trms/requests/bulk-approve` | `FR-REQUEST-012`/`013` | `bulkApproveRequests` | Mutation |
| `POST /trms/requests/bulk-reject` | `FR-REQUEST-012`/`013` | `bulkRejectRequests` | Mutation |
| `POST /trms/requests/:id/dispatch` | `FR-REQUEST-009` | `dispatchRequest` | Mutation |
| `POST /trms/requests/bulk-dispatch` | `FR-REQUEST-009` | `bulkDispatchRequests` | Mutation |

## 10. Trips, Commute Dispatch & Vehicle Status (`registerTripRoutes`, `registerCommuteDispatchRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/trips` | `FR-TRIP-000` | `trips` | Query |
| `GET /trms/trips/:id` | `FR-TRIP-001` | `trip(id)` | Query |
| `POST /trms/trips/:id/confirm` | `FR-TRIP-002` | `confirmTrip` | Mutation |
| `POST /trms/trips/:id/start` | `FR-TRIP-003` | `startTrip` | Mutation |
| `POST /trms/trips/:id/complete` | `FR-TRIP-004` | `completeTrip` | Mutation |
| `PATCH /trms/trips/:id/actual-km` | `FR-TRIP-005` | `updateTripActualKm` | Mutation |
| `POST /trms/trips/:id/reassign-vehicle` | `FR-TRIP-006` | `reassignTripVehicle` | Mutation |
| `POST /trms/trips/:id/cancel` | `FR-REQUEST-009` | `cancelTrip` | Mutation |
| `POST /trms/trips/:id/attach-requests` | `FR-REQUEST-009` | `attachRequestsToTrip` | Mutation |
| `POST /trms/trips/:id/detach-requests` | `FR-REQUEST-009` | `detachRequestsFromTrip` | Mutation |
| `GET /trms/vehicle-statuses` | `FR-VEHICLE-STATUS-000` | `vehicleStatuses` | Query |
| `GET /trms/commute-dispatches` | `FR-COMMUTE-DISPATCH-000` | `commuteDispatches` | Query |
| `POST /trms/commute-dispatches/routes/:id/legs/:leg/supplement-trips` | `FR-COMMUTE-DISPATCH-002` | `createSupplementTrip` | Mutation |
| `POST /trms/commute-dispatches/versions/:id/assignments` | `FR-COMMUTE-DISPATCH-003` | `createPlanAssignment` | Mutation |
| `PATCH /trms/commute-dispatches/versions/:id/assignments/:aid` | `FR-COMMUTE-DISPATCH-003` | `updatePlanAssignment` | Mutation |
| `DELETE /trms/commute-dispatches/versions/:id/assignments/:aid` | `FR-COMMUTE-DISPATCH-003` | `cancelPlanAssignment` | Mutation |
| `POST /trms/commute-dispatches/versions/:id/finalize` | `FR-COMMUTE-DISPATCH-005` | `finalizePlan` | Mutation |

## 11. Cost Config, Cost Reports & Audit (`registerCostAuditImportRoutes`, `registerTaskRoutes`)
| Legacy REST Endpoint | Feature Code | GraphQL Operation | Loại |
|---|---|---|---|
| `GET /trms/cost-configs` | `FR-COST-CONFIG-000` | `costConfigs` | Query |
| `POST /trms/cost-configs` | `FR-COST-CONFIG-001` | `upsertCostConfig` | Mutation |
| `DELETE /trms/cost-configs/:id` | `FR-COST-CONFIG-001` | `deleteCostConfig` | Mutation |
| `GET /trms/cost-reports/daily` | `FR-COST-REPORT-000` | `costRecords` | Query |
| `POST /trms/cost-reports/daily/recalculate` | `FR-COST-REPORT-003` | `recalculateDailyCosts` | Mutation |
| `GET /trms/cost-reports/vehicle-bills` | `FR-COST-REPORT-001` | `vehicleBills` | Query |
| `GET /trms/cost-reports/monthly-payments` | `FR-COST-REPORT-002` | `monthlyPayments` / `monthlyPayment` | Query |
| `POST /trms/cost-reports/monthly-payments/recalculate` | `FR-COST-REPORT-004` | `recalculateMonthlyCosts` | Mutation |
| `GET /trms/audit-logs` | `FR-AUDIT-000` | `auditLogs` | Query |
| `POST /trms/tasks/sync/vehicle-status` | Internal Task | `runSyncVehicleStatus` | Mutation |
| `POST /trms/tasks/auto-complete-trips` | Internal Task | `runAutoCompleteTrips` | Mutation |
| `POST /trms/tasks/create-commute-plan` | Internal Task | `runCreateCommutePlan` | Mutation |
