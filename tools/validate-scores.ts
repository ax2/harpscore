import fs from 'node:fs';
import path from 'node:path';
import { analyzeScore } from '../src/lib/harmonica';
import { scoreFromObject } from '../src/lib/scoreImport';

const root = path.resolve(import.meta.dirname, '..');
const scoreDir = path.join(root, 'src', 'data', 'scores');
let failed = false;

for (const file of fs.readdirSync(scoreDir).filter((name) => name.endsWith('.json')).sort()) {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(scoreDir, file), 'utf8'));
  const result = scoreFromObject(raw);
  if (!result.score || result.error) {
    failed = true;
    console.error(`FAIL ${file}: ${result.error}`);
    continue;
  }
  const analysis = analyzeScore(result.score, false);
  const measures = result.score.lines.reduce((sum, line) => sum + line.length, 0);
  const sourceIssues: string[] = [];
  if (!result.score.sourceFormat) sourceIssues.push('缺少 sourceFormat');
  if (!result.score.sourceCheckedAt) sourceIssues.push('缺少 sourceCheckedAt');
  if (result.score.sourceFormat !== 'original' && !result.score.sourceUrl) sourceIssues.push('非原创曲目缺少 sourceUrl');
  const unexpectedWarnings = [...result.warnings, ...sourceIssues];
  if (!analysis.playable || unexpectedWarnings.length) failed = true;
  console.log(`${analysis.playable && !unexpectedWarnings.length ? 'PASS' : 'FAIL'} ${file}: ${measures} measures, ${analysis.totalNotes} notes, ${analysis.bendNotes} bends, ${result.warnings.length} beat issues, ${sourceIssues.length} source issues`);
  unexpectedWarnings.forEach((warning) => console.error(`  ${warning}`));
  analysis.issues.filter((issue) => issue.severity === 'error').forEach((issue) => console.error(`  ${issue.reason}`));
}

if (failed) process.exitCode = 1;
