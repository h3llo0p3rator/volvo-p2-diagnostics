using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Win32;

internal static class J2534Helper
{
    private const int StatusNoError = 0x00;
    private const int ErrInvalidChannel = 0x02;
    private const int ErrNull = 0x04;
    private const int ErrTimeout = 0x09;
    private const int ErrBufferEmpty = 0x10;
    private const int DataBytes = 4128;
    private const int ReadVbatt = 0x03;
    private const int GetConfig = 0x01;
    private const int DataRate = 0x01;

    [StructLayout(LayoutKind.Sequential)]
    private struct PassThruMsg
    {
        public uint ProtocolID;
        public uint RxStatus;
        public uint TxFlags;
        public uint Timestamp;
        public uint DataSize;
        public uint ExtraDataIndex;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = DataBytes)]
        public byte[] Data;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SConfig
    {
        public uint Parameter;
        public uint Value;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SConfigList
    {
        public uint NumOfParams;
        public IntPtr ConfigPtr;
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int OpenDelegate(IntPtr name, out uint deviceId);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int CloseDelegate(uint deviceId);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int ReadVersionDelegate(uint deviceId, StringBuilder firmware, StringBuilder dll, StringBuilder api);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int GetLastErrorDelegate(StringBuilder description);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int ConnectDelegate(uint deviceId, uint protocol, uint flags, uint baud, out uint channelId);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int DisconnectDelegate(uint channelId);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int ReadMsgsDelegate(uint channelId, IntPtr messages, ref uint count, uint timeout);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int WriteMsgsDelegate(uint channelId, IntPtr messages, ref uint count, uint timeout);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int StartFilterDelegate(uint channelId, uint filterType, IntPtr mask, IntPtr pattern, IntPtr flow, out uint filterId);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int IoctlDelegate(uint handle, uint ioctlId, IntPtr input, IntPtr output);

    private static IntPtr library;
    private static OpenDelegate open;
    private static CloseDelegate close;
    private static ReadVersionDelegate readVersion;
    private static GetLastErrorDelegate getLastError;
    private static ConnectDelegate connect;
    private static DisconnectDelegate disconnect;
    private static ReadMsgsDelegate readMsgs;
    private static WriteMsgsDelegate writeMsgs;
    private static StartFilterDelegate startFilter;
    private static IoctlDelegate ioctl;
    private static uint deviceId;
    private static uint channelId;
    private static bool deviceOpen;
    private static bool channelOpen;

    public static int Main(string[] args)
    {
        try
        {
            if (Has(args, "--self-test")) return SelfTest(Value(args, "--self-test"), Value(args, "--export"));
            if (Has(args, "--list")) return ListDrivers(Value(args, "--export"));
            if (Has(args, "--vehicle-id")) return VehicleMode(args);
            if (Has(args, "--probe")) return Probe(Value(args, "--probe"));
            return Serve();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static int ListDrivers(string exportPath)
    {
        var report = new Dictionary<string, object> {
            { "kind", "registry" },
            { "verifiedHardware", false },
            { "drivers", Discover() }
        };
        var json = new JavaScriptSerializer().Serialize(report);
        Console.WriteLine(json);
        if (!string.IsNullOrEmpty(exportPath)) File.WriteAllText(exportPath, json);
        return 0;
    }

    private static int VehicleMode(string[] args)
    {
        if (!Has(args, "--confirm-vehicle-connected"))
        {
            Console.WriteLine("Vehicle identification is disabled until a vehicle is connected and this test is started with --confirm-vehicle-connected.");
            return 2;
        }
        Console.WriteLine("No verified identification request is configured. The helper will not transmit one.");
        var libraryPath = Value(args, "--library");
        if (string.IsNullOrEmpty(libraryPath)) return 2;
        Load(libraryPath);
        try
        {
            Require(open(IntPtr.Zero, out deviceId), "PassThruOpen");
            deviceOpen = true;
            var versions = ReadVersions();
            var voltage = ReadVoltage();
            Console.WriteLine("firmware=" + versions[0] + " dll=" + versions[1] + " api=" + versions[2] + " vbatt=" + voltage);
            return 2;
        }
        finally
        {
            SafeClose();
            FreeLibrary();
        }
    }

    private static int Probe(string libraryPath)
    {
        Load(libraryPath);
        try
        {
            Require(open(IntPtr.Zero, out deviceId), "PassThruOpen");
            deviceOpen = true;
            var versions = ReadVersions();
            WriteJson(new Dictionary<string, object> {
                { "kind", "hardware" },
                { "verifiedHardware", true },
                { "opened", true },
                { "messagesSent", false },
                { "firmware", versions[0] },
                { "dll", versions[1] },
                { "api", versions[2] }
            });
            return 0;
        }
        finally
        {
            SafeClose();
            FreeLibrary();
        }
    }

    private static int SelfTest(string libraryPath, string exportPath)
    {
        var checks = new List<Dictionary<string, object>>();
        Load(libraryPath);
        try
        {
            Check(checks, "resolve", open != null && close != null && readVersion != null && getLastError != null && connect != null && disconnect != null && readMsgs != null && writeMsgs != null && startFilter != null && ioctl != null);
            Check(checks, "open", open(IntPtr.Zero, out deviceId) == StatusNoError && deviceId == 1);
            deviceOpen = true;
            var versions = ReadVersions();
            Check(checks, "version", versions[0] == "SIM-FW-0" && versions[1] == "SIM-DLL-1" && versions[2] == "04.04");
            uint ignored;
            var second = open(IntPtr.Zero, out ignored);
            Check(checks, "second-open-rejected", second != StatusNoError && LastError().IndexOf("already open") >= 0);
            uint channel;
            var badProtocol = connect(deviceId, 99, 0, 500000, out channel);
            Check(checks, "reject-protocol", badProtocol != StatusNoError);
            var badBaud = connect(deviceId, 6, 0, 33300, out channel);
            Check(checks, "reject-baud", badBaud != StatusNoError);
            Check(checks, "connect", connect(deviceId, 6, 0, 500000, out channelId) == StatusNoError && channelId == 7);
            channelOpen = true;
            Check(checks, "second-connect-rejected", connect(deviceId, 6, 0, 500000, out channel) != StatusNoError);
            var request = new PassThruMsg { ProtocolID = 6, DataSize = 1, Data = new byte[DataBytes] };
            request.Data[0] = 0x3E;
            uint written = 1;
            Check(checks, "write-without-filter-keeps-queue-empty", Write(request, ref written) == StatusNoError && ReadOne(0) == null);
            uint filterId;
            Check(checks, "filter", StartPassFilter(out filterId) == StatusNoError && filterId == 1);
            written = 1;
            Check(checks, "write", Write(request, ref written) == StatusNoError);
            var response = ReadOne(0);
            Check(checks, "simulated-response", IsMockResponse(response));
            Check(checks, "empty-read", ReadOne(0) == null && LastError().IndexOf("empty") >= 0);
            Check(checks, "timeout", ReadRaw(40) == ErrTimeout);
            Check(checks, "voltage", ReadVoltage() == 0);
            Check(checks, "data-rate", ReadDataRate() == 500000);
            Check(checks, "disconnect", disconnect(channelId) == StatusNoError);
            channelOpen = false;
            Check(checks, "close", close(deviceId) == StatusNoError);
            deviceOpen = false;
            Check(checks, "reopen", open(IntPtr.Zero, out deviceId) == StatusNoError);
            deviceOpen = true;
            Check(checks, "cleanup-close", close(deviceId) == StatusNoError);
            deviceOpen = false;
        }
        finally
        {
            SafeClose();
            FreeLibrary();
        }
        var failed = checks.Exists(item => !(bool)item["passed"]);
        var report = new Dictionary<string, object> {
            { "kind", "simulated" },
            { "verifiedHardware", false },
            { "passed", !failed },
            { "checks", checks }
        };
        var json = new JavaScriptSerializer().Serialize(report);
        Console.WriteLine(json);
        if (!string.IsNullOrEmpty(exportPath)) File.WriteAllText(exportPath, json);
        return failed ? 1 : 0;
    }

    private static int Serve()
    {
        var parser = new JavaScriptSerializer();
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            if (line.Trim().Length == 0) continue;
            var request = parser.Deserialize<Dictionary<string, object>>(line);
            var id = request.ContainsKey("id") ? request["id"] : 0;
            try
            {
                var op = Convert.ToString(request["op"]);
                object result = Dispatch(op, request);
                WriteJson(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "result", result } });
            }
            catch (Exception ex)
            {
                WriteJson(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", ex.Message } });
            }
        }
        SafeClose();
        FreeLibrary();
        return 0;
    }

    private static object Dispatch(string op, Dictionary<string, object> request)
    {
        switch (op)
        {
            case "discover": return Discover();
            case "load":
                Load(Convert.ToString(request["library"]));
                return new Dictionary<string, object> { { "loaded", true } };
            case "open":
                Require(open(IntPtr.Zero, out deviceId), "PassThruOpen");
                deviceOpen = true;
                return new Dictionary<string, object> { { "deviceId", deviceId } };
            case "close":
                SafeClose();
                return new Dictionary<string, object> { { "closed", true } };
            case "readVersion":
                var versions = ReadVersions();
                return new Dictionary<string, object> { { "firmware", versions[0] }, { "dll", versions[1] }, { "api", versions[2] } };
            case "getLastError":
                return new Dictionary<string, object> { { "error", LastError() } };
            case "connect":
                uint channel;
                Require(connect(deviceId, Convert.ToUInt32(request["protocol"]), Convert.ToUInt32(request["flags"]), Convert.ToUInt32(request["baud"]), out channel), "PassThruConnect");
                channelId = channel;
                channelOpen = true;
                return new Dictionary<string, object> { { "channelId", channelId } };
            case "disconnect":
                if (channelOpen) Require(disconnect(channelId), "PassThruDisconnect");
                channelOpen = false;
                return new Dictionary<string, object> { { "disconnected", true } };
            case "readMsgs":
                var message = ReadOne(Convert.ToUInt32(request["timeout"]));
                return message == null
                    ? (object)new Dictionary<string, object> { { "messages", new object[0] } }
                    : new Dictionary<string, object> { { "messages", new object[] { ToMap(message.Value) } } };
            case "writeMsgs":
                RefuseHardwareWrite();
                var outgoing = FromHex(Convert.ToString(request["data"]), Convert.ToUInt32(request["protocol"]));
                uint count = 1;
                Require(Write(outgoing, ref count), "PassThruWriteMsgs");
                return new Dictionary<string, object> { { "written", count }, { "simulatedOnly", true } };
            case "startMsgFilter":
                uint filter;
                Require(StartPassFilter(out filter), "PassThruStartMsgFilter");
                return new Dictionary<string, object> { { "filterId", filter } };
            case "ioctl":
                return Ioctl(Convert.ToUInt32(request["ioctl"]));
            case "quit":
                SafeClose();
                FreeLibrary();
                Environment.Exit(0);
                return null;
            default:
                throw new InvalidOperationException("Unknown operation " + op);
        }
    }

    private static void RefuseHardwareWrite()
    {
        var location = loadedPath ?? "";
        if (location.IndexOf("mock_passthru.dll", StringComparison.OrdinalIgnoreCase) < 0)
            throw new InvalidOperationException("Diagnostic writes are refused unless the loaded library is the simulated driver.");
    }

    private static string loadedPath;

    private static object Ioctl(uint code)
    {
        if (code == ReadVbatt)
            return new Dictionary<string, object> { { "vbatt", ReadVoltage() } };
        if (code == GetConfig)
            return new Dictionary<string, object> { { "dataRate", ReadDataRate() } };
        throw new InvalidOperationException("Unsupported ioctl " + code);
    }

    private static List<Dictionary<string, object>> Discover()
    {
        var found = new List<Dictionary<string, object>>();
        Collect(RegistryView.Registry32, found);
        Collect(RegistryView.Registry64, found);
        return found;
    }

    private static void Collect(RegistryView view, List<Dictionary<string, object>> found)
    {
        string[] roots = { @"SOFTWARE\PassThruSupport.04.04", @"SOFTWARE\PassThruSupport.05.00" };
        using (var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
        {
            foreach (var rootName in roots)
            {
                using (var root = baseKey.OpenSubKey(rootName))
                {
                    if (root == null) continue;
                    foreach (var child in root.GetSubKeyNames())
                    {
                        using (var key = root.OpenSubKey(child))
                        {
                            if (key == null) continue;
                            var libraryPath = Convert.ToString(key.GetValue("FunctionLibrary"));
                            if (string.IsNullOrEmpty(libraryPath)) continue;
                            var protocols = new List<string>();
                            foreach (var name in key.GetValueNames())
                            {
                                if (name == "Name" || name == "Vendor" || name == "FunctionLibrary" || name == "ConfigApplication") continue;
                                if (Convert.ToString(key.GetValue(name)) == "1") protocols.Add(name);
                            }
                            found.Add(new Dictionary<string, object> {
                                { "registry", rootName },
                                { "view", view.ToString() },
                                { "name", Convert.ToString(key.GetValue("Name")) ?? child },
                                { "vendor", Convert.ToString(key.GetValue("Vendor")) ?? "" },
                                { "library", libraryPath },
                                { "protocols", protocols }
                            });
                        }
                    }
                }
            }
        }
    }

    private static void Load(string path)
    {
        FreeLibrary();
        loadedPath = Path.GetFullPath(path);
        library = LoadLibrary(loadedPath);
        if (library == IntPtr.Zero) throw new InvalidOperationException("LoadLibrary failed for " + loadedPath + " win32=" + Marshal.GetLastWin32Error());
        open = Get<OpenDelegate>("PassThruOpen");
        close = Get<CloseDelegate>("PassThruClose");
        readVersion = Get<ReadVersionDelegate>("PassThruReadVersion");
        getLastError = Get<GetLastErrorDelegate>("PassThruGetLastError");
        connect = Get<ConnectDelegate>("PassThruConnect");
        disconnect = Get<DisconnectDelegate>("PassThruDisconnect");
        readMsgs = Get<ReadMsgsDelegate>("PassThruReadMsgs");
        writeMsgs = Get<WriteMsgsDelegate>("PassThruWriteMsgs");
        startFilter = Get<StartFilterDelegate>("PassThruStartMsgFilter");
        ioctl = Get<IoctlDelegate>("PassThruIoctl");
    }

    private static T Get<T>(string name) where T : class
    {
        var address = GetProcAddress(library, name);
        if (address == IntPtr.Zero) throw new InvalidOperationException("Missing export " + name);
        return Marshal.GetDelegateForFunctionPointer(address, typeof(T)) as T;
    }

    private static string[] ReadVersions()
    {
        var firmware = new StringBuilder(80);
        var dll = new StringBuilder(80);
        var api = new StringBuilder(80);
        Require(readVersion(deviceId, firmware, dll, api), "PassThruReadVersion");
        return new[] { firmware.ToString(), dll.ToString(), api.ToString() };
    }

    private static uint ReadVoltage()
    {
        var output = Marshal.AllocHGlobal(4);
        try
        {
            Require(ioctl(deviceOpen ? deviceId : 0, ReadVbatt, IntPtr.Zero, output), "READ_VBATT");
            return (uint)Marshal.ReadInt32(output);
        }
        finally { Marshal.FreeHGlobal(output); }
    }

    private static uint ReadDataRate()
    {
        var config = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SConfig)));
        var list = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SConfigList)));
        try
        {
            Marshal.StructureToPtr(new SConfig { Parameter = DataRate, Value = 0 }, config, false);
            Marshal.StructureToPtr(new SConfigList { NumOfParams = 1, ConfigPtr = config }, list, false);
            Require(ioctl(channelId, GetConfig, list, IntPtr.Zero), "GET_CONFIG");
            var read = (SConfig)Marshal.PtrToStructure(config, typeof(SConfig));
            return read.Value;
        }
        finally
        {
            Marshal.FreeHGlobal(config);
            Marshal.FreeHGlobal(list);
        }
    }

    private static int StartPassFilter(out uint filterId)
    {
        var mask = AllocMessage(new PassThruMsg { DataSize = 1, Data = new byte[DataBytes] });
        var pattern = AllocMessage(new PassThruMsg { DataSize = 1, Data = new byte[DataBytes] });
        try
        {
            return startFilter(channelId, 1, mask, pattern, IntPtr.Zero, out filterId);
        }
        finally
        {
            Marshal.FreeHGlobal(mask);
            Marshal.FreeHGlobal(pattern);
        }
    }

    private static int Write(PassThruMsg message, ref uint count)
    {
        var pointer = AllocMessage(message);
        try { return writeMsgs(channelId, pointer, ref count, 0); }
        finally { Marshal.FreeHGlobal(pointer); }
    }

    private static bool IsMockResponse(PassThruMsg? message)
    {
        if (!message.HasValue) return false;
        var value = message.Value;
        return value.DataSize == 5 && value.Data != null && value.Data[0] == (byte)'M' && value.Data[4] == 0x3E;
    }

    private static PassThruMsg? ReadOne(uint timeout)
    {
        var status = ReadRaw(timeout);
        if (status == ErrBufferEmpty || status == ErrTimeout) return null;
        if (status != StatusNoError) throw new InvalidOperationException(Failure("PassThruReadMsgs", status));
        return lastRead;
    }

    private static PassThruMsg lastRead;
    private static int ReadRaw(uint timeout)
    {
        uint count = 1;
        var pointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(PassThruMsg)));
        try
        {
            var status = readMsgs(channelId, pointer, ref count, timeout);
            if (status == StatusNoError && count == 1)
                lastRead = (PassThruMsg)Marshal.PtrToStructure(pointer, typeof(PassThruMsg));
            return status;
        }
        finally { Marshal.FreeHGlobal(pointer); }
    }

    private static PassThruMsg FromHex(string hex, uint protocol)
    {
        var bytes = new byte[DataBytes];
        var clean = hex.Replace(" ", "");
        var size = clean.Length / 2;
        for (var i = 0; i < size && i < DataBytes; i++)
            bytes[i] = Convert.ToByte(clean.Substring(i * 2, 2), 16);
        return new PassThruMsg { ProtocolID = protocol, DataSize = (uint)size, Data = bytes };
    }

    private static Dictionary<string, object> ToMap(PassThruMsg message)
    {
        var hex = new StringBuilder();
        for (var i = 0; i < message.DataSize && i < message.Data.Length; i++) hex.Append(message.Data[i].ToString("X2"));
        return new Dictionary<string, object> {
            { "protocol", message.ProtocolID },
            { "timestamp", message.Timestamp },
            { "data", hex.ToString() },
            { "simulated", true }
        };
    }

    private static IntPtr AllocMessage(PassThruMsg message)
    {
        if (message.Data == null || message.Data.Length != DataBytes)
        {
            var data = new byte[DataBytes];
            if (message.Data != null) Buffer.BlockCopy(message.Data, 0, data, 0, Math.Min(message.Data.Length, DataBytes));
            message.Data = data;
        }
        var pointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(PassThruMsg)));
        Marshal.StructureToPtr(message, pointer, false);
        return pointer;
    }

    private static void Require(int status, string operation)
    {
        if (status != StatusNoError) throw new InvalidOperationException(Failure(operation, status));
    }

    private static string Failure(string operation, int status)
    {
        return operation + " returned 0x" + status.ToString("X2") + " " + LastError();
    }

    private static string LastError()
    {
        if (getLastError == null) return "";
        var text = new StringBuilder(80);
        getLastError(text);
        return text.ToString();
    }

    private static void SafeClose()
    {
        if (channelOpen && disconnect != null)
        {
            disconnect(channelId);
            channelOpen = false;
        }
        if (deviceOpen && close != null)
        {
            close(deviceId);
            deviceOpen = false;
        }
    }

    private static void FreeLibrary()
    {
        SafeClose();
        if (library != IntPtr.Zero)
        {
            NativeFreeLibrary(library);
            library = IntPtr.Zero;
        }
        open = null;
        close = null;
        readVersion = null;
        getLastError = null;
        connect = null;
        disconnect = null;
        readMsgs = null;
        writeMsgs = null;
        startFilter = null;
        ioctl = null;
    }

    private static void Check(List<Dictionary<string, object>> checks, string name, bool passed)
    {
        checks.Add(new Dictionary<string, object> { { "name", name }, { "passed", passed }, { "simulated", true } });
    }

    private static void WriteJson(object value)
    {
        Console.WriteLine(new JavaScriptSerializer().Serialize(value));
    }

    private static bool Has(string[] args, string name)
    {
        foreach (var arg in args) if (arg == name) return true;
        return false;
    }

    private static string Value(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++) if (args[i] == name) return args[i + 1];
        return "";
    }

    [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr LoadLibrary(string path);
    [DllImport("kernel32", EntryPoint = "FreeLibrary", SetLastError = true)]
    private static extern bool NativeFreeLibrary(IntPtr module);
    [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Ansi)]
    private static extern IntPtr GetProcAddress(IntPtr module, string name);
}
