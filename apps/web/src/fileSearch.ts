/**
 * Official chat bundle main.5a15ff2247.js:
 *   up=(e,t,n)=>{ … s=null==e||null!=e.file_feature&&!0!==e.file_feature.conflict_with_search;
 *     return { effectiveSearchEnabled:…, allowFileWithSearch:s, searchToggleDisabled:n&&!s } }
 *   k = T.effectiveSearchEnabled && !T.allowFileWithSearch
 * Upload is blocked only when the remote model sets file_feature.conflict_with_search === true.
 * There is no remote model config here. This flag is that boolean, and it defaults to off,
 * so a file and web search are sent together. Turn it on to restore the old mutual exclusion.
 */
export const conflictWithSearch = false

export type FileSearchDecision = {
  /** Official allowFileWithSearch (`s`). */
  allowFileWithSearch: boolean
  /** Official `k`: search is on and files conflict with it. Guards the paperclip and addFiles. */
  blockAttach: boolean
  /** Official searchToggleDisabled: a file is attached and it conflicts with search. */
  searchToggleDisabled: boolean
}

export const fileSearchDecision = (input: {
  searchEnabled: boolean
  hasFile: boolean
  conflictWithSearch?: boolean
}): FileSearchDecision => {
  const conflict = input.conflictWithSearch ?? conflictWithSearch
  const allowFileWithSearch = !conflict
  return {
    allowFileWithSearch,
    blockAttach: input.searchEnabled && !allowFileWithSearch,
    searchToggleDisabled: input.hasFile && !allowFileWithSearch,
  }
}
