import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { analyzeScore, holeLabel } from '../src/lib/harmonica';
import { noteDuration } from '../src/lib/notation';
import { DEFAULT_FILTERS, filterScores } from '../src/lib/libraryView';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';

const base = { title: 'mordent test', key: 'C', harmonicaKey: 'C', timeSignature: '4/4' };

test('explicit mordent auxiliaries survive octave shifts and JSON without adding beats', () => {
  const result = scoreFromObject({ ...base, octaveShift: 1, melody: '[U:#4]3 2 1 0' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  const notes = result.score!.lines[0][0].notes;
  assert.deepEqual(notes[0].ornament, { kind: 'upper-mordent', auxiliary: { degree: 4, accidental: 1, octave: 1 } });
  assert.equal(notes.reduce((sum, n) => sum + noteDuration(n), 0), 4);
  assert.deepEqual(importScoreJson(JSON.stringify(result.score)).score, result.score);
  for (const melody of ["[U:1']7 - - -", "[L:7]1' - - -"]) {
    assert.equal(scoreFromObject({ ...base, melody }).error, undefined);
  }
});

test('mordents reject non-neighbors, reversed directions, rests and ambiguous nested decoration', () => {
  for (const melody of ['[U:5]3 - - -', '[L:4]3 - - -', '[U:0]1 - - -', '[U:1]0 - - -',
    '[U:4/]3 - - -', '[U:4=字]3 - - -', '[U:b4]#3 - - -', '[U:4]{2}3 - - -', '{2}[U:4]3 - - -',
    '[U:[L:3]4]3 - - -', "[U:1'''']7''' - - -"]) {
    assert.ok(scoreFromObject({ ...base, melody }).error, melody);
  }
  for (const auxiliary of [{ degree: 0 }, { degree: 4, beats: 0.25 }, { degree: 4, graceNotes: [] }, { degree: 4, octave: 4 }]) {
    assert.ok(scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 3, beats: 4, ornament: { kind: 'upper-mordent', auxiliary } }] }]] }).error);
  }
});

test('auxiliary bends and unavailable pitches affect fingering, range and natural-note filtering', () => {
  const score = scoreFromObject({ ...base, melody: '[U:#4]3 - - -' }).score!;
  const analysis = analyzeScore(score);
  assert.equal(analysis.totalNotes, 2);
  assert.equal(analysis.ornamentNotes, 1);
  assert.equal(analysis.bendNotes, 1);
  assert.equal(analysis.maxMidi, 66);
  assert.equal(holeLabel(score.lines[0][0].notes[0].ornament!.auxiliary), "-2'");
  assert.equal(filterScores([score], { ...DEFAULT_FILTERS, technique: 'natural' }, []).length, 0);
  const high = scoreFromObject({ ...base, melody: "[U:#4']3' - - -" }).score!;
  assert.equal(analyzeScore(high, true).playable, true);
  const normal = analyzeScore(high, false);
  assert.equal(normal.playable, false);
  assert.equal(normal.issues[0].ornament, true);
  assert.equal(high.lines[0][0].notes[0].ornament!.auxiliary.hole, null);
});

test('mordent symbols and auxiliary fingering render with enough room for lyrics', () => {
  const score = scoreFromObject({ ...base, melody: '[U:4]3=字 [L:1]2=句 1 0' }).score!;
  analyzeScore(score);
  const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score }));
  assert.match(svg, /data-notation="upper-mordent"/);
  assert.match(svg, /data-notation="lower-mordent"/);
  assert.match(svg, /辅 -2&#x27;&#x27;/);
  assert.match(svg, /主—辅—主/);
  for (const width of [420, 1080]) {
    const line = layoutScore(score, width).lines[0];
    assert.equal(line.hasOrnament, true);
    assert.equal(line.hasLyric, true);
    assert.ok(line.height >= 150);
    assert.ok(line.measures[0].notes[1].x - line.measures[0].notes[0].x > 40);
  }
});

test('altered auxiliaries cancel earlier accidentals and ties cannot skip a mordent', () => {
  const score = scoreFromObject({ ...base, melody: '#4 [U:4]3 4 0' }).score!;
  const notes = layoutScore(score).lines[0].measures[0].notes;
  assert.equal(notes[1].auxiliaryNatural, true);
  assert.equal(notes[2].showNatural, false);
  assert.match(scoreFromObject({ ...base, melody: '3~ - - - | [U:4]3 - - -' }).warnings.join(), /波音/);
});
