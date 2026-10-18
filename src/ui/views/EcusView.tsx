import { controllerReadout, type SessionState } from '../../domain/session.ts'
import { EmptyNotice } from '../EmptyNotice.tsx'

interface EcusViewProps {
  session: SessionState
}

export function EcusView({ session }: EcusViewProps) {
  const readout = controllerReadout(session)
  return (
    <section>
      <h1>ECUs</h1>
      {readout === 'needs-connection' ? (
        <EmptyNotice>A connection is required before ECUs can be listed.</EmptyNotice>
      ) : null}
      {readout === 'stored-session' ? (
        <EmptyNotice>A stored report is open. Live ECU reads are paused.</EmptyNotice>
      ) : null}
      {readout === 'online-empty' ? (
        <EmptyNotice>The session is online and returned no ECUs.</EmptyNotice>
      ) : null}
      {readout === 'online-list' && session.snapshot ? (
        <ul className="choice-list">
          {session.snapshot.controllers.map((row) => (
            <li key={row.id}>{row.label}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
