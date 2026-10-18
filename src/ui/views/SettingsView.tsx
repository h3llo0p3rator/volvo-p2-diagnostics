import { languageChoices, resolveLanguage, type Preferences } from '../../domain/preferences.ts'

interface SettingsViewProps {
  preferences: Preferences
  onChange: (preferences: Preferences) => void
}

export function SettingsView({ preferences, onChange }: SettingsViewProps) {
  return (
    <section>
      <h1>Settings</h1>
      <div className="settings-fields">
        <label>
          Language
          <select
            value={preferences.language}
            onChange={(event) =>
              onChange({ ...preferences, language: resolveLanguage(event.target.value) })
            }
          >
            {languageChoices.map((choice) => (
              <option key={choice.code} value={choice.code}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.sidebarCollapsed}
            onChange={(event) => onChange({ ...preferences, sidebarCollapsed: event.target.checked })}
          />
          Collapse sidebar
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.startCompanionMonitor}
            onChange={(event) =>
              onChange({ ...preferences, startCompanionMonitor: event.target.checked })
            }
          />
          Start companion monitor
        </label>
        <p>Stored on this workstation. This version does not start a monitor.</p>
      </div>
    </section>
  )
}
