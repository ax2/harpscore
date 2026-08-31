/**
 * 清理内置曲谱里的把位英文：
 * "第二把位 (2nd Position / Cross Harp)" -> "第二把位"
 * 避免信息条溢出，中文界面也不需要重复英文。
 */
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] ?? 'src/data/scores';
let changed = 0;

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const p = path.join(dir, f);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (typeof j.position === 'string') {
    const np = j.position.replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim();
    if (np !== j.position) {
      j.position = np;
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
      console.log(`${f}: "${j.position}"`);
      changed++;
    }
  }
}
console.log(`done, ${changed} file(s) updated`);
