# Offline test results

These results are from `mock_passthru.dll` and from the Windows registry. They are not results from the USB adapter or from a vehicle.

`J2534Helper.exe --self-test native\j2534\bin\mock_passthru.dll` exited 0. The report has `"kind": "simulated"` and `"verifiedHardware": false`. Every check passed:

| Check | Result |
|---|---|
| Export resolution | Passed |
| Open, and a second open rejected | Passed |
| Version strings `SIM-FW-0`, `SIM-DLL-1`, `04.04` | Passed |
| Protocol 99 rejected | Passed |
| Baud 33300 rejected | Passed |
| ISO 15765 at 500000 accepted, second connect rejected | Passed |
| Write with no filter leaves the receive queue empty | Passed |
| Pass filter id 1 | Passed |
| Write then read returns `MOCK` plus the request byte `3E` | Passed |
| Following read is buffer-empty | Passed |
| Timed read returns timeout | Passed |
| `READ_VBATT` is 0 | Passed |
| `GET_CONFIG` data rate is 500000 | Passed |
| Disconnect, close, and a second open/close | Passed |

`npm test` in `volvo-p2-diagnostics` ran 51 tests, including this self-test, the disabled vehicle command, registry discovery of `monpj432.dll`, and the port's refusal to read a vehicle. `tsc -b` completed with no errors.

The helper binary is 20,992 bytes, SHA-256 `D755D813913767855834DC7776001672B3E970CAB0FA110C8BEE431128A1BF02`. The mock DLL is 39,936 bytes, machine `0x014C`, SHA-256 `B3B927AB8241C13CE188806EA42D8E819758001C7BBE0EFBD458E8300D8F6BD2`.
