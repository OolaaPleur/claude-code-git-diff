export type DiffMode = 'work' | 'base'

export type FileDiff = {
  path: string
  added: number
  removed: number
  /** Whole unified-diff hunks, or '' when the file has none to draw. */
  hunks: string
  /** Why there are no hunks, or how many were left out. */
  note: string
}

export type DiffView = {
  /** The repository's top-level folder, or '' while none is known. */
  repo: string
  mode: DiffMode
  /** What the diff is taken against, as shown in the header. */
  against: string
  files: FileDiff[]
  untracked: string[]
  /** A problem to show in place of a diff, or ''. */
  problem: string
}

declare module 'claude-code' {
  interface PluginState {
    'git-diff': { view: DiffView }
  }
}
