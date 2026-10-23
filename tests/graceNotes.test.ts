import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { analyzeScore, holeLabel } from '../src/lib/harmonica';
import { noteDuration } from '../src/lib/notation';
import { DEFAULT_FILTERS, filterScores } from '../src/lib/libraryView';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';

const base = { title: 'grace test', key: 'C', harmonicaKey: 'C', timeSignature: '4/4' };

test('grace notes preserve their register through DSL, octave shift and JSON round trips without adding beats', () => {
  const result = scoreFromObject({ ...base, octaveShift: 1, melody: "{6,;1/}2 - 3 4" });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  const score = result.score!;
  const notes = score.lines[0][0].notes;
  assert.deepEqual(notes[0].graceNotes?.map((n) => [n.degree, n.octave, n.beats]), [[6, 0, 0.25], [1, 1, 0.5]]);
  assert.equal(notes.reduce((sum, n) => sum + noteDuration(n), 0), 4);
  assert.deepEqual(importScoreJson(JSON.stringify(score)).score, score);
});

test('malformed grace notation is rejected in both DSL and full JSON', () => {
  for (const melody of ['{0}1 - - -', '{1}0 - - -', '{{1}2}3 - - -', '{1;2;3;4;5}1 - - -', '{1.}2 - - -', "{1''''}2 - - -", '{1~}1 - - -']) {
    assert.ok(scoreFromObject({ ...base, melody }).error, melody);
  }
  assert.ok(scoreFromObject({ ...base, melody: '{1=字}2 - - -' }).error);
  for (const grace of [
    { degree: 0, beats: 0.25 }, { degree: 1, beats: 1 }, { degree: 1, beats: 0.25, lyric: '字' },
    { degree: 1, beats: 0.25, graceNotes: [{ degree: 2, beats: 0.25 }] },
  ]) assert.ok(scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 1, beats: 4, graceNotes: [grace] }] }]] }).error);
  assert.ok(scoreFromObject({ ...base, octaveShift: 1, melody: "{1'''}2 - - -" }).error);
});

test('grace fingering is recalculated and can make an otherwise natural melody unplayable', () => {
  const score = scoreFromObject({ ...base, melody: '{#4}5 - - -' }).score!;
  const analysis = analyzeScore(score);
  assert.equal(analysis.totalNotes, 2);
  assert.equal(analysis.graceNotes, 1);
  assert.equal(analysis.bendNotes, 1);
  assert.equal(analysis.minMidi, 66);
  assert.equal(holeLabel(score.lines[0][0].notes[0].graceNotes![0]), "-2'");
  assert.equal(filterScores([score], { ...DEFAULT_FILTERS, technique: 'natural' }, []).length, 0);
  assert.equal(filterScores([score], { ...DEFAULT_FILTERS, technique: 'bends' }, []).length, 1);
  const unplayable = scoreFromObject({ ...base, melody: "{#4'}5 - - -" }).score!;
  assert.equal(analyzeScore(unplayable, true).playable, true);
  const rejected = analyzeScore(unplayable, false);
  assert.equal(rejected.playable, false);
  assert.equal(rejected.issues[0].graceIndex, 0);
  assert.equal(unplayable.lines[0][0].notes[0].graceNotes![0].hole, null);
});

test('grace glyphs reserve space and cancel accidentals before the principal note', () => {
  const score = scoreFromObject({ ...base, melody: '{#4}4 2 3 4' }).score!;
  analyzeScore(score);
  const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score }));
  assert.match(svg, /data-notation="grace-note"/);
  assert.match(svg, /data-notation="grace-arc"/);
  assert.match(svg, /♮/);
  for (const width of [420, 1080]) {
    const note = layoutScore(score, width).lines[0].measures[0].notes[0];
    assert.ok(note.x - note.graceNotes[0].x > 20);
  }
});

test('a tie cannot silently skip a written grace note', () => {
  assert.match(scoreFromObject({ ...base, melody: '1~ - - - | {2}1 - - -' }).warnings.join(), /前倚音/);
});
