import type { SessionState } from '../../domain/session.ts'

interface ReportsViewProps {
  session: SessionState
  onOpenReport: () => void
  onCloseReport: () => void
}

export function ReportsView({ session, onOpenReport, onCloseReport }: ReportsViewProps) {
  const openReport = session.viewingStoredReport ? session.reports[0] : undefined
  return (
    <section>
      <h1>Reports</h1>
      <p>Open a stored report to review it. Live data and tests stay off while it is open.</p>
      <ul className="choice-list">
        {session.reports.map((report) => (
          <li key={report.id}>
            <button type="button" onClick={onOpenReport}>
              {report.title}
            </button>
          </li>
        ))}
      </ul>
      {openReport ? (
        <article className="panel">
          <h2>{openReport.title}</h2>
          <p>{openReport.body}</p>
          <button type="button" onClick={onCloseReport}>
            Close report
          </button>
        </article>
      ) : null}
    </section>
  )
}
