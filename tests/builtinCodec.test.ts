import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { packBuiltinScores, unpackBuiltinScores, type PackedBuiltinLibrary } from '../src/lib/builtinCodec';
import { scoreFromObject } from '../src/lib/scoreImport';

test('packed transport restores all full score JSONs exactly and is deterministic', () => {
  const generated = JSON.parse(fs.readFileSync(new URL('../src/data/builtin.packed.json', import.meta.url), 'utf8'));
  assert.deepEqual(packBuiltinScores(BUILTIN_SCORES), generated);
  const restored = unpackBuiltinScores(generated);
  for (const score of restored) {
    const full = JSON.parse(fs.readFileSync(new URL(`../src/data/scores/${score.id}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(score, full, score.id);
  }
  assert.equal(restored.length, fs.readdirSync(new URL('../src/data/scores/', import.meta.url)).filter(name => name.endsWith('.json')).length);
  assert.ok(Buffer.byteLength(JSON.stringify(generated)) < Buffer.byteLength(JSON.stringify(restored)) * .4);
});

test('shared dictionary entries never share mutable notes, auxiliaries, metadata or decoder calls', () => {
  const imported = scoreFromObject({ title: 'Isolated', key: 'C', timeSignature: '4/4', tags: ['test'], melody: '{5}1 - - - | {5}1 - - - | [U:2]1 - - - | [U:2]1 - - -' });
  assert.equal(imported.error, undefined);
  const source = imported.score!;
  const snapshot = structuredClone(source);
  const packed = packBuiltinScores([source, { ...source, id: 'second' }]);
  assert.equal(packed.notes.length, 2);
  const packedSnapshot = structuredClone(packed);
  const decoded = unpackBuiltinScores(packed);
  const bars = decoded[0].lines.flat();
  bars[0].notes[0].degree = 7;
  bars[0].notes[0].graceNotes![0].hole = 10;
  bars[2].notes[0].ornament!.auxiliary.degree = 7;
  decoded[0].tags.push('changed');
  assert.deepEqual(bars[1].notes[0], snapshot.lines.flat()[1].notes[0]);
  assert.deepEqual(bars[3].notes[0], snapshot.lines.flat()[3].notes[0]);
  assert.deepEqual(decoded[1], { ...snapshot, id: 'second' });
  assert.deepEqual(packed, packedSnapshot);
  assert.deepEqual(source, snapshot);
  assert.deepEqual(unpackBuiltinScores(packed), [snapshot, { ...snapshot, id: 'second' }]);
  packed.notes[0].degree = 6;
  assert.deepEqual(source, snapshot);
});

test('invalid internal versions and dictionary indexes fail rather than substituting another note', () => {
  const packed = packBuiltinScores([scoreFromObject({ title: 'Index', key: 'C', timeSignature: '4/4', melody: '1 - - -' }).score!]);
  for (const index of [-1, .5, 1, NaN, Infinity]) {
    const invalid = structuredClone(packed);
    invalid.scores[0].lines[0][0].notes[0] = index;
    assert.throws(() => unpackBuiltinScores(invalid), /音符索引无效/);
  }
  assert.throws(() => unpackBuiltinScores({ ...packed, version: 2 } as unknown as PackedBuiltinLibrary), /数据版本/);
});
