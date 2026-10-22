import assert from 'node:assert/strict';
import test from 'node:test';
import { importScoreJson, parseMelodyDsl, scoreFromObject, uniqueScoreId } from '../src/lib/scoreImport';

const base = {
  title: '测试曲', key: 'C', harmonicaKey: 'C', timeSignature: '4/4', difficulty: 1, tags: [],
};

test('imports full HarpScore JSON and removes untrusted derived fingering', () => {
  const result = scoreFromObject({
    ...base,
    id: 'demo',
    lines: [[{ notes: [{ degree: 1, beats: 4, hole: 99, breath: 'draw' }] }]],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.score?.lines[0][0].notes[0].hole, undefined);
  assert.deepEqual(result.warnings, []);
});

test('imports melody DSL including BOM, lyrics, accidentals, durations and final bar', () => {
  const result = importScoreJson(`\uFEFF${JSON.stringify({
    ...base,
    melody: "1=你 2/ #3/ 4~ | 5 - - - ||",
  })}`);
  assert.equal(result.format, 'melody-dsl');
  assert.equal(result.error, undefined);
  assert.equal(result.score?.lines[0][0].notes[0].lyric, '你');
  assert.equal(result.score?.lines[0][0].notes[2].accidental, 1);
  assert.equal(result.score?.lines[0][0].notes[3].tie, true);
  assert.equal(result.score?.lines[0][1].notes[0].beats, 4);
  assert.equal(result.score?.lines[0][1].sectionEnd, true);
});

test('bakes octaveShift into note octave and removes the field', () => {
  const result = scoreFromObject({ ...base, octaveShift: 1, melody: '1 - - -' });
  assert.equal(result.error, undefined);
  assert.equal(result.score?.octaveShift, undefined);
  assert.equal(result.score?.lines[0][0].notes[0].octave, 1);
});

test('accepts complementary opening and closing pickup measures without warnings', () => {
  const result = scoreFromObject({ ...base, melody: '5 | 1 - - - |\n2 - - - | 1 - -' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
});

test('rejects malformed nested score data with a precise path', () => {
  const result = scoreFromObject({ ...base, lines: [[{ notes: [{ degree: 9, beats: -1 }] }]] });
  assert.match(result.error ?? '', /lines\[0\]\[0\]\.notes\[0\]\.degree/);
  assert.match(result.error ?? '', /beats/);
});

test('rejects unsupported DSL tokens and extension without a note', () => {
  assert.throws(() => parseMelodyDsl('- 1 | 2 3'), /延长符前没有音符/);
  assert.throws(() => parseMelodyDsl('H4 1 | 2 3'), /无法识别音符/);
});

test('reports beat mismatches without rejecting a structurally valid score', () => {
  const result = scoreFromObject({ ...base, melody: '1 2 | 3 - - -' });
  assert.equal(result.error, undefined);
  assert.equal(result.warnings.length, 1);
});

test('accepts a single-item array and wrapper object', () => {
  const lines = [[{ notes: [{ degree: 1, beats: 4 }] }]];
  assert.equal(scoreFromObject([{ ...base, lines }]).error, undefined);
  assert.equal(scoreFromObject({ score: { ...base, lines } }).error, undefined);
  assert.match(scoreFromObject([{ ...base, lines }, { ...base, lines }]).error ?? '', /一次只能导入一首/);
});

test('creates a non-destructive ID when an imported ID already exists', () => {
  const score = scoreFromObject({ ...base, id: 'demo', lines: [[{ notes: [{ degree: 1, beats: 4 }] }]] }).score!;
  assert.equal(uniqueScoreId(score, ['demo', 'demo-2']).id, 'demo-3');
});

test('preserves traceable numbered-notation source metadata', () => {
  const result = scoreFromObject({
    ...base,
    source: '教学简谱',
    sourceUrl: 'https://example.com/score.pdf',
    sourceFormat: 'jianpu-image',
    sourceCheckedAt: '2026-08-31',
    melody: '1 - - -',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.score?.sourceUrl, 'https://example.com/score.pdf');
  assert.equal(result.score?.sourceFormat, 'jianpu-image');
  assert.equal(result.score?.sourceCheckedAt, '2026-08-31');
});

test('rejects unsafe or malformed source metadata', () => {
  const result = scoreFromObject({
    ...base,
    sourceUrl: 'javascript:alert(1)',
    sourceFormat: 'staff-ocr',
    sourceCheckedAt: '31/08/2026',
    melody: '1 - - -',
  });
  assert.match(result.error ?? '', /sourceFormat/);
  assert.match(result.error ?? '', /sourceUrl/);
  assert.match(result.error ?? '', /sourceCheckedAt/);
});

test('rejects impossible dates, empty source formats, zero meter and unrenderable rhythms', () => {
  for (const patch of [
    { sourceCheckedAt: '2026-02-30' }, { sourceCheckedAt: '2026-13-01' },
    { sourceFormat: 123 }, { sourceFormat: '' }, { timeSignature: '0/4' },
    { melody: "1'''' - - -" }, { melody: "1''' - - -", octaveShift: 1 },
    { melody: '0, - - -' },
    { lines: [[{ notes: [{ degree: 1, beats: 0.3 }] }]], melody: undefined },
  ]) assert.ok(scoreFromObject({ ...base, melody: '1 - - -', ...patch }).error, JSON.stringify(patch));
});

test('a single half-filled measure is not a complementary pickup pair', () => {
  assert.equal(scoreFromObject({ ...base, melody: '1 -' }).warnings.length, 1);
});

test('an explicit pickup permits a complete final bar without hiding other rhythm errors', () => {
  const result = scoreFromObject({ ...base, pickupBeats: 1, melody: '5/ 1/ | 3 - - - | 1 - - -' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.score?.pickupBeats, 1);
  const roundTrip = importScoreJson(JSON.stringify(result.score));
  assert.deepEqual(roundTrip.score, result.score);
  assert.deepEqual(roundTrip.warnings, []);
  assert.equal(scoreFromObject({ ...base, melody: '5/ 1/ | 3 - - - | 1 - - -' }).warnings.length, 1);
  // A short internal bar is never excused by an explicit pickup.
  assert.equal(scoreFromObject({ ...base, pickupBeats: 1, melody: '5/ 1/ | 3 - | 1 - - -' }).warnings.length, 1);
  assert.equal(scoreFromObject({ ...base, pickupBeats: 1, melody: '5/ 1/ | 3 - - - | 1 -' }).warnings.length, 1);
  assert.deepEqual(scoreFromObject({ ...base, pickupBeats: 1, melody: '5/ 1/ | 3 - - - | 1 - -' }).warnings, []);
  assert.deepEqual(scoreFromObject({ ...base, pickupBeats: 1, melody: '5/ 1/ | [M:3/4] 1 - -' }).warnings, []);
});

test('pickup declarations must match the actual first bar and its effective meter', () => {
  for (const pickupBeats of [-1, 0, 4, 5, '1', null, true, NaN, Infinity, 0.5]) {
    assert.match(scoreFromObject({ ...base, pickupBeats, melody: '5/ 1/ | 1 - - -' }).error ?? '', /pickupBeats/);
  }
  assert.match(scoreFromObject({ ...base, pickupBeats: 1, melody: '1' }).error ?? '', /pickupBeats/);
  assert.match(scoreFromObject({ ...base, pickupBeats: 2, melody: '[M:2/4] 1 - | 1 -' }).error ?? '', /pickupBeats/);
  assert.deepEqual(scoreFromObject({ ...base, timeSignature: '6/8', pickupBeats: 0.5, melody: '5/ | 1 - -' }).warnings, []);
});

test('ties require a following sounding note of the same absolute pitch', () => {
  assert.deepEqual(scoreFromObject({ ...base, melody: '1~ - - - |\n1 - - -' }).warnings, []);
  for (const melody of ['1~ - - -', '1~ - - - | 2 - - -', '0~ - - - | 0 - - -']) {
    assert.match(scoreFromObject({ ...base, melody }).warnings.join(), /延音线/);
  }
});

test('meter changes persist across rows and survive full JSON round trips', () => {
  const result = scoreFromObject({ ...base, timeSignature: '5/4', melody: '5 3 3 2 - |\n[M:4/4] 6, 1/ 6,/ 5, - |\n6,/ 2/ 1/ 6,/ 5, -' });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.score!.lines[1][0].timeSignature, '4/4');
  const imported = importScoreJson(JSON.stringify(result.score));
  assert.deepEqual(imported.score, result.score);
  assert.deepEqual(imported.warnings, []);
  assert.match(scoreFromObject({ ...base, melody: '[M:3/4] 1 - - | 1 - - -' }).warnings.join(), /要求 3 拍/);
});

test('invalid or misplaced measure meters are rejected, not silently ignored', () => {
  for (const melody of ['[M:0/4] 1', '[M:3/3] 1', '1 [M:3/4] 2', '[M:3/4]']) {
    assert.ok(scoreFromObject({ ...base, melody }).error, melody);
  }
  for (const timeSignature of ['0/4', '3/3', 44, null]) {
    assert.match(scoreFromObject({ ...base, lines: [[{ timeSignature, notes: [{ degree: 1, beats: 4 }] }]] }).error ?? '', /timeSignature/);
  }
  // A changed final meter must not hide a missing beat by pairing it with the opening.
  assert.equal(scoreFromObject({ ...base, melody: '1 | [M:3/4] 1 -' }).warnings.length, 2);
});
