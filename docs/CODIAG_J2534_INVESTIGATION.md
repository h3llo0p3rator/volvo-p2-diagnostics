# Codiag J2534 investigation

The adapter is the USB device `VID_E327` `PID_2534`, serial `MT000169`, on COM3. The statement that it has previously connected to VDash through J2534 is accepted as prior use. This pass did not reproduce that connection. Absence of a Codiag registry key is not treated as proof that the adapter cannot speak J2534.

## Verified on this PC

Both registry views were read. The only PassThru key is the 32-bit `PassThruSupport.04.04` entry for Drew Technologies MongoosePro JLR. There is no 64-bit key and no `PassThruSupport.05.00` or `02.02` key. The uninstall database has one related product, `J2534 MongoosePro JLR` 01.01.16.00. No installed product name contains Codiag, Godiag, or VNCI.

Searches of Program Files, the VDash install, the desktop, and Downloads did not find a Codiag, Godiag, VNCI, or `PT32` library. The only J2534 DLLs found are:

| File | Role verified from the file |
|---|---|
| `monpj432.dll` | Exports `PassThruOpen`, `PassThruClose`, `PassThruConnect`, `PassThruReadMsgs`, `PassThruWriteMsgs`, `PassThruReadVersion`, and the other standard calls. Also exports Drew-specific `PassThruGetNextCarDAQ`, `PassThruReadDetails`, and `PassThruFirmwareUpdate`. |
| `j2534_loader.dll` | Contains the text `No J2534 v0404 DLL found!` and a device-select class. It looks up a registered v04.04 DLL. It is not a driver for COM3. |
| `dtmonpro.sys` | Kernel driver from `monpjaguar.inf`. |

`monpjaguar.inf` matches only `USB\VID_18E1&PID_0104`, described in the INF as `MongoosePro JLR J2534 Interface`. The DLL contains the strings `18E1`, `Mongoose`, `CarDAQ`, and `J2534`. It does not contain `E327` or `COM3`. The digit sequence 2534 occurs inside `J2534` and `CT2534`, not as this adapter's product id. No relationship between `monpj432.dll` and COM3 was found. The DLL was not loaded.

## Driver history

Surviving SetupAPI logs show three events for `USB\VID_E327&PID_2534\MT000169`:

- 7 September 2026, 13:33: hardware install. The only candidate was inbox `usbser.inf`, compatible id `USB\Class_02&SubClass_02&Prot_01`. No vendor INF was offered.
- A later `usbser.inf` servicing update changed that same device from driver version 10.0.26100.8972 to 10.0.26100.9278. It stayed on `usbser`.
- 15 October 2026, 15:46: Storage Sense removed the device node because it had not been detected within the 30-day window. The removal record does not name a previous driver.
- 18 October 2026, 23:30: the device was installed again. Again the only candidates were two `usbser.inf` compatible-id matches.

No published INF in `C:\Windows\INF` contains `VID_E327`. The driver store has no Codiag or Godiag package. The logs that remain do not show a different USB driver, a vendor kernel driver, or a mode switch. They also do not preserve a userspace DLL that could have been installed and later deleted without a SetupAPI record.

## Serial commands actually sent

COM3 was opened at 115200 8N1 with no vehicle connected. Only documented ELM327 read commands were sent. No `AT@3` write, firmware, or bootloader command was sent.

| Command | Response |
|---|---|
| empty carriage return | `OK` |
| `ATI` | `ELM327 v1.3a` |
| `AT@1` | `OBDII to RS232 Interpreter` |
| `AT@2` | `Aeronautics!` |
| `ATRV` | `4.4V` |
| `ATDP` | `AUTO` |
| `ATIGN` | `OK` |

The ELM327 manual defines `AT@1` as the device description, with that exact default text, and `AT@2` as a stored 12-character identifier. `Aeronautics!` is 12 characters. `ATRV` is the adapter's voltage reading; 4.4 V is not a vehicle battery. `ATDP` returned `AUTO`, so no vehicle protocol is selected. `ATIGN` returned `OK` rather than the `ON` or `OFF` text in the ELM manual. These responses confirm the serial command set. They do not inventory every firmware mode.

## VDash while the adapter was already connected

An idle trace of `Frontend.exe` did not open COM3, `usbser`, a PassThru key, or `monpj432.dll`. Selecting the adapter in the UI was not performed in this pass, so the path VDash uses after a user chooses this device is still unobserved.

## Inference, not a finding

A userspace library could speak J2534 by opening COM3 and then using a protocol other than the ELM text commands. No such library is on this PC now, and the protected VDash method bodies were not read. That possibility is open. It is not demonstrated.
