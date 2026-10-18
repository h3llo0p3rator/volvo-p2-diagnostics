import { describe, expect, it } from 'vitest'
import {
  LIVE_DATA_PROMPT,
  changeVehicle,
  closeStoredReport,
  confirmLink,
  confirmTest,
  controllerReadout,
  createSession,
  describePhase,
  disconnect,
  liveDataModel,
  openStoredReport,
  phaseOf,
  releaseAdapter,
  sectionIds,
  selectAdapter,
  selectTroubleCode,
  selectVehicle,
  setSection,
  startTest,
  testsAvailability,
  toggleSignal,
  troubleCodeReadout,
  type SessionSnapshot,
  type VehicleSelection,
} from './session.ts'
import {
  defaultPreferences,
  loadPreferences,
  preferenceKeys,
  resolveLanguage,
  savePreferences,
  type PreferenceStore,
} from './preferences.ts'
import { SIMULATED_ADAPTER_ID, createSimulatedAdapter } from '../diagnostics/simulatedAdapter.ts'

function memoryStore(): PreferenceStore {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

function sampleVehicle(): VehicleSelection {
  const [recent] = createSimulatedAdapter().listRecentVehicles()
  if (!recent) throw new Error('The simulated adapter has no recent vehicle.')
  return recent
}

function sampleSnapshot(): SessionSnapshot {
  return {
    controllers: [{ id: 'sim-unit-1', label: 'SIM powertrain controller' }],
    troubleCodes: [{ code: 'SIM-P1000', summary: 'Simulated sample fault' }],
    signals: [
      {
        id: 'sim-temp',
        label: 'SIM coolant sample',
        points: [
          { sequence: 1, reading: 70 },
          { sequence: 2, reading: 74 },
        ],
      },
    ],
  }
}

function withVehicle(state = createSession()) {
  return selectVehicle(selectAdapter(state, SIMULATED_ADAPTER_ID), sampleVehicle())
}

function online(snapshot: SessionSnapshot = sampleSnapshot()) {
  return confirmLink(withVehicle(), snapshot)
}

describe('session phases', () => {
  it('starts with no interface selected', () => {
    const state = createSession()
    expect(phaseOf(state)).toBe('no-interface')
    expect(state.section).toBe('home')
    expect(state.snapshot).toBeNull()
    expect(troubleCodeReadout(state)).toBe('needs-connection')
    expect(describePhase(phaseOf(state))).toBe('No interface selected')
  })

  it('describes every phase in plain language', () => {
    expect(describePhase('no-interface')).toBe('No interface selected')
    expect(describePhase('interface-ready')).toBe('Interface ready')
    expect(describePhase('vehicle-selected')).toBe('Vehicle selected, link not confirmed')
    expect(describePhase('online')).toBe('Online, simulated session')
    expect(describePhase('offline-session')).toMatch(/stored/i)
    expect(describePhase('offline-session')).toMatch(/not live/i)
  })
})

describe('selectAdapter', () => {
  it('becomes interface-ready when no vehicle is selected and does not invent codes', () => {
    const next = selectAdapter(createSession(), SIMULATED_ADAPTER_ID)
    expect(phaseOf(next)).toBe('interface-ready')
    expect(next.snapshot).toBeNull()
    expect(next.communicationConfirmed).toBe(false)
    expect(troubleCodeReadout(next)).toBe('needs-connection')
    expect(controllerReadout(next)).toBe('needs-connection')
  })

  it('becomes vehicle-selected when a vehicle is already stored', () => {
    const next = selectAdapter(selectVehicle(createSession(), sampleVehicle()), SIMULATED_ADAPTER_ID)
    expect(phaseOf(next)).toBe('vehicle-selected')
    expect(next.vehicle?.label).toBe('2007 Volvo XC70 D5')
    expect(next.snapshot).toBeNull()
    expect(troubleCodeReadout(next)).toBe('needs-connection')
  })

  it('drops an existing link instead of keeping sample codes', () => {
    const next = selectAdapter(online(), 'sim-other-interface')
    expect(next.selectedAdapterId).toBe('sim-other-interface')
    expect(next.communicationConfirmed).toBe(false)
    expect(next.snapshot).toBeNull()
    expect(phaseOf(next)).toBe('vehicle-selected')
    expect(troubleCodeReadout(next)).toBe('needs-connection')
  })

  it('ignores a blank adapter id', () => {
    const state = createSession()
    expect(selectAdapter(state, '   ')).toBe(state)
  })
})

describe('selectVehicle', () => {
  it('stores a vehicle without an adapter and stays offline', () => {
    const next = selectVehicle(createSession(), sampleVehicle())
    expect(phaseOf(next)).toBe('no-interface')
    expect(next.vehicle?.label).toBe('2007 Volvo XC70 D5')
    expect(next.vehicle?.identityText).toBe('VIN not read')
    expect(next.communicationConfirmed).toBe(false)
    expect(next.snapshot).toBeNull()
    expect(troubleCodeReadout(next)).toBe('needs-connection')
  })

  it('becomes vehicle-selected when an adapter is selected and the link is not confirmed', () => {
    const next = selectVehicle(selectAdapter(createSession(), SIMULATED_ADAPTER_ID), sampleVehicle())
    expect(phaseOf(next)).toBe('vehicle-selected')
    expect(next.snapshot).toBeNull()
  })

  it('stores a replacement label without clearing a confirmed link', () => {
    const state = online()
    const next = selectVehicle(state, {
      id: 'sim-standby',
      label: 'SIM standby vehicle',
      identityText: 'VIN not read',
    })
    expect(next.vehicle?.label).toBe('SIM standby vehicle')
    expect(next.communicationConfirmed).toBe(true)
    expect(next.snapshot).toBe(state.snapshot)
    expect(phaseOf(next)).toBe('online')
  })
})

describe('confirmLink', () => {
  it('does nothing until both an adapter and a vehicle are selected', () => {
    const snapshot = sampleSnapshot()
    const initial = createSession()
    const adapterOnly = selectAdapter(initial, SIMULATED_ADAPTER_ID)
    const vehicleOnly = selectVehicle(initial, sampleVehicle())
    expect(confirmLink(initial, snapshot)).toBe(initial)
    expect(confirmLink(adapterOnly, snapshot)).toBe(adapterOnly)
    expect(confirmLink(vehicleOnly, snapshot)).toBe(vehicleOnly)
  })

  it('moves online and attaches the snapshot for this session', () => {
    const snapshot = sampleSnapshot()
    const next = confirmLink(withVehicle(), snapshot)
    expect(phaseOf(next)).toBe('online')
    expect(next.communicationConfirmed).toBe(true)
    expect(next.snapshot?.troubleCodes[0]?.code).toBe('SIM-P1000')
    expect(troubleCodeReadout(next)).toBe('online-list')
    expect(controllerReadout(next)).toBe('online-list')
  })
})

describe('disconnect and releaseAdapter', () => {
  it('drops the live link, keeps the adapter and vehicle, and keeps saved reports', () => {
    const state = toggleSignal(online(), 'sim-temp')
    const next = disconnect(state)
    expect(next.selectedAdapterId).toBe(SIMULATED_ADAPTER_ID)
    expect(next.vehicle).toBe(state.vehicle)
    expect(next.communicationConfirmed).toBe(false)
    expect(next.snapshot).toBeNull()
    expect(next.testRun).toBeNull()
    expect(next.selectedSignalIds).toEqual(['sim-temp'])
    expect(phaseOf(next)).toBe('vehicle-selected')
    expect(next.reports).toBe(state.reports)
    expect(next.reports.map((report) => report.title)).toContain('Workshop notes')
    expect(troubleCodeReadout(next)).toBe('needs-connection')
  })

  it('returns to interface-ready when the live link drops and no vehicle is stored', () => {
    const state = selectAdapter(createSession(), SIMULATED_ADAPTER_ID)
    expect(phaseOf(disconnect(state))).toBe('interface-ready')
  })

  it('keeps an open report listed while the link is dropped', () => {
    const opened = openStoredReport(online())
    const next = disconnect(opened)
    expect(next.viewingStoredReport).toBe(true)
    expect(next.snapshot).toBeNull()
    expect(next.communicationConfirmed).toBe(false)
    expect(phaseOf(next)).toBe('offline-session')
    expect(next.reports).toBe(opened.reports)
    expect(phaseOf(closeStoredReport(next))).toBe('vehicle-selected')
  })

  it('releases the adapter, clears the link, and keeps the vehicle', () => {
    const state = online()
    const next = releaseAdapter(state)
    expect(next.selectedAdapterId).toBeNull()
    expect(next.vehicle).toBe(state.vehicle)
    expect(next.communicationConfirmed).toBe(false)
    expect(next.snapshot).toBeNull()
    expect(phaseOf(next)).toBe('no-interface')
    expect(next.reports).toBe(state.reports)
    expect(troubleCodeReadout(next)).toBe('needs-connection')
  })
})

describe('changeVehicle', () => {
  it('replaces the vehicle and leaves the online phase', () => {
    const pending = startTest(toggleSignal(selectTroubleCode(online(), 'SIM-P1000'), 'sim-temp')).state
    const running = confirmTest(pending)
    const next = changeVehicle(running, {
      id: 'sim-other',
      label: 'SIM other vehicle',
      identityText: 'VIN not read',
    })
    expect(next.vehicle?.label).toBe('SIM other vehicle')
    expect(next.communicationConfirmed).toBe(false)
    expect(next.snapshot).toBeNull()
    expect(next.selectedTroubleCodeId).toBeNull()
    expect(next.selectedSignalIds).toEqual([])
    expect(next.selectedTestId).toBeNull()
    expect(next.pendingTestConfirmation).toBe(false)
    expect(next.testRun).toBeNull()
    expect(phaseOf(next)).toBe('vehicle-selected')
  })

  it('clears a pending test confirmation', () => {
    const pending = startTest(online()).state
    expect(pending.pendingTestConfirmation).toBe(true)
    const next = changeVehicle(pending, {
      id: 'sim-other',
      label: 'SIM other vehicle',
      identityText: 'VIN not read',
    })
    expect(next.pendingTestConfirmation).toBe(false)
    expect(phaseOf(next)).toBe('vehicle-selected')
  })

  it('stays on no-interface when no adapter is selected', () => {
    const next = changeVehicle(selectVehicle(createSession(), sampleVehicle()), {
      id: 'sim-other',
      label: 'SIM other vehicle',
      identityText: 'VIN not read',
    })
    expect(phaseOf(next)).toBe('no-interface')
    expect(next.vehicle?.label).toBe('SIM other vehicle')
  })
})

describe('stored reports', () => {
  it('enters a stored session from any phase and restores the underlying phase', () => {
    const cases = [
      createSession(),
      selectAdapter(createSession(), SIMULATED_ADAPTER_ID),
      withVehicle(),
      online(),
    ]
    for (const state of cases) {
      const opened = openStoredReport(state)
      expect(phaseOf(opened)).toBe('offline-session')
      expect(opened.communicationConfirmed).toBe(state.communicationConfirmed)
      expect(opened.snapshot).toBe(state.snapshot)
      expect(opened.reports).toBe(state.reports)
      expect(liveDataModel(opened).availability).toBe('stored-session')
      expect(testsAvailability(opened)).toBe('stored-session')
      expect(liveDataModel(opened).chart).toEqual([])
      const closed = closeStoredReport(opened)
      expect(closed.viewingStoredReport).toBe(false)
      expect(closed.communicationConfirmed).toBe(state.communicationConfirmed)
      expect(phaseOf(closed)).toBe(phaseOf(state))
    }
  })

  it('keeps live actions disabled while a confirmed link is hidden behind a report', () => {
    const opened = openStoredReport(online())
    expect(opened.communicationConfirmed).toBe(true)
    const started = startTest(opened)
    expect(started.outcome).toBe('disabled')
    expect(started.state).toBe(opened)
    expect(confirmTest(opened)).toBe(opened)
    expect(phaseOf(closeStoredReport(opened))).toBe('online')
  })
})

describe('setSection', () => {
  it('changes the visible section in every phase', () => {
    const states = [
      createSession(),
      selectAdapter(createSession(), SIMULATED_ADAPTER_ID),
      withVehicle(),
      online(),
      openStoredReport(online()),
    ]
    for (const state of states) {
      for (const section of sectionIds) {
        const next = setSection(state, section)
        expect(next.section).toBe(section)
        expect(phaseOf(next)).toBe(phaseOf(state))
      }
    }
  })

  it('does not clear the session', () => {
    const state = confirmTest(startTest(toggleSignal(online(), 'sim-temp')).state)
    const next = setSection(state, 'settings')
    expect(next.section).toBe('settings')
    expect(next.selectedAdapterId).toBe(state.selectedAdapterId)
    expect(next.vehicle).toBe(state.vehicle)
    expect(next.communicationConfirmed).toBe(true)
    expect(next.snapshot).toBe(state.snapshot)
    expect(next.selectedSignalIds).toEqual(['sim-temp'])
    expect(next.testRun).toBe(state.testRun)
    expect(next.reports).toBe(state.reports)
    expect(next.viewingStoredReport).toBe(false)
    expect(phaseOf(next)).toBe('online')
  })
})

describe('tests', () => {
  it('returns a disabled outcome off the online phase and does not change phase', () => {
    const states = [
      createSession(),
      selectAdapter(createSession(), SIMULATED_ADAPTER_ID),
      withVehicle(),
      openStoredReport(createSession()),
    ]
    for (const state of states) {
      const started = startTest(state)
      expect(started.outcome).toBe('disabled')
      expect(started.state).toBe(state)
      expect(phaseOf(started.state)).toBe(phaseOf(state))
      expect(confirmTest(state)).toBe(state)
      expect(testsAvailability(state)).not.toBe('online')
    }
  })

  it('asks for confirmation online and records a simulated running test', () => {
    const state = online()
    const started = startTest(state)
    expect(started.outcome).toBe('confirmation-required')
    expect(phaseOf(started.state)).toBe('online')
    expect(started.state.testRun).toBeNull()
    expect(started.state.pendingTestConfirmation).toBe(true)
    expect(started.state.snapshot).toBe(state.snapshot)
    const running = confirmTest(started.state)
    expect(running.testRun).toEqual({
      id: 'sim-confirmation-sweep',
      label: 'SIM confirmation sweep',
      status: 'running',
    })
    expect(running.pendingTestConfirmation).toBe(false)
    expect(phaseOf(running)).toBe('online')
    expect(confirmTest(state).testRun?.status).toBe('running')
  })
})

describe('empty online results', () => {
  it('distinguishes an empty online snapshot from a missing connection', async () => {
    const adapter = createSimulatedAdapter('empty')
    await adapter.connect(SIMULATED_ADAPTER_ID)
    const snapshot: SessionSnapshot = {
      controllers: await adapter.readControllers(),
      troubleCodes: await adapter.readTroubleCodes(),
      signals: await adapter.readSignals(),
    }
    const prepared = withVehicle()
    const state = confirmLink(prepared, snapshot)
    expect(phaseOf(state)).toBe('online')
    expect(troubleCodeReadout(prepared)).toBe('needs-connection')
    expect(controllerReadout(prepared)).toBe('needs-connection')
    expect(troubleCodeReadout(state)).toBe('online-empty')
    expect(controllerReadout(state)).toBe('online-empty')
  })

  it('lets the simulated adapter switch to an empty snapshot after construction', async () => {
    const adapter = createSimulatedAdapter('sample')
    adapter.setSnapshotProfile('empty')
    await adapter.connect(SIMULATED_ADAPTER_ID)
    expect(await adapter.readControllers()).toEqual([])
    expect(await adapter.readTroubleCodes()).toEqual([])
    expect(await adapter.readSignals()).toEqual([])
  })

  it('treats an empty code list as online when controllers are present', () => {
    const state = confirmLink(withVehicle(), {
      controllers: [{ id: 'sim-unit-1', label: 'SIM powertrain controller' }],
      troubleCodes: [],
      signals: [],
    })
    expect(controllerReadout(state)).toBe('online-list')
    expect(troubleCodeReadout(state)).toBe('online-empty')
  })
})

describe('live data', () => {
  it('prompts for signals and then fills the chart with simulated points', () => {
    const state = online()
    const waiting = liveDataModel(state)
    expect(waiting.availability).toBe('online')
    expect(waiting.prompt).toBe(LIVE_DATA_PROMPT)
    expect(waiting.chart).toEqual([])
    const plotted = liveDataModel(toggleSignal(state, 'sim-temp'))
    expect(plotted.prompt).toBeNull()
    expect(plotted.chart).toHaveLength(1)
    expect(plotted.chart[0]?.points.length).toBeGreaterThan(0)
    expect(plotted.chart[0]?.label.startsWith('SIM')).toBe(true)
    const cleared = liveDataModel(toggleSignal(toggleSignal(state, 'sim-temp'), 'sim-temp'))
    expect(cleared.prompt).toBe(LIVE_DATA_PROMPT)
    expect(cleared.chart).toEqual([])
  })

  it('keeps the chart empty when the session is not online', () => {
    const selected = toggleSignal(withVehicle(), 'sim-temp')
    expect(liveDataModel(selected).availability).toBe('needs-connection')
    expect(liveDataModel(selected).chart).toEqual([])
    expect(liveDataModel(selected).prompt).toBeNull()
  })
})

describe('simulated adapter samples', () => {
  it('uses obvious sample text and does not invent a VIN', async () => {
    const adapter = createSimulatedAdapter()
    expect(adapter.listRecentVehicles()[0]).toMatchObject({
      label: '2007 Volvo XC70 D5',
      identityText: 'VIN not read',
    })
    await expect(adapter.readTroubleCodes()).rejects.toThrow(/not connected/i)
    await adapter.connect(SIMULATED_ADAPTER_ID)
    const packed = JSON.stringify({
      adapters: await adapter.listAdapters(),
      identity: await adapter.readIdentity(),
      recent: adapter.listRecentVehicles(),
      controllers: await adapter.readControllers(),
      codes: await adapter.readTroubleCodes(),
      signals: await adapter.readSignals(),
    })
    expect(packed).toContain('SIM-')
    expect(packed).toContain('VIN not read')
    expect(packed).toContain('2007 Volvo XC70 D5')
    expect(packed).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)
    await expect(adapter.connect('missing-adapter')).rejects.toThrow(/not recognized/i)
  })
})

describe('language and preferences', () => {
  it('falls back to en-US for an unknown language code', () => {
    expect(resolveLanguage('de-DE')).toBe('en-US')
    expect(resolveLanguage('en-us')).toBe('en-US')
    expect(resolveLanguage(null)).toBe('en-US')
    expect(resolveLanguage(undefined)).toBe('en-US')
    expect(resolveLanguage('')).toBe('en-US')
  })

  it('keeps the four supported preference codes', () => {
    for (const code of ['en-US', 'cs-CZ', 'pl-PL', 'sv-SE'] as const) {
      expect(resolveLanguage(code)).toBe(code)
    }
  })

  it('persists language, sidebar collapse, and the companion monitor flag', () => {
    const store = memoryStore()
    expect(loadPreferences(store)).toEqual(defaultPreferences())
    savePreferences(store, {
      language: 'sv-SE',
      sidebarCollapsed: true,
      startCompanionMonitor: true,
    })
    expect(loadPreferences(store)).toEqual({
      language: 'sv-SE',
      sidebarCollapsed: true,
      startCompanionMonitor: true,
    })
    savePreferences(store, {
      language: 'pl-PL',
      sidebarCollapsed: false,
      startCompanionMonitor: false,
    })
    expect(loadPreferences(store)).toEqual({
      language: 'pl-PL',
      sidebarCollapsed: false,
      startCompanionMonitor: false,
    })
    expect(store.getItem(preferenceKeys.language)).toBe('pl-PL')
    expect(store.getItem(preferenceKeys.sidebarCollapsed)).toBe('false')
    expect(store.getItem(preferenceKeys.startCompanionMonitor)).toBe('false')
  })

  it('falls back when a stored language code is unknown', () => {
    const store = memoryStore()
    store.setItem(preferenceKeys.language, 'fr-FR')
    expect(loadPreferences(store).language).toBe('en-US')
    savePreferences(store, {
      language: 'en-US',
      sidebarCollapsed: false,
      startCompanionMonitor: true,
    })
    store.setItem(preferenceKeys.language, 'no-NO')
    expect(loadPreferences(store)).toEqual({
      language: 'en-US',
      sidebarCollapsed: false,
      startCompanionMonitor: true,
    })
  })
})
