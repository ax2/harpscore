# Stage 7：传统曲与入门曲均衡扩充

核对日期：2026-10-23，北京时间。本批加入 8 首歌曲，分为 4 首入门选曲和 4 首传统曲选曲，曲库累计 48 首歌曲、4 条原创练习。“入门”表示本批的练习用途，不排除其本身也采用传统曲调；原始歌集的具体署名保留，不把所有童谣都改称匿名民歌。

来源为 [The Everyday Song Book（1927，第12版）的 John Chambers ABC 转录](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/)。此次直接核对的是 ABC 音符文本，不声称已经检查原书扫描件。每首曲谱的 `sourceUrl` 指向具体文件。歌词、伴奏与异音连奏线不录入，速度为编辑建议。曲名相同不表示所有流传版本都相同。

| 本批用途 | ID / 曲名 | 文件与核对要点 |
| --- | --- | --- |
| 入门 | lightly-row / 轻轻划 | `097_Lightly_Row.abc`，2/4，16 小节。G4 主音移到 C5；保留第 8、16 小节 mi + 四分休止。与现有《西班牙划船歌》8 小节短版的末句不同，两个版本不合并。 |
| 入门 | hickory-dickory-dock / 滴答滴答钟声响 | `019_Dickory_Dickory_Dock.abc`，Elliott 版本，6/8，8 小节。F4 主音移到 C5；保留全部独立休止，第 6 小节附点四分 la。 |
| 入门 | see-saw / 跷跷板 | `008_See-saw_Margery_Daw.abc`，Elliott 版本，6/8，8 小节。Ab4 主音移到 C5；第 5 小节原文本跨行，按实际小节线连接；低 sol、低 si 及结尾休止均保留。 |
| 入门 | lucy-locket / 露西的口袋 | `067_Lucy_Locket.abc`，G. M. S. 署名版本，2/4，16 小节。G4 主音移到 C5；仅四分/二分时值，第 14 小节低 si 来自原调 F#4。 |
| 传统曲 | busy-bee / 勤劳的小蜜蜂 | `034_How_Doth_the_Little_Busy_Bee.abc`，署名 Old English，4/4，9 个书写小节。Eb4 主音移到 C5；一拍弱起、三拍尾节、末句 fa–mi 两个八分音保留。不是常见德国童谣《小蜜蜂》的旋律。 |
| 传统曲 | jolly-miller / 快乐的磨坊主 | `098_Jolly_is_the_Miller.abc`，英国游戏歌，4/4，8 小节。A4 主音移到 C5；保留四组附点八分/十六分与低音句。F4 为 2 孔吸气全音压音，A4 为 3 孔吸气全音压音，标为进阶而非无压音入门。 |
| 传统曲 | good-comrade / 好伙伴 | `148_the_Good_Comrade.abc`，歌集署名 Folksong，4/4，13 个书写小节。G4 主音移到 C5；原文本第一段三拍末节与第二段一拍起拍合成同一小节，音符和休止均未增删。 |
| 传统曲 | ash-grove / 白蜡树林 | `131_the_Ash_Grove.abc`，威尔士民歌，3/4，33 个书写小节。Ab 调整体下移半音为 G，C 调口琴第二把位。首段反复完整展开，重复段弱起和下一段弱起接入前小节；第 24 书写小节原还原 D5 对应 C#5（4 吸半音压音），不能按原调号误读成 Db5。 |

## 可重复的来源对照

`tests/fixtures/stage7-sources/` 保存这 8 份 ABC 的音符和归属元数据摘录；只去掉歌词、注释及非音符说明。`manifest.json` 明确每首的原调与半音移调量。

`tests/stage7Sources.test.ts` 使用独立于简谱导入器的严格 ABC 解码，比较每一小节的绝对 MIDI 音高与四分拍时长。它拒绝不支持的语法，显式处理《白蜡树林》的反复展开和《好伙伴》的弱起衔接；另检查全小节拍数及首尾互补。生成器仍执行来源字段、节拍、延音和标准 Richter 孔位门禁。自动检查用于防止转录和后续修改出错，不替代音乐专业复核或实体口琴试奏。

## 暂缓的候选

- `090_Lazy_Sheep.abc`：2/4 中出现 `c B c2` 四拍小节；不猜测补写小节线。
- `094_Oats_and_Beans.abc`：6/8 中出现 `B2 B G3 E` 七个八分单位的小节；待原书对照。
- `134-O_No_John-V1.abc`：4/4 中有七个八分单位的小节，尚未找到可解释的拍号变更；暂缓。
- `021-Jolly_Old_St_Nicholas-V1.abc`：缺少明确小节线且含多声部和弦；本批不自动修补转录。

这些问题针对所读 ABC 版本，不表示曲目本身有误，也不以耳熟的旋律替代证据。

## 第二批：数字简谱与短曲（2026-10-23）

再加入传统曲、入门曲各2首，累计56项（52歌曲、4原创练习）。本阶段共12首新增选曲，按本批用途为传统曲6首、入门6首。

| 本批用途 | ID / 曲名 | 来源与逐首核对 |
| --- | --- | --- |
| 入门 | clap-hands / 大家一起拍拍手 | [ABC No.7](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/007_Well_all_Clap_Hands_Together.abc)，G4主音移为C5。9个书写小节，一拍弱起、三拍尾节；原文本两段的三拍结束与一拍起拍接成一个小节。28个事件独立解码比对。 |
| 入门 | ding-dong-bell / 叮咚铃声 | [ABC No.32](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/032_Ding_Dong_Bell.abc)，F4主音移为C5。10小节，首尾反复保留，40个事件独立比对。第6小节低la为3吸全音压音，明确标注“压音”，不列入无需压音结果。 |
| 传统曲 | flowing-stream / 小河淌水 | [《音乐鉴赏》印刷p.15 / PDF p.22，谱例1-6](https://backend.sjhtbook.com/upload/file/2025/04/80fb4b7923894770828045c9e613e236.pdf#page=22)。整页及4行放大图目视核对。原1=降E改为1=C并提高八度，A羽主音，C口琴第四把位。23个书写小节，前21小节反复；9处自由延长、9次显式拍号变更、2处同音延音、低la与高mi均保留。71个事件另以绝对音高/时值表对照。书面拍数不等于自由延长后的实奏长度。 |
| 传统曲 | polish-waltz / 波兰圆舞曲 | [人教七年级下册简谱，印刷p.48 / PDF p.53](https://dev98.oa.henanyuexue.com/static/szjc-resources/pdf/q/f/2/7.pdf#page=53)。全页与放大谱面目视核对。32小节：前16小节单旋律，后16小节每对谱行只取上声部，不把下声部当成旋律续行。1=C保留并提高八度，D5–F6自然音；第7→8、11→12、15→16小节同音延音保留。72个事件以绝对音高/时值表对照。 |

第二批共211个音符事件，测试位于 `tests/stage7Batch2.test.ts`。ABC参照解码器移至 `tests/helpers/abcReference.ts`，首批8曲的对照仍运行。第二批摘录位于 `tests/fixtures/stage7-batch2/`。

制作摘录时曾发现脚本把行首 `|:` 当作头字段而丢弃整行；10小节断言检出参考文件只有7小节。已修正为仅识别字母开头的头字段，并重新从原始ABC生成摘录。未修改来源旋律或用调整预期数量掩盖该错误。

新增可选小节号按这里的“书写小节”计数，不是演奏展开后的次数。数字谱的来源对照仍为本次作者目视核对加回归表，不冒充第二位音乐专业人士的独立审校。

## 第三批：二拍、三拍入门与六八拍传统曲（2026-10-23）

再加入入门/传统曲各2首；当前60项（56歌曲、4原创练习），Stage 7累计新增16首，用途分类各8首。以下核对针对链接中的单旋律ABC文本，未声称原书扫描件复核。

| 用途 | ID / 曲名 | 来源与核对 |
| --- | --- | --- |
| 入门 | left-right / 左右齐步走 | [No.26 Left Right](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/026_Left_Right.abc)，降E4主音移至C5（+9半音）。16小节2/4，28事件，低si至高re自然音。歌集未署曲作者，不擅自归给某作者。 |
| 入门 | snowbirds / 雪鸟 | [No.29 The Snowbirds](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/029_the_Snowbirds.abc)，E4主音移至C5（+8）。16小节3/4，42事件，C5–C6自然音；保留歌集B. J. Relemann署名。 |
| 传统曲 | little-ship / 小小航船 | [No.85 The Little Ship](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/085_the_Little_Ship.abc)，A4主音移至C5（+3）。17书写小节6/8，68事件，其中1休止；首半拍和末2.5拍互补。6处同音延音，第13小节第3事件的自由延长保留。音域E4–G5，4个低fa/低la压音音符，不纳入无需压音筛选。 |
| 传统曲 | hunting-we-will-go / 我们去狩猎 | [No.188 A Hunting We Will Go](https://trillian.mit.edu/~jc/music/book/EverydaySongBook/188_A_Hunting_We_Will_Go.abc)，C4主音提高八度（+12）。21书写小节6/8，89事件；半拍弱起与2.5拍尾节互补。6处同音延音和第11、19小节的自由延长保留，C5–F6自然音。保留附点八分/十六分，未抹平为均分八分音。 |

227个音符/休止事件逐小节对照音高、时值、延音和延长记号。严格参照解码器扩展了C/E调号与H/横线记号，另有固定样例检验十六分同音延音和延长落点；所有先前来源对照仍运行。见 tests/stage7Batch3.test.ts 和 tests/fixtures/stage7-batch3/。歌词及异音连奏线不收录；演奏速度是编辑建议。

本次候选复查仍暂缓 Lazy Sheep、Oats and Beans 的异常小节。All Through the Night 第7小节 E3 F>F 为5拍；Good-Night Ladies 含转录者明确注明的小节线问题；Harp That Once Through Tara's Halls 含 B c d zB 五拍小节，均待进一步来源证据。Polly's Piano 的第5小节有转录者对音符/休止的推断，本批不作为无疑义入门谱纳入。以上是对特定转录的限制，不是对曲目本身的否定。
