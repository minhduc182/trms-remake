export const POINT_TYPES = ['PICKUP', 'DROPOFF', 'BOTH'] as const;
export type PointType = (typeof POINT_TYPES)[number];

export const VEHICLE_TYPES = ['VAN_16', 'BUS_29', 'BUS_45', 'SEDAN_4', 'SUV_7', 'TRUCK', 'TAXI'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_CAPACITY_BY_TYPE: Record<string, number> = {
  VAN_16: 15,
  BUS_29: 28,
  BUS_45: 44,
  SEDAN_4: 4,
  SUV_7: 7,
  TRUCK: 2,
  TAXI: 4,
};

export const OWNERSHIP_TYPES = ['COMPANY', 'RENTAL', 'TAXI', 'GOODS'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const COMMUTE_PACKAGE_MODES = ['BASE_RENTAL', 'BY_SEGMENT'] as const;
export type CommutePackageMode = (typeof COMMUTE_PACKAGE_MODES)[number];

export const PASSENGER_TYPES = ['STAFF', 'WORKER'] as const;
export type PassengerType = (typeof PASSENGER_TYPES)[number];

export const LEG_DIRECTIONS = ['TO_FACTORY', 'FROM_FACTORY'] as const;
export type LegDirection = (typeof LEG_DIRECTIONS)[number];

export const ROUTE_RUN_DAYS = ['MON_FRI', 'MON_SAT', 'SAT_ONLY', 'MON_SUN'] as const;
export type RouteRunDays = (typeof ROUTE_RUN_DAYS)[number];

export const ETP_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type EtpApprovalStatus = (typeof ETP_APPROVAL_STATUSES)[number];

export const REQUEST_TYPES = ['BUSINESS', 'OVERTIME', 'GOODS', 'SPECIAL', 'FIXED_ROUTE'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const TRIP_MODES = ['ONE_WAY', 'ROUND_TRIP'] as const;
export type TripMode = (typeof TRIP_MODES)[number];

export const REQUEST_STATUSES = [
  'PENDING_DEPARTMENT',
  'PENDING_GA',
  'PENDING_GA_DEPARTMENT',
  'RETURNED',
  'REJECTED',
  'CANCELLED',
  'APPROVED_TAXI',
  'WAITING_VENDOR_DISPATCH',
  'WAITING_DRIVER_CONFIRM',
  'IN_PROGRESS',
  'WAITING_DISTANCE_INPUT',
  'COMPLETED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TRIP_STATUSES = [
  'PLANNED',
  'DISPATCHED',
  'DRIVER_CONFIRMED',
  'IN_PROGRESS',
  'WAITING_DISTANCE_INPUT',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const VEHICLE_RUNTIME_STATUSES = [
  'AVAILABLE',
  'NOT_AVAILABLE',
  'ON_FIXED_ROUTE',
  'ON_SPECIAL_ASSIGNMENT',
] as const;
export type VehicleRuntimeStatus = (typeof VEHICLE_RUNTIME_STATUSES)[number];

export const COST_CONFIG_TYPES = ['COMMUTE', 'EXTRA'] as const;
export type CostConfigType = (typeof COST_CONFIG_TYPES)[number];
