import { troubleCodeReadout, type SessionState } from '../../domain/session.ts'
import { EmptyNotice } from '../EmptyNotice.tsx'

interface TroubleCodesViewProps {
  session: SessionState
  onSelectCode: (code: string) => void
}

export function TroubleCodesView({ session, onSelectCode }: TroubleCodesViewProps) {
  const readout = troubleCodeReadout(session)
  return (
    <section>
      <h1>Trouble codes</h1>
      {readout === 'needs-connection' ? (
        <EmptyNotice>A connection is required before trouble codes can be read.</EmptyNotice>
      ) : null}
      {readout === 'stored-session' ? (
        <EmptyNotice>A stored report is open. Live trouble-code reads are paused.</EmptyNotice>
      ) : null}
      {readout === 'online-empty' ? (
        <EmptyNotice>The session is online and returned no trouble codes.</EmptyNotice>
      ) : null}
      {readout === 'online-list' && session.snapshot ? (
        <ul className="code-list">
          {session.snapshot.troubleCodes.map((row) => (
            <li key={row.code}>
              <button
                type="button"
                aria-pressed={session.selectedTroubleCodeId === row.code}
                onClick={() => onSelectCode(row.code)}
              >
                {row.code}
              </button>
              <span>{row.summary}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
