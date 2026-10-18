# Reverse-engineering findings

Static inspection of the local VDash 2.5.115.82 install at `C:\Users\t-lar\AppData\Local\VDASH\VDASH2`. The application was not launched. No vehicle session was opened. No method body was decompiled. The installed files were not modified.

This pass explains the metadata failure and records the type and member shapes that became readable after it. It does not establish diagnostic frame bytes, PassThru parameters, or ECU memory layout.

## Cause of the duplicate `#GUID` failure

The metadata root of the diagnostic assemblies really does list `#GUID` twice. This is not a misread by one tool.

`Core.dll` (and the same pattern in `Frontend.exe`, `Client.Core.dll`, `Frontend.Core.dll`, and `Frontend.Client.Core.dll`) has a normal CLI metadata root (`BSJB`, version string `v4.0.30319`) followed by nine stream headers. The first five are the ordinary heaps, with real sizes. Four more headers follow:

| Order | Name | Size in `Core.dll` | Role |
|---|---|---:|---|
| 1 | `#~` | 1,023,436 | Real metadata tables |
| 2 | `#Strings` | 539,828 | Real identifier heap |
| 3 | `#US` | 4 | User-string heap is present and empty |
| 4 | `#GUID` | 16 | Real module GUID |
| 5 | `#Blob` | 130,592 | Real blob heap |
| 6 | `#GUID` | 16 | Second GUID, different 16 bytes |
| 7 | `#Strings` | 4 | Decoy |
| 8 | `#Blob` | 4 | Decoy |
| 9 | `#Schema` | 4 | Four zero bytes. Not an ECMA-335 stream |

`Update.exe` has the ordinary five streams and no duplicate. That file was readable on the earlier pass. The diagnostic assemblies are the ones with the extra headers.

REA stops in `readMetadataStreams` when a stream name is already in the map. The error text is `Duplicate metadata stream #GUID`, code `invalid-stream`, scope `metadata.stream-header`. Tables are never read. That behavior matches the source in `src/dotnet/ManagedMetadataLayout.ts` in the REA repository. It is a strict parser rule, not evidence that the tables are absent.

The .NET Framework 4 loader accepts the original, unmodified `Core.dll`. `ReflectionOnlyLoadFrom` returned assembly `Core, Version=1.6.176.158` and 1,522 types. The manifest module MVID is `ba60556a-097b-42a3-a57b-5f2e45067317`, which is the first `#GUID` value, not the second. The runtime is using the first heap of each duplicated name and ignoring `#Schema`.

The CLI flags word is `0x0000000B`: IL only, 32-bit required, strong-name signed. The native-entry flag is not set. This is not a native unpacker stub at the CLR header. The user-string heap length of 4 means there are no stored `ldstr` literals in that heap. How display strings are produced was not recovered.

Inference, high confidence: the extra headers are intentional metadata padding aimed at strict readers. The protector product was not identified. The older .NET Reactor signature (`#GUlD` and `#Blop`) is not the pattern in these files. No protector name string was required for the conclusion above, and none is claimed.

## What each tool did

| Tool | Result |
|---|---|
| REA `inspect_managed_artifact` | Fails on the original files. Duplicate `#GUID`. No types. |
| .NET Framework `ReflectionOnlyLoadFrom` | Succeeds on the original `Core.dll`, `Frontend.Client.Core.dll`, and `Frontend.exe`. Types and member signatures are readable. Method bodies are not. |
| Copy with the later `#GUID`, `#Strings`, and `#Blob` names renamed | Also loads. Renaming is unnecessary once Framework reflection is used. The installed files were not renamed. |
| `ilspycmd` 11.1.0.9782 | Fails on the original file and on a stream-renamed copy. `Illegal tables in compressed metadata stream`. |
| `System.Reflection.Metadata` | This is the reader ILSpy calls. It rejects the `#~` table header. |

## What the signatures show

Member shapes below were read from the loaded types. A signature is not a method body. Callers, callees, and transports were not recovered except where a type name or a parameter list itself says so.

- `EgrSensor`, `EgrVvtSystem`, and `DpfReadiness` are `Nullable<Boolean>` properties on `Vdash.Core.Data.DataInfoReadiness`, next to `Mil`, `NumDtcs`, and the other readiness flags. They are not numeric sensor channels in this type.
- `DpfLevel` is `Nullable<Single>` on `Vdash.Core.DataInfoAdvanced`, with `DpfLevelText` as a `String` on the same type.
- `IdentifyRequest` and `IdentifyResponse` are data types under `Vdash.Core.V2.Base`. The response carries `IdentifyResult`, whose properties are `IsUpdate`, `Location`, `Date`, and `Version`.
- `FirmwareEcmId` is `Nullable<Int64>` on `Vdash.Core.Business.Record`. `Vdash.Core.Business.FirmwareEcm` is a catalog record (software numbers, file name, hash, account id), not an ECU memory image.
- `FirmwareVersion` on `Vdash.Core.Contracts.DongleBinding` is a `Version` property. That binding type was not otherwise inspected.
- `Checksum` is the method `Boolean Checksum(String hash, StorageType storage, String fileName, String subDirectory)` on `Vdash.Core.FileServiceClient` and `Vdash.Core.Service.IFileService`. It is a file-storage operation. The body was not read. `Crc64` and `Crc64Iso` types exist; their polynomials were not read.
- There is no method named `ReadFirmware`. The reader types are `FirmwareReader` and `FirmwareEcmReader` in `Frontend.Client.Core.dll`. Their public methods include `Read`. Bodies were not read. Writer types exist in the same namespace and were not analyzed.
- `BackupCommand` is a property on `Vdash.Frontend.ViewModel.AdvancedViewModel` and on a TFT retrofit wizard view-model. It is a UI command. The command handler was not recovered.
- J2534 names that reflection can see are `J2534DiagnoseManager.FindImplementation(String)`, `IDiagnoseDevice.Diagnose`, `RegistryUtils.RegisterPassThru(String)`, and `IDongleService.ProcessJ2534(String)`. No PassThru export, protocol id, baud rate, or diagnostic frame was recovered. Details are in `J2534_COMMUNICATION.md`.

## Not recovered

Method IL, call graphs, timeout policy, and whether `IDongleService` is local IPC or a remote service. ECU hardware identity for the 2007 XC70 D5. Bosch or EDC16 data. Soot, differential pressure, and regeneration operations. Checksum parameters. Any programming or security-access sequence.

Properties whose names refer to pin decoding, clone mode, patch settings, and security VIN exist on `FirmwareBase` and `FirmwareReader`. Those implementations were not opened.

## Parser change and the method-body blocker

REA now keeps the first header for each ECMA-335 stream name (`#~`, `#-`, `#Strings`, `#US`, `#GUID`, `#Blob`). A later header with the same name is an `invalid-stream` issue and does not replace the first offset or size. A name outside that set, including `#Schema`, is recorded as a nonstandard stream and is not used as a heap. An out-of-range duplicate is reported and skipped. An out-of-range first recognised heap still fails the parse. Ordinary fixtures, which have one header per name, still report no stream issues. Synthetic fixtures cover a repeated `#GUID` / `#Strings` / `#Blob` directory plus `#Schema`, and a `#GUID` header whose offset leaves the metadata range.

With that change, the original VDash assemblies classify as managed. `Frontend.Client.Core.dll` reports the four stream anomalies above and two further table anomalies: the Module table has 2 rows, and the Assembly table has 2 rows. ECMA-335 allows one module row and at most one assembly row. Those extra rows were not removed.

`ilspycmd` 11.1.0.9782, installed with the .NET SDK 10.0.402, does not decompile these files. On the original `Frontend.Client.Core.dll` and on a copy whose later duplicate stream names were renamed, it throws `System.BadImageFormatException: Illegal tables in compressed metadata stream` inside `MetadataReader.ReadMetadataTableHeader`. No C# and no IL listing was produced. The installed binaries were not modified.

REA can read the method rows, and the stored bodies do not decode:

| Method | RVA | Decoder result |
|---|---:|---|
| `J2534DiagnoseManager.FindImplementation` | 477156 | Unsupported method body header |
| `DiCEDiagnose.Diagnose` | 471664 | Unsupported method body header |
| `DoipDiagnose.Diagnose` | 472188 | Fat method body header is smaller than 12 bytes |
| `MongooseDiagnose.Diagnose` | 477284 | Unsupported method body header |
| `IDiagnoseDevice.Diagnose` | 0 | No body. This is the interface method. |
| `FirmwareEcmReader.Read` | 201948 | Unsupported method body header |
| `FirmwareReader.Read` | 220868 | Unsupported CIL opcode `0xfb` at IL offset 2 |
| `RegistryUtils.RegisterPassThru` | 151392 | Unsupported method body header |
| `IDongleService.ProcessJ2534` | 0 | No body. This is the interface method. |
| `DataInfoAdvanced.get_DpfLevel` | 79928 | Method body leaves file-backed PE section data |
| `DataInfoReadiness.get_EgrSensor` | 500396 | Header accepted, instruction count 0 |

The same assemblies import `kernel32!VirtualProtect` through methods whose managed names are not readable identifiers. `Frontend.Client.Core.dll` has no module reference whose name is a PassThru DLL. `Core.dll` references `kernel32.dll`, `Kernel32.dll`, `coredll.dll`, `psapi.dll`, and `user32.dll`. `Frontend.exe` also references `bthprops.cpl` and `wlanapi.dll`. None of those names is a J2534 driver.

Inference, not a traced decryptor: the undecodable headers, the illegal table stream, and `VirtualProtect` together match a protector that rewrites method bodies when the module loads. That was not demonstrated by running the module. Target methods were not executed, so plaintext IL was not recovered. Call graphs, diagnostic frames, and firmware layout remain unknown.

## Workarounds for further analysis

1. Use .NET Framework reflection-only load on the original file when the question is type and member shape. Preload `mscorlib`, `System`, and `System.Core` from `C:\Windows\Microsoft.NET\Framework\v4.0.30319`, and resolve product dependencies from the VDASH2 directory. Do not use `Assembly.Load`, which can run module initializers.
2. For a strict reader such as REA, a working copy can rename only the later duplicate stream names so each name occurs once. Keep the first `#GUID`. Confirm the module MVID still matches. Do not edit the installed application.
3. A decompiler that uses `System.Reflection.Metadata` does not get past the `#~` header. Reading plaintext IL would require a dump taken after the module has repaired its own bodies. That means executing the assembly, which this investigation did not do.

No J2534 backend was added in this pass. The public PassThru call sequence is not yet evidenced in these assemblies, so a hardware client would be a guess.
