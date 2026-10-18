import type { ReactElement } from 'react'
import type { AdapterDescriptor } from '../diagnostics/port.ts'
import type { ResearchState } from '../domain/research.ts'
import type { Preferences } from '../domain/preferences.ts'
import {
  phaseOf,
  type SectionId,
  type SessionState,
  type VehicleSelection,
} from '../domain/session.ts'
import { SideNav } from './SideNav.tsx'
import { StatusBar } from './StatusBar.tsx'
import { ConnectionView } from './views/ConnectionView.tsx'
import { EcusView } from './views/EcusView.tsx'
import { HelpView } from './views/HelpView.tsx'
import { HomeView } from './views/HomeView.tsx'
import { LiveDataView } from './views/LiveDataView.tsx'
import { ReportsView } from './views/ReportsView.tsx'
import { SettingsView } from './views/SettingsView.tsx'
import { ResearchView, type ResearchActions } from './views/ResearchView.tsx'
import { TestsView } from './views/TestsView.tsx'
import { TroubleCodesView } from './views/TroubleCodesView.tsx'
import { VehicleView } from './views/VehicleView.tsx'

interface AppShellProps {
  session: SessionState
  research: ResearchState
  researchActions: ResearchActions
  preferences: Preferences
  adapters: readonly AdapterDescriptor[]
  recentVehicles: readonly VehicleSelection[]
  linking: boolean
  linkError: string | null
  onSelectSection: (section: SectionId) => void
  onSelectAdapter: (adapterId: string) => void
  onReleaseAdapter: () => void
  onConfirmLink: () => void
  onDisconnect: () => void
  onChooseVehicle: (vehicle: VehicleSelection) => void
  onSelectCode: (code: string) => void
  onToggleSignal: (signalId: string) => void
  onStartTest: () => void
  onConfirmTest: () => void
  onOpenReport: () => void
  onCloseReport: () => void
  onPreferences: (preferences: Preferences) => void
}

export function AppShell({
  session,
  research,
  researchActions,
  preferences,
  adapters,
  recentVehicles,
  linking,
  linkError,
  onSelectSection,
  onSelectAdapter,
  onReleaseAdapter,
  onConfirmLink,
  onDisconnect,
  onChooseVehicle,
  onSelectCode,
  onToggleSignal,
  onStartTest,
  onConfirmTest,
  onOpenReport,
  onCloseReport,
  onPreferences,
}: AppShellProps) {
  const phase = phaseOf(session)
  return (
    <div className="workshop-shell" data-collapsed={preferences.sidebarCollapsed ? 'true' : 'false'}>
      <SideNav section={session.section} collapsed={preferences.sidebarCollapsed} onSelect={onSelectSection} />
      <main className="workshop-main">
        {phase === 'online' ? <p className="session-banner">Simulated session</p> : null}
        {renderSection({
          session,
          research,
          researchActions,
          preferences,
          adapters,
          recentVehicles,
          linking,
          linkError,
          onSelectSection,
          onSelectAdapter,
          onReleaseAdapter,
          onConfirmLink,
          onChooseVehicle,
          onSelectCode,
          onToggleSignal,
          onStartTest,
          onConfirmTest,
          onOpenReport,
          onCloseReport,
          onPreferences,
        })}
      </main>
      <StatusBar session={session} onDisconnect={onDisconnect} />
    </div>
  )
}

function renderSection(props: Omit<AppShellProps, 'onDisconnect'>): ReactElement {
  const { session } = props
  switch (session.section) {
    case 'home':
      return <HomeView session={session} onOpenSection={props.onSelectSection} />
    case 'connection':
      return (
        <ConnectionView
          session={session}
          adapters={props.adapters}
          linking={props.linking}
          linkError={props.linkError}
          onSelectAdapter={props.onSelectAdapter}
          onReleaseAdapter={props.onReleaseAdapter}
          onConfirmLink={props.onConfirmLink}
        />
      )
    case 'vehicle':
      return (
        <VehicleView
          session={session}
          recentVehicles={props.recentVehicles}
          onChooseVehicle={props.onChooseVehicle}
        />
      )
    case 'ecus':
      return <EcusView session={session} />
    case 'trouble-codes':
      return <TroubleCodesView session={session} onSelectCode={props.onSelectCode} />
    case 'live-data':
      return <LiveDataView session={session} onToggleSignal={props.onToggleSignal} />
    case 'tests':
      return (
        <TestsView session={session} onStartTest={props.onStartTest} onConfirmTest={props.onConfirmTest} />
      )
    case 'research':
      return <ResearchView session={session} research={props.research} actions={props.researchActions} />
    case 'reports':
      return (
        <ReportsView session={session} onOpenReport={props.onOpenReport} onCloseReport={props.onCloseReport} />
      )
    case 'settings':
      return <SettingsView preferences={props.preferences} onChange={props.onPreferences} />
    case 'help':
      return <HelpView />
    default: {
      const unexpected: never = session.section
      throw new Error(`Unknown section ${String(unexpected)}`)
    }
  }
}
