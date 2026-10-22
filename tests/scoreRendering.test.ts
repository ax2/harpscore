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
