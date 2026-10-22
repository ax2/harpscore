import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';

function bars(id: string) {
  const score = BUILTIN_SCORES.find((s) => s.id === id)!;
  assert.ok(score, id);
  return score.lines.flat().map((m) => m.notes.map((n) => [noteToMidi(score.key, n), noteDuration(n)]));
}

test('Arirang preserves textbook p.53 dotted opening, register and distinct endings', () => {
  const source = bars('arirang');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[67, 1.5], [69, 0.5], [67, 0.5], [69, 0.5]]);
  assert.deepEqual(source[2], [[76, 1], [74, 0.5], [76, 0.5], [72, 0.5], [69, 0.5]]);
  assert.deepEqual(source[7], [[72, 3]]);
  assert.deepEqual(source[11], [[67, 1.5], [69, 0.5], [67, 0.5], [null, 0.5]]);
  assert.deepEqual(source[15], [[72, 2], [null, 1]]);
});

test('Harvest Song includes textbook p.51 continuation and its high-register bridge', () => {
  const source = bars('harvest-song');
  assert.equal(source.length, 24);
  assert.deepEqual(source[0], [[84, 1], [79, 0.5], [76, 0.5]]);
  assert.deepEqual(source[16], [[84, 1], [84, 1]]);
  assert.deepEqual(source[17], [[83, 0.5], [86, 0.5], [79, 1]]);
  assert.deepEqual(source[19], [[84, 0.5], [88, 0.5], [79, 1]]);
  for (const index of [7, 15, 23]) assert.deepEqual(source[index], [[72, 1], [null, 1]]);
});
