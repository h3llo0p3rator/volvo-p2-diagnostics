import type { ControllerRow, SignalRow, TroubleCodeRow, VehicleSelection } from '../domain/session.ts'
import { SIMULATED_SOFTWARE_ID, buildSimulatedImage } from '../domain/research.ts'
import type { AdapterDescriptor, DiagnosticPort } from './port.ts'
import type { ResearchPort } from './researchPort.ts'

export const SIMULATED_ADAPTER_ID = 'sim-bench-link'

export type SnapshotProfile = 'sample' | 'empty'

export interface SimulatedAdapter extends DiagnosticPort, ResearchPort {
  setSnapshotProfile(profile: SnapshotProfile): void
  listRecentVehicles(): readonly VehicleSelection[]
}

const ADAPTERS: readonly AdapterDescriptor[] = [
  { id: SIMULATED_ADAPTER_ID, label: 'Simulated bench interface' },
]

const RECENT_VEHICLES: readonly VehicleSelection[] = [
  {
    id: 'recent-2007-xc70-d5',
    label: '2007 Volvo XC70 D5',
    identityText: 'VIN not read',
  },
]

const SAMPLE_CONTROLLERS: readonly ControllerRow[] = [
  { id: 'sim-unit-1', label: 'SIM powertrain controller' },
  { id: 'sim-unit-2', label: 'SIM cabin controller' },
]

const SAMPLE_CODES: readonly TroubleCodeRow[] = [
  {
    code: 'SIM-P1000',
    summary: 'Simulated sample fault, not read from a vehicle',
  },
]

const SAMPLE_SIGNALS: readonly SignalRow[] = [
  {
    id: 'sim-temp',
    label: 'SIM coolant sample',
    points: [
      { sequence: 1, reading: 70 },
      { sequence: 2, reading: 74 },
      { sequence: 3, reading: 79 },
    ],
  },
  {
    id: 'sim-speed',
    label: 'SIM speed sample',
    points: [
      { sequence: 1, reading: 12 },
      { sequence: 2, reading: 18 },
      { sequence: 3, reading: 16 },
    ],
  },
]

export function createSimulatedAdapter(initial: SnapshotProfile = 'sample'): SimulatedAdapter {
  let profile = initial
  let connected = false
  let simulatedImage: Promise<Uint8Array> | null = null

  return {
    setSnapshotProfile(next) {
      profile = next
    },
    listRecentVehicles() {
      return RECENT_VEHICLES.map((vehicle) => ({ ...vehicle }))
    },
    async listAdapters() {
      return ADAPTERS.map((adapter) => ({ ...adapter }))
    },
    async connect(adapterId) {
      if (adapterId !== SIMULATED_ADAPTER_ID) {
        throw new Error('Simulated adapter id was not recognized.')
      }
      connected = true
    },
    async disconnect() {
      connected = false
    },
    async readIdentity() {
      assertConnected()
      return { text: 'VIN not read' }
    },
    async readControllers() {
      assertConnected()
      if (profile === 'empty') return []
      return SAMPLE_CONTROLLERS.map((row) => ({ ...row }))
    },
    async readTroubleCodes() {
      assertConnected()
      if (profile === 'empty') return []
      return SAMPLE_CODES.map((row) => ({ ...row }))
    },
    async readSignals() {
      assertConnected()
      if (profile === 'empty') return []
      return SAMPLE_SIGNALS.map((signal) => ({
        ...signal,
        points: signal.points.map((point) => ({ ...point })),
      }))
    },
    async readResearchIdentity() {
      assertConnected()
      return {
        softwareId: SIMULATED_SOFTWARE_ID,
        engineFamily: 'Not identified' as const,
        result: 'Simulated identity only' as const,
        simulated: true as const,
      }
    },
    async readEgr() {
      assertConnected()
      return { sensor: '0.18', vvt: '12', simulated: true as const }
    },
    async readDpf() {
      assertConnected()
      const level = 2
      return {
        level,
        levelText: String(level),
        readiness: 'Incomplete' as const,
        simulated: true as const,
      }
    },
    async currentSimulatedImage() {
      simulatedImage ??= buildSimulatedImage()
      const image = await simulatedImage
      return image.slice()
    },
  }

  function assertConnected(): void {
    if (!connected) throw new Error('Simulated adapter is not connected.')
  }
}
