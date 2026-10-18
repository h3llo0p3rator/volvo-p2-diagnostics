import { phaseOf, type SessionState, type VehicleSelection } from '../../domain/session.ts'

interface VehicleViewProps {
  session: SessionState
  recentVehicles: readonly VehicleSelection[]
  onChooseVehicle: (vehicle: VehicleSelection) => void
}

export function VehicleView({ session, recentVehicles, onChooseVehicle }: VehicleViewProps) {
  const phase = phaseOf(session)
  return (
    <section>
      <h1>Vehicle</h1>
      <p>
        {session.selectedAdapterId
          ? 'Choose a vehicle for this interface.'
          : 'Choose a vehicle. No interface is selected, so it will stay offline.'}
      </p>
      {session.vehicle ? (
        <p>
          Selected: {session.vehicle.label}. {session.vehicle.identityText}.
          {phase === 'online' ? ' The simulated link is confirmed.' : ' Not online.'}
        </p>
      ) : (
        <p>No vehicle is selected.</p>
      )}
      <h2>Recent vehicles</h2>
      <p>Saved in this app, not a live readout.</p>
      <ul className="choice-list">
        {recentVehicles.map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              aria-pressed={session.vehicle?.id === vehicle.id}
              onClick={() => onChooseVehicle(vehicle)}
            >
              {vehicle.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
