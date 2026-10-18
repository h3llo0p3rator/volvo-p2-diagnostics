# Hardware test results

No PassThru call was made. No vehicle request was sent. J2534 open, protocol connect, and diagnostic reads are not verified.

The attached USB device did enumerate and its COM port did open. Details are in `CODIAG_HARDWARE_ANALYSIS.md`. `ATI` returned `ELM327 v1.3a`. That verifies the serial interface only.

The running UI did not load `monpj432.dll`. The simulated PassThru checks in `OFFLINE_TEST_RESULTS.md` are not hardware results.

The only installed J2534 library is the 32-bit Drew Technologies MongoosePro JLR DLL recorded in `J2534_DRIVER_INVENTORY.md`. A Codiag driver is not registered. Until that library is loaded and `PassThruOpen` returns a device id from the attached adapter, the independent application has no hardware result to report.
