import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { noteDuration } from '../src/lib/notation';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';

const base = { title: '32nd test', key: 'C', harmonicaKey: 'C', timeSignature: '4/4' };

test('dotted sixteenth and thirty-second pairs preserve a half beat and survive JSON', () => {
  const result = scoreFromObject({ ...base, melody: '1//. 2/// 3/ 4 5 0' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  const notes = result.score!.lines[0][0].notes;
  assert.deepEqual(notes.slice(0, 2).map(noteDuration), [0.375, 0.125]);
  assert.equal(notes.reduce((sum, n) => sum + noteDuration(n), 0), 4);
  assert.deepEqual(importScoreJson(JSON.stringify(result.score)).score, result.score);
});

test('thirty-seconds show three beam tiers, while unsupported smaller durations are rejected', () => {
  const score = scoreFromObject({ ...base, melody: '1//. 2/// 3/ 4 5 0' }).score!;
  for (const width of [420, 1080]) {
    const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score, pageWidth: width }));
    assert.equal((svg.match(/data-notation="beam-3"/g) ?? []).length, 1);
    assert.equal((svg.match(/data-notation="beam-2"/g) ?? []).length, 1);
    const line = layoutScore(score, width).lines[0];
    assert.ok(line.measures.at(-1)!.x + line.measures.at(-1)!.w <= width - 56 + 0.001);
  }
  assert.ok(scoreFromObject({ ...base, melody: '1//// 2' }).error);
  assert.ok(scoreFromObject({ ...base, melody: '{1///}2 - - -' }).error);
  assert.ok(scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 1, beats: 0.0625 }] }]] }).error);
});
