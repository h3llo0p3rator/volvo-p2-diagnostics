export type LanguageCode = 'en-US' | 'cs-CZ' | 'pl-PL' | 'sv-SE'

export interface Preferences {
  language: LanguageCode
  sidebarCollapsed: boolean
  startCompanionMonitor: boolean
}

export interface PreferenceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const preferenceKeys = {
  language: 'p2diagnostics.language',
  sidebarCollapsed: 'p2diagnostics.sidebarCollapsed',
  startCompanionMonitor: 'p2diagnostics.startCompanionMonitor',
} as const

export const languageChoices: readonly { code: LanguageCode; label: string }[] = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'cs-CZ', label: 'Czech (Czechia)' },
  { code: 'pl-PL', label: 'Polish (Poland)' },
  { code: 'sv-SE', label: 'Swedish (Sweden)' },
]

export function defaultPreferences(): Preferences {
  return {
    language: 'en-US',
    sidebarCollapsed: false,
    startCompanionMonitor: false,
  }
}

export function resolveLanguage(code: string | null | undefined): LanguageCode {
  switch (code) {
    case 'en-US':
    case 'cs-CZ':
    case 'pl-PL':
    case 'sv-SE':
      return code
    default:
      return 'en-US'
  }
}

export function loadPreferences(store: PreferenceStore): Preferences {
  return {
    language: resolveLanguage(store.getItem(preferenceKeys.language)),
    sidebarCollapsed: store.getItem(preferenceKeys.sidebarCollapsed) === 'true',
    startCompanionMonitor: store.getItem(preferenceKeys.startCompanionMonitor) === 'true',
  }
}

export function savePreferences(store: PreferenceStore, preferences: Preferences): void {
  store.setItem(preferenceKeys.language, resolveLanguage(preferences.language))
  store.setItem(preferenceKeys.sidebarCollapsed, String(preferences.sidebarCollapsed))
  store.setItem(preferenceKeys.startCompanionMonitor, String(preferences.startCompanionMonitor))
}
