import { describe, expect, it } from 'vitest'
import { conflictWithSearch, fileSearchDecision } from './fileSearch.js'

describe('file_feature.conflict_with_search', () => {
  it('defaults off, so search and a file are both allowed', () => {
    expect(conflictWithSearch).toBe(false)
    expect(fileSearchDecision({ searchEnabled: true, hasFile: true })).toEqual({
      allowFileWithSearch: true,
      blockAttach: false,
      searchToggleDisabled: false,
    })
    expect(fileSearchDecision({ searchEnabled: true, hasFile: false })).toEqual({
      allowFileWithSearch: true,
      blockAttach: false,
      searchToggleDisabled: false,
    })
  })

  it('blocks attach while search is on, and disables the search toggle while a file is attached', () => {
    expect(fileSearchDecision({ searchEnabled: true, hasFile: false, conflictWithSearch: true })).toEqual({
      allowFileWithSearch: false,
      blockAttach: true,
      searchToggleDisabled: false,
    })
    expect(fileSearchDecision({ searchEnabled: false, hasFile: true, conflictWithSearch: true })).toEqual({
      allowFileWithSearch: false,
      blockAttach: false,
      searchToggleDisabled: true,
    })
    expect(fileSearchDecision({ searchEnabled: true, hasFile: true, conflictWithSearch: true })).toEqual({
      allowFileWithSearch: false,
      blockAttach: true,
      searchToggleDisabled: true,
    })
    expect(fileSearchDecision({ searchEnabled: false, hasFile: false, conflictWithSearch: true })).toEqual({
      allowFileWithSearch: false,
      blockAttach: false,
      searchToggleDisabled: false,
    })
  })
})
