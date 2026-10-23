import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';
import { analyzeScore } from '../src/lib/harmonica';

const get = (id: string) => BUILTIN_SCORES.find(score => score.id === id)!;
test('Su Wu matches all 29 HKCO p.33 bars, articulations, grace notes and the final fermata/tie', () => {
  const score = get('su-wu-herding-sheep');
  const bars = score.lines.flat();
  // Absolute pitches and durations read separately from the enlarged source.
  assert.deepEqual(bars.map(bar => bar.notes.map(note => [noteToMidi(score.key,note),noteDuration(note)])),[
    [[79,2],[72,2]],[[74,1],[79,1],[77,1],[74,1]],[[72,4]],[[84,1],[86,1],[84,1],[81,1]],
    [[79,4]],[[77,1],[74,1],[77,1],[81,1]],[[79,4]],[[84,1],[81,1],[79,2]],
    [[77,1],[81,1],[79,2]],[[74,1],[79,1],[77,1],[74,1]],[[72,4]],[[74,1],[74,1],[74,1],[81,1]],
    [[79,3],[77,1]],[[74,1],[72,1],[69,1],[67,.5],[69,.5]],[[72,4]],[[79,1],[79,1],[81,1],[84,1]],
    [[76,4]],[[79,1],[76,1],[74,.5],[76,.5],[79,1]],[[72,4]],[[72,1.5],[74,.5],[77,1],[77,1]],
    [[74,1],[77,1],[74,1],[72,1]],[[69,1],[72,1],[74,1],[77,1]],[[72,4]],[[72,1.5],[74,.5],[77,1],[77,1]],
    [[74,1],[77,1],[74,1],[72,1]],[[81,4]],[[79,2],[81,2]],[[84,4]],[[84,4]],
  ]);
  const positions = (kind: 'accent'|'tenuto') => bars.flatMap((bar,i) => bar.notes.flatMap((note,j) => note.articulation===kind ? [[i+1,j+1]] : []));
  assert.deepEqual(positions('accent'),[[1,1],[1,2],[3,1],[8,1],[8,2],[8,3],[9,1],[9,2],[9,3],[11,1],[23,1],[26,1],[27,1],[27,2],[28,1]]);
  assert.deepEqual(positions('tenuto'),[[4,1],[4,2],[4,3],[4,4],[5,1],[6,1],[6,2],[6,3],[6,4],[7,1],[12,1],[12,2],[12,3],[12,4],[13,1],[13,2],[15,1],[20,1],[20,2],[20,3],[20,4],[21,1],[21,2],[21,3],[21,4],[22,1],[22,2],[22,3],[22,4]]);
  assert.deepEqual(bars.flatMap((bar,i) => bar.notes.flatMap(note => note.graceNotes ? [[i+1,...note.graceNotes.map(g => [noteToMidi(score.key,{...g,beats:g.beats}),g.beats])]] : [])),[[3,[74,.5]],[11,[74,.5]],[23,[74,.5]]]);
  assert.deepEqual(bars.flatMap((bar,i) => bar.notes.some(n=>n.tie) ? [i+1] : []),[28]);
  assert.deepEqual(bars.flatMap((bar,i) => bar.notes.some(n=>n.fermata) ? [i+1] : []),[28]);
  assert.equal(bars.flatMap(bar=>bar.notes).length,77);
  const analysis=analyzeScore(score);
  assert.equal(analysis.playable,true);
  assert.equal(analysis.bendNotes,3);
  assert.equal(analysis.minMidi,67);
  assert.equal(analysis.maxMidi,86);
});

test('Little Bee matches the eight HKCO p.26 bars and keeps both rests', () => {
  const score=get('little-bee');
  const bars=score.lines.flat();
  assert.deepEqual(bars.map(bar=>bar.notes.map(note=>[noteToMidi(score.key,note),noteDuration(note)])),[
    [[79,.5],[76,.5],[76,1],[77,.5],[74,.5],[74,1]],
    [[72,.5],[74,.5],[76,.5],[77,.5],[79,.5],[79,.5],[79,1]],
    [[79,.5],[76,.5],[76,1],[77,.5],[74,.5],[74,1]],
    [[72,.5],[76,.5],[79,.5],[79,.5],[76,1],[null,1]],
    [[74,.5],[74,.5],[74,.5],[74,.5],[74,.5],[76,.5],[77,1]],
    [[76,.5],[76,.5],[76,.5],[76,.5],[76,.5],[77,.5],[79,1]],
    [[79,.5],[76,.5],[76,1],[77,.5],[74,.5],[74,1]],
    [[72,.5],[76,.5],[79,.5],[79,.5],[72,1],[null,1]],
  ]);
  assert.equal(bars.flatMap(bar=>bar.notes).length,51);
  const analysis=analyzeScore(score);
  assert.equal(analysis.playable,true);
  assert.equal(analysis.bendNotes,0);
  assert.equal(analysis.minMidi,72);
  assert.equal(analysis.maxMidi,79);
});
