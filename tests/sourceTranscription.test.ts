import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';
import { analyzeScore } from '../src/lib/harmonica';

function bars(id: string) {
  const score = BUILTIN_SCORES.find((s) => s.id === id)!;
  assert.ok(score, id);
  return score.lines.flat().map((m) => m.notes.map((n) => [noteToMidi(score.key, n), noteDuration(n)]));
}

test('the original call-response study stays on natural reeds and retains breathing rests', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'cross-harp-call-response')!;
  const analysis = analyzeScore(score);
  assert.equal(analysis.playable, true);
  assert.equal(analysis.bendNotes, 0);
  assert.equal(analysis.overblowNotes, 0);
  assert.equal(score.lines.flat().length, 16);
  for (const index of [3, 7, 11, 15]) assert.equal(score.lines.flat()[index].notes.at(-1)?.degree, 0);
});

test('the original low blues scale study uses the intended scale and two specific bends', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'low-blues-scale-study')!;
  const analysis = analyzeScore(score);
  const notes = score.lines.flat().flatMap((m) => m.notes).filter((n) => n.degree);
  assert.equal(analysis.playable, true);
  assert.equal(analysis.overblowNotes, 0);
  assert.equal(score.lines.flat().length, 8);
  assert.deepEqual([...new Set(notes.map((n) => noteToMidi(score.key, n)))].sort((a, b) => a! - b!), [67, 70, 72, 73, 74, 77, 79]);
  for (const note of notes.filter((n) => n.bend)) {
    assert.equal(note.breath, 'draw');
    assert.equal(note.bend, 1);
    assert.equal(note.hole, noteToMidi(score.key, note) === 70 ? 3 : 4);
  }
});

test('Longing for Spring preserves the PEP chromatic bridge, grace note and complementary pickup', () => {
  const source = bars('longing-for-spring');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[60, 0.5]]);
  assert.deepEqual(source[9], [[65, 1], [61, 0.5], [62, 0.5], [64, 0.5], [65, 0.5]]);
  assert.deepEqual(source[11], [[72, 0.5], [71, 0.5], [69, 0.5], [69, 0.5], [67, 0.5], [66, 0.5]]);
  assert.deepEqual(source[15], [[67, 0.5], [64, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5]]);
  assert.deepEqual(source[16], [[60, 1], [null, 0.5], [null, 1]]);
  const score = BUILTIN_SCORES.find((s) => s.id === 'longing-for-spring')!;
  const measures = score.lines.flat();
  assert.deepEqual(measures[15].notes[3].graceNotes?.map((n) => [noteToMidi(score.key, n), n.beats]), [[67, 0.25]]);
  assert.equal(measures[2].notes[0].tie, true);
  assert.equal(measures[6].notes[0].tie, true);
});

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

test('Xiao Bai Cai follows the selected folk textbook variant and changes to 4/4 for the coda', () => {
  const source = bars('xiao-bai-cai');
  assert.equal(source.length, 6);
  assert.deepEqual(source[3], [[74, 1], [72, 1], [72, 0.5], [69, 0.5], [67, 2]]);
  assert.deepEqual(source[4], [[69, 1], [72, 0.5], [69, 0.5], [67, 2]]);
  assert.deepEqual(source[5], [[69, 0.5], [74, 0.5], [72, 0.5], [69, 0.5], [67, 2]]);
  const measures = BUILTIN_SCORES.find((s) => s.id === 'xiao-bai-cai')!.lines.flat();
  assert.equal(measures[4].timeSignature, '4/4');
  assert.ok(measures[3].repeatEnd && measures[4].repeatBegin && measures[5].repeatEnd);
});

test('London Bridge retains the 1927 edition rhythm, ties and final rest', () => {
  const source = bars('london-bridge');
  assert.equal(source.length, 8);
  assert.deepEqual(source[0], [[79, 1.5], [81, 0.5], [79, 1], [77, 1]]);
  assert.deepEqual(source[6], [[74, 2], [79, 2]]);
  assert.deepEqual(source[7], [[76, 1], [72, 2], [null, 1]]);
  assert.ok(BUILTIN_SCORES.find((s) => s.id === 'london-bridge')!.lines[0][1].notes[2].tie);
});

test('Oh Susanna expands the repeat with its pickup and a rest before the chorus', () => {
  const source = bars('oh-susanna');
  assert.equal(source.length, 25);
  assert.deepEqual(source[0], [[72, 0.25], [74, 0.25]]);
  assert.deepEqual(source[8], [[72, 1.5], [72, 0.25], [74, 0.25]]);
  assert.deepEqual(source[16], [[72, 1.5], [null, 0.5]]);
  assert.deepEqual(source[17], [[77, 1], [77, 1]]);
  assert.deepEqual(source[18], [[81, 0.5], [81, 1], [81, 0.5]]);
  assert.deepEqual(source[24], [[72, 1.5]]);
  assert.deepEqual(source.slice(1, 8), source.slice(9, 16));
});

test('Zou Jiang Zhou distinguishes low notes, upper do and sixteenth rests', () => {
  const source = bars('zou-jiang-zhou');
  assert.equal(source.length, 23);
  assert.deepEqual(source[1], [[72, 0.5], [71, 0.25], [69, 0.25], [67, 1]]);
  assert.deepEqual(source[2], [[79, 0.75], [84, 0.25], [79, 0.5], [77, 0.5]]);
  assert.deepEqual(source[5], [[79, 0.25], [null, 0.25], [84, 0.25], [null, 0.25], [79, 0.25], [null, 0.25], [84, 0.25], [null, 0.25]]);
  assert.deepEqual(source[17], [[67, 0.5], [65, 0.5], [67, 0.5], [65, 0.5]]);
  assert.deepEqual(source[22], [[67, 2]]);
});

test('Yankee Doodle includes the lower chorus, dotted rhythms and complementary pickup', () => {
  const source = bars('yankee-doodle');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[67, 0.5]]);
  assert.deepEqual(source[9], [[69, 0.75], [71, 0.25], [69, 0.5], [67, 0.5]]);
  assert.deepEqual(source[12], [[64, 0.75], [65, 0.25], [67, 0.5], [null, 0.5]]);
  assert.deepEqual(source[16], [[72, 1], [72, 0.5]]);
});

test('My Bonnie retains the source ninth opening, low register and tied phrase transitions', () => {
  const source = bars('my-bonnie');
  assert.equal(source.length, 33);
  assert.deepEqual(source[0], [[67, 1]]);
  assert.deepEqual(source[1], [[76, 1.5], [74, 0.5], [72, 1]]);
  assert.deepEqual(source[3], [[67, 1], [64, 2]]);
  assert.deepEqual(source[8], [[74, 2], [67, 1]]);
  assert.deepEqual(source[19], [[69, 3]]);
  assert.deepEqual(source[32], [[72, 2]]);
});

test('Fengyang Flower Drum retains the PEP edition low la and the full rhythmic coda', () => {
  const source = bars('fengyang-flower-drum');
  assert.equal(source.length, 15);
  assert.deepEqual(source[4], [[72, 0.5], [72, 1], [69, 0.5], [79, 1], [79, 0.5], [76, 0.5]]);
  assert.deepEqual(source[12], [[79, 1], [72, 0.5], [null, 0.5], [79, 1], [72, 0.5], [null, 0.5]]);
  assert.deepEqual(source[14], [[74, 0.5], [72, 0.5], [69, 0.5], [74, 0.5], [72, 2]]);
});

test('Click Go the Shears has four phrase-ending rests and the final octave leap', () => {
  const source = bars('click-go-the-shears');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[76, 1], [76, 0.75], [74, 0.25]]);
  assert.deepEqual(source[12], [[86, 0.75], [84, 0.25], [83, 0.5], [81, 0.5]]);
  assert.deepEqual(source[14], [[72, 1], [84, 0.75], [83, 0.25]]);
  for (const index of [3, 7, 11, 15]) assert.deepEqual(source[index].at(-1), [null, 1]);
});

test('Santa Lucia preserves its chromatic cancellation and both alternate endings', () => {
  const source = bars('santa-lucia');
  assert.equal(source.length, 24);
  assert.deepEqual(source[5], [[67, 0.25], [66, 0.25], [65, 1]]);
  assert.deepEqual(source[14], [[74, 0.5], [69, 0.75], [71, 0.25]]);
  assert.deepEqual(source[22], [[74, 0.5], [76, 0.75], [74, 0.25]]);
  assert.deepEqual(source[23], [[74, 0.5], [72, 1]]);
  assert.deepEqual(source.slice(8, 14), source.slice(16, 22));
});
