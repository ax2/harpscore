import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';
import { decodeReferenceAbc } from './helpers/abcReference';

const get = (id: string) => BUILTIN_SCORES.find(score => score.id === id)!;
const events = (id: string) => {
  const score = get(id);
  return score.lines.flat().map(bar => bar.notes.map(note => [noteToMidi(score.key, note), noteDuration(note)]));
};

test('Clap Hands joins the source section pickup without adding or dropping an event', () => {
  const raw = fs.readFileSync(new URL('./fixtures/stage7-batch2/007_Well_all_Clap_Hands_Together.abc', import.meta.url), 'utf8');
  const reference = decodeReferenceAbc(raw, 5);
  assert.equal(reference.length, 10);
  assert.deepEqual(events('clap-hands'), [...reference.slice(0, 4), [...reference[4], ...reference[5]], ...reference.slice(6)]);
});

test('Ding Dong Bell retains all ten source bars, repeat boundaries and the low-la bend', () => {
  const raw = fs.readFileSync(new URL('./fixtures/stage7-batch2/032_Ding_Dong_Bell.abc', import.meta.url), 'utf8');
  const reference = decodeReferenceAbc(raw, 7);
  assert.equal(reference.length, 10);
  assert.deepEqual(events('ding-dong-bell'), reference);
  const bars = get('ding-dong-bell').lines.flat();
  assert.equal(bars[0].repeatBegin, true);
  assert.equal(bars[9].repeatEnd, true);
  assert.equal(bars[5].notes[1].hole, 3);
  assert.equal(bars[5].notes[1].breath, 'draw');
  assert.equal(bars[5].notes[1].bend, 2);
});

test('Flowing Stream matches all 23 visually checked source bars and preserves nine fermatas', () => {
  // Music Appreciation, printed p.15 / PDF p.22, example 1-6.
  // Separate absolute-pitch transcription of the enlarged numbered source.
  assert.deepEqual(events('flowing-stream'), [
    [[81,2]], [[81,.5],[84,.5],[86,.5],[88,.5]], [[88,.5],[86,1],[84,.25],[81,.25]],
    [[88,.5],[86,1.5]], [[86,.25],[84,.25],[81,1.5],[81,1]], [[81,.5],[84,.5],[81,.5],[79,.5]],
    [[76,.5],[74,.5],[79,.5],[81,1.5]], [[81,.5],[79,.5],[76,.5],[74,.5]], [[69,2]],
    [[81,.5],[86,.5],[86,.5],[81,.5]], [[88,.5],[86,1],[84,.25],[81,.25]], [[88,.5],[86,1.5]],
    [[86,.25],[84,.25],[81,1.5]], [[86,1.5],[84,.25],[81,.25]], [[88,.5],[86,1],[84,.25],[81,.25]],
    [[88,.5],[86,1.5]], [[84,.5],[81,1.5],[81,1]], [[81,.5],[84,.5],[81,.5],[79,.5]],
    [[76,.5],[74,.5],[79,.5],[81,1.5]], [[81,.5],[79,.5],[76,.5],[74,.5]], [[69,2]],
    [[76,2],[76,.5],[74,.5],[74,1]], [[81,4]],
  ]);
  const score=get('flowing-stream');
  const bars=score.lines.flat();
  assert.equal(bars[0].repeatBegin, true);
  assert.equal(bars[20].repeatEnd, true);
  assert.deepEqual(bars.flatMap((bar,index)=>bar.timeSignature ? [[index+1,bar.timeSignature]] : []),
    [[5,'3/4'],[6,'2/4'],[7,'3/4'],[8,'2/4'],[17,'3/4'],[18,'2/4'],[19,'3/4'],[20,'2/4'],[22,'4/4']]);
  assert.deepEqual(bars.flatMap((bar,i)=>bar.notes.flatMap((note,j)=>note.fermata?[[i+1,j+1]]:[])),
    [[1,1],[4,2],[5,4],[9,1],[12,2],[13,3],[16,2],[17,3],[21,1]]);
  assert.deepEqual(bars.flatMap((bar,i)=>bar.notes.flatMap((note,j)=>note.tie?[[i+1,j+1]]:[])), [[5,3],[17,2]]);
  assert.equal(score.position,'第四把位');
});

test('Polish Waltz takes only the upper melody of the two-part section and all three long ties', () => {
  // PEP grade 7 lower, printed p.48 / PDF p.53: first 16 unison bars,
  // then the upper staff of each paired system (bars 17-24 and 25-32).
  assert.deepEqual(events('polish-waltz'), [
    [[79,2],[84,1]],[[88,2],[86,1]],[[84,2],[83,1]],[[84,2],[81,1]],
    [[79,2],[79,1]],[[76,2],[77,1]],[[79,3]],[[79,3]],
    [[77,2],[81,1]],[[74,2],[76,1]],[[77,3]],[[77,3]],
    [[79,2],[79,1]],[[88,2],[86,1]],[[84,3]],[[84,3]],
    [[88,1],[88,.5],[86,.5],[84,1]],[[88,1],[88,.5],[86,.5],[84,1]],
    [[88,1],[89,1.5],[88,.5]],[[86,3]],
    [[86,1],[86,.5],[84,.5],[83,1]],[[86,1],[86,.5],[84,.5],[83,1]],
    [[86,1],[88,1.5],[86,.5]],[[84,3]],
    [[88,1],[88,.5],[86,.5],[84,1]],[[88,1],[88,.5],[86,.5],[84,1]],
    [[88,1],[89,1.5],[88,.5]],[[86,3]],
    [[89,1],[88,1],[86,1]],[[84,1],[83,1],[81,1]],[[79,1],[81,1],[83,1]],[[84,3]],
  ]);
  const bars=get('polish-waltz').lines.flat();
  assert.deepEqual(bars.flatMap((bar,i)=>bar.notes.some(note=>note.tie)?[i+1]:[]),[7,11,15]);
  assert.ok(bars.every(bar=>bar.notes.every(note=>!note.bend && !note.overblow)));
});
