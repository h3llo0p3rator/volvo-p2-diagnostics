export const sectionIds = [
  'home',
  'connection',
  'vehicle',
  'ecus',
  'trouble-codes',
  'live-data',
  'tests',
  'research',
  'reports',
  'settings',
  'help',
] as const

export type SectionId = (typeof sectionIds)[number]

export type LinkPhase =
  | 'no-interface'
  | 'interface-ready'
  | 'vehicle-selected'
  | 'online'
  | 'offline-session'

export interface VehicleSelection {
  id: string
  label: string
  identityText: string
}

export interface ControllerRow {
  id: string
  label: string
}

export interface TroubleCodeRow {
  code: string
  summary: string
}

export interface SignalPoint {
  sequence: number
  reading: number
}

export interface SignalRow {
  id: string
  label: string
  points: readonly SignalPoint[]
}

export interface SessionSnapshot {
  controllers: readonly ControllerRow[]
  troubleCodes: readonly TroubleCodeRow[]
  signals: readonly SignalRow[]
}

export interface StoredReport {
  id: string
  title: string
  body: string
}

export interface TestRun {
  id: string
  label: string
  status: 'running'
}

export interface SessionState {
  selectedAdapterId: string | null
  vehicle: VehicleSelection | null
  communicationConfirmed: boolean
  viewingStoredReport: boolean
  section: SectionId
  snapshot: SessionSnapshot | null
  reports: readonly StoredReport[]
  selectedTroubleCodeId: string | null
  selectedSignalIds: readonly string[]
  selectedTestId: string | null
  pendingTestConfirmation: boolean
  testRun: TestRun | null
}

export interface TestStartResult {
  state: SessionState
  outcome: 'disabled' | 'confirmation-required'
}

export type ReadoutKind = 'needs-connection' | 'online-empty' | 'online-list' | 'stored-session'

export interface ChartSeries {
  id: string
  label: string
  points: readonly SignalPoint[]
}

export interface LiveDataModel {
  availability: 'needs-connection' | 'stored-session' | 'online'
  prompt: string | null
  chart: readonly ChartSeries[]
}

export type TestsAvailability = 'needs-connection' | 'stored-session' | 'online'

export const LIVE_DATA_PROMPT = 'Pick signals to plot on the chart.'

const WORKSHOP_NOTES: StoredReport = {
  id: 'workshop-notes',
  title: 'Workshop notes',
  body: 'Notes kept by P2 Diagnostics on this workstation. They are not a live link.',
}

const SIMULATED_TEST_RUN: TestRun = {
  id: 'sim-confirmation-sweep',
  label: 'SIM confirmation sweep',
  status: 'running',
}

const PHASE_TEXT: Record<LinkPhase, string> = {
  'no-interface': 'No interface selected',
  'interface-ready': 'Interface ready',
  'vehicle-selected': 'Vehicle selected, link not confirmed',
  online: 'Online, simulated session',
  'offline-session': 'Stored session, not live',
}

export function createSession(): SessionState {
  return {
    selectedAdapterId: null,
    vehicle: null,
    communicationConfirmed: false,
    viewingStoredReport: false,
    section: 'home',
    snapshot: null,
    reports: [WORKSHOP_NOTES],
    selectedTroubleCodeId: null,
    selectedSignalIds: [],
    selectedTestId: null,
    pendingTestConfirmation: false,
    testRun: null,
  }
}

export function describePhase(phase: LinkPhase): string {
  return PHASE_TEXT[phase]
}

export function phaseOf(state: SessionState): LinkPhase {
  if (state.viewingStoredReport) return 'offline-session'
  if (state.selectedAdapterId === null) return 'no-interface'
  if (state.communicationConfirmed && state.snapshot !== null) return 'online'
  if (state.vehicle === null) return 'interface-ready'
  return 'vehicle-selected'
}

export function selectAdapter(state: SessionState, adapterId: string): SessionState {
  const id = adapterId.trim()
  if (id.length === 0) return state
  return {
    ...state,
    selectedAdapterId: id,
    communicationConfirmed: false,
    snapshot: null,
    pendingTestConfirmation: false,
    testRun: null,
  }
}

export function selectVehicle(state: SessionState, vehicle: VehicleSelection): SessionState {
  return {
    ...state,
    vehicle: { ...vehicle },
  }
}

export function confirmLink(state: SessionState, snapshot: SessionSnapshot): SessionState {
  if (state.selectedAdapterId === null || state.vehicle === null) return state
  return {
    ...state,
    communicationConfirmed: true,
    snapshot: copySnapshot(snapshot),
  }
}

export function disconnect(state: SessionState): SessionState {
  return {
    ...state,
    communicationConfirmed: false,
    snapshot: null,
    pendingTestConfirmation: false,
    testRun: null,
  }
}

export function releaseAdapter(state: SessionState): SessionState {
  return {
    ...disconnect(state),
    selectedAdapterId: null,
  }
}

export function changeVehicle(state: SessionState, vehicle: VehicleSelection): SessionState {
  return {
    ...state,
    vehicle: { ...vehicle },
    communicationConfirmed: false,
    snapshot: null,
    selectedTroubleCodeId: null,
    selectedSignalIds: [],
    selectedTestId: null,
    pendingTestConfirmation: false,
    testRun: null,
  }
}

export function openStoredReport(state: SessionState): SessionState {
  if (state.viewingStoredReport) return state
  return { ...state, viewingStoredReport: true }
}

export function closeStoredReport(state: SessionState): SessionState {
  if (!state.viewingStoredReport) return state
  return { ...state, viewingStoredReport: false }
}

export function setSection(state: SessionState, section: SectionId): SessionState {
  if (state.section === section) return state
  return { ...state, section }
}

export function selectTroubleCode(state: SessionState, code: string | null): SessionState {
  return { ...state, selectedTroubleCodeId: code }
}

export function toggleSignal(state: SessionState, signalId: string): SessionState {
  const selected = state.selectedSignalIds.includes(signalId)
  return {
    ...state,
    selectedSignalIds: selected
      ? state.selectedSignalIds.filter((id) => id !== signalId)
      : [...state.selectedSignalIds, signalId],
  }
}

export function startTest(state: SessionState): TestStartResult {
  if (phaseOf(state) !== 'online') return { state, outcome: 'disabled' }
  return {
    state: { ...state, pendingTestConfirmation: true },
    outcome: 'confirmation-required',
  }
}

export function confirmTest(state: SessionState): SessionState {
  if (phaseOf(state) !== 'online') return state
  return {
    ...state,
    pendingTestConfirmation: false,
    selectedTestId: SIMULATED_TEST_RUN.id,
    testRun: SIMULATED_TEST_RUN,
  }
}

export function controllerReadout(state: SessionState): ReadoutKind {
  return readout(state, state.snapshot?.controllers.length ?? null)
}

export function troubleCodeReadout(state: SessionState): ReadoutKind {
  return readout(state, state.snapshot?.troubleCodes.length ?? null)
}

export function liveDataModel(state: SessionState): LiveDataModel {
  const phase = phaseOf(state)
  if (phase === 'offline-session') {
    return { availability: 'stored-session', prompt: null, chart: [] }
  }
  if (phase !== 'online' || state.snapshot === null) {
    return { availability: 'needs-connection', prompt: null, chart: [] }
  }
  const chart = state.snapshot.signals
    .filter((signal) => state.selectedSignalIds.includes(signal.id))
    .map((signal) => ({
      id: signal.id,
      label: signal.label,
      points: signal.points,
    }))
  if (chart.length === 0) {
    return { availability: 'online', prompt: LIVE_DATA_PROMPT, chart: [] }
  }
  return { availability: 'online', prompt: null, chart }
}

export function testsAvailability(state: SessionState): TestsAvailability {
  const phase = phaseOf(state)
  if (phase === 'offline-session') return 'stored-session'
  if (phase !== 'online') return 'needs-connection'
  return 'online'
}

function readout(state: SessionState, count: number | null): ReadoutKind {
  const phase = phaseOf(state)
  if (phase === 'offline-session') return 'stored-session'
  if (phase !== 'online' || count === null) return 'needs-connection'
  return count === 0 ? 'online-empty' : 'online-list'
}

function copySnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return {
    controllers: snapshot.controllers.map((row) => ({ ...row })),
    troubleCodes: snapshot.troubleCodes.map((row) => ({ ...row })),
    signals: snapshot.signals.map((signal) => ({
      ...signal,
      points: signal.points.map((point) => ({ ...point })),
    })),
  }
}
