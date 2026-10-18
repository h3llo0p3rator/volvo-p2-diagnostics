# Runtime analysis

Observed on this Windows machine on 18 October 2026. The installed files were not modified. No method was invoked inside the assemblies, and no process memory was copied out. Process Monitor, Process Explorer, Handle, TCPView, VMMap, and ListDLLs were installed for this pass. VMMap was used to record page protection, not page contents.

## Tools

| Tool | Version | SHA-256 |
|---|---|---|
| Process Monitor `Procmon64.exe` | 4.12 | `28495E642B2A465474A4EDC58380EAF8B7EE580F3FBCB4141061DEADAFE9B885` |
| Process Explorer `procexp64.exe` | 17.2 | `CDD3BF8FD68284480361C3673B9DB7F48FF8A44317D28A243D26E12192050392` |
| Handle `handle64.exe` | 5.0 | `24BAFCC570CC9BBB6B6E6652A57A519E0464E3996891AABA6F55299CCE20B04F` |
| TCPView `tcpvcon.exe` | 4.19 | `37621BDAC3CED1103278E8C0EF7B73DFA1CBE9BECFBAFF421A46FBC78D636B5F` |
| VMMap `vmmap.exe` | 3.4 | `A834987F7B6098027E3392366F3985F5644BBE7396406E2A43E5688DDC00BBDF` |
| ListDLLs `Listdlls64.exe` | 3.3 | `641405893F7966A065897758F8EDF611610D764175D2BC4D96FBEDA96409D058` |

## How the UI starts

The public shortcut starts `Vdash.Frontend.exe` 2.5.115.82 with no arguments. Launching that file produced one child and then the bootstrap exited:

`Vdash.Frontend.exe` (PID 5740) created `Frontend.exe` (PID 43680) with the command line `"C:\Users\t-lar\AppData\Local\VDASH\VDASH2\Frontend.exe"`.

Eight seconds later only `Frontend.exe` remained from that pair. Its window title was `VDASH`. It had no child process. `Vdash.Monitor.exe` (PID 40920, version 0.1.2.1) was already running and was left running. Its parent PID was no longer alive, and this launch did not create a second monitor. No Windows service has a VDash image path.

## Where the code lives

`Frontend.exe` is a 32-bit .NET Framework 4 process. ListDLLs shows `mscoreei.dll`, `clr.dll`, and `clrjit.dll`, plus the native WPF libraries. The product assemblies are open as files in that process, and they are not separate native modules:

`Core.dll`, `Client.Core.dll`, `Frontend.Core.dll`, `Frontend.Client.Core.dll`, `Microsoft.Web.WebView2.Core.dll`, `protobuf-net.dll`, `OxyPlot.dll`, the SharpVectors assemblies, and `K4os.Compression.LZ4.dll`.

`Vdash.Monitor.exe` is also a 32-bit .NET Framework 4 process. Its native module list did not change during UI startup. It has `Hardcodet.NotifyIcon.Wpf.dll` open and the `iamm` directory open. The monitor did not load `Core.dll`.

Between about 8 seconds and 35 seconds after the UI appeared, `Frontend.exe` gained 18 native modules. All of them are Windows components: `wininet.dll`, `winhttp.dll`, `schannel.dll`, `ncrypt.dll`, `rasapi32.dll`, and the firewall API DLLs. No second managed product module was added to the native module list in that interval.

## Local IPC and files

`\\.\pipe\VdashPipeLocal` was absent before the launch and present after it. The owning process was not identified; a full handle search did not finish. No other pipe name matching VDash, J2534, DiCE, Mongoose, or Codiag appeared.

While the main window was open and idle, `Frontend.exe` probed these paths. None of them exists. Both the query and the create returned `STATUS_OBJECT_PATH_NOT_FOUND` (`0xC000003A`):

- `C:\Temp\log\`
- `C:\VIDA\System\Log\Diagnostics`
- `C:\Users\t-lar\VIDA\PROD\LogFiles\Diagnostics`

The same idle interval opened the 32-bit WMI classes `PSFactoryBuffer` (`wbemsvc.dll`, CLSID `{7C857801-7381-11CF-884D-00AA004B2E24}`) and `WBEM Locator` (`wbemprox.dll`, CLSID `{4590F811-1D3A-11D0-891F-00AA004B2E24}`). It also read the TCP/IP hostname and domain parameters. It did not open `PassThruSupport.04.04` or `monpj432.dll`.

## Network

`Frontend.exe` connected to `d5t5.com` (`217.16.189.155`) on TCP port 46000. Two established sockets were still open when the ports were read, and a 20-second idle trace recorded send and receive on one of them. The trace does not include the payload. An earlier connection list also named `217.16.189.153` (`d5t5.com`) and `85.207.44.86` (`static.ralskonet.cz`) without showing their ports; those two were not still established when the port query ran. No loopback listener belonging to Frontend was established. The monitor had no TCP connection in that list.

## Executable pages

VMMap snapshots at about 8 seconds and 35 seconds show the same private committed region inside the `Frontend.exe` image: address `15343616`, size 8,761,344 bytes, all of it private, protection value 64 (`PAGE_EXECUTE_READWRITE`). One 4,096-byte private page of `.text` has the same protection. Those regions did not appear or grow between the two snapshots. The capture started after the process existed, so it does not show the call that made them writable and executable. `VirtualProtect` remains an import seen in the file, not a call observed here.

The CLR stub heaps are also protection 64. That is the normal JIT layout and is separate from the image region above. No additional executable image was mapped under the VDash directory during this window.

## What this does not show

No adapter was opened by VDash and no vehicle request was sent. `FindImplementation`, `Diagnose`, `RegisterPassThru`, and `ProcessJ2534` were not traced as calls. Whether a later diagnostic action stays inside `Frontend.exe`, loads `monpj432.dll`, or uses another process is still unknown. The idle process does not load a J2534 DLL and does not keep a diagnostic helper running.

After `USB\VID_E327&PID_2534` had enumerated as COM3, an 18-second idle trace of `Frontend.exe` contained eight thread create and exit events. None of them named COM3, `usbser`, PassThru, `monpj432`, or the USB id. Handle inspection of that process also found no open reference to COM3 or a PassThru DLL. VDash did not select this adapter during the idle window. The adapter's own serial response is in `CODIAG_HARDWARE_ANALYSIS.md`.
