# P2 Diagnostics

P2 Diagnostics is a desktop-style workshop shell for a future Volvo P2 diagnostic workflow. This version is a local interface only. It does not talk to a vehicle, a pass-through device, or an account service.

## Run

From this folder:

npm install

npm run dev

Vite prints a local URL. Open that address in a browser.

npm test

npm run build

## Architecture

The screen is a view over a session object. `src/domain/session.ts` stores the adapter choice, the vehicle choice, whether communication was confirmed, whether a saved report is open, and the visible section. The link phase is derived from those facts. Changing section does not clear them.

Diagnostic work sits behind `DiagnosticPort` in `src/diagnostics/port.ts`. Methods on that port are `listAdapters`, `connect`, `disconnect`, `readIdentity`, `readControllers`, `readTroubleCodes`, and `readSignals`. View components do not call Win32 or a vehicle bus. `src/diagnostics/simulatedAdapter.ts` is a stand-in for the shell. Its sample rows are marked with `SIM-`. The recent vehicle is "2007 Volvo XC70 D5" and its identity text is "VIN not read". An empty snapshot profile is available for an online session that returned no controllers and no trouble codes.

Preferences for language, sidebar collapse, and the companion-monitor flag are stored in `localStorage`. Supported language codes are en-US, cs-CZ, pl-PL, and sv-SE. An unknown code falls back to en-US. The companion monitor is stored only and is not started.

## Session phases

- No interface: no adapter is selected. Home and Connection are the useful pages. ECU, trouble-code, live-data, and test pages stay reachable and explain that a connection is required.
- Interface ready: an adapter is selected and no vehicle is associated.
- Vehicle selected: a vehicle is associated and the link is not confirmed.
- Online: the simulated vehicle answered. The banner reads "Simulated session". Sample rows exist only for this session.
- Stored session: a saved report is open. The status line says the session is stored, not live. Live data and tests are disabled until the report is closed.

## Roadmap

1. Done in this increment: an original shell, navigation, session phases, and a simulated adapter behind DiagnosticPort.
2. Next: discover the Codiag adapter through Windows J2534 PassThru, using the same DiagnosticPort. The interface stays free of Win32 calls. macOS and Linux keep the simulated adapter until a portable transport exists.
3. Later, using public specifications only (J2534, ISO 15765-2, KWP2000, and ISO 14229 where the vehicle uses it): identify ECUs, read trouble codes, and take live measurements for Volvo P2. Diagnostic databases are not copied from other products.
4. After that: named tests and actuations, session reports saved by this app, and translated copy for en-US, cs-CZ, pl-PL, and sv-SE.
5. ECU research is a simulated, read-only section; engine family stays unidentified; firmware write is refused.
