import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';
import { scoreFromObject } from '../src/lib/scoreImport';

function fixture(melody: string) {
  return scoreFromObject({ title: 'notation', key: 'C', timeSignature: '4/4', melody }).score!;
}
function render(melody: string) {
  return renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score: fixture(melody) }));
}
test('long notes have one dash per extra beat; dotted half notes last three beats', () => {
  assert.equal((render('1 - - -').match(/data-notation="duration-dash"/g) ?? []).length, 3);
  assert.equal((render('1. -').match(/data-notation="duration-dash"/g) ?? []).length, 2);
  assert.equal((render('0 - - -').match(/data-notation="rest-extension"/g) ?? []).length, 3);
});
test('multiple octave dots survive rendering and short notes leave room below dots', () => {
  const svg = render("1'' 1,,,/ 2/ 1");
  assert.equal((svg.match(/data-notation="high-dot"/g) ?? []).length, 2);
  assert.equal((svg.match(/data-notation="low-dot"/g) ?? []).length, 3);
});
test('a cross-row tie renders its outgoing and incoming portions', () => {
  assert.equal((render('1~ - - - |\n1 - - -').match(/data-notation="tie"/g) ?? []).length, 2);
});
test('dense lines wrap without overflowing the page right margin', () => {
  const layout = layoutScore(fixture(Array(12).fill('1 2 3 4').join(' | ')));
  assert.ok(layout.lines.length > 1);
  for (const line of layout.lines) {
    const last = line.measures[line.measures.length - 1];
    assert.ok(last.x + last.w <= layout.width - 55);
  }
});

test('meter changes reserve space before the first note on desktop and mobile', () => {
  const score = fixture('1 - - - | [M:3/4] 2 - - |\n3 - -');
  const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score }));
  assert.equal((svg.match(/data-notation="meter-change"/g) ?? []).length, 1);
  for (const width of [420, 1080]) {
    const meter = layoutScore(score, width).lines.flatMap((line) => line.measures).find((m) => m.measure.timeSignature)!;
    assert.ok(meter.notes[0].x > meter.x + 45);
  }
});

test('natural signs cancel earlier alterations at the same octave within a measure', () => {
  assert.equal((render('#4 4 4 4').match(/♮/g) ?? []).length, 1);
  assert.equal((render('b7 1 7 7').match(/♮/g) ?? []).length, 1);
  assert.equal((render("#4 4' 4 4").match(/♮/g) ?? []).length, 1);
  assert.equal((render('#4 - - - | 4 - - -').match(/♮/g) ?? []).length, 0);
  assert.equal((render('#4 #4 #4 #4').match(/♮/g) ?? []).length, 0);
});

test('an oversized measure wraps without changing its music, repeats or accidental state', () => {
  const score = fixture('|: #4// 1// 2// 3// 1// 2// 3// 4//~ 4// 1// 2// 3// 1// 2// 3// 4// :|');
  const original = score.lines.flatMap((line) => line).flatMap((m) => m.notes);
  const layout = layoutScore(score, 420);
  const fragments = layout.lines.flatMap((line) => line.measures);
  assert.equal(fragments.length, 2);
  assert.deepEqual(fragments.flatMap((m) => m.notes.map((p) => p.note)), original);
  assert.equal(fragments[0].measure.repeatBegin, true);
  assert.equal(fragments[0].measure.repeatEnd, false);
  assert.equal(fragments[1].measure.repeatBegin, false);
  assert.equal(fragments[1].measure.repeatEnd, true);
  assert.equal(fragments[0].continuesOnNext, true);
  assert.equal(fragments[1].continuesFromPrevious, true);
  for (const fragment of fragments) {
    for (let i = 1; i < fragment.notes.length; i++) {
      assert.ok(fragment.notes[i].x - fragment.notes[i - 1].x >= 32);
    }
  }
  const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score, pageWidth: 420 }));
  assert.equal((svg.match(/data-notation="measure-continuation"/g) ?? []).length, 2);
  assert.equal((svg.match(/data-notation="measure-continuation-label"/g) ?? []).length, 1);
  assert.equal((svg.match(/data-notation="tie"/g) ?? []).length, 2);
  // A sharp in the first fragment must be cancelled even in the continuation.
  const crossing = fixture('#4// 1// 2// 3// 1// 2// 3// 1// 4// 1// 2// 3// 1// 2// 3// 4//');
  const next = layoutScore(crossing, 420).lines[1].measures[0].notes[0];
  assert.equal(next.note.degree, 4);
  assert.equal(next.showNatural, true);
});
