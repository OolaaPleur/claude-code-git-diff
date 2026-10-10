import type { FileDiff } from '../types'

// One drawing shows 100000 characters in all; headers and notes need a share.
export const BUDGET = 80000

const pathOf = (head: string): string => {
  const plus = /^\+\+\+ b\/(.+)$/m.exec(head)
  if (plus?.[1] !== undefined) return plus[1]
  const minus = /^--- a\/(.+)$/m.exec(head)
  if (minus?.[1] !== undefined) return minus[1]
  const first = /^a\/(.+?) b\/(.+)$/m.exec(head)

  return first?.[2] ?? head.split('\n', 1)[0] ?? '?'
}

const noteOf = (head: string): string => {
  if (/^Binary files /m.test(head) || /^GIT binary patch/m.test(head)) return 'binary file'
  if (/^rename from /m.test(head)) return 'renamed, no content change'
  if (/^new file mode /m.test(head)) return 'new empty file'
  if (/^deleted file mode /m.test(head)) return 'deleted empty file'
  if (/^old mode /m.test(head)) return 'mode change only'

  return 'no content change'
}

/**
 * Splits `git diff` output into files, keeping whole hunks only and at most
 * `budget` characters of them in all, since a diff cut mid-hunk does not draw.
 */
export const parseDiff = (output: string, budget: number = BUDGET): FileDiff[] => {
  let room = budget

  return output
    .split(/^diff --git /m)
    .slice(1)
    .map(chunk => {
      const at = chunk.search(/^@@ /m)
      const head = at === -1 ? chunk : chunk.slice(0, at)
      const path = pathOf(head)
      if (at === -1) return { path, added: 0, removed: 0, hunks: '', note: noteOf(head) }

      const hunks = chunk.slice(at).split(/^(?=@@ )/m)
      let added = 0
      let removed = 0
      let kept = ''
      let left = 0
      for (const hunk of hunks) {
        for (const line of hunk.split('\n').slice(1)) {
          if (line.startsWith('+')) added += 1
          else if (line.startsWith('-')) removed += 1
        }
        if (left === 0 && hunk.length <= room) {
          kept += hunk
          room -= hunk.length
        } else left += 1
      }
      const note = left === 0 ? '' : `${left} of ${hunks.length} hunks not shown, the pane is full`

      return { path, added, removed, hunks: kept.replace(/\n+$/, ''), note }
    })
}
