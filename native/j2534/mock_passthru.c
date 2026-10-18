#include <windows.h>
#include <string.h>

#define STATUS_NOERROR 0x00
#define ERR_INVALID_CHANNEL_ID 0x02
#define ERR_INVALID_PROTOCOL_ID 0x03
#define ERR_NULL_PARAMETER 0x04
#define ERR_INVALID_IOCTL_ID 0x0F
#define ERR_INVALID_IOCTL_VALUE 0x05
#define ERR_FAILED 0x07
#define ERR_TIMEOUT 0x09
#define ERR_INVALID_MSG 0x0A
#define ERR_DEVICE_IN_USE 0x0E
#define ERR_BUFFER_EMPTY 0x10
#define ERR_CHANNEL_IN_USE 0x14
#define ERR_INVALID_FILTER_ID 0x16
#define ERR_INVALID_BAUDRATE 0x19
#define ERR_INVALID_DEVICE_ID 0x1A

#define CAN 5
#define ISO15765 6
#define PASS_FILTER 1
#define BLOCK_FILTER 2
#define FLOW_CONTROL_FILTER 3
#define GET_CONFIG 0x01
#define SET_CONFIG 0x02
#define READ_VBATT 0x03
#define CLEAR_TX_BUFFER 0x07
#define CLEAR_RX_BUFFER 0x08
#define CLEAR_MSG_FILTERS 0x0A
#define DATA_RATE 0x01
#define DATA_BYTES 4128
#define QUEUE_LIMIT 16

typedef struct {
    unsigned long ProtocolID;
    unsigned long RxStatus;
    unsigned long TxFlags;
    unsigned long Timestamp;
    unsigned long DataSize;
    unsigned long ExtraDataIndex;
    unsigned char Data[DATA_BYTES];
} PASSTHRU_MSG;

typedef struct {
    unsigned long Parameter;
    unsigned long Value;
} SCONFIG;

typedef struct {
    unsigned long NumOfParams;
    SCONFIG *ConfigPtr;
} SCONFIG_LIST;

static char g_last_error[80];
static int g_open;
static int g_connected;
static unsigned long g_protocol;
static unsigned long g_baud;
static unsigned long g_next_filter;
static unsigned long g_filter_count;
static PASSTHRU_MSG g_queue[QUEUE_LIMIT];
static unsigned long g_head;
static unsigned long g_count;
static unsigned long g_clock;

static void set_error(const char *text) {
    strncpy(g_last_error, text, sizeof(g_last_error) - 1);
    g_last_error[sizeof(g_last_error) - 1] = 0;
}

static void clear_session(void) {
    g_connected = 0;
    g_protocol = 0;
    g_baud = 0;
    g_next_filter = 1;
    g_filter_count = 0;
    g_head = 0;
    g_count = 0;
    g_clock = 0;
}

static int valid_message(const PASSTHRU_MSG *message) {
    if (message == NULL) {
        set_error("NULL message");
        return ERR_NULL_PARAMETER;
    }
    if (message->DataSize > DATA_BYTES) {
        set_error("Message data is larger than 4128 bytes");
        return ERR_INVALID_MSG;
    }
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruOpen(void *name, unsigned long *device_id) {
    (void)name;
    if (device_id == NULL) {
        set_error("NULL device id");
        return ERR_NULL_PARAMETER;
    }
    if (g_open) {
        set_error("Device is already open");
        return ERR_DEVICE_IN_USE;
    }
    g_open = 1;
    clear_session();
    *device_id = 1;
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruClose(unsigned long device_id) {
    if (!g_open || device_id != 1) {
        set_error("Device is not open");
        return ERR_INVALID_DEVICE_ID;
    }
    g_open = 0;
    clear_session();
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruReadVersion(
    unsigned long device_id, char *firmware, char *dll, char *api) {
    if (!g_open || device_id != 1) {
        set_error("Device is not open");
        return ERR_INVALID_DEVICE_ID;
    }
    if (firmware == NULL || dll == NULL || api == NULL) {
        set_error("NULL version buffer");
        return ERR_NULL_PARAMETER;
    }
    strncpy(firmware, "SIM-FW-0", 79);
    strncpy(dll, "SIM-DLL-1", 79);
    strncpy(api, "04.04", 79);
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruGetLastError(char *description) {
    if (description == NULL) {
        return ERR_NULL_PARAMETER;
    }
    strncpy(description, g_last_error, 79);
    description[79] = 0;
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruConnect(
    unsigned long device_id, unsigned long protocol, unsigned long flags,
    unsigned long baud, unsigned long *channel_id) {
    (void)flags;
    if (!g_open || device_id != 1) {
        set_error("Device is not open");
        return ERR_INVALID_DEVICE_ID;
    }
    if (channel_id == NULL) {
        set_error("NULL channel id");
        return ERR_NULL_PARAMETER;
    }
    if (g_connected) {
        set_error("Channel is already connected");
        return ERR_CHANNEL_IN_USE;
    }
    if (protocol != CAN && protocol != ISO15765) {
        set_error("Protocol is not supported by the simulated driver");
        return ERR_INVALID_PROTOCOL_ID;
    }
    if (baud != 500000) {
        set_error("Simulated driver accepts 500000 only");
        return ERR_INVALID_BAUDRATE;
    }
    g_connected = 1;
    g_protocol = protocol;
    g_baud = baud;
    *channel_id = 7;
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruDisconnect(unsigned long channel_id) {
    if (!g_connected || channel_id != 7) {
        set_error("Channel is not connected");
        return ERR_INVALID_CHANNEL_ID;
    }
    clear_session();
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruReadMsgs(
    unsigned long channel_id, PASSTHRU_MSG *messages, unsigned long *count, unsigned long timeout) {
    if (!g_connected || channel_id != 7) {
        set_error("Channel is not connected");
        return ERR_INVALID_CHANNEL_ID;
    }
    if (messages == NULL || count == NULL) {
        set_error("NULL read buffer");
        return ERR_NULL_PARAMETER;
    }
    if (*count == 0) {
        set_error("Read count is zero");
        return ERR_INVALID_MSG;
    }
    if (g_count == 0) {
        if (timeout == 0) {
            *count = 0;
            set_error("Receive queue is empty");
            return ERR_BUFFER_EMPTY;
        }
        Sleep(timeout > 200 ? 200 : timeout);
        *count = 0;
        set_error("Receive timeout");
        return ERR_TIMEOUT;
    }
    messages[0] = g_queue[g_head];
    g_head = (g_head + 1) % QUEUE_LIMIT;
    g_count -= 1;
    *count = 1;
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

static int enqueue_response(const PASSTHRU_MSG *request) {
    PASSTHRU_MSG response;
    unsigned long index;
    if (g_filter_count == 0) {
        return STATUS_NOERROR;
    }
    if (g_count >= QUEUE_LIMIT) {
        set_error("Receive queue is full");
        return ERR_FAILED;
    }
    memset(&response, 0, sizeof(response));
    response.ProtocolID = g_protocol;
    response.Timestamp = g_clock;
    g_clock += 1000;
    response.DataSize = 5;
    response.Data[0] = 'M';
    response.Data[1] = 'O';
    response.Data[2] = 'C';
    response.Data[3] = 'K';
    response.Data[4] = request->DataSize > 0 ? request->Data[0] : 0;
    index = (g_head + g_count) % QUEUE_LIMIT;
    g_queue[index] = response;
    g_count += 1;
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruWriteMsgs(
    unsigned long channel_id, PASSTHRU_MSG *messages, unsigned long *count, unsigned long timeout) {
    unsigned long status;
    (void)timeout;
    if (!g_connected || channel_id != 7) {
        set_error("Channel is not connected");
        return ERR_INVALID_CHANNEL_ID;
    }
    if (messages == NULL || count == NULL) {
        set_error("NULL write buffer");
        return ERR_NULL_PARAMETER;
    }
    if (*count != 1) {
        set_error("Simulated driver accepts one message per write");
        return ERR_INVALID_MSG;
    }
    status = valid_message(&messages[0]);
    if (status != STATUS_NOERROR) {
        return status;
    }
    status = enqueue_response(&messages[0]);
    if (status != STATUS_NOERROR) {
        return status;
    }
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruStartMsgFilter(
    unsigned long channel_id, unsigned long filter_type, PASSTHRU_MSG *mask,
    PASSTHRU_MSG *pattern, PASSTHRU_MSG *flow, unsigned long *filter_id) {
    long status;
    if (!g_connected || channel_id != 7) {
        set_error("Channel is not connected");
        return ERR_INVALID_CHANNEL_ID;
    }
    if (filter_id == NULL) {
        set_error("NULL filter id");
        return ERR_NULL_PARAMETER;
    }
    if (filter_type != PASS_FILTER && filter_type != BLOCK_FILTER && filter_type != FLOW_CONTROL_FILTER) {
        set_error("Unknown filter type");
        return ERR_INVALID_IOCTL_VALUE;
    }
    status = valid_message(mask);
    if (status != STATUS_NOERROR) return status;
    status = valid_message(pattern);
    if (status != STATUS_NOERROR) return status;
    if (filter_type == FLOW_CONTROL_FILTER) {
        status = valid_message(flow);
        if (status != STATUS_NOERROR) return status;
    }
    *filter_id = g_next_filter++;
    g_filter_count += 1;
    set_error("STATUS_NOERROR");
    return STATUS_NOERROR;
}

__declspec(dllexport) long __stdcall PassThruIoctl(
    unsigned long handle, unsigned long ioctl_id, void *input, void *output) {
    if (!g_open) {
        set_error("Device is not open");
        return ERR_INVALID_DEVICE_ID;
    }
    if (ioctl_id == READ_VBATT) {
        if (output == NULL) {
            set_error("NULL voltage output");
            return ERR_NULL_PARAMETER;
        }
        *(unsigned long *)output = 0;
        set_error("STATUS_NOERROR");
        return STATUS_NOERROR;
    }
    if (!g_connected || handle != 7) {
        set_error("Channel is not connected");
        return ERR_INVALID_CHANNEL_ID;
    }
    if (ioctl_id == CLEAR_RX_BUFFER) {
        g_head = 0;
        g_count = 0;
        set_error("STATUS_NOERROR");
        return STATUS_NOERROR;
    }
    if (ioctl_id == CLEAR_TX_BUFFER || ioctl_id == CLEAR_MSG_FILTERS) {
        if (ioctl_id == CLEAR_MSG_FILTERS) g_filter_count = 0;
        set_error("STATUS_NOERROR");
        return STATUS_NOERROR;
    }
    if (ioctl_id == GET_CONFIG || ioctl_id == SET_CONFIG) {
        SCONFIG_LIST *list = (SCONFIG_LIST *)input;
        unsigned long index;
        if (list == NULL || list->ConfigPtr == NULL) {
            set_error("NULL configuration list");
            return ERR_NULL_PARAMETER;
        }
        for (index = 0; index < list->NumOfParams; index++) {
            if (list->ConfigPtr[index].Parameter == DATA_RATE) {
                if (ioctl_id == GET_CONFIG) list->ConfigPtr[index].Value = g_baud;
                else g_baud = list->ConfigPtr[index].Value;
            } else {
                set_error("Unsupported configuration parameter");
                return ERR_INVALID_IOCTL_VALUE;
            }
        }
        set_error("STATUS_NOERROR");
        return STATUS_NOERROR;
    }
    (void)output;
    set_error("Ioctl is not implemented by the simulated driver");
    return ERR_INVALID_IOCTL_ID;
}
