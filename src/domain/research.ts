import type { LinkPhase, VehicleSelection } from './session.ts'

export const SIMULATED_IMAGE_MAGIC = 'P2SIM1'
export const SIMULATED_SOFTWARE_ID = 'SIM-ECM-1'
export const ENGINE_FAMILY_LABEL = 'Not identified'
export const IDENTIFICATION_UNREAD = 'Not read'
export const IDENTIFICATION_SIMULATED = 'Simulated identity only'
export const CONNECTION_NOTICE = 'A connection is required before these readings can be shown.'
export const BACKUP_CONNECTION_NOTICE = 'A connection is required before a backup can be stored.'
export const WRITE_REFUSED_LOG = 'Write refused'
export const RECOVERY_LOG =
  'The backup file is the recovery artifact. This build cannot apply it to hardware.'
export const HEX_ROW_BYTES = 16
export const HEX_PAGE_BYTES = 256

const HEADER_LENGTH = 10
const IMAGE_VERSION = 1
const SEAL_LENGTH = 32
const IMAGE_FAMILY = 'not-identified'
const DEFAULT_PAYLOAD_TEXT = 'Simulated payload bytes. Not an ECU map.'

export type ProgrammingPhase =
  | 'idle'
  | 'backup-stored'
  | 'compatibility-match'
  | 'compatibility-mismatch'
  | 'compatibility-unknown'
  | 'write-refused'
  | 'recovery-planned'

export type ImportSlot = 'a' | 'b'

export type DpfReadiness = 'Incomplete' | 'Ready'

export interface ResearchReadings {
  softwareId: string
  result: typeof IDENTIFICATION_SIMULATED
  egrSensor: string
  egrVvt: string
  dpfLevel: number
  dpfLevelText: string
  dpfReadiness: DpfReadiness
}

export interface ImageRegion {
  label: 'Header' | 'Identification' | 'Payload'
  offset: number
  length: number
}

export type IntegrityResult =
  | { status: 'match' }
  | { status: 'mismatch' }
  | { status: 'recorded'; sha256: string }

export interface ImageComparison {
  equal: boolean
  firstOffset: number | null
  differingCount: number
}

export interface SRecordFile {
  records: number
  data: Uint8Array
}

export interface ImportedImage {
  name: string
  byteLength: number
  sha256: string
  viewerBytes: Uint8Array
  recordCount: number | null
  regions: readonly ImageRegion[] | null
  integrity: IntegrityResult
}

export interface StoredBackup {
  bytes: Uint8Array
  softwareId: string | null
}

export interface ResearchState {
  readings: ResearchReadings | null
  showDpfVariants: boolean
  images: { a: ImportedImage | null; b: ImportedImage | null }
  hexSlot: ImportSlot
  hexPage: number
  programming: ProgrammingPhase
  backup: StoredBackup | null
  log: readonly string[]
}

export interface ResearchViewModel {
  connectionNotice: string | null
  backupNotice: string | null
  identification: {
    vehicleLabel: string
    vinText: string
    softwareId: string
    engineFamily: typeof ENGINE_FAMILY_LABEL
    result: string
    simulated: boolean
  }
  egr: { sensor: string; vvt: string } | null
  dpf: { level: number; levelText: string; readiness: DpfReadiness } | null
}

interface ParsedImage {
  softwareId: string
  payload: Uint8Array
  seal: Uint8Array
  identificationOffset: number
  identificationLength: number
  payloadOffset: number
}

const encoder = new TextEncoder()
const PROGRAMMING_TEXT: Record<ProgrammingPhase, string> = {
  idle: 'Idle',
  'backup-stored': 'Backup stored',
  'compatibility-match': 'Compatibility match',
  'compatibility-mismatch': 'Compatibility mismatch',
  'compatibility-unknown': 'Compatibility unknown',
  'write-refused': 'Write refused',
  'recovery-planned': 'Recovery planned',
}

export function createResearch(): ResearchState {
  return {
    readings: null,
    showDpfVariants: false,
    images: { a: null, b: null },
    hexSlot: 'a',
    hexPage: 0,
    programming: 'idle',
    backup: null,
    log: [],
  }
}

export function describeProgramming(phase: ProgrammingPhase): string {
  return PROGRAMMING_TEXT[phase]
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await sha256Bytes(bytes)
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildSimulatedImage(options?: {
  softwareId?: string
  payload?: Uint8Array
}): Promise<Uint8Array> {
  const softwareId = options?.softwareId ?? SIMULATED_SOFTWARE_ID
  const payload = options?.payload ?? encoder.encode(DEFAULT_PAYLOAD_TEXT)
  const softwareBytes = encoder.encode(softwareId)
  const familyBytes = encoder.encode(IMAGE_FAMILY)
  if (softwareBytes.length === 0 || softwareBytes.length > 255 || familyBytes.length > 255) {
    throw new Error('Simulated image field is too long.')
  }
  if (payload.length > 0xffff) throw new Error('Simulated payload is too long.')
  const identificationLength = 1 + softwareBytes.length + 1 + familyBytes.length
  const out = new Uint8Array(HEADER_LENGTH + identificationLength + payload.length + SEAL_LENGTH)
  out.set(encoder.encode(SIMULATED_IMAGE_MAGIC), 0)
  out[6] = IMAGE_VERSION
  out[7] = 0
  out[8] = (payload.length >> 8) & 0xff
  out[9] = payload.length & 0xff
  let offset = HEADER_LENGTH
  out[offset] = softwareBytes.length
  offset += 1
  out.set(softwareBytes, offset)
  offset += softwareBytes.length
  out[offset] = familyBytes.length
  offset += 1
  out.set(familyBytes, offset)
  offset += familyBytes.length
  out.set(payload, offset)
  offset += payload.length
  out.set(await sha256Bytes(payload), offset)
  return out
}

export function regionMap(bytes: Uint8Array): readonly ImageRegion[] | null {
  const image = readSimulatedImage(bytes)
  if (!image) return null
  return [
    { label: 'Header', offset: 0, length: HEADER_LENGTH },
    {
      label: 'Identification',
      offset: image.identificationOffset,
      length: image.identificationLength,
    },
    { label: 'Payload', offset: image.payloadOffset, length: image.payload.length },
  ]
}

export async function integrityOf(bytes: Uint8Array): Promise<IntegrityResult> {
  const image = readSimulatedImage(bytes)
  if (!image) return { status: 'recorded', sha256: await sha256Hex(bytes) }
  const digest = await sha256Bytes(image.payload)
  return equalBytes(digest, image.seal) ? { status: 'match' } : { status: 'mismatch' }
}

export function describeIntegrity(result: IntegrityResult): string {
  if (result.status === 'match') return 'Seal matches'
  if (result.status === 'mismatch') return 'Seal does not match'
  return `Hash recorded ${result.sha256}`
}

export function parseSRecords(bytes: Uint8Array): SRecordFile | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return null
  const data: number[] = []
  for (const line of lines) {
    const record = parseSRecordLine(line)
    if (!record) return null
    data.push(...record.data)
  }
  return { records: lines.length, data: Uint8Array.from(data) }
}

export function compareImages(left: Uint8Array, right: Uint8Array): ImageComparison {
  const limit = Math.max(left.length, right.length)
  let firstOffset: number | null = null
  let differingCount = 0
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) {
      differingCount += 1
      if (firstOffset === null) firstOffset = index
    }
  }
  return { equal: differingCount === 0, firstOffset, differingCount }
}

export function describeComparison(result: ImageComparison): string {
  if (result.equal) return 'Images are equal.'
  const offset = (result.firstOffset ?? 0).toString(16).toUpperCase().padStart(8, '0')
  return `First differing offset: 0x${offset}. Differing bytes: ${result.differingCount}.`
}

export interface HexRow {
  offset: string
  hex: string
  ascii: string
}

export interface HexPage {
  page: number
  pageCount: number
  rows: readonly HexRow[]
}

export function formatHexPage(bytes: Uint8Array, pageIndex: number): HexPage {
  const pageCount = Math.max(1, Math.ceil(bytes.length / HEX_PAGE_BYTES))
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1)
  const start = page * HEX_PAGE_BYTES
  const end = Math.min(bytes.length, start + HEX_PAGE_BYTES)
  const rows: HexRow[] = []
  for (let offset = start; offset < end; offset += HEX_ROW_BYTES) {
    const slice = bytes.slice(offset, Math.min(end, offset + HEX_ROW_BYTES))
    const hex = [...slice].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    rows.push({
      offset: offset.toString(16).toUpperCase().padStart(8, '0'),
      hex: hex.padEnd(HEX_ROW_BYTES * 3 - 1, ' '),
      ascii: [...slice].map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.')).join(''),
    })
  }
  return { page, pageCount, rows }
}

export async function prepareImport(name: string, bytes: Uint8Array): Promise<ImportedImage> {
  const original = new Uint8Array(bytes)
  const parsed = parseSRecords(original)
  const viewerBytes = parsed ? parsed.data : original
  const integrity = await integrityForImport(original, viewerBytes, parsed !== null)
  return {
    name,
    byteLength: original.length,
    sha256: await sha256Hex(original),
    viewerBytes,
    recordCount: parsed ? parsed.records : null,
    regions: regionMap(viewerBytes),
    integrity,
  }
}

export function attachImport(state: ResearchState, slot: ImportSlot, image: ImportedImage): ResearchState {
  return {
    ...state,
    images: { ...state.images, [slot]: image },
    hexSlot: slot,
    hexPage: 0,
  }
}

export function selectHexSlot(state: ResearchState, slot: ImportSlot): ResearchState {
  if (state.hexSlot === slot && state.hexPage === 0) return state
  return { ...state, hexSlot: slot, hexPage: 0 }
}

export function setHexPage(state: ResearchState, page: number): ResearchState {
  if (state.hexPage === page) return state
  return { ...state, hexPage: page }
}

export function setResearchReadings(state: ResearchState, readings: ResearchReadings): ResearchState {
  return { ...state, readings }
}

export function clearResearchReadings(state: ResearchState): ResearchState {
  if (state.readings === null) return state
  return { ...state, readings: null }
}

export function toggleDpfVariants(state: ResearchState): ResearchState {
  return { ...state, showDpfVariants: !state.showDpfVariants }
}

export async function storeBackup(
  state: ResearchState,
  image: Uint8Array,
  online: boolean,
): Promise<ResearchState> {
  if (!online) return state
  return commitBackup(state, image, await sha256Hex(image))
}

export function commitBackup(state: ResearchState, image: Uint8Array, hash: string): ResearchState {
  const bytes = new Uint8Array(image)
  const header = readSimulatedImage(bytes)
  return {
    ...state,
    programming: 'backup-stored',
    backup: { bytes, softwareId: header?.softwareId ?? null },
    log: [...state.log, `Backup stored: ${bytes.length} bytes, SHA-256 ${hash}`],
  }
}

export function checkCompatibility(state: ResearchState): ResearchState {
  const programming: ProgrammingPhase = !state.backup
    ? 'compatibility-unknown'
    : state.backup.softwareId === SIMULATED_SOFTWARE_ID
      ? 'compatibility-match'
      : 'compatibility-mismatch'
  const detail =
    programming === 'compatibility-unknown'
      ? 'Compatibility unknown.'
      : programming === 'compatibility-match'
        ? 'Compatibility match.'
        : 'Compatibility mismatch.'
  return { ...state, programming, backup: state.backup, log: [...state.log, detail] }
}

export function refuseWrite(state: ResearchState): ResearchState {
  return {
    ...state,
    programming: 'write-refused',
    backup: state.backup,
    log: [...state.log, WRITE_REFUSED_LOG],
  }
}

export function planRecovery(state: ResearchState): ResearchState {
  return {
    ...state,
    programming: 'recovery-planned',
    backup: state.backup,
    log: [...state.log, RECOVERY_LOG],
  }
}

export function researchViewModel(
  phase: LinkPhase,
  state: ResearchState,
  vehicle: VehicleSelection | null,
): ResearchViewModel {
  const identification: ResearchViewModel['identification'] = {
    vehicleLabel: vehicle?.label ?? 'No vehicle',
    vinText: vehicle?.identityText ?? '',
    softwareId: '',
    engineFamily: ENGINE_FAMILY_LABEL,
    result: IDENTIFICATION_UNREAD,
    simulated: false,
  }
  if (phase !== 'online' || state.readings === null) {
    return {
      connectionNotice: phase === 'online' ? null : CONNECTION_NOTICE,
      backupNotice: phase === 'online' ? null : BACKUP_CONNECTION_NOTICE,
      identification,
      egr: null,
      dpf: null,
    }
  }
  return {
    connectionNotice: null,
    backupNotice: null,
    identification: {
      ...identification,
      softwareId: state.readings.softwareId,
      engineFamily: ENGINE_FAMILY_LABEL,
      result: state.readings.result,
      simulated: true,
    },
    egr: { sensor: state.readings.egrSensor, vvt: state.readings.egrVvt },
    dpf: {
      level: state.readings.dpfLevel,
      levelText: state.readings.dpfLevelText,
      readiness: state.readings.dpfReadiness,
    },
  }
}

export function formatResearchReport(input: {
  vehicleLabel: string
  vinText: string
  softwareId: string
  engineFamily: string
  identificationResult: string
  log: readonly string[]
  files: readonly { name: string; sha256: string }[]
}): string {
  const logLines = input.log.length > 0 ? input.log.map((line) => `- ${line}`) : ['- (none)']
  const fileLines =
    input.files.length > 0
      ? input.files.map((file) => `- ${file.name} SHA-256 ${file.sha256}`)
      : ['- (none)']
  return [
    `Vehicle: ${input.vehicleLabel}`,
    `VIN: ${input.vinText}`,
    `Module software id: ${input.softwareId}`,
    `Engine family: ${input.engineFamily}`,
    `Identification result: ${input.identificationResult}`,
    '',
    'Operation log:',
    ...logLines,
    '',
    'Imported files:',
    ...fileLines,
    '',
  ].join('\n')
}

async function integrityForImport(
  original: Uint8Array,
  viewerBytes: Uint8Array,
  decodedRecords: boolean,
): Promise<IntegrityResult> {
  const examined = decodedRecords ? viewerBytes : original
  const image = readSimulatedImage(examined)
  if (!image) return { status: 'recorded', sha256: await sha256Hex(original) }
  const digest = await sha256Bytes(image.payload)
  return equalBytes(digest, image.seal) ? { status: 'match' } : { status: 'mismatch' }
}

function readSimulatedImage(bytes: Uint8Array): ParsedImage | null {
  if (bytes.length < HEADER_LENGTH + SEAL_LENGTH || !hasMagic(bytes)) return null
  if (bytes[6] !== IMAGE_VERSION || bytes[7] !== 0) return null
  const payloadLength = ((bytes[8] ?? 0) << 8) | (bytes[9] ?? 0)
  let offset = HEADER_LENGTH
  const softwareLength = bytes[offset]
  if (softwareLength === undefined || softwareLength === 0) return null
  offset += 1
  if (offset + softwareLength >= bytes.length) return null
  const softwareId = decodeAscii(bytes.subarray(offset, offset + softwareLength))
  if (softwareId === null) return null
  offset += softwareLength
  const familyLength = bytes[offset]
  if (familyLength === undefined) return null
  offset += 1
  if (offset + familyLength > bytes.length) return null
  const family = decodeAscii(bytes.subarray(offset, offset + familyLength))
  if (family !== IMAGE_FAMILY) return null
  offset += familyLength
  const identificationLength = offset - HEADER_LENGTH
  const payloadOffset = offset
  if (payloadOffset + payloadLength + SEAL_LENGTH !== bytes.length) return null
  return {
    softwareId,
    payload: bytes.subarray(payloadOffset, payloadOffset + payloadLength),
    seal: bytes.subarray(payloadOffset + payloadLength),
    identificationOffset: HEADER_LENGTH,
    identificationLength,
    payloadOffset,
  }
}

function hasMagic(bytes: Uint8Array): boolean {
  if (bytes.length < SIMULATED_IMAGE_MAGIC.length) return false
  for (let index = 0; index < SIMULATED_IMAGE_MAGIC.length; index += 1) {
    if (bytes[index] !== SIMULATED_IMAGE_MAGIC.charCodeAt(index)) return false
  }
  return true
}

function decodeAscii(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function parseSRecordLine(line: string): { data: number[] } | null {
  if (!/^S[0-9][0-9A-Fa-f]+$/.test(line) || line.length % 2 !== 0) return null
  const type = line[1]
  const addressLength = addressBytes(type)
  if (addressLength === null || type === undefined) return null
  const raw: number[] = []
  for (let index = 2; index < line.length; index += 2) {
    const value = Number.parseInt(line.slice(index, index + 2), 16)
    if (Number.isNaN(value)) return null
    raw.push(value)
  }
  const count = raw[0]
  if (count === undefined || count !== raw.length - 1) return null
  if (raw.length < 1 + addressLength + 1) return null
  const sum = raw.reduce((total, byte) => total + byte, 0) & 0xff
  if (sum !== 0xff) return null
  const data = type === '1' || type === '2' || type === '3' ? raw.slice(1 + addressLength, -1) : []
  return { data }
}

function addressBytes(type: string): number | null {
  switch (type) {
    case '0':
    case '1':
    case '5':
    case '9':
      return 2
    case '2':
    case '6':
    case '8':
      return 3
    case '3':
    case '7':
      return 4
    default:
      return null
  }
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return new Uint8Array(digest)
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}
