# EGR and DPF findings

This note records a static name scan of VDash 2.5.115.82. The application was not launched, and no diagnostic session was run. Managed metadata for the main assemblies was unreadable (a duplicate `#GUID` stream), so the scan produced field and type names only. A name does not establish a screen, a unit, or a routine. Procedures were not recovered.

## Observations

EGR names appear in `Frontend.exe`, `Core.dll`, and `Frontend.Client.Core.dll`.

- `EgrSensor` and `EgrVvtSystem` are field names in `Core.dll` and `Frontend.Client.Core.dll`.
- `NeedsEGRDisconnect` is present in `Frontend.exe` and `Core.dll`. It was seen and not expanded.
- No adaptation name, actuator-test name, or EGR fault identifier was found.

DPF names appear in `Core.dll`, `Frontend.exe`, and `Frontend.Client.Core.dll`.

- `DpfLevel` (also seen in other casings) is a level field in `Core.dll`.
- `DpfLevelText` is the level rendered as text. `DpfLevelValidation` is a validation name only.
- `DpfReadiness` is a readiness field in `Core.dll` and `Frontend.Client.Core.dll`.
- `P1_ShowDPFVariants` is a show-variants flag in `Frontend.exe` and `Frontend.Client.Core.dll`.
- No soot, differential-pressure, forced-regeneration, or automatic-regeneration literal was found in the searched assemblies or the language satellites.

Identification and firmware names are separate from those measurements.

- `FirmwareEcmId` is one of several module-id fields in `Core.dll`, along with ids for other modules and `FirmwareVersion`.
- `ReadFirmware` is in `Frontend.Client.Core.dll`, next to reader type names such as `FirmwareEcmReader`, `FirmwareEepromReader`, `FirmwareCemReader`, `FirmwareCemlReader`, `FirmwareUemReader`, `Firmware1BootReader`, `Firmware1BootIcmReader`, and `FirmwareVeaBridgeReader`.
- Matching writer type names are in that same assembly. `DownloadFirmware` and `UploadFirmware` are named in `Core.dll` and `Client.Core.dll`. Those writer types were seen and not expanded.

Checksum symbol names are present. Their algorithms were not read.

- `Core.dll`: `Checksum`, `Crc`, `Crc64`, `Crc64Iso`, `CrcRequest`, `CrcResponse`, `Crcerr`, `CrcerrCount`, `GetCrc32Hash`, `UpdateCrc32`, `crc32`, `DefaultPolynomial`.
- `Client.Core.dll`: `Checksum`, `CrcRequest`, `CrcResponse`, `UpdateCrc32`, `get_Crc`.
- `Frontend.exe`: `Checksum`.

No literal `Bosch`, `EDC16`, or `XC70` was found. An identifier in `Frontend.Core.dll` mentions EDC17CP22 and EDC17CP48. That string does not identify the engine family of this vehicle, and it was not expanded.

Backup names (`BackupCommand`, `OnBackupFinished`, `BACKUP_ECUS`, `DimBackup`, `DontBackup`, and related names) describe states. They do not describe a transfer.

## Inferences

`EgrSensor` and `EgrVvtSystem` are consistent with two monitored values, not with a command that changes the system. `DpfLevel` plus `DpfLevelText` is consistent with one measurement shown both as a number and as text. `DpfReadiness` is a separate field from the generic readiness view. `P1_ShowDPFVariants` is consistent with a flag that reveals or hides variant text; nothing in the scan said what a variant contains.

Reader type names and `ReadFirmware` are consistent with a read path. The writer type names sit beside them, but the scan did not show a completed write. Checksum symbols are consistent with an integrity concern inside the reference application. They are not an algorithm.

## Unknowns

Which control displays each field, what the units are, and whether a live value exists were not established. Method bodies were not readable and were not decompiled. Whether packed resources contain sentences that the literal scan missed is unknown. No hardware id or software id for this 2007 XC70 D5 was stored as a clean literal.

## Seen and not expanded

`NeedsEGRDisconnect`, the writer types, and the checksum symbols above were seen and left closed. No polynomial, width, or parameter was read. No flash step was recovered. This application does not implement those names.
