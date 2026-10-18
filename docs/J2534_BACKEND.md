# J2534 backend

The Windows helper is `native/j2534/bin/J2534Helper.exe`, a 32-bit .NET Framework program. It loads a PassThru DLL with `LoadLibrary` and `GetProcAddress`. The React UI does not load drivers and has no new screen. `tools/j2534/j2534Port.ts` speaks JSON lines to the helper and implements the same adapter, connect, disconnect, and read methods as `DiagnosticPort`. Vehicle reads throw `VehicleAccessDisabled`.

Rebuild with `native/j2534/build.ps1` after LLVM MinGW is installed. The helper is compiled with the 32-bit `csc.exe` in `C:\Windows\Microsoft.NET\Framework\v4.0.30319`. The simulated DLL is compiled with `i686-w64-mingw32-gcc`.

## Commands

Registry discovery, without loading a DLL:

```text
native\j2534\bin\J2534Helper.exe --list --export report.json
```

Simulated driver, which is allowed to exchange the mock's own test messages:

```text
native\j2534\bin\J2534Helper.exe --self-test native\j2534\bin\mock_passthru.dll --export report.json
```

Open a real library, read its version strings, and close it. This does not connect a protocol and does not write:

```text
native\j2534\bin\J2534Helper.exe --probe PATH\TO\PassThru.dll
```

Vehicle identification stays off unless both flags are present. Even then the helper does not transmit an identification request, because no verified request bytes are configured:

```text
native\j2534\bin\J2534Helper.exe --vehicle-id --confirm-vehicle-connected --library PATH\TO\PassThru.dll
```

## API coverage

The helper resolves `PassThruOpen`, `PassThruClose`, `PassThruReadVersion`, `PassThruGetLastError`, `PassThruConnect`, `PassThruDisconnect`, `PassThruReadMsgs`, `PassThruWriteMsgs`, `PassThruStartMsgFilter`, and `PassThruIoctl`.

`writeMsgs` on the JSON API is rejected unless the loaded file is `mock_passthru.dll`. Closing the helper disconnects a channel and closes the device if those calls are still open.

Discovery reads both the 32-bit and 64-bit views of `PassThruSupport.04.04` and `PassThruSupport.05.00`. Protocol support is whatever registry value is the string `1`.

## Simulated driver

`mock_passthru.dll` is 32-bit. `PassThruOpen` returns device id 1. A second open returns device-in-use until close. `PassThruReadVersion` returns `SIM-FW-0`, `SIM-DLL-1`, and `04.04`. Connect accepts CAN (5) and ISO 15765 (6) at 500000 baud and returns channel 7. Other protocols and baud rates fail. A pass filter is required before a write places a response on the receive queue. That response is the bytes `4D 4F 43 4B` (`MOCK`) plus the first request byte. It is not a vehicle frame. `READ_VBATT` returns 0. `GET_CONFIG` for data rate returns the connected baud. An empty read with no timeout returns buffer-empty. A timed read of an empty queue returns timeout.
