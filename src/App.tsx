import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdapterDescriptor } from './diagnostics/port.ts'
import { createSimulatedAdapter } from './diagnostics/simulatedAdapter.ts'
import { defaultPreferences, loadPreferences, savePreferences, type Preferences } from './domain/preferences.ts'
import {
  attachImport,
  checkCompatibility,
  clearResearchReadings,
  commitBackup,
  createResearch,
  formatResearchReport,
  planRecovery,
  prepareImport,
  refuseWrite,
  researchViewModel,
  selectHexSlot,
  setHexPage,
  setResearchReadings,
  sha256Hex,
  toggleDpfVariants,
  type ImportSlot,
} from './domain/research.ts'
import {
  changeVehicle,
  closeStoredReport,
  confirmLink,
  confirmTest,
  createSession,
  disconnect,
  openStoredReport,
  phaseOf,
  releaseAdapter,
  selectAdapter,
  selectTroubleCode,
  selectVehicle,
  setSection,
  startTest,
  toggleSignal,
  type SectionId,
  type SessionState,
  type VehicleSelection,
} from './domain/session.ts'
import { AppShell } from './ui/AppShell.tsx'
import type { ResearchActions } from './ui/views/ResearchView.tsx'

export function App() {
  const [port] = useState(createSimulatedAdapter)
  const [session, setSession] = useState(createSession)
  const [research, setResearch] = useState(createResearch)
  const [preferences, setPreferences] = useState(readStoredPreferences)
  const [adapters, setAdapters] = useState<readonly AdapterDescriptor[]>([])
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const sessionRef = useRef(session)
  const researchRef = useRef(research)
  sessionRef.current = session
  researchRef.current = research
  const recentVehicles = useMemo(() => port.listRecentVehicles(), [port])

  useEffect(() => {
    let active = true
    void port.listAdapters().then((rows) => {
      if (active) setAdapters(rows)
    })
    return () => {
      active = false
    }
  }, [port])

  function onConfirmLink() {
    const current = sessionRef.current
    if (current.selectedAdapterId === null || current.vehicle === null || current.communicationConfirmed) return
    const adapterId = current.selectedAdapterId
    setLinking(true)
    setLinkError(null)
    void readLink(adapterId)
  }

  async function readLink(adapterId: string) {
    try {
      await port.connect(adapterId)
      const [controllers, troubleCodes, signals, identity, egr, dpf, moduleIdentity] = await Promise.all([
        port.readControllers(),
        port.readTroubleCodes(),
        port.readSignals(),
        port.readIdentity(),
        port.readEgr(),
        port.readDpf(),
        port.readResearchIdentity(),
      ])
      setResearch((prev) =>
        setResearchReadings(prev, {
          softwareId: moduleIdentity.softwareId,
          result: moduleIdentity.result,
          egrSensor: egr.sensor,
          egrVvt: egr.vvt,
          dpfLevel: dpf.level,
          dpfLevelText: dpf.levelText,
          dpfReadiness: dpf.readiness,
        }),
      )
      setSession((prev) => {
        if (prev.selectedAdapterId === null || prev.vehicle === null) return prev
        const next: SessionState = {
          ...prev,
          vehicle: { ...prev.vehicle, identityText: identity.text },
        }
        return confirmLink(next, { controllers, troubleCodes, signals })
      })
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'The simulated link did not confirm.')
    } finally {
      setLinking(false)
    }
  }

  const researchActions: ResearchActions = {
    onImport: (slot: ImportSlot, name: string, bytes: Uint8Array) => {
      void prepareImport(name, bytes).then((image) => {
        setResearch((prev) => attachImport(prev, slot, image))
      })
    },
    onSelectHexSlot: (slot) => setResearch((prev) => selectHexSlot(prev, slot)),
    onHexPage: (page) => setResearch((prev) => setHexPage(prev, page)),
    onToggleDpfVariants: () => setResearch((prev) => toggleDpfVariants(prev)),
    onStoreBackup: () => {
      void (async () => {
        if (phaseOf(sessionRef.current) !== 'online') return
        const image = await port.currentSimulatedImage()
        if (phaseOf(sessionRef.current) !== 'online') return
        const hash = await sha256Hex(image)
        if (phaseOf(sessionRef.current) !== 'online') return
        setResearch((prev) => commitBackup(prev, image, hash))
      })()
    },
    onCheckCompatibility: () => setResearch((prev) => checkCompatibility(prev)),
    onWriteFirmware: () => setResearch((prev) => refuseWrite(prev)),
    onPlanRecovery: () => setResearch((prev) => planRecovery(prev)),
    onExportReport: () => {
      const currentSession = sessionRef.current
      const currentResearch = researchRef.current
      const model = researchViewModel(phaseOf(currentSession), currentResearch, currentSession.vehicle)
      const files = [currentResearch.images.a, currentResearch.images.b].flatMap((image) =>
        image ? [{ name: image.name, sha256: image.sha256 }] : [],
      )
      downloadReport(
        formatResearchReport({
          vehicleLabel: model.identification.vehicleLabel,
          vinText: model.identification.vinText,
          softwareId: model.identification.softwareId,
          engineFamily: model.identification.engineFamily,
          identificationResult: model.identification.result,
          log: currentResearch.log,
          files,
        }),
      )
    },
  }

  return (
    <AppShell
      session={session}
      research={research}
      researchActions={researchActions}
      preferences={preferences}
      adapters={adapters}
      recentVehicles={recentVehicles}
      linking={linking}
      linkError={linkError}
      onSelectSection={(section: SectionId) => setSession((prev) => setSection(prev, section))}
      onSelectAdapter={(adapterId) => setSession((prev) => selectAdapter(prev, adapterId))}
      onReleaseAdapter={() => {
        setSession((prev) => releaseAdapter(prev))
        setResearch((prev) => clearResearchReadings(prev))
        void port.disconnect()
      }}
      onConfirmLink={onConfirmLink}
      onDisconnect={() => {
        setSession((prev) => disconnect(prev))
        setResearch((prev) => clearResearchReadings(prev))
        void port.disconnect()
      }}
      onChooseVehicle={(vehicle: VehicleSelection) =>
        setSession((prev) => {
          if (prev.vehicle && prev.vehicle.id !== vehicle.id) return changeVehicle(prev, vehicle)
          if (prev.vehicle) return prev
          return selectVehicle(prev, vehicle)
        })
      }
      onSelectCode={(code) => setSession((prev) => selectTroubleCode(prev, code))}
      onToggleSignal={(signalId) => setSession((prev) => toggleSignal(prev, signalId))}
      onStartTest={() => setSession((prev) => startTest(prev).state)}
      onConfirmTest={() => setSession((prev) => confirmTest(prev))}
      onOpenReport={() => setSession((prev) => openStoredReport(prev))}
      onCloseReport={() => setSession((prev) => closeStoredReport(prev))}
      onPreferences={(next) => {
        setPreferences(next)
        try {
          savePreferences(localStorage, next)
        } catch {
          // Keep the in-memory choice when storage is unavailable.
        }
      }}
    />
  )
}

function downloadReport(text: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ecu-research.txt'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function readStoredPreferences(): Preferences {
  try {
    return loadPreferences(localStorage)
  } catch {
    return defaultPreferences()
  }
}
