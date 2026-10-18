# J2534 driver inventory

Read from the registry on this machine. No driver function was called, and no adapter was opened.

The 64-bit keys `HKLM\SOFTWARE\PassThruSupport.04.04` and `PassThruSupport.05.00` are absent. The only SAE J2534 v04.04 key is the 32-bit view:

`HKLM\SOFTWARE\WOW6432Node\PassThruSupport.04.04\Drew Technologies Inc. - MongoosePro JLR`

| Field | Value |
|---|---|
| Name | MongoosePro JLR |
| Vendor | Drew Technologies Inc. |
| FunctionLibrary | `C:\Program Files (x86)\Drew Technologies, Inc\J2534\MongoosePro JLR\monpj432.dll` |
| ConfigApplication | `C:\Program Files (x86)\Drew Technologies, Inc\J2534\MongoosePro JLR\MPConfigApp.exe` |
| DLL version | 1.1.16.0 |
| DLL description | J2534 PassThru DLL for MongoosePro |
| DLL size | 2,501,848 |
| DLL machine | `0x014C` (32-bit x86) |
| DLL SHA-256 | `2710726FDD174F32B5E703E310CFCE047A663451EDBB3E35CA0C8EEFF6929413` |
| Protocols flagged 1 | CAN, ISO15765, ISO14230, ISO9141, J1850PWM, UART_ECHO_BYTE_PS, CAN_PS, ISO15765_PS, ISO14230_PS, ISO9141_PS |

No registry key containing Codiag was found under `HKLM\SOFTWARE`, `HKLM\SOFTWARE\WOW6432Node`, or `HKCU\SOFTWARE` at the top level, and no second PassThru vendor key exists. A Codiag interface is not installed as a J2534 driver on this PC. The MongoosePro JLR DLL is a 32-bit PassThru library, so a 64-bit process cannot load it directly. That is a file and registry fact. The DLL was not loaded during the UI session either. `Frontend.exe` did not open `monpj432.dll` or the PassThru registry key while its main window was idle, so device discovery and a live protocol list were not verified.

A second USB device, `VID_E327` `PID_2534` on COM3, is present and is not this Mongoose registration. See `CODIAG_HARDWARE_ANALYSIS.md`.
