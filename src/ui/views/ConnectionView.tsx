import type { AdapterDescriptor } from '../../diagnostics/port.ts'
import { phaseOf, type LinkPhase, type SessionState } from '../../domain/session.ts'

interface ConnectionViewProps {
  session: SessionState
  adapters: readonly AdapterDescriptor[]
  linking: boolean
  linkError: string | null
  onSelectAdapter: (adapterId: string) => void
  onReleaseAdapter: () => void
  onConfirmLink: () => void
}

export function ConnectionView({
  session,
  adapters,
  linking,
  linkError,
  onSelectAdapter,
  onReleaseAdapter,
  onConfirmLink,
}: ConnectionViewProps) {
  const phase = phaseOf(session)
  const canConfirm = session.selectedAdapterId !== null && session.vehicle !== null && !session.communicationConfirmed
  return (
    <section>
      <h1>Connection</h1>
      <p>{connectionSummary(phase)}</p>
      {adapters.length === 0 ? <p>Checking for a simulated interface.</p> : null}
      <ul className="choice-list">
        {adapters.map((adapter) => (
          <li key={adapter.id}>
            <button
              type="button"
              aria-pressed={session.selectedAdapterId === adapter.id}
              onClick={() => onSelectAdapter(adapter.id)}
            >
              {adapter.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="shortcut-row">
        {canConfirm ? (
          <button type="button" onClick={onConfirmLink} disabled={linking}>
            Confirm link
          </button>
        ) : null}
        {session.selectedAdapterId ? (
          <button type="button" onClick={onReleaseAdapter}>
            Release interface
          </button>
        ) : null}
      </div>
      {linkError ? <p className="panel">{linkError}</p> : null}
    </section>
  )
}

function connectionSummary(phase: LinkPhase): string {
  switch (phase) {
    case 'no-interface':
      return 'Choose an interface. Nothing is connected.'
    case 'interface-ready':
      return 'This interface is ready. Choose a vehicle before confirming the link.'
    case 'vehicle-selected':
      return 'The vehicle is selected and the link is not confirmed.'
    case 'online':
      return 'A simulated session is active on this interface.'
    case 'offline-session':
      return 'A stored report is open. Live reads stay paused until it is closed.'
  }
}
