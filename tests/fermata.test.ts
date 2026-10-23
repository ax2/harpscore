import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { noteDuration } from '../src/lib/notation';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';

const base = { title: 'fermata', key: 'C', harmonicaKey: 'C', timeSignature: '4/4' };

test('fermata preserves written duration, ties, rests and decorated main notes through import/export', () => {
  const result = scoreFromObject({ ...base, melody: '{6,/}3!~ - - - | 3 - 0! - | [U:3]2! - - -' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  const score = result.score!;
  assert.equal(score.lines[0][0].notes[0].fermata, true);
  assert.equal(score.lines[0][0].notes[0].tie, true);
  assert.deepEqual(score.lines[0].map((m) => m.notes.reduce((sum, n) => sum + noteDuration(n), 0)), [4, 4, 4]);
  assert.deepEqual(importScoreJson(JSON.stringify(score)).score, score);
  for (const pageWidth of [420, 1080]) {
    const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score, pageWidth }));
    assert.equal((svg.match(/data-notation="fermata"/g) ?? []).length, 3);
    assert.match(svg, /不固定增加拍数/);
    assert.ok(layoutScore(score, pageWidth).lines[0].y > 210);
  }
});

test('fermata flags are validated and cannot silently attach to grace or mordent auxiliary pitches', () => {
  for (const fermata of ['true', 1, null, {}]) {
    assert.match(scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 1, beats: 4, fermata }] }]] }).error ?? '', /fermata/);
  }
  for (const melody of ['1!! - - -', '{1!}2 - - -', '[U:3!]2 - - -']) assert.ok(scoreFromObject({ ...base, melody }).error);
  assert.ok(scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 1, beats: 4, graceNotes: [{ degree: 2, beats: 0.25, fermata: true }] }] }]] }).error);
});
