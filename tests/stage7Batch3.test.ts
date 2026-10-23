import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { analyzeScore } from '../src/lib/harmonica';
import { noteDuration } from '../src/lib/notation';
import { decodeMarkedReferenceAbc } from './helpers/abcReference';

const fixtures = new URL('./fixtures/stage7-batch3/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', fixtures), 'utf8')) as Array<{id:string;file:string;transpose:number}>;
const counts: Record<string, [number, number, number, number]> = {
  'left-right': [16, 0, 0, 28],
  snowbirds: [16, 0, 0, 42],
  'little-ship': [17, 6, 1, 68],
  'hunting-we-will-go': [21, 6, 2, 89],
};
for (const entry of manifest) test(`${entry.id}: every pitch, duration, tie and fermata matches the selected ABC`, () => {
  const score = structuredClone(BUILTIN_SCORES.find(score => score.id === entry.id)!);
  assert.ok(score);
  const reference = decodeMarkedReferenceAbc(fs.readFileSync(new URL(entry.file, fixtures), 'utf8'), entry.transpose);
  const bars = score.lines.flat();
  const actual = bars.map(bar => bar.notes.map(note => [noteToMidi(score.key, note), noteDuration(note), !!note.tie, !!note.fermata]));
  assert.deepEqual(actual, reference);
  const [barCount, ties, fermatas, events] = counts[entry.id];
  assert.equal(bars.length, barCount);
  assert.equal(actual.flat().length, events);
  assert.equal(bars.flatMap(bar => bar.notes).filter(note => note.tie).length, ties);
  assert.equal(bars.flatMap(bar => bar.notes).filter(note => note.fermata).length, fermatas);
  const analysis = analyzeScore(score);
  assert.equal(analysis.playable, true);
  if (entry.id !== 'little-ship') assert.equal(analysis.bendNotes, 0);
  else {
    assert.equal(analysis.minMidi, 64);
    assert.equal(analysis.maxMidi, 79);
    assert.equal(analysis.bendNotes, 4);
  }
});

test('reference decoder retains tied subdivisions and fermata onset and rejects unsupported marks', () => {
  const header = 'X:1\nM:6/8\nL:1/8\nK:C\n';
  assert.deepEqual(decodeMarkedReferenceAbc(header + 'G/-G/ | H(c2 B) c>B A |]', 12), [
    [[79,.25,true,false],[79,.25,false,false]],
    [[84,1,false,true],[83,.5,false,false],[84,.75,false,false],[83,.25,false,false],[81,.5,false,false]],
  ]);
  for (const body of ['!trill!c2', '(3abc', 'c<<d', 'c--c']) {
    assert.throws(() => decodeMarkedReferenceAbc(header + body, 0));
  }
});
