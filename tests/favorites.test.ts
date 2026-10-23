import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { FAVORITES_KEY, loadFavorites, setFavorite } from '../src/lib/libraryView';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } });
});

test('favorite choices preserve other tabs additions and are idempotent', async () => {
  const stale = loadFavorites();
  values.set(FAVORITES_KEY, JSON.stringify(['other-tab']));
  assert.deepEqual(stale, []);
  assert.deepEqual(await setFavorite('this-tab', true), ['other-tab', 'this-tab']);
  assert.deepEqual(await setFavorite('this-tab', true), ['other-tab', 'this-tab']);
  assert.deepEqual(await setFavorite('this-tab', false), ['other-tab']);
  assert.deepEqual(await setFavorite('this-tab', false), ['other-tab']);
});

test('malformed or unreadable favorites never get overwritten', async () => {
  for (const raw of ['{', '{}', '[null]', '["valid", 42]', '[""]']) {
    values.set(FAVORITES_KEY, raw);
    await assert.rejects(setFavorite('new', true), /原数据未覆盖/);
    assert.equal(values.get(FAVORITES_KEY), raw);
  }
  values.set(FAVORITES_KEY, '["valid", 42, "valid"]');
  assert.deepEqual(loadFavorites(), ['valid']);
  localStorage.getItem = () => { throw new Error('denied'); };
  await assert.rejects(setFavorite('new', true), /原数据未覆盖/);
});

test('failed favorite writes preserve stored data', async () => {
  values.set(FAVORITES_KEY, '["existing"]');
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(setFavorite('new', true), /空间不足/);
  assert.equal(values.get(FAVORITES_KEY), '["existing"]');
  assert.deepEqual(loadFavorites(), ['existing']);
});

test('favorite data is read after acquiring its write lock', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: async (key: string, action: () => string[]) => {
      assert.equal(key, FAVORITES_KEY);
      await waiting;
      return action();
    },
  } } });
  const saving = setFavorite('mine', true);
  values.set(FAVORITES_KEY, '["arrived-while-waiting"]');
  release();
  assert.deepEqual(await saving, ['arrived-while-waiting', 'mine']);
});
