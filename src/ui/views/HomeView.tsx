import { describePhase, phaseOf, type SectionId, type SessionState } from '../../domain/session.ts'

const SHORTCUTS: readonly { id: SectionId; label: string }[] = [
  { id: 'connection', label: 'Connection' },
  { id: 'ecus', label: 'ECUs' },
  { id: 'trouble-codes', label: 'Trouble codes' },
  { id: 'live-data', label: 'Live data' },
]

interface HomeViewProps {
  session: SessionState
  onOpenSection: (section: SectionId) => void
}

export function HomeView({ session, onOpenSection }: HomeViewProps) {
  const phase = phaseOf(session)
  return (
    <section>
      <h1>Home</h1>
      <div className="panel">
        <p>Link: {describePhase(phase)}</p>
        {session.vehicle ? (
          <>
            <p>{session.vehicle.label}</p>
            <p>{session.vehicle.identityText}</p>
            <p>{vehicleSummary(phase)}</p>
          </>
        ) : (
          <p>Choose a vehicle to begin.</p>
        )}
      </div>
      <div className="shortcut-row">
        {SHORTCUTS.map((shortcut) => (
          <button key={shortcut.id} type="button" onClick={() => onOpenSection(shortcut.id)}>
            {shortcut.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function vehicleSummary(phase: ReturnType<typeof phaseOf>): string {
  if (phase === 'online') return 'The simulated link is confirmed.'
  if (phase === 'offline-session') return 'A stored report is open, so this is not a live link.'
  return 'Selected on this workstation, not online.'
}
