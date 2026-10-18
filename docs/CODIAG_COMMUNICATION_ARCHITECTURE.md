# Communication architecture

## Verified

The connected adapter enumerates as a USB communications device and Windows binds inbox `usbser.sys`. Applications can open it as COM3. At 115200 8N1 it answers the ELM327 text commands recorded in `CODIAG_J2534_INVESTIGATION.md`.

On this computer, every surviving installation of this hardware id used that same `usbser` binding. No second USB interface and no vendor kernel driver appeared.

The only installed J2534 implementation is the MongoosePro JLR pair: `monpj432.dll` plus `dtmonpro.sys` for `USB\VID_18E1&PID_0104`. That is a different device. VDash, while idle with this adapter already on COM3, did not open the port and did not load the Mongoose DLL.

The independent helper still loads a PassThru DLL only. It was not pointed at `monpj432.dll`, because that would be an unproven pairing, and it has no Codiag PassThru DLL to load.

## Not verified

These were not observed, so none of them is the established architecture:

- A vendor J2534 DLL opening COM3.
- J2534 framing inside VDash over the serial port.
- A vendor-specific USB protocol besides the CDC serial interface.
- A firmware mode that replaces the ELM text interface.

The prior successful VDash J2534 session is not reproduced by the files and logs on this PC. The next observation that can distinguish those architectures is VDash itself while the adapter is selected in its UI: either it loads a DLL, opens COM3, or opens the USB device directly.
