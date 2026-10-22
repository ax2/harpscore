import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteToMidi } from '../src/types/score';
import { noteDuration } from '../src/lib/notation';
import { analyzeScore } from '../src/lib/harmonica';

function bars(id: string) {
  const score = BUILTIN_SCORES.find((s) => s.id === id)!;
  assert.ok(score, id);
  return score.lines.flat().map((m) => m.notes.map((n) => [noteToMidi(score.key, n), noteDuration(n)]));
}

test('Amazing Grace follows the source soprano register, line-split bar and real pickup', () => {
  const source = bars('amazing-grace');
  assert.equal(source.length, 15);
  assert.deepEqual(source[0], [[67, 1]]);
  assert.deepEqual(source[1], [[72, 2], [76, 0.5], [72, 0.5]]);
  assert.deepEqual(source[7], [[79, 2], [74, 0.5], [76, 0.5]]);
  assert.deepEqual(source[8], [[79, 2], [76, 0.5], [72, 0.5]]);
  assert.deepEqual(source[14], [[72, 2]]);
  assert.equal(BUILTIN_SCORES.find(s => s.id === 'amazing-grace')!.pickupBeats, 1);
});

test('Ode to Joy retains the low dominant, cross-bar tie and second-section repeat', () => {
  const score = BUILTIN_SCORES.find(s => s.id === 'ode-to-joy')!;
  const measures = score.lines.flat();
  assert.equal(measures.length, 16);
  assert.deepEqual(bars(score.id)[11], [[72, 1], [74, 1], [67, 1], [76, 1]]);
  assert.equal(measures[11].notes[3].tie, true);
  assert.equal(measures[8].repeatBegin, true);
  assert.equal(measures[15].repeatEnd, true);
});

test('Happy Birthday expands both textbook endings without artificial opening rests', () => {
  const source = bars('happy-birthday');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[79, 0.5], [79, 0.5]]);
  assert.deepEqual(source[8], [[84, 2], [79, 0.5], [79, 0.5]]);
  assert.deepEqual(source.slice(1, 8), source.slice(9, 16));
  assert.deepEqual(source[16], [[84, 3]]);
});

test('Auld Lang Syne keeps its real pickup and the source full final bar', () => {
  const score = BUILTIN_SCORES.find(s => s.id === 'auld-lang-syne')!;
  const source = bars(score.id);
  assert.equal(source.length, 17);
  assert.equal(score.pickupBeats, 1);
  assert.deepEqual(source[0], [[67, 1]]);
  assert.deepEqual(source[16], [[72, 3], [null, 1]]);
});

test('Silent Night retains the 1927 six-eight rhythm, rests and low final tonic', () => {
  const score = BUILTIN_SCORES.find(s => s.id === 'silent-night')!;
  const source = bars(score.id);
  assert.equal(score.timeSignature, '6/8');
  assert.equal(source.length, 12);
  assert.deepEqual(source[2], [[86, 1], [86, 0.375], [83, 0.125], [83, 1.5]]);
  assert.deepEqual(source[11], [[72, 1.5], [72, 1], [null, 0.5]]);
  assert.equal(score.lines.flat()[11].notes[0].tie, true);
  assert.equal(source.flat().filter(n => n[0] === null).length, 4);
});

test('Mary retains the source pickup, dotted pairs, high-sol tie and ending rests', () => {
  const source = bars('mary-little-lamb');
  assert.equal(source.length, 9);
  assert.deepEqual(source[0], [[76, 0.5]]);
  assert.deepEqual(source[1], [[76, 1.5], [74, 0.5], [72, 1], [74, 1]]);
  assert.deepEqual(source[4], [[76, 1], [79, 1], [79, 1.5], [79, 0.5]]);
  assert.equal(BUILTIN_SCORES.find(s => s.id === 'mary-little-lamb')!.lines.flat()[4].notes[2].tie, true);
  assert.deepEqual(source[8], [[72, 2], [null, 1], [null, 0.5]]);
});

test('Frere Jacques uses the source two-beat opening and complementary ending', () => {
  const source = bars('frere-jacques');
  assert.equal(source.length, 9);
  assert.deepEqual(source[0], [[72, 1], [74, 1]]);
  assert.deepEqual(source[6], [[76, 1], [72, 1], [72, 1], [67, 1]]);
  assert.deepEqual(source[8], [[72, 2]]);
});

test('Sally Gardens uses the complete Rose X2 melody with its real pickup and repeat', () => {
  const score = BUILTIN_SCORES.find(s => s.id === 'sally-gardens')!;
  const source = bars(score.id);
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[72, 0.5], [74, 0.5]]);
  assert.deepEqual(source[9], [[84, 1], [83, 0.5], [79, 0.5], [81, 1], [84, 1]]);
  assert.deepEqual(source[16], [[72, 3]]);
  assert.equal(score.lines.flat()[16].repeatEnd, true);
});

test('legacy original exercises retain the declared bar counts and exact bend targets', () => {
  const bend = BUILTIN_SCORES.find(s => s.id === 'bend-etude')!;
  const blues = BUILTIN_SCORES.find(s => s.id === 'blues-12bar')!;
  assert.equal(bend.lines.flat().length, 15);
  assert.equal(blues.lines.flat().length, 12);
  for (const [score, targets] of [[bend, [[4, 0, 2, 2], [6, 0, 3, 2]]], [blues, [[2, 0, 3, 2], [3, -1, 3, 1], [5, -1, 4, 1]]]] as const) {
    const notes = structuredClone(score);
    analyzeScore(notes);
    for (const [degree, accidental, hole, depth] of targets) {
      const matches = notes.lines.flat().flatMap(m => m.notes).filter(n => n.degree === degree && (n.accidental ?? 0) === accidental);
      assert.ok(matches.length);
      for (const n of matches) {
        assert.equal(n.hole, hole);
        assert.equal(n.breath, 'draw');
        assert.equal(n.bend, depth);
      }
    }
  }
});

test('Zhi-mode folk tunes use their G tonic on a C harp, not the jianpu reference pitch', () => {
  // Music Appreciation p.5 (Zou Jiang Zhou); Basic Music Theory p.85 ex.7-3(d) (Xiao Bai Cai).
  for (const id of ['xiao-bai-cai', 'zou-jiang-zhou']) {
    const score = BUILTIN_SCORES.find(s => s.id === id)!;
    assert.equal(score.key, 'C');
    assert.equal(score.harmonicaKey, 'C');
    assert.equal(score.position, '第二把位');
    assert.match(score.notes ?? '', /主音 G/);
  }
});

test('Jasmine Flower keeps all seven rows of the selected simple Jiangsu version', () => {
  const source = bars('jasmine-flower');
  assert.equal(source.length, 28);
  assert.deepEqual(source[0], [[76, 1], [76, 0.5], [79, 0.5]]);
  assert.deepEqual(source[1], [[81, 0.5], [84, 0.5], [84, 0.5], [81, 0.5]]);
  assert.deepEqual(source[21], [[74, 0.5], [76, 0.5], [72, 0.5], [69, 0.5]]);
  assert.deepEqual(source[23], [[69, 1], [72, 1]]);
  assert.deepEqual(source[27], [[67, 1], [null, 1]]);
});

test('What Boat preserves the 3/8 low-register answer and dotted whole-bar endings', () => {
  const source = bars('what-boat');
  assert.equal(source.length, 12);
  assert.deepEqual(source[3], [[71, 0.5], [69, 0.5], [67, 0.5]]);
  assert.deepEqual(source[4], [[72, 1], [67, 0.5]]);
  for (const index of [7, 11]) assert.deepEqual(source[index], [[67, 1.5]]);
  assert.deepEqual(source[5], source[9]);
});

test('Home on the Range preserves full verse and chorus, ties and complementary pickup', () => {
  const source = bars('home-on-the-range');
  assert.equal(source.length, 33);
  assert.deepEqual(source[0], [[67, 0.5], [67, 0.5]]);
  assert.deepEqual(source[18], [[77, 1], [76, 1.5], [74, 0.5]]);
  assert.deepEqual(source[32], [[72, 2]]);
  const measures = BUILTIN_SCORES.find((s) => s.id === 'home-on-the-range')!.lines.flat();
  assert.deepEqual(measures.flatMap((m, i) => m.notes.some((n) => n.tie) ? [i] : []), [7, 15, 19, 23, 31]);
});

test('Red River Valley retains its full final bar and low chromatic descent', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'red-river-valley')!;
  const source = bars(score.id);
  assert.equal(source.length, 9);
  assert.equal(score.pickupBeats, 1);
  assert.deepEqual(source[6].slice(-2), [[69, 0.5], [68, 0.5]]);
  assert.deepEqual(source[8], [[72, 2], [72, 1], [null, 1]]);
  for (const [m, n] of [[2, 1], [6, 1], [8, 0]]) assert.equal(score.lines.flat()[m].notes[n].tie, true);
});

test('Hong Yan retains the repeat, coda, source-shaped grace groups, ties and fermata', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'hong-yan')!;
  const source = bars(score.id);
  assert.equal(source.length, 16);
  assert.deepEqual(source[1], [[79, 1], [81, 0.75], [84, 0.25], [81, 2]]);
  assert.deepEqual(source[3], [[76, 0.5], [74, 0.5], [74, 3]]);
  const measures = score.lines.flat();
  assert.equal(measures[7].repeatEnd, true);
  assert.equal(measures[2].notes.at(-1)!.tie, true);
  assert.equal(measures[3].notes[1].tie, true);
  for (const m of [6, 10, 14]) assert.deepEqual(measures[m].notes.at(-1)!.graceNotes?.map((n) => [noteToMidi('C', n), n.beats]), [[69, 0.5]]);
  for (const m of [7, 11, 15]) assert.deepEqual(measures[m].notes[0].graceNotes?.map((n) => [noteToMidi('C', n), n.beats]), [[72, 0.25], [74, 0.25], [72, 0.25]]);
  assert.deepEqual(measures.flatMap((m, i) => m.notes.some((n) => n.fermata) ? [i] : []), [14]);
  assert.deepEqual(source[15], [[69, 4]]);
});

test('Mulberry Bush keeps the ABC sixteenths, low descent and closing rests', () => {
  const source = bars('mulberry-bush');
  assert.equal(source.length, 8);
  assert.deepEqual(source[1], [[79, 1], [76, 0.25], [76, 0.25], [72, 1], [76, 0.5]]);
  assert.deepEqual(source[3], [[71, 1], [69, 0.25], [69, 0.25], [67, 1], [null, 0.5]]);
  assert.deepEqual(source[7], [[72, 1.5], [72, 1], [null, 0.5]]);
});

test('Lassie preserves the source pickup, middle rest and complementary ending', () => {
  const source = bars('did-you-ever-see-a-lassie');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[72, 0.5], [76, 0.5]]);
  assert.deepEqual(source[1], [[79, 1.5], [81, 0.5], [79, 0.5], [77, 0.5]]);
  assert.deepEqual(source[8], [[72, 1], [null, 1], [72, 1]]);
  assert.deepEqual(source[16], [[72, 2]]);
});

test('traditional Golden Slumbers preserves low opening, three-beat notes and repeat', () => {
  const source = bars('golden-slumbers');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[67, 1], [64, 1], [65, 1]]);
  assert.deepEqual(source[3], [[69, 3]]);
  assert.deepEqual(source[8], [[74, 1], [76, 1], [77, 1]]);
  assert.deepEqual(source[15], [[72, 3]]);
  const measures = BUILTIN_SCORES.find((s) => s.id === 'golden-slumbers')!.lines.flat();
  assert.equal(measures[0].repeatBegin, true);
  assert.equal(measures[7].repeatEnd, true);
});

test('Spotted Dove keeps the complete nine-bar vocal melody and sixteenth-note calls', () => {
  const source = bars('spotted-dove-song');
  assert.equal(source.length, 9);
  assert.deepEqual(source[0], [[84, 0.5], [84, 0.25], [81, 0.25], [79, 0.25], [81, 0.25], [86, 0.25], [84, 0.25]]);
  assert.deepEqual(source[5], [[88, 0.5], [88, 0.5], [86, 1]]);
  assert.deepEqual(source[7], [[76, 0.75], [74, 0.25], [76, 0.25], [74, 0.25], [76, 0.25], [81, 0.25]]);
  assert.deepEqual(source[8], [[79, 2]]);
});

test('Flying Kites expands both endings while retaining the different response octaves', () => {
  const source = bars('flying-kites');
  assert.equal(source.length, 24);
  assert.deepEqual(source.slice(0, 11), source.slice(12, 23));
  assert.deepEqual(source[0], [[86, 1], [88, 1], [86, 0.5], [86, 0.25], [88, 0.25], [86, 0.5], [84, 0.5]]);
  assert.deepEqual(source[9].slice(0, 4), [[84, 0.5], [86, 0.5], [89, 0.5], [88, 0.5]]);
  assert.deepEqual(source[11], [[86, 1], [81, 0.5], [81, 0.5], [74, 1], [null, 1]]);
  assert.deepEqual(source[23], [[86, 1], [81, 0.5], [81, 0.5], [86, 1], [null, 1]]);
});

test('Cuckoo retains all twelve bars and four phrase rests from the 1927 ABC', () => {
  const source = bars('cuckoo-song');
  assert.equal(source.length, 12);
  assert.deepEqual(source[0], [[79, 1], [76, 1], [null, 1]]);
  assert.deepEqual(source[5], [[77, 2], [74, 1]]);
  for (const index of [0, 1, 3, 11]) assert.deepEqual(source[index].at(-1), [null, 1]);
});

test('Rock-a-bye Baby retains dotted short notes, low register and distinct second endings', () => {
  const source = bars('rock-a-bye-baby');
  assert.equal(source.length, 8);
  assert.deepEqual(source[0], [[64, 0.75], [67, 0.25], [76, 0.5], [74, 1], [72, 0.5]]);
  assert.deepEqual(source[1].at(-1), [71, 1.5]);
  assert.deepEqual(source[5].slice(-2), [[71, 1], [69, 0.5]]);
  assert.deepEqual(source[7].at(-1), [null, 0.5]);
});

test('Pan Hong Jun retains the low la, high do, and four-quarter-beat tied ending', () => {
  const source = bars('pan-hong-jun');
  assert.equal(source.length, 12);
  assert.deepEqual(source[1], [[76, 0.75], [79, 0.25], [76, 0.5], [69, 0.5]]);
  assert.deepEqual(source[4], [[76, 0.25], [79, 0.25], [81, 1], [84, 0.5]]);
  assert.deepEqual(source[9], [[69, 0.5], [72, 1], [69, 0.25], [72, 0.25]]);
  assert.deepEqual(source.slice(-2), [[[69, 2]], [[69, 2]]]);
  assert.equal(BUILTIN_SCORES.find((s) => s.id === 'pan-hong-jun')!.lines.flat()[10].notes[0].tie, true);
});

test('Meng Jiang Nv keeps five thirty-seconds, four eighth-shaped graces and source ties', () => {
  const source = bars('meng-jiang-nv');
  assert.equal(source.length, 8);
  assert.deepEqual(source[0], [[72, 0.5], [72, 1], [74, 0.5], [76, 0.375], [79, 0.125], [76, 0.25], [74, 0.25], [76, 1]]);
  assert.deepEqual(source[3].slice(-5), [[69, 0.25], [67, 0.25], [72, 0.25], [69, 0.25], [67, 2]]);
  assert.deepEqual(source[4].slice(0, 5), [[67, 0.25], [64, 0.25], [67, 0.25], [69, 0.25], [72, 1]]);
  assert.deepEqual(source[3], source[7]);
  const measures = BUILTIN_SCORES.find((s) => s.id === 'meng-jiang-nv')!.lines.flat();
  const notes = measures.flatMap((m) => m.notes);
  assert.equal(notes.filter((n) => n.beats === 0.125).length, 5);
  assert.deepEqual(notes.flatMap((n) => n.graceNotes ?? []).map((n) => [n.degree, n.octave, n.beats]), [[2, 1, 0.5], [3, 1, 0.5], [6, 0, 0.5], [6, 0, 0.5]]);
  for (const [m, n] of [[1, 1], [1, 3], [2, 1], [2, 3]]) assert.equal(measures[m].notes[n].tie, true);
});

test('Spring Excursion keeps the full upper melody, different cadences and chromatic bridge', () => {
  const source = bars('spring-excursion');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[67, 1], [67, 0.5], [72, 1], [67, 0.5]]);
  assert.deepEqual(source[3], [[65, 1], [62, 0.5], [64, 1.5]]);
  for (const index of [7, 15]) assert.deepEqual(source[index], [[65, 1], [62, 0.5], [60, 1.5]]);
  assert.deepEqual(source[10], [[67, 1], [67, 0.5], [71, 1], [69, 0.5]]);
  assert.deepEqual(source[11], [[67, 1], [66, 0.5], [67, 1.5]]);
  assert.deepEqual(source.slice(4, 8), source.slice(12, 16));
});

test('Wuxi Jing retains its 16-bar edition, upper mordent and two pre-graces', () => {
  const source = bars('wuxi-jing');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[81, 0.5], [81, 0.25], [79, 0.25], [81, 0.5], [86, 0.5]]);
  assert.deepEqual(source[4], [[84, 0.5], [84, 1], [86, 0.5]]);
  assert.deepEqual(source[5], [[88, 0.75], [86, 0.25], [88, 0.75], [86, 0.25]]);
  assert.deepEqual(source[14], [[76, 0.5], [79, 0.25], [79, 0.25], [79, 0.25], [81, 0.25], [74, 0.5]]);
  assert.deepEqual(source[15], [[76, 0.25], [79, 0.25], [76, 0.25], [74, 0.25], [72, 1]]);
  const score = BUILTIN_SCORES.find((s) => s.id === 'wuxi-jing')!;
  const measures = score.lines.flat();
  assert.equal(measures[0].notes[4].ornament?.kind, 'upper-mordent');
  assert.equal(noteToMidi(score.key, measures[0].notes[4].ornament!.auxiliary), 88);
  assert.equal(noteToMidi(score.key, measures[3].notes[0].graceNotes![0]), 81);
  assert.equal(noteToMidi(score.key, measures[7].notes[0].graceNotes![0]), 84);
  assert.equal(analyzeScore(score).bendNotes, 0);
});

test('the original call-response study stays on natural reeds and retains breathing rests', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'cross-harp-call-response')!;
  const analysis = analyzeScore(score);
  assert.equal(analysis.playable, true);
  assert.equal(analysis.bendNotes, 0);
  assert.equal(analysis.overblowNotes, 0);
  assert.equal(score.lines.flat().length, 16);
  for (const index of [3, 7, 11, 15]) assert.equal(score.lines.flat()[index].notes.at(-1)?.degree, 0);
});

test('the original low blues scale study uses the intended scale and two specific bends', () => {
  const score = BUILTIN_SCORES.find((s) => s.id === 'low-blues-scale-study')!;
  const analysis = analyzeScore(score);
  const notes = score.lines.flat().flatMap((m) => m.notes).filter((n) => n.degree);
  assert.equal(analysis.playable, true);
  assert.equal(analysis.overblowNotes, 0);
  assert.equal(score.lines.flat().length, 8);
  assert.deepEqual([...new Set(notes.map((n) => noteToMidi(score.key, n)))].sort((a, b) => a! - b!), [67, 70, 72, 73, 74, 77, 79]);
  for (const note of notes.filter((n) => n.bend)) {
    assert.equal(note.breath, 'draw');
    assert.equal(note.bend, 1);
    assert.equal(note.hole, noteToMidi(score.key, note) === 70 ? 3 : 4);
  }
});

test('Longing for Spring preserves the PEP chromatic bridge, grace note and complementary pickup', () => {
  const source = bars('longing-for-spring');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[60, 0.5]]);
  assert.deepEqual(source[9], [[65, 1], [61, 0.5], [62, 0.5], [64, 0.5], [65, 0.5]]);
  assert.deepEqual(source[11], [[72, 0.5], [71, 0.5], [69, 0.5], [69, 0.5], [67, 0.5], [66, 0.5]]);
  assert.deepEqual(source[15], [[67, 0.5], [64, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5]]);
  assert.deepEqual(source[16], [[60, 1], [null, 0.5], [null, 1]]);
  const score = BUILTIN_SCORES.find((s) => s.id === 'longing-for-spring')!;
  const measures = score.lines.flat();
  assert.deepEqual(measures[15].notes[3].graceNotes?.map((n) => [noteToMidi(score.key, n), n.beats]), [[67, 0.25]]);
  assert.equal(measures[2].notes[0].tie, true);
  assert.equal(measures[6].notes[0].tie, true);
});

test('Arirang preserves textbook p.53 dotted opening, register and distinct endings', () => {
  const source = bars('arirang');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[67, 1.5], [69, 0.5], [67, 0.5], [69, 0.5]]);
  assert.deepEqual(source[2], [[76, 1], [74, 0.5], [76, 0.5], [72, 0.5], [69, 0.5]]);
  assert.deepEqual(source[7], [[72, 3]]);
  assert.deepEqual(source[11], [[67, 1.5], [69, 0.5], [67, 0.5], [null, 0.5]]);
  assert.deepEqual(source[15], [[72, 2], [null, 1]]);
});

test('Harvest Song includes textbook p.51 continuation and its high-register bridge', () => {
  const source = bars('harvest-song');
  assert.equal(source.length, 24);
  assert.deepEqual(source[0], [[84, 1], [79, 0.5], [76, 0.5]]);
  assert.deepEqual(source[16], [[84, 1], [84, 1]]);
  assert.deepEqual(source[17], [[83, 0.5], [86, 0.5], [79, 1]]);
  assert.deepEqual(source[19], [[84, 0.5], [88, 0.5], [79, 1]]);
  for (const index of [7, 15, 23]) assert.deepEqual(source[index], [[72, 1], [null, 1]]);
});

test('Xiao Bai Cai follows the selected folk textbook variant and changes to 4/4 for the coda', () => {
  const source = bars('xiao-bai-cai');
  assert.equal(source.length, 6);
  assert.deepEqual(source[3], [[74, 1], [72, 1], [72, 0.5], [69, 0.5], [67, 2]]);
  assert.deepEqual(source[4], [[69, 1], [72, 0.5], [69, 0.5], [67, 2]]);
  assert.deepEqual(source[5], [[69, 0.5], [74, 0.5], [72, 0.5], [69, 0.5], [67, 2]]);
  const measures = BUILTIN_SCORES.find((s) => s.id === 'xiao-bai-cai')!.lines.flat();
  assert.equal(measures[4].timeSignature, '4/4');
  assert.ok(measures[3].repeatEnd && measures[4].repeatBegin && measures[5].repeatEnd);
});

test('London Bridge retains the 1927 edition rhythm, ties and final rest', () => {
  const source = bars('london-bridge');
  assert.equal(source.length, 8);
  assert.deepEqual(source[0], [[79, 1.5], [81, 0.5], [79, 1], [77, 1]]);
  assert.deepEqual(source[6], [[74, 2], [79, 2]]);
  assert.deepEqual(source[7], [[76, 1], [72, 2], [null, 1]]);
  assert.ok(BUILTIN_SCORES.find((s) => s.id === 'london-bridge')!.lines[0][1].notes[2].tie);
});

test('Oh Susanna expands the repeat with its pickup and a rest before the chorus', () => {
  const source = bars('oh-susanna');
  assert.equal(source.length, 25);
  assert.deepEqual(source[0], [[72, 0.25], [74, 0.25]]);
  assert.deepEqual(source[8], [[72, 1.5], [72, 0.25], [74, 0.25]]);
  assert.deepEqual(source[16], [[72, 1.5], [null, 0.5]]);
  assert.deepEqual(source[17], [[77, 1], [77, 1]]);
  assert.deepEqual(source[18], [[81, 0.5], [81, 1], [81, 0.5]]);
  assert.deepEqual(source[24], [[72, 1.5]]);
  assert.deepEqual(source.slice(1, 8), source.slice(9, 16));
});

test('Zou Jiang Zhou distinguishes low notes, upper do and sixteenth rests', () => {
  const source = bars('zou-jiang-zhou');
  assert.equal(source.length, 23);
  assert.deepEqual(source[1], [[72, 0.5], [71, 0.25], [69, 0.25], [67, 1]]);
  assert.deepEqual(source[2], [[79, 0.75], [84, 0.25], [79, 0.5], [77, 0.5]]);
  assert.deepEqual(source[5], [[79, 0.25], [null, 0.25], [84, 0.25], [null, 0.25], [79, 0.25], [null, 0.25], [84, 0.25], [null, 0.25]]);
  assert.deepEqual(source[17], [[67, 0.5], [65, 0.5], [67, 0.5], [65, 0.5]]);
  assert.deepEqual(source[22], [[67, 2]]);
});

test('Yankee Doodle includes the lower chorus, dotted rhythms and complementary pickup', () => {
  const source = bars('yankee-doodle');
  assert.equal(source.length, 17);
  assert.deepEqual(source[0], [[67, 0.5]]);
  assert.deepEqual(source[9], [[69, 0.75], [71, 0.25], [69, 0.5], [67, 0.5]]);
  assert.deepEqual(source[12], [[64, 0.75], [65, 0.25], [67, 0.5], [null, 0.5]]);
  assert.deepEqual(source[16], [[72, 1], [72, 0.5]]);
});

test('My Bonnie retains the source ninth opening, low register and tied phrase transitions', () => {
  const source = bars('my-bonnie');
  assert.equal(source.length, 33);
  assert.deepEqual(source[0], [[67, 1]]);
  assert.deepEqual(source[1], [[76, 1.5], [74, 0.5], [72, 1]]);
  assert.deepEqual(source[3], [[67, 1], [64, 2]]);
  assert.deepEqual(source[8], [[74, 2], [67, 1]]);
  assert.deepEqual(source[19], [[69, 3]]);
  assert.deepEqual(source[32], [[72, 2]]);
});

test('Fengyang Flower Drum retains the PEP edition low la and the full rhythmic coda', () => {
  const source = bars('fengyang-flower-drum');
  assert.equal(source.length, 15);
  assert.deepEqual(source[4], [[72, 0.5], [72, 1], [69, 0.5], [79, 1], [79, 0.5], [76, 0.5]]);
  assert.deepEqual(source[12], [[79, 1], [72, 0.5], [null, 0.5], [79, 1], [72, 0.5], [null, 0.5]]);
  assert.deepEqual(source[14], [[74, 0.5], [72, 0.5], [69, 0.5], [74, 0.5], [72, 2]]);
});

test('Click Go the Shears has four phrase-ending rests and the final octave leap', () => {
  const source = bars('click-go-the-shears');
  assert.equal(source.length, 16);
  assert.deepEqual(source[0], [[76, 1], [76, 0.75], [74, 0.25]]);
  assert.deepEqual(source[12], [[86, 0.75], [84, 0.25], [83, 0.5], [81, 0.5]]);
  assert.deepEqual(source[14], [[72, 1], [84, 0.75], [83, 0.25]]);
  for (const index of [3, 7, 11, 15]) assert.deepEqual(source[index].at(-1), [null, 1]);
});

test('Santa Lucia preserves its chromatic cancellation and both alternate endings', () => {
  const source = bars('santa-lucia');
  assert.equal(source.length, 24);
  assert.deepEqual(source[5], [[67, 0.25], [66, 0.25], [65, 1]]);
  assert.deepEqual(source[14], [[74, 0.5], [69, 0.75], [71, 0.25]]);
  assert.deepEqual(source[22], [[74, 0.5], [76, 0.75], [74, 0.25]]);
  assert.deepEqual(source[23], [[74, 0.5], [72, 1]]);
  assert.deepEqual(source.slice(8, 14), source.slice(16, 22));
});
