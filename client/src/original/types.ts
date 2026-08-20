export type RiskStatus = 'normal' | 'caution' | 'high' | 'insufficient'

export interface RiskState {
  status: RiskStatus
  weatherReason?: string
  vmsReason?: string
  observedAt: string
}

export interface ReliabilityState {
  label: '근거 충분' | '일부 구간 추정' | '확인 필요'
  detail: string
}

export type Workload = 'busy' | 'relaxed'

export type VehiclePreset = 'two-axle' | 'three-axle' | 'special'

export interface VehicleSpecs {
  height: number // m
  length: number // m
  width: number // m
  weight: number // tons
  axleload: number // tons
  fuelEfficiency: number // km/L
  hazmat: boolean
}

export interface PlanInputs {
  origin: string
  originCoordinates?: [number, number]
  destination: string
  destinationCoordinates?: [number, number]
  arrivalTime: string
  workload: Workload
  vehiclePreset: VehiclePreset
  vehicleSpecs?: VehicleSpecs
}

export type RouteKind = 'base' | 'time' | 'cost'

export interface RouteOption {
  id: RouteKind
  title: string
  shortTitle: string
  departure: string
  duration: string
  durationMinutes?: number
  distanceKm?: number
  cost: string
  directCost?: { amountKrw: number | null; reliability: string; note: string }
  delta: string
  reason: string
  statusText: string
  portPatternApplied?: boolean
  geometryCoordinates?: [number, number][]
}

export type AppScreen = 'dashboard' | 'compare' | 'in-trip'
