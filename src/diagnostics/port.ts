import type { ControllerRow, SignalRow, TroubleCodeRow } from '../domain/session.ts'

export interface AdapterDescriptor {
  id: string
  label: string
}

export interface VehicleIdentity {
  text: string
}

export interface DiagnosticPort {
  listAdapters(): Promise<readonly AdapterDescriptor[]>
  connect(adapterId: string): Promise<void>
  disconnect(): Promise<void>
  readIdentity(): Promise<VehicleIdentity>
  readControllers(): Promise<readonly ControllerRow[]>
  readTroubleCodes(): Promise<readonly TroubleCodeRow[]>
  readSignals(): Promise<readonly SignalRow[]>
}
