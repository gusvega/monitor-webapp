'use client'

const MONITOR_LOCAL_STORAGE_KEYS = ['selectedRepos', 'userRepos', 'selectedRepoId'] as const

export function clearMonitorLocalState() {
  if (typeof window === 'undefined') return

  MONITOR_LOCAL_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })
}

export function hasMonitorRepoSelection() {
  if (typeof window === 'undefined') return false

  const saved = localStorage.getItem('selectedRepos')
  if (!saved) return false

  try {
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}
