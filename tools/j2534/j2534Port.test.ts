import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { VehicleAccessDisabled, createJ2534Port } from './j2534Port.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const helper = path.join(root, 'native/j2534/bin/J2534Helper.exe')
const mock = path.join(root, 'native/j2534/bin/mock_passthru.dll')

describe('J2534 helper', () => {
  it('passes the simulated driver checks and does not call them hardware results', () => {
    const output = execFileSync(helper, ['--self-test', mock], { encoding: 'utf8' })
    const report = JSON.parse(output) as { kind: string; verifiedHardware: boolean; passed: boolean; checks: { name: string; passed: boolean }[] }
    expect(report.kind).toBe('simulated')
    expect(report.verifiedHardware).toBe(false)
    expect(report.passed).toBe(true)
    expect(report.checks.every((check) => check.passed)).toBe(true)
  })

  it('leaves vehicle identification disabled', () => {
    try {
      execFileSync(helper, ['--vehicle-id'], { encoding: 'utf8' })
      throw new Error('vehicle mode should have refused to start')
    } catch (error) {
      const failed = error as { status?: number; stdout?: string }
      expect(failed.status).toBe(2)
      expect(failed.stdout).toMatch(/disabled/)
    }
  })

  it('discovers registry drivers without opening them', () => {
    const output = execFileSync(helper, ['--list'], { encoding: 'utf8' })
    const report = JSON.parse(output) as { verifiedHardware: boolean; drivers: { library: string }[] }
    expect(report.verifiedHardware).toBe(false)
    expect(report.drivers.some((driver) => driver.library.toLowerCase().endsWith('monpj432.dll'))).toBe(true)
  })

  it('refuses vehicle reads from the port', async () => {
    const port = createJ2534Port()
    await expect(port.readIdentity()).rejects.toBeInstanceOf(VehicleAccessDisabled)
    await expect(port.readControllers()).rejects.toBeInstanceOf(VehicleAccessDisabled)
    await expect(port.readTroubleCodes()).rejects.toBeInstanceOf(VehicleAccessDisabled)
    await expect(port.readSignals()).rejects.toBeInstanceOf(VehicleAccessDisabled)
  })
})
