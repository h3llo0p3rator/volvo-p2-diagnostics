# USB adapter analysis

Observed on 18 October 2026 with no vehicle connected. The adapter was already enumerated by Windows when this pass started. No PassThru function was called, and no diagnostic frame was sent.

## What Windows shows

| Field | Value |
|---|---|
| Present | Yes, status OK |
| Friendly name | USB Serial Device (COM3) |
| Instance | `USB\VID_E327&PID_2534\MT000169` |
| Hardware ids | `USB\VID_E327&PID_2534&REV_0200`, `USB\VID_E327&PID_2534` |
| Bus-reported description | `N32G43x Port` |
| USB class | Communications class, abstract control model (`Class_02`, `SubClass_02`, `Prot_01`) |
| Location | Port 2 on hub 4 |
| Parent | `USB\VID_05E3&PID_0608\...` (USB hub) |
| Service | `usbser` |
| INF | `usbser.inf`, Microsoft, driver version 10.0.26100.9278 |
| Kernel driver | `C:\Windows\System32\drivers\usbser.sys`, 126,976 bytes, SHA-256 `823753C996CEC647669B38B308D8C437E61B10090E830A9396934AF6FAE3BDAB` |
| Port | COM3, `MaxBaudRate` 115200 |
| Install time | 18 October 2026 23:30:25 |

The device is a generic USB serial port. Windows did not install a vendor J2534 driver for it. There is no second device with this VID and PID.

## Serial open without vehicle power

COM3 opened at 115200 8N1 while the adapter had only USB power. The only command sent was `ATI`. The adapter answered:

```text
ELM327 v1.3a
```

That is the adapter identifying its serial mode. It is not a vehicle response. Detection and a serial open do not require OBD-II power. This does not show whether a PassThru session, or a particular protocol, needs vehicle power. No PassThru DLL is installed for this device, so `PassThruOpen` was not attempted.

Published descriptions of `VID_E327` / `PID_2534` and the bus name `N32G43x Port` refer to Godiag GD101 and VNCI Nano adapters, which expose this serial interface without OBD power and use a separate 32-bit DLL for SAE J2534. The case was not opened and no vendor string was read from the hardware, so that name is a public association with this USB identity, not a label read from the device.

## Comparison with MongoosePro JLR

| | Attached adapter | Drew Technologies MongoosePro JLR |
|---|---|---|
| Visible on USB now | Yes, COM3 | No |
| Registry | No PassThru key | `HKLM\SOFTWARE\WOW6432Node\PassThruSupport.04.04\Drew Technologies Inc. - MongoosePro JLR` |
| Driver | Microsoft `usbser.sys` | `monpj432.dll`, 32-bit, version 1.1.16.0 |
| How software would open it | COM port, or a PassThru DLL that is not installed | `LoadLibrary` of the registered DLL |
| Protocols | Not advertised in the PassThru registry. Serial identity is `ELM327 v1.3a` | Registry flags CAN, ISO15765, ISO14230, ISO9141, J1850PWM, and the pin-select variants |

The two interfaces are different. The Mongoose DLL does not describe this USB device, and this USB device does not satisfy the Mongoose registration.

`ATI` shows an ELM327-compatible serial command set. It does not show that this is the adapter's only mode. The follow-up is in `CODIAG_J2534_INVESTIGATION.md`.
