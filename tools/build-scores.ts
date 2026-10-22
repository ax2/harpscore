import fs from 'node:fs';
import path from 'node:path';
import { analyzeScore } from '../src/lib/harmonica';
import { scoreFromObject } from '../src/lib/scoreImport';

const root = path.resolve(import.meta.dirname, '..');
const inputDir = path.join(root, 'tools', 'import');
const outputDir = path.join(root, 'src', 'data', 'scores');

const scores = fs.readdirSync(inputDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
    const result = scoreFromObject(raw);
    if (!result.score || result.error) throw new Error(`${file}: ${result.error ?? '无法生成曲谱'}`);
    const score = result.score;
    if (result.warnings.length) throw new Error(`${file}: ${result.warnings.join('；')}`);
    if (!score.sourceFormat || !score.sourceCheckedAt || (score.sourceFormat !== 'original' && !score.sourceUrl)) {
      throw new Error(`${file}: 内置曲谱必须记录来源格式、核对日期和非原创来源链接`);
    }
    score.builtin = true;
    const analysis = analyzeScore(score, false);
    if (!analysis.playable) {
      throw new Error(`${file}: ${analysis.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.reason).join('；')}`);
    }
    return { file, score };
  })
  .sort((a, b) => (a.score.order ?? 9999) - (b.score.order ?? 9999) || a.file.localeCompare(b.file));

if (new Set(scores.map(({ score }) => score.id)).size !== scores.length) {
  throw new Error('内置曲谱 ID 重复；未写入任何生成文件');
}

fs.mkdirSync(outputDir, { recursive: true });
for (const { file, score } of scores) {
  fs.writeFileSync(path.join(outputDir, file), `${JSON.stringify(score, null, 2)}\n`, 'utf8');
}

const imports = scores.map(({ file }, index) => {
  const variable = `score_${index + 1}`;
  return { variable, line: `import ${variable} from './scores/${file}';` };
});
const builtinSource = `// 由 npm run scores:build 自动生成，请勿手工编辑\nimport type { Score } from '../types/score';\n${imports.map((item) => item.line).join('\n')}\n\nexport const BUILTIN_SCORES: Score[] = [\n${imports.map((item) => `  ${item.variable} as unknown as Score,`).join('\n')}\n];\n`;
fs.writeFileSync(path.join(root, 'src', 'data', 'builtin.ts'), builtinSource, 'utf8');
console.log(`Generated ${scores.length} built-in scores.`);
