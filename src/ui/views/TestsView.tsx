import { testsAvailability, type SessionState } from '../../domain/session.ts'
import { EmptyNotice } from '../EmptyNotice.tsx'

interface TestsViewProps {
  session: SessionState
  onStartTest: () => void
  onConfirmTest: () => void
}

export function TestsView({ session, onStartTest, onConfirmTest }: TestsViewProps) {
  const availability = testsAvailability(session)
  return (
    <section>
      <h1>Tests</h1>
      {availability === 'needs-connection' ? (
        <EmptyNotice>A connection is required before a test can start.</EmptyNotice>
      ) : null}
      {availability === 'stored-session' ? (
        <EmptyNotice>Tests are turned off while a stored report is open.</EmptyNotice>
      ) : null}
      {availability === 'online' ? (
        <div className="panel">
          {session.testRun ? <p>{session.testRun.label} is running.</p> : null}
          {session.pendingTestConfirmation ? (
            <p>Confirmation is required before the simulated test can run.</p>
          ) : null}
          {!session.testRun && !session.pendingTestConfirmation ? (
            <button type="button" onClick={onStartTest}>
              Start test
            </button>
          ) : null}
          {session.pendingTestConfirmation ? (
            <button type="button" onClick={onConfirmTest}>
              Confirm test
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
