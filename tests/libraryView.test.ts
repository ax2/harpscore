import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FILTERS, filterScores } from '../src/lib/libraryView';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { analyzeScore } from '../src/lib/harmonica';
import { scoreFromObject } from '../src/lib/scoreImport';

test('natural-note filter excludes bends and unplayable notes, regardless of difficulty label', () => {
  const scores = BUILTIN_SCORES.map((score) => structuredClone(score));
  const impossible = scoreFromObject({ title: 'outside range', key: 'C', timeSignature: '4/4', melody: '1,, - - -' }).score!;
  scores.push(impossible);
  scores.forEach((score) => analyzeScore(score, false));
  const natural = filterScores(scores, { ...DEFAULT_FILTERS, technique: 'natural' }, []);
  assert.ok(natural.some((s) => s.id === 'twinkle'));
  assert.ok(!natural.some((s) => s.id === 'arirang' || s.id === impossible.id));
  const bends = filterScores(scores, { ...DEFAULT_FILTERS, technique: 'bends' }, []);
  assert.ok(bends.some((s) => s.id === 'arirang'));
  assert.ok(!bends.some((s) => s.id === 'twinkle'));
});

test('query words, tag, difficulty and favorites combine without changing library order', () => {
  const idsBefore = BUILTIN_SCORES.map((s) => s.id);
  assert.deepEqual(filterScores(BUILTIN_SCORES, {
    ...DEFAULT_FILTERS, query: '  London   1927 ', tag: '西方童谣', maxDifficulty: 1, favoritesOnly: true,
  }, ['london-bridge']).map((s) => s.id), ['london-bridge']);
  assert.equal(filterScores(BUILTIN_SCORES, { ...DEFAULT_FILTERS, tag: '中国民歌', maxDifficulty: 1 }, []).length, 0);
  const sorted = filterScores(BUILTIN_SCORES, { ...DEFAULT_FILTERS, sort: 'difficulty' }, []);
  assert.ok(sorted.every((s, index) => index === 0 || sorted[index - 1].difficulty <= s.difficulty));
  assert.deepEqual(BUILTIN_SCORES.map((s) => s.id), idsBefore);
});
