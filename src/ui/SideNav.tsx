import { useEffect, useState } from 'react'
import { sectionIds, type SectionId } from '../domain/session.ts'

const LABELS: Record<SectionId, { label: string; short: string }> = {
  home: { label: 'Home', short: 'Ho' },
  connection: { label: 'Connection', short: 'Cn' },
  vehicle: { label: 'Vehicle', short: 'Ve' },
  ecus: { label: 'ECUs', short: 'EC' },
  'trouble-codes': { label: 'Trouble codes', short: 'TC' },
  'live-data': { label: 'Live data', short: 'Ld' },
  tests: { label: 'Tests', short: 'Ts' },
  research: { label: 'ECU research', short: 'Er' },
  reports: { label: 'Reports', short: 'Rp' },
  settings: { label: 'Settings', short: 'St' },
  help: { label: 'Help', short: 'He' },
}

interface SideNavProps {
  section: SectionId
  collapsed: boolean
  onSelect: (section: SectionId) => void
}

export function SideNav({ section, collapsed, onSelect }: SideNavProps) {
  const narrow = useNarrowLayout()
  const compact = collapsed && !narrow
  const primary = sectionIds.filter((id) => id !== 'help')
  return (
    <nav className="workshop-nav" aria-label="Sections">
      <div className="brand">{compact ? 'P2' : 'P2 Diagnostics'}</div>
      <div className="nav-primary">
        {primary.map((id) => (
          <NavButton key={id} id={id} section={section} compact={compact} onSelect={onSelect} />
        ))}
      </div>
      <div className="nav-help">
        <NavButton id="help" section={section} compact={compact} onSelect={onSelect} />
      </div>
    </nav>
  )
}

function NavButton({
  id,
  section,
  compact,
  onSelect,
}: {
  id: SectionId
  section: SectionId
  compact: boolean
  onSelect: (section: SectionId) => void
}) {
  const item = LABELS[id]
  return (
    <button
      type="button"
      aria-current={section === id ? 'page' : undefined}
      aria-label={compact ? item.label : undefined}
      onClick={() => onSelect(id)}
    >
      {compact ? item.short : item.label}
    </button>
  )
}

function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 800px)')
    const apply = () => setNarrow(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
  return narrow
}
