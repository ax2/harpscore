/**
 * HarpScore 曲谱数据模型
 * 简谱（数字谱）+ 十孔布鲁斯口琴演奏标记
 */

/** 吹吸方向 */
export type Breath = 'blow' | 'draw';

/** 曲谱核对所依据的原始材料类型 */
export type ScoreSourceFormat = 'jianpu-text' | 'jianpu-image' | 'music-text' | 'original';

/** 演奏技巧标记 */
export type Technique =
  | 'vibrato'   // 颤音 ~~~
  | 'bend-release' // 压音-释放
  | 'slap'      // 舌堵/拍击
  | 'gliss'     // 滑音
  | 'trill';    // 颤音(快速交替)

/** 单个音符（或休止符） */
export interface Note {
  /** 简谱度数 1-7，0 表示休止符 */
  degree: number;
  /** 临时升降号：-1 降，0 无，1 升 */
  accidental?: -1 | 0 | 1;
  /** 八度偏移：-1 低音点，0 中音，1 高音点 */
  octave?: number;
  /** 时值（拍数）：0.25=十六分, 0.5=八分, 1=四分, 2=二分, 4=全音符 */
  beats: number;
  /** 附点 */
  dotted?: boolean;
  /** 延音线（与下一音相连） */
  tie?: boolean;
  /** 歌词 */
  lyric?: string;

  /** ---- 口琴演奏标记（导入时由引擎推算，也可手工指定） ---- */
  /** 孔位 1-10，休止符为 null */
  hole?: number | null;
  /** 吹 / 吸 */
  breath?: Breath | null;
  /** 压音级别：0 无，1 半音，2 全音，3 一又二分之一音 */
  bend?: 0 | 1 | 2 | 3;
  /** 超吹/超吸（高级技巧） */
  overblow?: boolean;
  /** 技巧标记 */
  techniques?: Technique[];
}

/** 小节 */
export interface Measure {
  notes: Note[];
  /** 从本小节开始生效的拍号；省略则沿用上一小节或曲谱初始拍号 */
  timeSignature?: string;
  /** 小节起始反复记号 */
  repeatBegin?: boolean;
  /** 小节结束反复记号 */
  repeatEnd?: boolean;
  /** 段落结束（双纵线） */
  sectionEnd?: boolean;
}

/** 曲谱 */
export interface Score {
  /** 唯一标识 */
  id: string;
  /** 曲名 */
  title: string;
  /** 副标题/原名 */
  subtitle?: string;
  /** 作曲/来源 */
  composer?: string;
  /** 调号（简谱 1=X），如 "C"、"G" */
  key: string;
  /** @deprecated 演奏整体八度移位已废弃，生成阶段直接烘焙到每个音符的 octave 字段 */
  octaveShift?: number;
  /** 口琴调性（用哪把口琴），如 "C" */
  harmonicaKey: string;
  /** 把位描述，如 "第一把位 (1st Position)" */
  position?: string;
  /** 拍号，如 "4/4"、"3/4"、"6/8" */
  timeSignature: string;
  /** 速度（BPM） */
  tempo?: number;
  /** 难度 1-5 */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 标签 */
  tags: string[];
  /** 曲谱来源说明 */
  source?: string;
  /** 主核对来源链接（原创曲可省略） */
  sourceUrl?: string;
  /** 主核对来源格式；内置传统曲目应优先使用简谱 */
  sourceFormat?: ScoreSourceFormat;
  /** 最近一次逐音核对日期（YYYY-MM-DD） */
  sourceCheckedAt?: string;
  /** 是否内置 */
  builtin?: boolean;
  /** 内置曲库排序（生成阶段使用） */
  order?: number;
  /** 备注/演奏提示 */
  notes?: string;
  /** 正文：按行分组的小节（每行通常 4 小节） */
  lines: Measure[][];
  /** 创建/修改时间 */
  updatedAt?: string;
}

/** 简谱度数 → 半音偏移（相对主音，大调自然音阶） */
export const DEGREE_SEMITONES: Record<number, number> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
};

/** 调名 → 主音 MIDI 基准（中音区） */
export const KEY_ROOTS: Record<string, number> = {
  'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63,
  'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68,
  'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71,
};

/** 调内把音符度数换算为 MIDI 音高 */
export function noteToMidi(key: string, n: Note, octaveShift = 0): number | null {
  if (n.degree === 0) return null;
  const root = KEY_ROOTS[key];
  if (root === undefined) return null;
  const semi = DEGREE_SEMITONES[n.degree];
  if (semi === undefined) return null;
  return root + semi + (n.accidental ?? 0) + (n.octave ?? 0) * 12 + octaveShift * 12;
}
