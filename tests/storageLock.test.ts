import assert from 'node:assert/strict';
import test from 'node:test';
import { withStorageWriteLock } from '../src/lib/storageLock';

test('queued storage publication precedes lock release even when a later write fails', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
  for (const fail of [false, true]) {
    const events: string[] = [];
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
      request: async (_key: string, action: () => Promise<string>) => {
        try { return await action(); }
        finally { events.push('released'); }
      },
    } } });
    const error = new Error('second write failed after recovery snapshot');
    const result = withStorageWriteLock('test', () => {
      events.push('write');
      setTimeout(() => events.push('published'), 0);
      if (fail) throw error;
      return 'saved';
    });
    if (fail) await assert.rejects(result, caught => caught === error);
    else assert.equal(await result, 'saved');
    assert.deepEqual(events, ['write', 'published', 'released']);
  }
});
