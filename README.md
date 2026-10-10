# git-diff

A Claude Code mod that shows the git diff of the repository you are working on in a pane, next to the conversation.

- One section per changed file, with added and removed line counts and a coloured, line-numbered diff.
- Two views: uncommitted changes (against `HEAD`), or everything on the branch since it left `origin/HEAD` or its upstream.
- Refreshes by itself after Claude edits a file or runs a shell command, and follows Claude to the repository it is editing.
- Lists untracked files under the diff.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install git-diff --marketplace OolaaPleur/claude-code-git-diff
```

Answer `y` to add the marketplace, then pick a scope.

## Use

```
/git-diff                      open the pane for the current repository
/git-diff ~/src/some-repo      open it for another repository
/git-diff base                 show the whole branch against its base
/git-diff work                 show uncommitted changes only
```

The mode and the path can be combined: `/git-diff base ~/src/some-repo`.

In the pane, `uncommitted` and `branch` switch the view and `refresh` reads the diff again. The pane docks beside the conversation in the fullscreen layout from 110 columns; otherwise it opens above the prompt.

## Limits

- The diff is drawn in one column; there is no side-by-side view.
- About 80,000 characters of diff are drawn. Hunks that do not fit are left out and counted under their file.
- The `branch` view needs `origin/HEAD` or an upstream branch to compare with.

## Compatibility

Written against Claude Code 2.1.296. The function hooks API this mod uses is early access and may change between releases.

## Develop

```
claude --plugin-dir /path/to/claude-code-git-diff   # run it from a working copy
claude plugin validate /path/to/claude-code-git-diff
claude plugin test /path/to/claude-code-git-diff
```

## License

MIT
