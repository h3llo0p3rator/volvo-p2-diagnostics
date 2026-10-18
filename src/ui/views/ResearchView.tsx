import type { ImportSlot, ResearchState } from '../../domain/research.ts'
import {
  compareImages,
  describeComparison,
  describeIntegrity,
  describeProgramming,
  formatHexPage,
  researchViewModel,
} from '../../domain/research.ts'
import { phaseOf, type SessionState } from '../../domain/session.ts'
import { EmptyNotice } from '../EmptyNotice.tsx'

export interface ResearchActions {
  onImport: (slot: ImportSlot, name: string, bytes: Uint8Array) => void
  onSelectHexSlot: (slot: ImportSlot) => void
  onHexPage: (page: number) => void
  onToggleDpfVariants: () => void
  onStoreBackup: () => void
  onCheckCompatibility: () => void
  onWriteFirmware: () => void
  onPlanRecovery: () => void
  onExportReport: () => void
}

interface ResearchViewProps {
  session: SessionState
  research: ResearchState
  actions: ResearchActions
}

export function ResearchView({ session, research, actions }: ResearchViewProps) {
  const model = researchViewModel(phaseOf(session), research, session.vehicle)
  const selected = research.images[research.hexSlot]
  const comparison =
    research.images.a && research.images.b
      ? compareImages(research.images.a.viewerBytes, research.images.b.viewerBytes)
      : null
  return (
    <section>
      <h1>ECU research</h1>
      <div className="research-stack">
        <div className="panel">
          <h2>Identification</h2>
          {model.connectionNotice ? <EmptyNotice>{model.connectionNotice}</EmptyNotice> : null}
          <p>
            Vehicle <span>{model.identification.vehicleLabel}</span>
          </p>
          <p>
            VIN <span>{model.identification.vinText}</span>
          </p>
          <p>
            Module software id <span>{model.identification.softwareId}</span>
            {model.identification.simulated ? <SimulatedMark /> : null}
          </p>
          <p>
            Engine family <span>{model.identification.engineFamily}</span>
          </p>
          <p>
            Identification result <span>{model.identification.result}</span>
            {model.identification.simulated ? <SimulatedMark /> : null}
          </p>
        </div>

        <div className="panel">
          <h2>EGR</h2>
          {model.connectionNotice ? <EmptyNotice>{model.connectionNotice}</EmptyNotice> : null}
          {model.egr ? (
            <>
              <p>
                EGR sensor <span>{model.egr.sensor}</span>
                <SimulatedMark />
              </p>
              <p>
                VVT system <span>{model.egr.vvt}</span>
                <SimulatedMark />
              </p>
            </>
          ) : null}
        </div>

        <div className="panel">
          <h2>DPF</h2>
          {model.connectionNotice ? <EmptyNotice>{model.connectionNotice}</EmptyNotice> : null}
          {model.dpf ? (
            <>
              <p>
                Level <span>{model.dpf.level}</span>
                <SimulatedMark />
              </p>
              <p>
                Level text <span>{model.dpf.levelText}</span>
                <SimulatedMark />
              </p>
              <p>
                Readiness <span>{model.dpf.readiness}</span>
                <SimulatedMark />
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={research.showDpfVariants}
                  onChange={actions.onToggleDpfVariants}
                />
                Show DPF variants
              </label>
              {research.showDpfVariants ? <p>No variants were supplied.</p> : null}
            </>
          ) : null}
        </div>

        <div className="panel">
          <h2>Firmware files</h2>
          <p>Imported files stay in this browser session and are not transmitted.</p>
          <div className="file-fields">
            <FileSlot slot="a" research={research} actions={actions} />
            <FileSlot slot="b" research={research} actions={actions} />
          </div>
          <p>{comparison ? describeComparison(comparison) : 'Import two images to compare them.'}</p>
          {selected ? (
            <>
              <HexViewer research={research} actions={actions} bytes={selected.viewerBytes} />
              {selected.regions ? (
                <>
                  <p>This layout belongs to the simulated image and is not an ECU memory map.</p>
                  <ul className="reading-list">
                    {selected.regions.map((region) => (
                      <li key={region.label}>
                        {region.label} offset 0x{region.offset.toString(16).toUpperCase().padStart(8, '0')}{' '}
                        length {region.length}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No region map for this file.</p>
              )}
              <p>{describeIntegrity(selected.integrity)}</p>
              {selected.integrity.status === 'recorded' ? null : (
                <p>This is the SHA-256 seal stored in the simulated image, not an ECU checksum.</p>
              )}
            </>
          ) : null}
        </div>

        <div className="panel">
          <h2>Programming</h2>
          {model.backupNotice ? <EmptyNotice>{model.backupNotice}</EmptyNotice> : null}
          <p>State: {describeProgramming(research.programming)}</p>
          <div className="shortcut-row">
            <button type="button" onClick={actions.onStoreBackup} disabled={model.backupNotice !== null}>
              Store backup
            </button>
            <button type="button" onClick={actions.onCheckCompatibility}>
              Check compatibility
            </button>
            <button type="button" onClick={actions.onWriteFirmware}>
              Write firmware
            </button>
            <button type="button" onClick={actions.onPlanRecovery}>
              Plan recovery
            </button>
            <button type="button" onClick={actions.onExportReport}>
              Export report
            </button>
          </div>
          <h3>Operation log</h3>
          {research.log.length === 0 ? (
            <p>No operations yet.</p>
          ) : (
            <ol className="operation-log">
              {research.log.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

function FileSlot({
  slot,
  research,
  actions,
}: {
  slot: ImportSlot
  research: ResearchState
  actions: ResearchActions
}) {
  const image = research.images[slot]
  const title = slot === 'a' ? 'Image A' : 'Image B'
  return (
    <div>
      <h3>{title}</h3>
      <label>
        Import {title}
        <input
          type="file"
          aria-label={`Import ${title}`}
          onChange={(event) => {
            const input = event.currentTarget
            const file = input.files?.[0]
            input.value = ''
            if (!file) return
            void file.arrayBuffer().then((buffer) => {
              actions.onImport(slot, file.name, new Uint8Array(buffer))
            })
          }}
        />
      </label>
      {image ? (
        <>
          <p>{image.name}</p>
          <p>{image.byteLength} bytes</p>
          <p>SHA-256 {image.sha256}</p>
          {image.recordCount !== null ? (
            <>
              <p>Record count: {image.recordCount}</p>
              <p>Decoded data bytes: {image.viewerBytes.length}</p>
            </>
          ) : null}
          <button
            type="button"
            aria-pressed={research.hexSlot === slot}
            onClick={() => actions.onSelectHexSlot(slot)}
          >
            Show {title} in hex viewer
          </button>
        </>
      ) : (
        <p>No file imported.</p>
      )}
    </div>
  )
}

function HexViewer({
  research,
  actions,
  bytes,
}: {
  research: ResearchState
  actions: ResearchActions
  bytes: Uint8Array
}) {
  const page = formatHexPage(bytes, research.hexPage)
  return (
    <div>
      <p>Read-only</p>
      <p>
        Page {page.page + 1} of {page.pageCount}
      </p>
      <div className="shortcut-row">
        <button type="button" onClick={() => actions.onHexPage(page.page - 1)} disabled={page.page === 0}>
          Previous page
        </button>
        <button
          type="button"
          onClick={() => actions.onHexPage(page.page + 1)}
          disabled={page.page >= page.pageCount - 1}
        >
          Next page
        </button>
      </div>
      <pre className="hex-view">
        {page.rows.map((row) => `${row.offset}  ${row.hex}  ${row.ascii}`).join('\n')}
      </pre>
    </div>
  )
}

function SimulatedMark() {
  return <span className="simulated-mark">Simulated</span>
}
