# J2534 driver discovery

Read-only. No registry value and no driver package was changed.

## Registrations

| View | Key | Result |
|---|---|---|
| 32-bit | `HKLM\SOFTWARE\PassThruSupport.04.04` | Drew Technologies Inc. - MongoosePro JLR |
| 32-bit | `PassThruSupport.05.00` and `02.02` | Absent |
| 64-bit | `PassThruSupport.04.04`, `05.00`, `02.02` | Absent |

Mongoose values: `FunctionLibrary` is `C:\Program Files (x86)\Drew Technologies, Inc\J2534\MongoosePro JLR\monpj432.dll`. `ConfigApplication` is `MPConfigApp.exe`. Protocol values set to 1 are CAN, ISO15765, ISO14230, ISO9141, J1850PWM, UART_ECHO_BYTE_PS, CAN_PS, ISO15765_PS, ISO14230_PS, and ISO9141_PS.

## Libraries

`monpj432.dll` exports the PassThru calls listed in `CODIAG_J2534_INVESTIGATION.md`. Its INF binds `USB\VID_18E1&PID_0104` through `dtmonpro.sys`. That hardware id is not the connected adapter. The DLL text does not contain `E327` or `COM3`.

`j2534_loader.dll` is a registry lookup and device picker for a v04.04 DLL. Its own message is `No J2534 v0404 DLL found!` when that lookup fails. It does not implement the PassThru device for COM3.

No other `*j2534*.dll`, `*PT32*.dll`, `*passthru*.dll`, Codiag, Godiag, or VNCI file was found under Program Files, the VDash directory, the desktop, or Downloads.

## What was not established

`PassThruOpen` was not called on `monpj432.dll`. Compatibility with `VID_E327` `PID_2534` is not assumed, and it is also not disproved by an API call. The evidence against that pairing is the INF hardware id and the absence of this adapter's USB id and COM port in the DLL text.
