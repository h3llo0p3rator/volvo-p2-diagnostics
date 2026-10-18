# J2534 communication

No PassThru session was observed. The notes below are type and method names from reflection-only loads of the original assemblies. They are not a driver trace and not a frame capture.

## What is named

| Member | Assembly | Shape | Confidence |
|---|---|---|---|
| `J2534DiagnoseManager.FindImplementation` | `Frontend.Client.Core.dll` | `IDiagnoseDevice FindImplementation(String)` | High for the signature. The string's meaning was not recovered. |
| `IDiagnoseDevice.Diagnose` | same | Method name `Diagnose`. Parameter types were not resolved (`PresentationFramework` was not preloaded). Also `String Device { get; }`. | High for the name. Low for behavior. |
| `IDiagnoseDevice` implementers | same | `DiCEDiagnose`, `DoipDiagnose`, `MongooseDiagnose`. Each declares `Diagnose`. No type is named as a J2534 device class. | High that these three are the located implementers. |
| `RegistryUtils.RegisterPassThru` | `Core.dll` | `Void RegisterPassThru(String)` | High for the signature. The registry key and the string format were not read. Sibling methods on the same type are DiCE path and protocol registration helpers, which supports a registry role without proving the key. |
| `IDongleService.ProcessJ2534` | `Core.dll` | `String ProcessJ2534(String)` | High for the signature. Transport unknown. |
| `IDongleService` neighbors | `Core.dll` | `GetCanConfig(String)`, `Send(String, String, Boolean)`, `GetResponse(String, String)`, `Disconnect(String, String)`, `ExecuteCommand(String)`, `GetCommands(String)` | High for the names. Bodies not read. |

`J2534DiagnoseManager` has no other declared method besides `FindImplementation`. Discovery of installed PassThru DLLs, `LoadLibrary`, `PassThruOpen`, `PassThruConnect`, filter setup, read and write, and timeout handling are not visible as managed method names.

## Method bodies

`ilspycmd` 11.1.0.9782 cannot open `Frontend.Client.Core.dll`. The .NET metadata reader reports an illegal compressed table stream. REA reads the method rows after ignoring duplicate stream headers, and the bodies still do not decode. `FindImplementation` and the three `Diagnose` implementations have RVAs, and the bytes at those RVAs are not a tiny or fat CIL header (`DoipDiagnose.Diagnose` has a fat header shorter than 12 bytes). `IDiagnoseDevice.Diagnose` and `IDongleService.ProcessJ2534` have RVA 0 because they are interface methods.

`Diagnose` on the interface and on the three classes is `bool Diagnose(string&, <list>)`. The list's element type did not resolve to a name. No call instruction inside these methods was decoded, so there is no callee list.

Module references and P/Invoke imports do not name a PassThru DLL. The native imports that match a communications-related filter are `kernel32!VirtualProtect` (obfuscated managed names), job-object and version APIs, `user32`, `psapi`, `coredll`, and, in `Frontend.exe`, `bthprops.cpl` and `wlanapi.dll`. Bluetooth and Wi-Fi imports are not evidence of a J2534 session.

## What was not found

Searches of method names on the loaded types in `Core.dll`, `Frontend.Client.Core.dll`, and `Frontend.exe` did not find `PassThruOpen`, `PassThruConnect`, `PassThruReadMsgs`, `PassThruWriteMsgs`, or a method named `ReadFirmware`.

No protocol id, baud, ISO 15765 padding, or request/response byte string was taken from a method body, because no method body was decoded.

`IDongleService.ProcessJ2534` accepts and returns strings. That is compatible with a service boundary. It does not show whether the service is a local process, a device driver, or a remote host. `CreateRegistration` sits on the same interface. That registration method was not analyzed.

## Read-only diagnostic surface that is evidenced

The only diagnose operation named on the device interface is `Diagnose`. DiCE, DoIP, and Mongoose are separate types. J2534 is a manager that returns an `IDiagnoseDevice`. How a J2534 DLL is chosen is inside `FindImplementation` and `RegisterPassThru`, and those bodies are still closed.

Until those bodies, or a trace from an authorized adapter session, show the PassThru calls, the P2 Diagnostics `DiagnosticPort` must not grow a Windows backend that pretends to follow this application. A backend written from the public J2534 specification would be a separate design, not a recovery of this install.

## Runtime check

Starting the UI and leaving the main window idle did not load a PassThru DLL and did not open the PassThru registry key. The observations are in `RUNTIME_ANALYSIS.md` and `J2534_DRIVER_INVENTORY.md`. The only registered PassThru driver is the 32-bit Drew Technologies MongoosePro JLR library, and this session did not call it. The attached USB adapter is a serial device, documented in `CODIAG_HARDWARE_ANALYSIS.md`, and it has no PassThru registration. The independent helper and simulated driver are in `J2534_BACKEND.md`.
