import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DiffMode, DiffView } from '../types'
import { parseDiff } from './parse'

const PANE = 'git-diff'
/** The id git gives the tree with no files, in a SHA-1 repository. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const EMPTY: DiffView = {
  repo: '',
  mode: 'work',
  against: '',
  files: [],
  untracked: [],
  problem: '',
}
const view = atom({ plugin: 'git-diff', key: 'view' } as const, EMPTY)

const git = async ($: EngineInterface, cwd: string, args: readonly string[]) => {
  const ran = await $.process.run(['git', '-c', 'core.quotepath=off', ...args], { cwd })

  return { isOk: ran.exitCode === 0, out: ran.stdout.trim(), raw: ran.stdout }
}

const topOf = async ($: EngineInterface, folder: string): Promise<string> => {
  try {
    const top = await git($, folder, ['rev-parse', '--show-toplevel'])

    return top.isOk ? top.out : ''
  } catch {
    return ''
  }
}

/** The commit the branch left its upstream at, and the name to show for it. */
const baseOf = async ($: EngineInterface, repo: string) => {
  for (const ref of ['origin/HEAD', '@{upstream}']) {
    const name = await git($, repo, ['rev-parse', '--abbrev-ref', ref])
    if (!name.isOk) continue
    const fork = await git($, repo, ['merge-base', 'HEAD', name.out])
    if (fork.isOk) return { commit: fork.out, name: name.out }
  }

  return undefined
}

const load = async ($: EngineInterface, repo: string, mode: DiffMode): Promise<DiffView> => {
  if (repo === '') {
    return { ...EMPTY, mode, problem: 'Not a git repository. Run /git-diff <path to a repository>.' }
  }
  const base = mode === 'base' ? await baseOf($, repo) : undefined
  if (mode === 'base' && base === undefined) {
    return { ...EMPTY, repo, mode, problem: 'No origin/HEAD and no upstream branch to compare with.' }
  }
  // A repository with no commit yet has no HEAD: everything in it is new.
  const hasHead = (await git($, repo, ['rev-parse', '--verify', '--quiet', 'HEAD'])).isOk
  const from = base?.commit ?? (hasHead ? 'HEAD' : EMPTY_TREE)
  const diff = await git($, repo, ['diff', '--no-color', '--no-ext-diff', '-M', from])
  if (!diff.isOk) return { ...EMPTY, repo, mode, problem: 'git diff failed.' }
  const others = await git($, repo, ['ls-files', '--others', '--exclude-standard'])

  return {
    repo,
    mode,
    against:
      base !== undefined
        ? `${base.name} (${base.commit.slice(0, 7)})`
        : hasHead
          ? 'HEAD'
          : 'nothing (no commit yet)',
    files: parseDiff(diff.raw),
    untracked: others.isOk && others.out !== '' ? others.out.split('\n').slice(0, 200) : [],
    problem: '',
  }
}

/** Reads the diff again; `folder` moves the pane to the repository holding it. */
const refresh = async ($: EngineInterface, change: { folder?: string; mode?: DiffMode } = {}) => {
  const now = await read($, view)
  const moved = change.folder === undefined ? '' : await topOf($, change.folder)
  const repo = moved !== '' ? moved : now.repo !== '' ? now.repo : await topOf($, await $.session.cwd())
  const next = await load($, repo, change.mode ?? now.mode)
  await update($, view, () => next)
}

const quietly = async (work: Promise<void>) => {
  try {
    await work
  } catch {
    // A diff that cannot be read never fails the tool call it follows.
  }
}

const folderOf = (path: string) => path.replace(/\/[^/]*$/, '') || '/'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'git-diff',
      description: 'Show the git diff in a pane: /git-diff [work|base] [repository path]',
      argumentHint: '[work|base] [path]',
    })

    return next(e)
  })

  on('command.run', { command: 'git-diff' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(word => word !== '')
    const mode = words.find((word): word is DiffMode => word === 'work' || word === 'base')
    const typed = words.find(word => word !== 'work' && word !== 'base')
    const home = (await $.env.get('HOME')) ?? ''
    const folder = typed === '~' || typed?.startsWith('~/') === true ? home + typed.slice(1) : typed
    if (folder !== undefined && (await topOf($, folder)) === '') {
      return { text: `${folder} is not inside a git repository.` }
    }
    await refresh($, { folder, mode })
    await $.ui.open({ id: PANE, title: 'Git diff' })
    const shown = await read($, view)

    return { text: `Git diff pane: ${shown.repo || 'no repository'}, against ${shown.against || 'nothing'}.` }
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    await quietly(refresh($, { folder: folderOf(e.file_path) }))

    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    await quietly(refresh($, { folder: folderOf(e.file_path) }))

    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    await quietly(refresh($))

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const shown = await read($, view)
    const added = shown.files.reduce((sum, file) => sum + file.added, 0)
    const removed = shown.files.reduce((sum, file) => sum + file.removed, 0)

    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-start">
          {shown.repo === '' ? 'git diff' : shown.repo}
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button
            key="work"
            hotkey="w"
            variant={shown.mode === 'work' ? 'primary' : 'secondary'}
            onPress={() => refresh($, { mode: 'work' })}
          >
            uncommitted
          </Button>
          <Button
            key="base"
            hotkey="b"
            variant={shown.mode === 'base' ? 'primary' : 'secondary'}
            onPress={() => refresh($, { mode: 'base' })}
          >
            branch
          </Button>
          <Button key="refresh" hotkey="r" onPress={() => refresh($)}>
            refresh
          </Button>
        </Box>
        {shown.problem !== '' && <Text color="warning">{shown.problem}</Text>}
        {shown.problem === '' && (
          <Text dimColor>
            against {shown.against}: {shown.files.length} files, +{added} -{removed}
          </Text>
        )}
        {shown.problem === '' && shown.files.length === 0 && shown.untracked.length === 0 && (
          <Text dimColor>No changes.</Text>
        )}
        {shown.files.map(file => (
          <Box flexDirection="column" marginTop={1}>
            <Text bold wrap="truncate-start">
              {file.path} <Text color="success">+{file.added}</Text> <Text color="error">-{file.removed}</Text>
            </Text>
            {file.hunks !== '' && <Code source={file.hunks} format="diff" path={file.path} />}
            {file.note !== '' && <Text dimColor>{file.note}</Text>}
          </Box>
        ))}
        {shown.untracked.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Untracked files</Text>
            {shown.untracked.map(path => (
              <Text dimColor wrap="truncate-start">
                {path}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
