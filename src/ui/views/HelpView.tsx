export function HelpView() {
  return (
    <section>
      <h1>Help</h1>
      <div className="panel">
        <p>
          P2 Diagnostics is a workshop shell. Use Connection to pick the simulated interface, Vehicle
          to pick a recent vehicle, then confirm the link.
        </p>
        <p>
          Sample rows are marked with SIM- and exist only for the current session. Disconnect keeps
          the vehicle name and drops the sample rows. This version does not communicate with a vehicle.
        </p>
      </div>
    </section>
  )
}
