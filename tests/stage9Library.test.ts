import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';
import { analyzeScore } from '../src/lib/harmonica';
import { decodeMarkedReferenceAbc } from './helpers/abcReference';

const get = (id: string) => BUILTIN_SCORES.find(score => score.id === id)!;
test('Kangding retains every pitch and subdivision from HKCO p.29, with exactly six ties', () => {
  const score = get('kangding-love-song');
  const bars = score.lines.flat();
  // Independently read from the enlarged original numbered score, in C5.
  // Curves between different pitches are slurs, not same-pitch ties.
  assert.deepEqual(bars.map(bar => bar.notes.map(note => [noteToMidi(score.key, note), noteDuration(note)])), [
    [[76,.5],[79,.5],[81,.5],[81,.25],[79,.25],[81,.5],[76,.5],[74,1]],
    [[76,.5],[79,.5],[81,.5],[81,.25],[79,.25],[81,.5],[76,.5],[76,1]],
    [[76,.5],[79,.5],[81,.5],[81,.25],[79,.25],[81,.5],[76,.5],[74,1]],
    [[79,.5],[76,.5],[74,.25],[76,.25],[74,.25],[72,.25],[74,.5],[69,.5],[69,1]],
    [[69,.5],[74,.5],[74,1],[79,.5],[76,.5],[76,1]],
    [[74,.25],[72,.25],[69,.5],[69,1],[79,.5],[76,.5],[74,.25],[76,.25],[74,.25],[72,.25]],
    [[74,.5],[69,.5],[69,1],[79,.5],[79,.25],[76,.25],[74,.25],[76,.25],[74,.25],[72,.25]],
    [[74,.5],[81,1],[79,.5],[81,2]],
  ]);
  assert.deepEqual(bars.flatMap((bar,i) => bar.notes.flatMap((note,j) => note.tie ? [[i+1,j+1]] : [])),
    [[2,7],[4,8],[5,2],[5,5],[6,3],[7,2]]);
  assert.equal(bars.flatMap(bar => bar.notes).length, 63);
  assert.ok(bars.every(bar => bar.notes.reduce((sum,note) => sum+noteDuration(note),0) === 4));
  assert.ok(bars.every(bar => bar.notes.every(note => !note.fermata)));
  const low = bars.flatMap(bar => bar.notes).filter(note => noteToMidi(score.key,note) === 69);
  assert.equal(low.length, 7);
  assert.ok(low.every(note => note.hole === 3 && note.breath === 'draw' && note.bend === 2));
  const analysis = analyzeScore(score);
  assert.equal(analysis.playable, true);
  assert.equal(analysis.minMidi, 69);
  assert.equal(analysis.maxMidi, 81);
  assert.equal(score.position, '第四把位');
});

test('Learn to Sing preserves all fifteen ABC bars and three rests after F-to-C transposition', () => {
  const raw = fs.readFileSync(new URL('./fixtures/stage9/025_Come_Let_Us_Learn_to_Sing.abc', import.meta.url), 'utf8');
  const score = get('learn-to-sing');
  const bars = score.lines.flat();
  assert.deepEqual(bars.map(bar => bar.notes.map(note => [noteToMidi(score.key,note),noteDuration(note),!!note.tie,!!note.fermata])),
    decodeMarkedReferenceAbc(raw,7));
  assert.equal(bars.length,15);
  assert.equal(bars.flatMap(bar => bar.notes).length,53);
  assert.deepEqual(bars.flatMap((bar,i) => bar.notes.flatMap((note,j) => !note.degree ? [[i+1,j+1]] : [])),[[4,2],[8,2],[15,2]]);
  const analysis = analyzeScore(score);
  assert.equal(analysis.playable,true);
  assert.equal(analysis.bendNotes,0);
  assert.equal(analysis.minMidi,72);
  assert.equal(analysis.maxMidi,84);
});
