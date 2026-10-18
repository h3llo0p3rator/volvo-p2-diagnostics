# Vehicle test plan

No vehicle was connected during this work. Nothing below has been run against a car.

## Before any request

1. Connect the adapter to the car and confirm it still enumerates, or confirm that the vendor PassThru DLL can open it. USB serial enumeration without OBD power does not prove that a protocol channel will open.
2. Install a PassThru DLL from a source you trust only if you want `PassThruOpen`. The attached adapter currently has no such DLL. The MongoosePro DLL is a different device and was not opened.
3. Run `--list` and confirm the intended `FunctionLibrary`.
4. Run `--probe` on that DLL. That opens the device, reads version strings, and closes it. It does not send a diagnostic message.
5. Start a vehicle test only with:

```text
native\j2534\bin\J2534Helper.exe --vehicle-id --confirm-vehicle-connected --library PATH\TO\PassThru.dll
```

Without `--confirm-vehicle-connected` the command exits 2 and does not load the DLL. With the flag, the helper still does not transmit an identification request. No verified Volvo request bytes are configured. A battery-voltage ioctl and the version strings are the only device calls that mode will make.

## Not in this plan

Firmware writes, adaptations, forced regeneration, configuration changes, and security-access sequences are out of scope. A passing mock test does not show that the car, or this adapter, speaks those operations.

## What a later identification test has to record

When a verified read-only identification request exists, log the selected DLL, protocol id, baud, the request bytes, the raw response bytes, timestamps, and the PassThru result code. Keep that log separate from any simulated `MOCK` response.
