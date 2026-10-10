import { expect, test } from 'claude-code/testing'

import { parseDiff } from './parse'

const TWO_FILES = [
  'diff --git a/res/icon.xml b/res/icon.xml',
  'index bdcd4ff..7a982ef 100644',
  '--- a/res/icon.xml',
  '+++ b/res/icon.xml',
  '@@ -1,3 +1,3 @@',
  ' <vector>',
  '-  <path old="1" />',
  '+  <path new="1" />',
  ' </vector>',
  '@@ -10,2 +10,1 @@',
  ' <group>',
  '-  <path plus="1" />',
  'diff --git a/logo.png b/logo.png',
  'index 1111111..2222222 100644',
  'Binary files a/logo.png and b/logo.png differ',
  '',
].join('\n')

test('splits a diff into files with their hunks and counts', () => {
  const files = parseDiff(TWO_FILES)

  expect(files.length).toBe(2)
  expect(files[0]?.path).toBe('res/icon.xml')
  expect(files[0]?.added).toBe(1)
  expect(files[0]?.removed).toBe(2)
  expect(files[0]?.hunks.startsWith('@@ -1,3 +1,3 @@')).toBe(true)
  expect(files[0]?.hunks.includes('diff --git')).toBe(false)
  expect(files[0]?.note).toBe('')
  expect(files[1]?.path).toBe('logo.png')
  expect(files[1]?.hunks).toBe('')
  expect(files[1]?.note).toBe('binary file')
})

test('keeps whole hunks only once the room runs out', () => {
  const files = parseDiff(TWO_FILES, 80)

  expect(files[0]?.hunks.includes('@@ -10,2 +10,1 @@')).toBe(false)
  expect(files[0]?.hunks.endsWith(' </vector>')).toBe(true)
  expect(files[0]?.note).toBe('1 of 2 hunks not shown, the pane is full')
  expect(files[0]?.removed).toBe(2)
})

test('an empty diff has no files', () => {
  expect(parseDiff('').length).toBe(0)
})
