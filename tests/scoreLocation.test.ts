import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreFromObject } from '../src/lib/scoreImport';
import { formatScoreLocation } from '../src/lib/scoreLocation';
import { analyzeScore } from '../src/lib/harmonica';
import { layoutScore } from '../src/components/ScoreSheet';

test('diagnostics count authored bars across unequal source rows, pickups and mobile continuations', () => {
  const result = scoreFromObject({ title: 'Locations', key: 'C', timeSignature: '4/4', pickupBeats: 1, lines: [
    [{ notes: [{ degree: 1, beats: 1 }] },
      { notes: Array.from({ length: 32 }, () => ({ degree: 3, beats: .125 })), repeatBegin: true, repeatEnd: true }],
    [{ notes: [{ degree: 0, beats: 1 }, { degree: 4, accidental: 1, beats: 1, tie: true, techniques: ['gliss'] }] }],
  ] });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, [
    '第 3 小节为 2 拍，拍号要求 4 拍',
    '第 3 小节第 2 音的延音线必须连接后续同音高音符',
    '第 3 小节第 2 音的滑音未指定起止及过程音，只显示文字提示；过程音未作孔位校验',
  ]);
  const score = result.score!;
  const issue = analyzeScore(score).issues.find(issue => issue.lineIndex === 1)!;
  assert.equal(formatScoreLocation(score, issue), '第 3 小节第 2 音');
  for (const width of [420, 1080]) {
    const bars = layoutScore(score, width, true).lines.flatMap(line => line.measures);
    assert.equal(bars.at(-1)!.number, 3);
    if (width === 420) assert.ok(bars.length > 3);
  }
});

test('grace and ornament diagnostics retain parent note and auxiliary position', () => {
  const imported = scoreFromObject({ title: 'Auxiliary locations', key: 'C', timeSignature: '4/4', melody: '1 - - - | 2 - - - |\n{#4;#4}1 - - - | [U:#4]3 - - -' });
  assert.equal(imported.error, undefined);
  const score = imported.score!;
  const auxiliary = analyzeScore(score).issues.filter(issue => issue.graceIndex !== undefined || issue.ornament);
  assert.deepEqual(auxiliary.map(issue => formatScoreLocation(score, issue)), [
    '第 3 小节第 1 音的倚音 1',
    '第 3 小节第 1 音的倚音 2',
    '第 4 小节第 1 音的波音辅助音',
  ]);
});
