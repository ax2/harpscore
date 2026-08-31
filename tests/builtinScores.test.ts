import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';

test('ships fourteen unique built-in scores with traceable sources', () => {
  assert.equal(BUILTIN_SCORES.length, 14);
  const ids = BUILTIN_SCORES.map((score) => score.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const score of BUILTIN_SCORES) {
    assert.ok(score.sourceFormat, `${score.id} 缺少 sourceFormat`);
    assert.ok(score.sourceCheckedAt, `${score.id} 缺少 sourceCheckedAt`);
    if (score.sourceFormat !== 'original') {
      assert.match(score.sourceUrl ?? '', /^https?:\/\//, `${score.id} 缺少 HTTP(S) 来源`);
    }
  }
});
