# Diagnostic method map

Signatures come from .NET Framework reflection-only loads and from REA after the duplicate-stream change. No row below has a recovered body. Where REA found an RVA, the bytes at that RVA are not decodable CIL. Confidence applies to the declaring member, not to a guessed implementation.

Pseudocode is omitted where the body was not read. Inventing it would repeat the string-only pass.

## Requested symbols

### `IdentifyRequest`

- Kind: type, data object.
- Assembly: `Core.dll`.
- Name: `Vdash.Core.V2.Base.IdentifyRequest`.
- Properties: `String V`, `String SV`, `Boolean Locate`, `String Id`.
- Methods: none declared beyond the property accessors.
- Callers and callees: not recovered.
- Transport: not recovered. The namespace is `V2.Base`, beside other V2 contracts. That does not by itself prove a remote call.
- Confidence: high for the property list.

### `IdentifyResponse`

- Kind: type, data object.
- Assembly: `Core.dll`.
- Name: `Vdash.Core.V2.Base.IdentifyResponse`.
- Properties: `IdentifyResult Identity`, `String Id`, `List<Entry> Tasks`.
- `IdentifyResult` properties: `Boolean IsUpdate`, `GeolocationData Location`, `Double Date`, `String Version`.
- Callers, callees, transport: not recovered.
- Confidence: high for the property list. The meaning of `V`, `SV`, and `Tasks` is unknown.

### `FirmwareEcmId`

- Kind: property.
- Assembly: `Core.dll`.
- Declaring types: `Vdash.Core.Business.Record`, and also `RecordView` and `Volvo` with the same property name.
- Type: `Nullable<Int64>`.
- Related record: `Vdash.Core.Business.FirmwareEcm` has `Hardware`, `SwNumber1`, `SwNumber2`, `SwNumber4`, `DiagnosticNumber`, `SerialNumber`, `FileName`, `Hash`, `IdAccount`, `Created`, and `Nullable<Int64> Id`.
- This is a catalog foreign key and a file record. It is not a firmware address map.
- Confidence: high for the CLR types. No ECU part number was stored as a constant in these members.

### `FirmwareVersion`

- Kind: property.
- Assembly: `Core.dll`.
- Declaring type: `Vdash.Core.Contracts.DongleBinding`.
- Type: `Version`.
- The rest of that binding type was not inspected.
- Confidence: high for the property. Low for what the version numbers.

### `EgrSensor`

- Kind: property.
- Assembly: `Core.dll`.
- Declaring type: `Vdash.Core.Data.DataInfoReadiness`.
- Type: `Nullable<Boolean>`.
- Same object: `Mil` (`Boolean`), `NumDtcs` (`Nullable<Int32>`), `FuelSystemMonitor`, `ComprehensiveComponent`, `CompressionIgnition`, `CatalystMonitor`, `DpfReadiness`, `EgrVvtSystem`, `HeatedCatalyst`, `SecondaryAirSystem` (each `Nullable<Boolean>` except `Mil` and `NumDtcs`).
- There is no numeric EGR sensor property on this type. The earlier simulated reading `0.18` does not match this shape.
- Inference, medium: the booleans are readiness flags because they sit with MIL and a DTC count. Which bit is "complete" versus "supported" was not recovered.
- Confidence: high for the property type.

### `EgrVvtSystem`

- Same declaring type and type as `EgrSensor`: `Nullable<Boolean>` on `DataInfoReadiness`.
- No separate actuator or adaptation method of this name was found.
- Confidence: high for the property type.

### `DpfLevel`

- Kind: property.
- Assemblies: `Core.dll`.
- `Vdash.Core.DataInfoAdvanced.DpfLevel` is `Nullable<Single>`.
- `DpfLevelText` on the same type is `String`.
- A second `DpfLevel` exists on `Vdash.Core.Business.Dongle.DongleMileageData` as `Nullable` of an unresolved argument. That mileage type was not analyzed.
- Other measurements on `DataInfoAdvanced` include fuel level, coolant temperature, oil level, and voltage, each as a nullable number plus a text property. Units were not recovered.
- No soot, differential-pressure, or regeneration member was found in the searched type names.
- Confidence: high for `DataInfoAdvanced`.

### `DpfReadiness`

- Kind: property.
- Declaring type: `Vdash.Core.Data.DataInfoReadiness`.
- Type: `Nullable<Boolean>`.
- Distinct from `DpfLevel`.
- Confidence: high.

### `ReadFirmware`

- No member is named `ReadFirmware`.
- The matching types are in `Frontend.Client.Core.dll`, namespace `Vdash.Frontend.Client.Core.Reader`.
- `FirmwareReader` methods include `Read`, `ReadAsync`, `Verify`, `CreateFromOriginal`, `CreateReload`, `DeleteReload`, `GetImmo`.
- `FirmwareEcmReader` methods include `Read`, `ReadVea`, `CreateFromOriginal`.
- `FirmwareBase` methods include `GetHardwareNumber`, `GetSerialNumber`, and others. Properties include `HardwareNumber`, `SerialNumber`, `SwNumber1` through `SwNumber4`, and `Vin`.
- Bodies were not read. Input frames and output image layout are unknown.
- `FirmwareEcmWriter` and the other `*Writer` types are in the same namespace. Their bodies were not opened. This map does not describe a write procedure.
- `FirmwareBase` and `FirmwareReader` also expose properties named for pin decode, clone mode, and patch settings. Those were not analyzed.
- Confidence: high that `Read` is the method name on the ECM reader. Low for what `Read` transmits.

### `BackupCommand`

- Kind: property on a view-model, not a protocol method.
- Assembly: `Frontend.exe`.
- `Vdash.Frontend.ViewModel.AdvancedViewModel` has `get_BackupCommand` and `set_BackupCommand`.
- `Vdash.Frontend.ViewModel.CEM.TftRetrofitWizard1` has the same, plus `BackupDate`.
- The command's execute method was not bound. No backup file format was recovered.
- Confidence: high that this is UI state. Low for the operation it starts.

### `Checksum`

- Kind: method.
- Assembly: `Core.dll`.
- `Vdash.Core.FileServiceClient.Checksum(String hash, StorageType storage, String fileName, String subDirectory)` returns `Boolean`.
- The same signature is on `Vdash.Core.Service.IFileService`.
- Neighbor methods are `Upload`, `Download`, `Exists`, and `Enumerate` against a `StorageType` and a file name.
- Body not read. This is not evidence of an ECU calibration checksum. `Vdash.Core.Hash.Crc64` and `Crc64Iso`, and `Vdash.Core.V2.Fs.CrcRequest` / `CrcResponse`, exist. Their algorithms and any ECU use were not read.
- Confidence: high for the file-service signature. Unknown for `Crc64` beyond the type name `Crc64Iso`.

## J2534 entry points

Documented in `J2534_COMMUNICATION.md`. Short form: `FindImplementation`, `Diagnose`, `RegisterPassThru`, and `ProcessJ2534` are the recovered names. None of their bodies is recovered, so none of them is described in pseudocode.

A normal UI launch did not provide the missing behavior. `Frontend.exe` reached a window titled `VDASH` without loading a J2534 DLL, without opening the PassThru registry key, and without creating a diagnostic child process. The named methods were not traced. See `RUNTIME_ANALYSIS.md`.

## Dependencies

`Core.dll` references framework assemblies including `System`, `System.Core`, `System.Data`, and `System.Net.Http`. `Frontend.Client.Core.dll` references `Core.dll` and WPF (`PresentationFramework` blocked one parameter resolve). Product references between `Frontend.exe` and `Frontend.Client.Core.dll` were not enumerated as a full assembly-ref table this pass.

`System.Net.Http` being referenced means some type in `Core.dll` mentions HTTP types. It does not identify which of the methods above uses HTTP. `FileServiceClient` is the observed file transfer client. Its wire protocol was not read.
