export type QuickStatusType =
  | 'ON_THE_WAY'
  | 'FUEL_STOP'
  | 'FOOD_STOP'
  | 'BREAK'
  | 'RESTROOM'
  | 'STOPPED'
  | 'TRAFFIC'
  | 'VEHICLE_PROBLEM'
  | 'NEED_HELP'
  | 'BACK_ON_ROUTE';

export interface StatusUpdateRecord {
  id: string;
  uid: string;
  status: QuickStatusType;
  timestamp: number;
  note?: string;
}
