import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { loadLibrary, saveUserScore, deleteUserScore, userLibraryBackup, restoreUserLibrary, recoveryLibraryBackup } from '../src/lib/store';
import { scoreFromObject, importLibraryBackup } from '../src/lib/scoreImport';
import { DEFAULT_FILTERS, filterScores } from '../src/lib/libraryView';

const key = 'harpscore.userScores.v1';
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (id: string) => values.get(id) ?? null,
    setItem: (id: string, value: string) => { values.set(id, value); },
  } });
});
const score = (id: string, melody = '1 - - -') => scoreFromObject({
  id, title: id, key: 'C', timeSignature: '4/4', melody,
}).score!;

test('successive imports and deletion retain old fingerings and technique filters', async () => {
  let lib = (await saveUserScore(loadLibrary(), score('natural'))).library;
  lib = (await saveUserScore(lib, score('bending', '6 - - -'))).library;
  assert.equal(lib.user[0].lines[0][0].notes[0].hole, 1);
  assert.deepEqual(filterScores(lib.user, { ...DEFAULT_FILTERS, technique: 'natural' }, []).map(s => s.id), ['natural']);
  lib = await deleteUserScore(lib, 'natural');
  assert.equal(lib.user[0].lines[0][0].notes[0].bend, 2);
});

test('malformed storage is not replaced by an import or deletion', async () => {
  for (const raw of ['{broken', '{}', '[null]', JSON.stringify([score('good'), { title: 'incomplete' }])]) {
    values.set(key, raw);
    const lib = loadLibrary();
    assert.ok(lib.storageIssue);
    await assert.rejects(saveUserScore(lib, score('new')));
    await assert.rejects(deleteUserScore(lib, 'good'));
    assert.equal(userLibraryBackup(), raw);
    assert.equal(values.get(key), raw);
  }
});

test('importing from stale library state cannot replace another tab score', async () => {
  const stale = loadLibrary();
  await saveUserScore(stale, score('same'));
  const { library: lib, savedScore } = await saveUserScore(stale, { ...score('same'), title: 'second' });
  assert.equal(savedScore.id, 'same-2');
  assert.deepEqual(lib.user.map(s => s.title), ['same', 'second']);
  assert.equal(new Set(lib.user.map(s => s.id)).size, 2);
});

test('save timestamps survive reloading', async () => {
  const { library: lib } = await saveUserScore(loadLibrary(), score('dated'));
  assert.equal(typeof lib.user[0].updatedAt, 'string');
  assert.equal(loadLibrary().user[0].updatedAt, lib.user[0].updatedAt);
});

test('legacy duplicate and builtin IDs stay individually selectable across delete/reload', async () => {
  values.set(key, JSON.stringify([
    score('twinkle'), score('dupe'), { ...score('dupe'), title: 'second copy' }, score('dupe-2'),
  ]));
  const lib = loadLibrary();
  assert.deepEqual(lib.user.map(s => s.id), ['twinkle-2', 'dupe', 'dupe-3', 'dupe-2']);
  const next = await deleteUserScore(lib, 'dupe');
  assert.deepEqual(loadLibrary().user.map(s => s.id), next.user.map(s => s.id));
  assert.deepEqual(next.user.map(s => s.title), ['twinkle', 'second copy', 'dupe-2']);
});

test('64-character colliding IDs remain distinct after parsing saved data', async () => {
  const id = 'a'.repeat(64);
  const stale = loadLibrary();
  await saveUserScore(stale, score(id));
  const second = await saveUserScore(stale, score(id));
  assert.equal(second.savedScore.id.length, 64);
  assert.notEqual(second.savedScore.id, id);
  assert.deepEqual(loadLibrary().user.map(s => s.id), second.library.user.map(s => s.id));
});

test('stale deletion refuses to remove a record changed in another tab', async () => {
  const { library } = await saveUserScore(loadLibrary(), score('target'));
  values.set(key, JSON.stringify([{ ...score('target'), title: 'edited elsewhere' }]));
  const raw = values.get(key);
  await assert.rejects(deleteUserScore(library, 'target'), /重新读取曲库/);
  assert.equal(values.get(key), raw);
  const next = await deleteUserScore(loadLibrary(), 'target');
  assert.deepEqual(next.user, []);
});

test('storage read/write failure never mutates caller state or source score', async () => {
  const source = score('new');
  const before = structuredClone(source);
  const lib = loadLibrary();
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(saveUserScore(lib, source), /尚未保存/);
  assert.deepEqual(source, before);
  assert.deepEqual(lib.user, []);
  assert.equal(values.size, 0);
  localStorage.getItem = () => { throw new Error('SecurityError'); };
  assert.match(loadLibrary().storageIssue ?? '', /无法读取/);
  assert.throws(userLibraryBackup, /无法读取/);
  await assert.rejects(saveUserScore(lib, source), /无法读取/);
  await assert.rejects(deleteUserScore(lib, source.id), /无法读取/);
});

test('backup preview checks all entries and restoration rejects partial validity without writing', async () => {
  const { library } = await saveUserScore(loadLibrary(), score('existing'));
  const raw = userLibraryBackup();
  for (const text of ['invalid', '{}', JSON.stringify([score('one'), null, score('three'), {}])]) {
    const preview = importLibraryBackup(text);
    assert.ok(preview.errors.length);
    await assert.rejects(restoreUserLibrary(library, text, 'merge'), /未恢复/);
    await assert.rejects(restoreUserLibrary(library, text, 'replace'), /未恢复/);
    assert.equal(userLibraryBackup(), raw);
    assert.throws(recoveryLibraryBackup, /还没有/);
  }
  const warnings = importLibraryBackup(JSON.stringify([score('short', '1 2')]));
  assert.equal(warnings.errors.length, 0);
  assert.match(warnings.warnings.join(), /第 1 首.*拍号/);
});

test('merging a backup retains all current entries, duplicate IDs and original timestamps', async () => {
  const stale = loadLibrary();
  await saveUserScore(stale, score('shared'));
  const original = { ...score('shared', '{5}4 - - -'), updatedAt: '2020-01-02T03:04:05.000Z' };
  const merged = await restoreUserLibrary(stale, '\uFEFF' + JSON.stringify([original, score('shared')]), 'merge');
  assert.deepEqual(merged.user.map(s => s.id), ['shared', 'shared-2', 'shared-3']);
  assert.equal(merged.user[1].updatedAt, original.updatedAt);
  assert.equal(merged.user[1].lines[0][0].notes[0].graceNotes![0].hole, 3);
  assert.deepEqual(loadLibrary().user, merged.user);
  assert.throws(recoveryLibraryBackup, /还没有/);
});

test('replacement can recover a corrupt library and keeps exact pre-restore bytes', async () => {
  const damaged = ' { damaged original data\n';
  values.set(key, damaged);
  const lib = loadLibrary();
  await assert.rejects(restoreUserLibrary(lib, JSON.stringify([score('recovered')]), 'merge'), /有效的 JSON 数组/);
  const result = await restoreUserLibrary(lib, JSON.stringify([score('recovered')]), 'replace');
  assert.equal(result.storageIssue, undefined);
  assert.equal(result.user[0].id, 'recovered');
  assert.equal(recoveryLibraryBackup(), damaged);
  assert.deepEqual(result.builtin, lib.builtin);
  assert.deepEqual(loadLibrary().user, result.user);
});

test('downloaded backup restores the complete personal library after replacement', async () => {
  let lib = (await saveUserScore(loadLibrary(), score('first', '3! - - -'))).library;
  lib = (await saveUserScore(lib, score('second', '[U:3]2 - - -'))).library;
  const original = structuredClone(lib.user);
  const backup = userLibraryBackup();
  lib = await restoreUserLibrary(lib, '[]', 'replace');
  assert.deepEqual(lib.user, []);
  assert.equal(recoveryLibraryBackup(), backup);
  const restored = await restoreUserLibrary(lib, recoveryLibraryBackup(), 'replace');
  assert.deepEqual(restored.user, original);
  assert.deepEqual(loadLibrary().user, original);
  assert.equal(recoveryLibraryBackup(), '[]');
  await assert.rejects(restoreUserLibrary(restored, '[]', 'merge'), /备份为空/);
});

test('stale replacement cannot overwrite changes made after the preview', async () => {
  const stale = loadLibrary();
  await saveUserScore(stale, score('elsewhere'));
  const original = userLibraryBackup();
  await assert.rejects(restoreUserLibrary(stale, JSON.stringify([score('backup')]), 'replace'), /其他标签页/);
  assert.equal(userLibraryBackup(), original);
  assert.throws(recoveryLibraryBackup, /还没有/);
});

test('recovery backup or final write failure leaves the current library intact', async () => {
  const { library } = await saveUserScore(loadLibrary(), score('existing'));
  const original = userLibraryBackup();
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(restoreUserLibrary(library, '[]', 'replace'), /无法保存恢复前副本/);
  assert.equal(userLibraryBackup(), original);
  localStorage.setItem = (id, value) => {
    if (id === key) throw new Error('quota');
    values.set(id, value);
  };
  await assert.rejects(restoreUserLibrary(library, '[]', 'replace'), /尚未保存/);
  assert.equal(userLibraryBackup(), original);
  assert.equal(recoveryLibraryBackup(), original);
  localStorage.getItem = () => { throw new Error('security'); };
  await assert.rejects(restoreUserLibrary(library, '[]', 'replace'), /无法读取/);
});
