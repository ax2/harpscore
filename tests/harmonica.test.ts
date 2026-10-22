import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeScore, findHole, harmonicaRoot, holeLabel } from '../src/lib/harmonica';
import { scoreFromObject } from '../src/lib/scoreImport';

test('Richter C natural reeds and all stable bends match their absolute pitches', () => {
  const expected: Array<[number, string]> = [
    [60, '+1'], [62, '-1'], [64, '+2'], [67, '+3'], [71, '-3'], [72, '+4'],
    [74, '-4'], [76, '+5'], [77, '-5'], [79, '+6'], [81, '-6'], [83, '-7'],
    [84, '+7'], [86, '-8'], [88, '+8'], [89, '-9'], [91, '+9'], [93, '-10'], [96, '+10'],
    [61, "-1'"], [65, "-2''"], [66, "-2'"], [68, "-3'''"], [69, "-3''"],
    [70, "-3'"], [73, "-4'"], [80, "-6'"], [87, "+8'"], [90, "+9'"],
    [95, "+10'"], [94, "+10''"],
  ];
  for (const [midi, label] of expected) {
    const option = findHole(midi);
    assert.ok(option, `${midi} should be playable`);
    assert.equal(holeLabel({ degree: 1, beats: 1, ...option }), label, String(midi));
  }
  for (const midi of [59, 63, 75, 78, 82, 85, 92, 97]) assert.equal(findHole(midi), null);
});

test('advanced mode includes overdraws and clears stale fingering when disabled', () => {
  for (const [midi, hole] of [[85, 7], [92, 9], [97, 10]]) {
    assert.equal(findHole(midi, true)?.breath, 'draw');
    assert.equal(findHole(midi, true)?.hole, hole);
  }
  const score = scoreFromObject({ title: 'test', key: 'C', timeSignature: '4/4', melody: "#1'' - - -" }).score!;
  assert.equal(analyzeScore(score, true).playable, true);
  assert.equal(score.lines[0][0].notes[0].hole, 7);
  assert.equal(analyzeScore(score, false).playable, false);
  assert.equal(score.lines[0][0].notes[0].hole, null);
});

test('standard A and G harmonicas use their real lower register, D uses D4', () => {
  assert.equal(harmonicaRoot('A'), 57);
  assert.equal(harmonicaRoot('G'), 55);
  assert.equal(harmonicaRoot('D'), 62);
  assert.equal(findHole(57, false, 'A')?.hole, 1);
  assert.equal(findHole(69, false, 'A')?.hole, 4);
  assert.equal(findHole(62, false, 'D')?.hole, 1);
  const score = scoreFromObject({ title: 'A harp', key: 'A', harmonicaKey: 'A', timeSignature: '4/4', melody: '1 - - -' }).score!;
  assert.equal(analyzeScore(score).playable, true);
  assert.equal(score.lines[0][0].notes[0].hole, 4);
});

test('blow bends are described as blow, and out-of-range errors use the selected harp', () => {
  const score = scoreFromObject({ title: 'high B', key: 'C', timeSignature: '4/4', melody: "7'' - - -" }).score!;
  assert.match(analyzeScore(score).issues[0].reason, /10 孔吹/);
  score.harmonicaKey = 'G';
  assert.match(analyzeScore(score).issues[0].reason, /G6/);
});
