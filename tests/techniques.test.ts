import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { analyzeScore } from '../src/lib/harmonica';
import { DEFAULT_FILTERS, filterScores } from '../src/lib/libraryView';
import type { Technique } from '../src/types/score';

const all: Technique[] = ['vibrato', 'bend-release', 'slap', 'gliss', 'trill'];
const base = { title: '技巧测试', key: 'C', timeSignature: '4/4' };

test('accepted technique flags survive reimport and expose missing pitch detail', () => {
  const result = scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 1, beats: 4, techniques: all }] }]] });
  assert.equal(result.error, undefined);
  assert.equal(result.warnings.length, 4);
  assert.match(result.warnings.join(), /颤音未指定交替音/);
  assert.match(result.warnings.join(), /滑音未指定起止/);
  assert.match(result.warnings.join(), /压音释放未指定完整音高变化/);
  assert.match(result.warnings.join(), /舌拍未指定和声音/);
  assert.deepEqual(importScoreJson(JSON.stringify(result.score)).score, result.score);
});

test('all five techniques appear in standalone and compact notation without hiding on missing fingering', () => {
  for (const degree of [0, 1]) {
    const result = scoreFromObject({ ...base, lines: [[{ notes: [{ degree, beats: 4, techniques: all }] }]] });
    if (degree === 0) assert.match(result.warnings.join(), /休止符/);
    // No analysis: fingering is absent, but annotation must still be printable.
    for (const pageWidth of [420, 1080]) {
      const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score: result.score!, pageWidth, standalone: true }));
      for (const technique of all) assert.equal((svg.match(new RegExp(`data-technique="${technique}"`, 'g')) ?? []).length, 1);
      assert.match(svg, /技巧文字不展开过程音/);
    }
  }
});

test('stacked techniques reserve space above lyrics alongside grace notes, mordents and fermatas', () => {
  const score = scoreFromObject({ ...base, lines: [[{ notes: [
    { degree: 3, beats: 1, lyric: '词', fermata: true, graceNotes: [{ degree: 5, beats: .25 }], techniques: all },
    { degree: 2, beats: 1, ornament: { kind: 'upper-mordent', auxiliary: { degree: 3 } } },
    { degree: 3, beats: 1 }, { degree: 4, beats: 1 },
  ] }]] }).score!;
  for (const pageWidth of [420, 1080]) {
    const layout = layoutScore(score, pageWidth);
    assert.ok(layout.lines.some(line => line.techniqueRows === 5));
    const svg = renderToStaticMarkup(React.createElement(ScoreSheetSvg, { score, pageWidth }));
    const positions = [...svg.matchAll(/data-notation="technique"[^>]* y="([\d.]+)"/g)].map(m => Number(m[1]));
    const lyric = Number(svg.match(/data-notation="lyric"[^>]* y="([\d.]+)"/)![1]);
    assert.equal(positions.length, 5);
    assert.ok(lyric - Math.max(...positions) >= 20);
    assert.ok(layout.height > lyric + 50);
  }
});

test('natural-only filtering does not promise unspecified trill/gliss pitches are natural', () => {
  const scores = all.map(technique => {
    const score = scoreFromObject({ ...base, id: technique, lines: [[{ notes: [{ degree: 1, beats: 4, techniques: [technique] }] }]] }).score!;
    analyzeScore(score);
    return score;
  });
  const natural = filterScores(scores, { ...DEFAULT_FILTERS, technique: 'natural' }, []).map(s => s.id);
  assert.deepEqual(natural, ['vibrato']);
  assert.deepEqual(filterScores(scores, { ...DEFAULT_FILTERS, technique: 'bends' }, []).map(s => s.id), ['bend-release']);
});
