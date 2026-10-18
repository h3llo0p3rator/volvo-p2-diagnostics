import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface J2534Port {
  listAdapters(): Promise<readonly { id: string; label: string }[]>
  connect(adapterId: string): Promise<void>
  disconnect(): Promise<void>
  readIdentity(): Promise<{ text: string }>
  readControllers(): Promise<readonly unknown[]>
  readTroubleCodes(): Promise<readonly unknown[]>
  readSignals(): Promise<readonly unknown[]>
}

export class VehicleAccessDisabled extends Error {
  constructor() {
    super('Vehicle identification is disabled until a vehicle is connected and a verified request is configured.')
    this.name = 'VehicleAccessDisabled'
  }
}

interface HelperResult {
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

interface DriverRecord {
  name: string
  library: string
}

const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../native/j2534/bin/J2534Helper.exe')

export function createJ2534Port(): J2534Port {
  let child: ChildProcessWithoutNullStreams | null = null
  let nextId = 1
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

  function ensure(): ChildProcessWithoutNullStreams {
    if (process.platform !== 'win32') {
      throw new Error('The J2534 helper runs on Windows only.')
    }
    if (child) return child
    child = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    const lines = createInterface({ input: child.stdout })
    lines.on('line', (line) => {
      const message = JSON.parse(line) as HelperResult
      const waiter = pending.get(message.id)
      if (!waiter) return
      pending.delete(message.id)
      if (message.ok) waiter.resolve(message.result)
      else waiter.reject(new Error(message.error ?? 'J2534 helper failed'))
    })
    child.on('exit', () => {
      child = null
      for (const waiter of pending.values()) waiter.reject(new Error('J2534 helper exited'))
      pending.clear()
    })
    return child
  }

  function request(op: string, fields: Record<string, unknown> = {}): Promise<unknown> {
    const process = ensure()
    const id = nextId++
    const payload = JSON.stringify({ id, op, ...fields })
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      process.stdin.write(`${payload}\n`)
    })
  }

  return {
    async listAdapters() {
      const drivers = (await request('discover')) as DriverRecord[]
      return drivers.map((driver) => ({ id: driver.library, label: driver.name }))
    },
    async connect(adapterId: string) {
      await request('load', { library: adapterId })
      await request('open')
    },
    async disconnect() {
      if (!child) return
      await request('close')
      await request('quit')
    },
    readIdentity() {
      return Promise.reject(new VehicleAccessDisabled())
    },
    readControllers() {
      return Promise.reject(new VehicleAccessDisabled())
    },
    readTroubleCodes() {
      return Promise.reject(new VehicleAccessDisabled())
    },
    readSignals() {
      return Promise.reject(new VehicleAccessDisabled())
    },
  }
}
