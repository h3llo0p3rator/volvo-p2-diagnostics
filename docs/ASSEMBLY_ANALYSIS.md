# Assembly analysis

Target directory: `C:\Users\t-lar\AppData\Local\VDASH\VDASH2`. Inspection was static. Counts below come from .NET Framework `ReflectionOnlyLoadFrom` on the original files after the metadata-directory issue was understood.

## Metadata directory

Every diagnostic assembly listed here is PE32, CLI runtime string `v4.0.30319`, metadata signature `BSJB`. The stream directory is non-standard because names repeat. `Update.exe` is the control case: five unique streams, and it was readable without a workaround.

| File | Stream count | Duplicate names | `#Schema` | Framework reflection |
|---|---:|---|---|---|
| `Frontend.exe` | 9 | `#GUID`, `#Strings`, `#Blob` | yes | 1,049 types |
| `Core.dll` | 9 | `#GUID`, `#Strings`, `#Blob` | yes | 1,522 types |
| `Frontend.Client.Core.dll` | 9 | `#GUID`, `#Strings`, `#Blob` | yes | 323 types |
| `Client.Core.dll` | 8 | `#GUID`, `#Strings`, `#Blob` | yes | Not re-counted this pass |
| `Frontend.Core.dll` | 8 | `#GUID`, `#Strings`, `#Blob` | yes | Not re-counted this pass |
| `Update.exe` | 5 | none | no | Readable on the earlier pass |

`Core.dll` first `#GUID` bytes `6A 55 60 BA 7B 09 A3 42 A5 7B 5F 2E 45 06 73 17` decode to MVID `ba60556a-097b-42a3-a57b-5f2e45067317`. The second `#GUID` is a different 16-byte value. `Module.ModuleVersionId` on the loaded assembly matches the first value.

`#US` is 4 bytes on `Frontend.exe` and `Core.dll`. That is an empty user-string heap. Identifier strings in `#Strings` are still present, which is why type and member names resolve.

## How the failure is produced

ECMA-335 stream names in a metadata root are unique. REA enforces that with a map insert in `readMetadataStreams` and raises `invalid-stream` at the second `#GUID` header. `System.Reflection.Metadata` was not run. The Framework loader does not enforce uniqueness the same way: it bound the module GUID from the first `#GUID` stream and returned the type tables from the first `#~` stream.

`#Schema` is four zero bytes. It is not a table heap, a string heap, or a GUID heap. Strict tools that reject unknown streams, and tools that reject duplicate names, both fail. The running Framework host does neither to this directory.

CLI flags `0xB` exclude a native CLR entry point. A second protection layer can still exist inside method bodies. That was not tested, because no IL was decoded.

## Assemblies and the symbols they actually declare

| Assembly | Holds |
|---|---|
| `Core.dll` | Readiness and advanced data records, V2 identify DTOs, firmware catalog records, file-service `Checksum`, `RegistryUtils.RegisterPassThru`, `IDongleService` |
| `Frontend.Client.Core.dll` | `J2534DiagnoseManager`, `IDiagnoseDevice`, DiCE, DoIP, and Mongoose diagnose types, firmware reader and writer types |
| `Frontend.exe` | `AdvancedViewModel.BackupCommand` and the TFT wizard backup properties |
| `Update.exe` | Updater only. No duplicate streams. Not part of the diagnostic map |

`Frontend.Client.Core.dll` reflection reported 15 loader exceptions on `Core.dll` until framework assemblies were preloaded. Those exceptions were missing reflection-only dependencies (`System`, `System.Core`, `System.Net.Http`, `System.Data`), not metadata failures. After preloading, the diagnose and reader types resolved.

## Tool limits that remain

Reflection-only load does not return IL, exception handlers, or custom-attribute arguments that live in an unloaded assembly. `IDiagnoseDevice.Diagnose` parameter types need `PresentationFramework`, which was not preloaded, so that parameter list is still unread. The method name itself is `Diagnose`.

`ilspycmd` 11.1.0.9782 uses `System.Reflection.Metadata`. It rejects both the original `Frontend.Client.Core.dll` and a copy whose duplicate stream names were renamed, with `Illegal tables in compressed metadata stream`. The failure is the `#~` table header, which still reports two Module rows and two Assembly rows. Method RVAs can be listed, and the bytes at those RVAs are not ordinary CIL headers.

At runtime, `Frontend.exe` holds `Core.dll`, `Client.Core.dll`, `Frontend.Core.dll`, and `Frontend.Client.Core.dll` open as files. They do not appear in the native module list. The monitor process does not have `Core.dll` open. Details are in `RUNTIME_ANALYSIS.md`.
