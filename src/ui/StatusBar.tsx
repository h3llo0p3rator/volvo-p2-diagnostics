import { describePhase, phaseOf, type SessionState } from '../domain/session.ts'

interface StatusBarProps {
  session: SessionState
  onDisconnect: () => void
}

export function StatusBar({ session, onDisconnect }: StatusBarProps) {
  const phase = phaseOf(session)
  return (
    <footer className="workshop-status" data-phase={phase} role="status">
      <p className="status-phase">{describePhase(phase)}</p>
      {session.vehicle ? <p className="status-vehicle">{session.vehicle.label}</p> : null}
      {phase === 'online' ? (
        <button type="button" onClick={onDisconnect}>
          Disconnect
        </button>
      ) : null}
    </footer>
  )
}
