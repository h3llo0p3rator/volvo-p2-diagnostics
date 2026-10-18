import { liveDataModel, type SessionState, type SignalPoint } from '../../domain/session.ts'
import { EmptyNotice } from '../EmptyNotice.tsx'

const STROKES = ['#d5dee6', '#7f9eae']

interface LiveDataViewProps {
  session: SessionState
  onToggleSignal: (signalId: string) => void
}

export function LiveDataView({ session, onToggleSignal }: LiveDataViewProps) {
  const model = liveDataModel(session)
  return (
    <section>
      <h1>Live data</h1>
      {model.availability === 'needs-connection' ? (
        <EmptyNotice>A connection is required before live data can be shown.</EmptyNotice>
      ) : null}
      {model.availability === 'stored-session' ? (
        <EmptyNotice>Live data is turned off for a stored session.</EmptyNotice>
      ) : null}
      {model.availability === 'online' && session.snapshot ? (
        <div className="signal-picker">
          {session.snapshot.signals.map((signal) => (
            <label key={signal.id}>
              <input
                type="checkbox"
                checked={session.selectedSignalIds.includes(signal.id)}
                onChange={() => onToggleSignal(signal.id)}
              />
              {signal.label}
            </label>
          ))}
        </div>
      ) : null}
      {model.availability === 'online' ? (
        <div className="chart-region" aria-label="Chart">
          {model.chart.length > 0 ? (
            <svg viewBox="0 0 100 40" role="img" aria-label="Simulated signal chart">
              {model.chart.map((series, index) => (
                <polyline
                  key={series.id}
                  fill="none"
                  stroke={STROKES[index % STROKES.length]}
                  strokeWidth="1.5"
                  points={toPoints(series.points)}
                />
              ))}
            </svg>
          ) : null}
        </div>
      ) : null}
      {model.prompt ? <p>{model.prompt}</p> : null}
      {model.chart.length > 0 ? (
        <ul className="reading-list">
          {model.chart.flatMap((series) =>
            series.points.map((point) => (
              <li key={`${series.id}-${point.sequence}`}>
                {series.label} sequence {point.sequence}: {point.reading}
              </li>
            )),
          )}
        </ul>
      ) : null}
    </section>
  )
}

function toPoints(points: readonly SignalPoint[]): string {
  if (points.length === 0) return ''
  const readings = points.map((point) => point.reading)
  const min = Math.min(...readings)
  const max = Math.max(...readings)
  const span = max - min || 1
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
      const y = 36 - ((point.reading - min) / span) * 32
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
