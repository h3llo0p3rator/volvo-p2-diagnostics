import { describe, expect, it } from 'vitest'
import {
  BACKUP_CONNECTION_NOTICE,
  CONNECTION_NOTICE,
  ENGINE_FAMILY_LABEL,
  HEX_PAGE_BYTES,
  HEX_ROW_BYTES,
  IDENTIFICATION_SIMULATED,
  IDENTIFICATION_UNREAD,
  RECOVERY_LOG,
  SIMULATED_IMAGE_MAGIC,
  SIMULATED_SOFTWARE_ID,
  WRITE_REFUSED_LOG,
  buildSimulatedImage,
  checkCompatibility,
  clearResearchReadings,
  compareImages,
  createResearch,
  describeComparison,
  describeIntegrity,
  formatHexPage,
  formatResearchReport,
  integrityOf,
  parseSRecords,
  planRecovery,
  prepareImport,
  refuseWrite,
  regionMap,
  researchViewModel,
  setResearchReadings,
  sha256Hex,
  storeBackup,
  type ResearchReadings,
} from './research.ts'

const VEHICLE = {
  id: 'recent-2007-xc70-d5',
  label: '2007 Volvo XC70 D5',
  identityText: 'VIN not read',
}

function readings(overrides: Partial<ResearchReadings> = {}): ResearchReadings {
  return {
    softwareId: SIMULATED_SOFTWARE_ID,
    result: IDENTIFICATION_SIMULATED,
    egrSensor: '0.18',
    egrVvt: '12',
    dpfLevel: 2,
    dpfLevelText: '2',
    dpfReadiness: 'Incomplete',
    ...overrides,
  }
}

describe('simulated image', () => {
  it('builds a sealed image with the simulated software id and an unidentified family', async () => {
    const image = await buildSimulatedImage()
    const again = await buildSimulatedImage()
    expect(new TextDecoder().decode(image.slice(0, SIMULATED_IMAGE_MAGIC.length))).toBe(SIMULATED_IMAGE_MAGIC)
    expect(new TextDecoder().decode(image)).toContain(SIMULATED_SOFTWARE_ID)
    expect(new TextDecoder().decode(image)).toContain('not-identified')
    expect(image.length).toBe(107)
    expect(compareImages(image, again)).toEqual({ equal: true, firstOffset: null, differingCount: 0 })
    expect(regionMap(image)).toEqual([
      { label: 'Header', offset: 0, length: 10 },
      { label: 'Identification', offset: 10, length: 25 },
      { label: 'Payload', offset: 35, length: 40 },
    ])
    const imported = await prepareImport('bench.img', image)
    expect(imported.name).toBe('bench.img')
    expect(imported.byteLength).toBe(image.length)
    expect(imported.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(imported.recordCount).toBeNull()
    expect(imported.regions).toHaveLength(3)
    expect(imported.integrity).toEqual({ status: 'match' })
  })
})

describe('integrity', () => {
  it('matches the stored seal and reports a hash for any other file', async () => {
    const image = await buildSimulatedImage()
    expect(await integrityOf(image)).toEqual({ status: 'match' })
    expect(describeIntegrity({ status: 'match' })).toBe('Seal matches')

    const tampered = image.slice()
    const payloadByte = tampered.length - 33
    tampered[payloadByte] = (tampered[payloadByte] ?? 0) ^ 0xff
    expect(await integrityOf(tampered)).toEqual({ status: 'mismatch' })
    expect(regionMap(tampered)?.map((region) => region.label)).toEqual([
      'Header',
      'Identification',
      'Payload',
    ])
    expect(describeIntegrity({ status: 'mismatch' })).toBe('Seal does not match')

    const foreign = new Uint8Array([0x00, 0x01, 0x02, 0xff])
    const recorded = await integrityOf(foreign)
    expect(recorded).toEqual({ status: 'recorded', sha256: await sha256Hex(foreign) })
    if (recorded.status === 'recorded') {
      expect(describeIntegrity(recorded)).toBe(`Hash recorded ${recorded.sha256}`)
      expect(recorded.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('compare', () => {
  it('reports equality or the first differing offset and the differing count', async () => {
    const image = await buildSimulatedImage()
    expect(compareImages(new Uint8Array(), new Uint8Array()).equal).toBe(true)
    const changed = image.slice()
    changed[10] = (changed[10] ?? 0) ^ 0x01
    const difference = compareImages(image, changed)
    expect(difference).toEqual({ equal: false, firstOffset: 10, differingCount: 1 })
    expect(describeComparison(difference)).toBe('First differing offset: 0x0000000A. Differing bytes: 1.')
    expect(describeComparison(difference).toLowerCase()).not.toContain('patch')

    const longer = new Uint8Array(image.length + 2)
    longer.set(image)
    expect(compareImages(image, longer)).toEqual({
      equal: false,
      firstOffset: image.length,
      differingCount: 2,
    })
  })
})

describe('regions', () => {
  it('refuses a region map for foreign bytes', async () => {
    expect(regionMap(new Uint8Array([1, 2, 3, 4]))).toBeNull()
    const image = await buildSimulatedImage()
    const extra = new Uint8Array(image.length + 1)
    extra.set(image)
    expect(regionMap(extra)).toBeNull()
    const imported = await prepareImport('raw.bin', new Uint8Array([9, 8, 7]))
    expect(imported.regions).toBeNull()
    expect(imported.integrity.status).toBe('recorded')
  })
})

describe('s-records', () => {
  it('parses a tiny valid record and leaves other files opaque', async () => {
    const record = new TextEncoder().encode('S107000001020304EE\n')
    const parsed = parseSRecords(record)
    expect(parsed?.records).toBe(1)
    expect(Array.from(parsed?.data ?? [])).toEqual([1, 2, 3, 4])
    expect(regionMap(record)).toBeNull()
    expect(regionMap(parsed?.data ?? new Uint8Array())).toBeNull()
    const imported = await prepareImport('tiny.s19', record)
    expect(imported.recordCount).toBe(1)
    expect(Array.from(imported.viewerBytes)).toEqual([1, 2, 3, 4])
    expect(imported.regions).toBeNull()
    expect(imported.integrity.status).toBe('recorded')
    expect(parseSRecords(new TextEncoder().encode('S10700000102030400'))).toBeNull()
    expect(parseSRecords(new Uint8Array([0, 1, 2, 3, 4]))).toBeNull()
    expect(parseSRecords(new TextEncoder().encode('not a record'))).toBeNull()
  })
})

describe('hex viewer', () => {
  it('pages 256 bytes and shows 16-byte rows with printable ASCII', () => {
    const row = new Uint8Array(HEX_ROW_BYTES).fill(0x41)
    row[0] = 0x00
    const formatted = formatHexPage(row, 0)
    expect(formatted.rows).toHaveLength(1)
    expect(formatted.rows[0]?.hex.trim().split(/\s+/)).toHaveLength(HEX_ROW_BYTES)
    expect(formatted.rows[0]?.ascii).toBe(`.${'A'.repeat(15)}`)
    expect(formatted.rows[0]?.offset).toBe('00000000')
    expect(formatHexPage(new Uint8Array(HEX_PAGE_BYTES), 0).pageCount).toBe(1)
    expect(formatHexPage(new Uint8Array(HEX_PAGE_BYTES + 1), 1).rows).toHaveLength(1)
  })
})

describe('programming log', () => {
  it('stores an opaque backup, then records compatibility, refusal, and recovery', async () => {
    const image = await buildSimulatedImage()
    const initial = createResearch()
    expect(await storeBackup(initial, image, false)).toBe(initial)

    let state = await storeBackup(initial, image, true)
    const hash = await sha256Hex(image)
    expect(state.programming).toBe('backup-stored')
    expect(state.log[0]).toContain(`${image.length} bytes`)
    expect(state.log[0]).toContain(hash)
    expect(state.backup?.bytes).not.toBe(image)
    expect(state.backup?.bytes).toEqual(image)
    expect(state.backup?.softwareId).toBe(SIMULATED_SOFTWARE_ID)
    image[0] = 0
    expect(state.backup?.bytes[0]).toBe(SIMULATED_IMAGE_MAGIC.charCodeAt(0))

    const backup = state.backup
    state = checkCompatibility(state)
    expect(state.programming).toBe('compatibility-match')
    expect(state.backup).toBe(backup)

    state = refuseWrite(state)
    expect(state.programming).toBe('write-refused')
    expect(state.log.at(-1)).toBe(WRITE_REFUSED_LOG)
    expect(state.backup).toBe(backup)

    state = planRecovery(state)
    expect(state.programming).toBe('recovery-planned')
    expect(state.backup).toBe(backup)
    expect(state.log.at(-1)).toBe(RECOVERY_LOG)
    expect(state.log.map((line) => line.split(':')[0])).toEqual([
      'Backup stored',
      'Compatibility match.',
      WRITE_REFUSED_LOG,
      RECOVERY_LOG,
    ])

    const other = await buildSimulatedImage({ softwareId: 'SIM-OTHER' })
    const mismatch = checkCompatibility(await storeBackup(createResearch(), other, true))
    expect(mismatch.programming).toBe('compatibility-mismatch')
    expect(mismatch.backup?.softwareId).toBe('SIM-OTHER')

    const unknown = checkCompatibility(createResearch())
    expect(unknown.programming).toBe('compatibility-unknown')
    expect(unknown.backup).toBeNull()
    expect(unknown.log).toEqual(['Compatibility unknown.'])

    const refused = refuseWrite(createResearch())
    expect(refused.programming).toBe('write-refused')
    expect(refused.backup).toBeNull()
    expect(refused.log).toEqual([WRITE_REFUSED_LOG])
  })
})

describe('research view model', () => {
  it('hides sample readings until the link is online and keeps the family unidentified', () => {
    const held = setResearchReadings(createResearch(), readings())
    const disconnected = researchViewModel('vehicle-selected', held, VEHICLE)
    expect(disconnected.connectionNotice).toBe(CONNECTION_NOTICE)
    expect(disconnected.backupNotice).toBe(BACKUP_CONNECTION_NOTICE)
    expect(disconnected.egr).toBeNull()
    expect(disconnected.dpf).toBeNull()
    expect(disconnected.identification).toMatchObject({
      vehicleLabel: VEHICLE.label,
      vinText: 'VIN not read',
      softwareId: '',
      engineFamily: ENGINE_FAMILY_LABEL,
      result: IDENTIFICATION_UNREAD,
      simulated: false,
    })

    const online = researchViewModel('online', held, VEHICLE)
    expect(online.connectionNotice).toBeNull()
    expect(online.egr).toEqual({ sensor: '0.18', vvt: '12' })
    expect(online.dpf).toEqual({ level: 2, levelText: '2', readiness: 'Incomplete' })
    expect(online.identification.softwareId).toBe(SIMULATED_SOFTWARE_ID)
    expect(online.identification.result).toBe(IDENTIFICATION_SIMULATED)
    expect(online.identification.engineFamily).toBe(ENGINE_FAMILY_LABEL)
    expect(online.identification.simulated).toBe(true)
    expect(JSON.stringify(online)).not.toMatch(/EDC16|Bosch/)

    const ready = researchViewModel(
      'online',
      setResearchReadings(createResearch(), readings({ dpfReadiness: 'Ready', dpfLevel: 4, dpfLevelText: '4' })),
      VEHICLE,
    )
    expect(ready.dpf).toEqual({ level: 4, levelText: '4', readiness: 'Ready' })

    const cleared = clearResearchReadings(held)
    expect(cleared.readings).toBeNull()
    expect(researchViewModel('online', cleared, VEHICLE).egr).toBeNull()
    expect(researchViewModel('no-interface', createResearch(), null).identification.vehicleLabel).toBe(
      'No vehicle',
    )
  })
})

describe('research report', () => {
  it('includes identification lines, the log, and imported hashes', () => {
    const report = formatResearchReport({
      vehicleLabel: 'No vehicle',
      vinText: '',
      softwareId: '',
      engineFamily: ENGINE_FAMILY_LABEL,
      identificationResult: IDENTIFICATION_UNREAD,
      log: [WRITE_REFUSED_LOG],
      files: [{ name: 'raw.bin', sha256: 'abc123' }],
    })
    expect(report).toContain('Vehicle: No vehicle')
    expect(report).toContain('Engine family: Not identified')
    expect(report).toContain('Identification result: Not read')
    expect(report).toContain(WRITE_REFUSED_LOG)
    expect(report).toContain('raw.bin SHA-256 abc123')
    expect(report.toLowerCase()).not.toContain('patch')
  })
})
