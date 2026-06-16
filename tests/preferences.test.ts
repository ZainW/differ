import { describe, expect, it } from 'vitest'
import { normalizePreferences } from '../src/renderer/src/hooks/usePreferences'

describe('normalizePreferences', () => {
  it('uses defaults for invalid stored values', () => {
    expect(normalizePreferences(null)).toEqual({
      diffLayout: 'split',
      sidebarWidth: 280,
      descriptionOpen: false
    })

    expect(
      normalizePreferences({
        diffLayout: 'stacked',
        sidebarWidth: Number.NaN,
        descriptionOpen: 'yes'
      })
    ).toEqual({
      diffLayout: 'split',
      sidebarWidth: 280,
      descriptionOpen: false
    })
  })

  it('preserves valid stored values', () => {
    expect(
      normalizePreferences({
        diffLayout: 'unified',
        sidebarWidth: 360,
        descriptionOpen: true
      })
    ).toEqual({
      diffLayout: 'unified',
      sidebarWidth: 360,
      descriptionOpen: true
    })
  })

  it('clamps sidebar width to supported layout bounds', () => {
    expect(normalizePreferences({ sidebarWidth: 120 }).sidebarWidth).toBe(220)
    expect(normalizePreferences({ sidebarWidth: 640 }).sidebarWidth).toBe(480)
  })
})
