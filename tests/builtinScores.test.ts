import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import fs from 'node:fs';
import path from 'node:path';
import { scoreFromObject } from '../src/lib/scoreImport';
import { analyzeScore } from '../src/lib/harmonica';

test('ships unique built-in scores with traceable sources', () => {
  assert.ok(BUILTIN_SCORES.filter(score => score.sourceFormat !== 'original').length >= 40);
  assert.ok(BUILTIN_SCORES.filter(score => score.sourceFormat === 'original').length >= 4);
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

test('every built-in score matches its source DSL and passes rhythm, ties and playability', () => {
  const inputDir = path.resolve(import.meta.dirname, '../tools/import');
  const files = fs.readdirSync(inputDir).filter((name) => name.endsWith('.json'));
  assert.equal(files.length, BUILTIN_SCORES.length);
  for (const file of files) {
    const result = scoreFromObject(JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8')));
    assert.equal(result.error, undefined, file);
    assert.deepEqual(result.warnings, [], file);
    const score = result.score!;
    score.builtin = true;
    assert.equal(analyzeScore(score).playable, true, file);
    assert.deepEqual(score, BUILTIN_SCORES.find((built) => built.id === score.id), `${file} must be rebuilt`);
  }
});
