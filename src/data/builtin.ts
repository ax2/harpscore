// 由 npm run scores:build 自动生成，请勿手工编辑
import { unpackBuiltinScores, type PackedBuiltinLibrary } from '../lib/builtinCodec';
import packed from './builtin.packed.json';

export const BUILTIN_SCORES = unpackBuiltinScores(packed as PackedBuiltinLibrary);
