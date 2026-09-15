<!-- AUTO-TRANSLATED: 源文件 = ../../../references/migrated/seedance-filter-original.md ; 最后同步 = 2026-07-06 -->
<!-- 校对状态: draft -->
<!-- 术语表: references/vocab/zh.md -->

# `seedance-filter` 的旧版体

于 2026-04-27 在 v5.1.0 期间迁移。除非在 `references/api-status.md` 或 `references/source-registry.md` 中确认，否则将本文件中的平台、策略、API 与安全声明视为旧版。

---

# seedance-filter

驾驭 Seedance 2.0 内容过滤器并撰写通过的提示词。

---

## 问题：必需的源 - 阻止风险观察

从业者数据（2026 年 2 月）显示 **37% 的所有 Seedance 2.0 提示词被阻止**。绝大多数不是实际的策略违规，而是对创意意图的**过滤器误判**。本技能解释过滤器如何思考以及如何撰写它理解的提示词。

---

## 过滤器如何思考

内容过滤器不是简单的关键词阻止器。它是一个**语言模型**，将整个提示词评估为单一连贯的场景。它评估**意图和上下文**，而不仅是个别词。

| 过滤器行为 | 对提示词写作的启示 |
|---|---|
| 将整个提示词评估为一个场景 | 专业电影上下文中一个暴力词可能通过，而随意的一个失败。 |
| 阅读意图而非关键词 | "电影制作"框架比随意描述获得更多回旋空间。 |
| 制作语言信号专业性 | 镜头类型、镜头规格、灯光术语 → 更高的通过率。 |
| 随意语言信号风险 | 像"给朋友的笔记"的提示词更常被标记。 |

**核心原则：** 像电影制作人那样写，而非随意用户。

---

## 四问框架

为信号专业意图，每个提示词应回答以下四个问题：

1.  **场景在哪里？**（例如 `abandoned warehouse`、`neon-lit alley`、`foggy mountaintop`）
2.  **它看起来像什么？**（例如 `rusting machinery`、`wet pavement with reflections`、`ancient pine trees`）
3.  **摄影机在做什么？**（例如 `slow dolly push-in`、`handheld tracking shot`、`static wide shot`）
4.  **氛围是什么？**（例如 `tense and quiet`、`energetic and chaotic`、`serene and cold`）

回答这四个问题的提示词被过滤器误判的可能性小得多。

---

## 高风险词类别

某些词会触发整个提示词的更高审查，即使意图是无辜的。尽可能避免它们。

| 类别 | 高风险词 | 更安全替代 |
|---|---|---|
| **年龄（少年）** | `child`、`kid`、`young`、`boy`、`girl` | 通过角色描述（`apprentice`、`student`）、动作（`learning to...`）或相对年龄（`the younger of the two`）。 |
| **暴力（直接）** | `kill`、`shoot`、`stab`、`blood` | 使用电影委婉语：`neutralizes target`、`discharges weapon`、`a brief struggle`、`red liquid`。 |
| **亲密** | `intimate`、`sensual`、`passionate` | 描述物理动作：`a gentle touch on the arm`、`a shared glance`、`standing close together`。 |

---

## 通过过滤器的实用技巧

### 1. 图像上传最佳实践

-   **避免竞争信息：** 如果你使用 `@Image1` 上传了角色图像，**不要** 在文本提示词中描述他们的外观。这创建了让过滤器困惑的冲突信息。
-   **使用背对姿势：** 为避免触发人脸识别过滤器，使用角色背对摄影机、剪影或远距离的图像。
-   **偏好插画：** 与照片级写实图像相比，插画或风格化的角色艺术触发真人肖像过滤器的可能性较小。

### 2. 中文提示词技巧

-   **社区发现：** 一些用户报告通过**中文**撰写主要场景描述同时保留对话或特定技术术语为英文，能获得更高的通过率。
-   **为何有效：** 模型在大量中文数据语料上训练，其中文语言过滤器有不同的阈值和细微差别。
-   **范例：**
    ```
    (prompt in Chinese describing a complex action scene)
    Character A says: "We have to go, now."
    ```

### 3. 以专业性打头

-   **前置电影化语言。** 用摄影机运动、镜头类型或灯光描述开始提示词。这立即向过滤器发出你是制作电影而非描述真实事件的信号。
-   **范例：**
    ```
    (Good) ✅ "Low-angle tracking shot. A figure in a long coat runs down a wet alley..."
    (Bad)  ❌ "A person is running down an alley. It's dark and wet..."
    ```

---

## 诊断被阻止的提示词

如果你的提示词被阻止，按此清单操作：

1.  **检查高风险词：** 上表中是否有可被重新措辞的词？
2.  **检查 IP/肖像：** 是否违反 `seedance-copyright` 中的规则？
3.  **检查歧义：** 你的意图清晰吗？机器能否将你的创意描述误判为真实世界的策略违规？
4.  **用四问框架重写：** 确保你已清楚描述了地点、内容、摄影机和氛围。
5.  **尝试中文提示词技巧：** 作为最后的手段，将描述性部分翻译为中文。

---

## 过滤安全电影词汇数据库 v1.0

本数据库提供已知与内容过滤器有高通过率的电影化术语的多语言查询。当提示词被阻止时，找到有问题的词并用本列表中的等价词替换。

### 1. 摄影机 —— 景别

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| extreme wide shot | 大远景 | 超ロングショット | 익스트림 와이드 샷 | plano general extremo |
| wide shot | 远景 / 全景 | ワイドショット | 와이드 샷 | plano general |
| full shot | 全身景 | フルショット | 풀 샷 | plano entero |
| medium shot | 中景 | ミディアムショット | 미디엄 샷 | plano medio |
| medium close-up | 中近景 | ミディアムクローズアップ | 미디엄 클로즈업 | plano medio corto |
| close-up | 近景 / 特写 | クローズアップ | 클로즈업 | primer plano |
| extreme close-up | 极致特写 | エクストリームクローズアップ | 익스트림 클로즈업 | primerísimo primer plano |
| over-the-shoulder | 过肩镜头 | オーバーザショルダー | 오버 더 숄더 | plano sobre el hombro |
| two-shot | 双人镜头 | ツーショット | 투 샷 | plano de dos |
| POV / first-person | 第一视角 / 主观镜头 | 主観ショット / POV | 1인칭 시점 | plano subjetivo / POV |
| bird's-eye view | 鸟瞰 / 俯瞰 | 俯瞰ショット | 버드아이 뷰 | vista de pájaro / cenital |
| low angle | 仰拍 / 低角度 | ローアングル | 로우 앵글 | contrapicado |
| high angle | 俯拍 / 高角度 | ハイアングル | 하이 앵글 | picado |
| Dutch angle | 荷兰角 / 倾斜构图 | ダッチアングル | 더치 앵글 | plano holandés |
| insert shot | 插入镜头 | インサートショット | 인서트 샷 | plano detalle / inserto |

### 2. 摄影机 —— 运动

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| locked-off / static | 固定机位 / 锁定 | 固定カメラ / ロックオフ | 고정 카메라 | cámara fija |
| dolly push-in | 推镜头 | ドリーイン / 寄り | 달리 인 | travelling de acercamiento |
| dolly pull-out | 拉镜头 | ドリーアウト / 引き | 달리 아웃 | travelling de alejamiento |
| pan left / right | 摇镜头（左/右） | パン（左/右） | 팬 (좌/우) | panorámica horizontal |
| tilt up / down | 升降摇（上/下） | ティルト（上/下） | 틸트 (상/하) | panorámica vertical |
| orbit / circling | 环绕 | 回り込み / オービット | 오빗 / 원형 이동 | travelling circular |
| tracking / follow | 跟拍 | 追跡撮影 / フォロー | 트래킹 / 팔로우 | travelling de seguimiento |
| crane shot | 摇臂镜头 | クレーンショット | 크레인 샷 | plano grúa |
| handheld | 手持镜头 | ハンドヘルド | 핸드헬드 | cámara en mano |
| steadicam | 稳定器跟拍 | ステディカム | 스테디캠 | steadicam |
| one-take / oner | 一镜到底 | ワンカット / 長回し | 원테이크 / 롱테이크 | plano secuencia |
| whip pan | 甩镜 / 急摇 | ウィップパン | 휘팬 | panorámica rápida |
| rack focus | 焦点转换 | ラックフォーカス / ピン送り | 랙 포커스 | cambio de foco |
| Hitchcock zoom | 希区柯克变焦 | めまいショット / ドリーズーム | 히치콕 줌 | efecto vértigo / contrazoom |
| drone approach | 航拍推进 | ドローン接近 | 드론 접근 | acercamiento con dron |

### 3. 灯光

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| key light | 主光 | キーライト / 主光 | 키 라이트 | luz principal |
| fill light | 辅光 / 补光 | フィルライト / 補助光 | 필 라이트 | luz de relleno |
| rim light | 轮廓光 | リムライト / 輪郭光 | 림 라이트 | luz de contorno |
| backlight | 逆光 | バックライト / 逆光 | 백라이트 / 역광 | contraluz |
| practical light | 实景灯光 | 実景照明 / プラクティカル | 프랙티컬 라이트 | luz práctica |
| low-key | 低调布光 | ローキー照明 | 로우키 조명 | iluminación en clave baja |
| high-key | 高调布光 | ハイキー照明 | 하이키 조명 | iluminación en clave alta |
| god rays / Tyndall | 丁达尔光 / 光束 | ティンダル光 / ゴッドレイ | 틴들 효과 / 빛줄기 | rayos de luz / efecto Tyndall |
| golden hour | 黄金时刻 | ゴールデンアワー / 黄金時間 | 골든 아워 | hora dorada |
| hard light | 硬光 | ハードライト / 硬い光 | 하드 라이트 | luz dura |
| soft / diffused light | 柔光 / 漫射光 | ソフトライト / 柔らかい光 | 소프트 라이트 | luz suave / difusa |
| motivated light | 有源光 | 動機付き照明 | 동기 부여 조명 | luz motivada |
| ambient light | 环境光 | アンビエントライト / 環境光 | 앰비언트 라이트 | luz ambiental |
| neon light | 霓虹灯光 | ネオンライト | 네온 라이트 | luz de neón |
| firelight / flicker | 火光 / 烛光闪烁 | 炎の光 / ゆらぎ | 불빛 / 촛불 깜빡임 | luz de fuego / parpadeo |
| silhouette | 剪影 | シルエット | 실루엣 | silueta |
| overcast / flat | 阴天漫射 | 曇天光 / フラットライト | 흐린 날 조명 | luz de día nublado |

### 4. 灯光 —— 色温与氛围

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| warm amber | 暖琥珀色 | 暖色アンバー | 따뜻한 앰버 | ámbar cálido |
| cool blue | 冷蓝调 | 冷たいブルー | 차가운 블루 | azul frío |
| neutral white | 中性白 | ニュートラルホワイト | 중성 화이트 | blanco neutro |
| thin fog | 薄雾 | 薄霧 | 얇은 안개 | niebla ligera |
| dense fog | 浓雾 | 濃霧 | 짙은 안개 | niebla densa |
| dust motes | 浮尘微粒 | 塵の粒子 | 먼지 입자 | motas de polvo |
| light rain | 细雨 | 小雨 / 霧雨 | 가랑비 | lluvia ligera |
| heavy rain | 暴雨 | 大雨 / 豪雨 | 폭우 | lluvia torrencial |
| breath mist | 呼气白雾 | 白い息 | 입김 | vaho del aliento |
| heat shimmer | 热浪扭曲 | 陽炎 / 熱揺らぎ | 아지랑이 | espejismo de calor |
| smoke drift | 烟雾飘动 | 煙の漂い | 연기 흐름 | humo a la deriva |
| snow falling | 飘雪 | 降雪 / 雪が舞う | 눈 내림 | nieve cayendo |

### 5. 风格与质感

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| anamorphic lens | 变形宽银幕镜头 | アナモルフィックレンズ | 아나모픽 렌즈 | lente anamórfica |
| spherical lens | 球面镜头 | スフェリカルレンズ | 구면 렌즈 | lente esférica |
| film grain | 胶片颗粒 | フィルムグレイン | 필름 그레인 | grano de película |
| digital clean | 数字清晰 | デジタルクリーン | 디지털 클린 | digital limpio |
| shallow depth of field | 浅景深 | 浅い被写界深度 | 얕은 심도 | profundidad de campo reducida |
| deep depth of field | 深景深 | 深い被写界深度 | 깊은 심도 | gran profundidad de campo |
| lens flare | 镜头光晕 | レンズフレア | 렌즈 플레어 | destello de lente |
| muted palette | 低饱和色调 | 落ち着いた色調 | 채도 낮은 팔레트 | paleta apagada |
| desaturated | 去饱和 | 彩度を落とした | 채도 감소 | desaturado |
| high contrast | 高对比 | ハイコントラスト | 하이 콘트라스트 | alto contraste |
| crushed blacks | 压暗黑部 | 潰れた黒 | 블랙 크러시 | negros aplastados |
| bleach bypass | 跳漂处理 | ブリーチバイパス | 블리치 바이패스 | proceso de blanqueo |
| cel-shaded | 赛璐璐渲染 | セルシェーディング | 셀 셰이딩 | sombreado cel |
| 2D animation | 二维动画 | 2Dアニメーション | 2D 애니메이션 | animación 2D |
| stop-motion | 定格动画 | ストップモーション | 스톱 모션 | stop motion |
| watercolor wash | 水彩渲染 | 水彩ウォッシュ | 수채화 워시 | lavado de acuarela |
| ink outline | 墨线勾勒 | 墨線 / インクライン | 먹선 | línea de tinta |
| photorealistic | 照片级写实 | フォトリアル | 포토리얼리스틱 | fotorrealista |

### 6. 动作与时序

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| slow motion | 慢动作 / 升格 | スローモーション / ハイスピード撮影 | 슬로우 모션 | cámara lenta |
| real-time | 正常速度 | リアルタイム / 等速 | 실시간 | tiempo real |
| time-lapse | 延时摄影 | タイムラプス / 微速度撮影 | 타임랩스 | time-lapse |
| freeze frame | 定帧 / 画面静止 | フリーズフレーム / 静止画 | 프리즈 프레임 | fotograma congelado |
| ease in | 缓入 | イーズイン / 緩加速 | 이즈 인 | aceleración progresiva |
| ease out | 缓出 | イーズアウト / 緩減速 | 이즈 아웃 | desaceleración progresiva |
| beat-sync | 卡点 | ビートシンク / 拍合わせ | 비트 싱크 | sincronización al ritmo |
| smear frame | 动态模糊帧 | スミアフレーム | 스미어 프레임 | fotograma de barrido |
| motion on twos | 二拍一动画 | 二コマ打ち | 투스 모션 | animación a doses |
| whip transition | 甩切转场 | ウィップトランジション | 휘 전환 | transición de barrido |
| match cut | 匹配剪辑 | マッチカット | 매치 컷 | corte por continuidad |
| smash cut | 硬切 | スマッシュカット | 스매시 컷 | corte brusco |
| dissolve | 叠化 / 溶解转场 | ディゾルブ / オーバーラップ | 디졸브 | fundido encadenado |
| fade to black | 渐黑 | フェードアウト / 暗転 | 페이드 투 블랙 | fundido a negro |

### 7. 安全动作与战斗词汇

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| impact | 冲击 | 衝撃 | 충격 | impacto |
| collision | 碰撞 | 衝突 | 충돌 | colisión |
| momentum | 动能 / 惯性 | 運動量 / 勢い | 운동량 / 관성 | inercia / impulso |
| force exchange | 力量交汇 | 力の交差 | 힘의 교환 | intercambio de fuerza |
| dramatic confrontation | 气势对抗 | 気迫の対峙 | 기세 대치 | confrontación dramática |
| parry / deflect | 格挡 / 拆解 | 受け流し / 弾き | 막아내기 / 흘려보내기 | parada / desvío |
| counter-move | 反击 / 拆招 | 返し技 / カウンター | 반격 / 역습 | contragolpe / contramovimiento |
| energy release | 能量爆发 | エネルギー解放 | 에너지 방출 | liberación de energía |
| cinematic combat choreography | 影视级动作编排 | 映画的アクション演出 | 영화적 액션 안무 | coreografía de acción cinematográfica |
| power clash | 力量碰撞 | パワークラッシュ / 力の激突 | 파워 클래시 | choque de poder |
| evasion / sidestep | 闪避 / 侧身 | 回避 / 横移動 | 회피 / 옆걸음 | evasión / esquiva lateral |
| aerial arc | 腾空弧线 | 空中の弧 | 공중 호 | arco aéreo |
| recovery stance | 回稳架势 | 体勢回復 | 회복 자세 | postura de recuperación |
| absorb the force | 承受冲击 | 衝撃を受け止める | 충격 흡수 | absorber la fuerza |
| slide back | 滑退 | 後方滑走 | 미끄러져 후퇴 | deslizarse hacia atrás |
| sparks cascade | 火花迸溅 | 火花が飛び散る | 불꽃이 튀다 | cascada de chispas |
| shockwave ripple | 冲击波扩散 | 衝撃波の波紋 | 충격파 확산 | onda de choque |
| structural failure | 结构崩塌 | 構造崩壊 | 구조 붕괴 | fallo estructural |
| rapid dispersal | 急速扩散 | 急速拡散 | 급속 확산 | dispersión rápida |

### 8. 安全武器词汇

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| elongated steel instrument | 精钢长刃 | 精鋼の長器 | 정밀 강철 장기 | instrumento de acero alargado |
| forged implement | 锻造兵刃 | 鍛造された刃器 | 단조된 기구 | implemento forjado |
| polished steel edge | 精钢刃面 | 磨き上げた鋼の刃 | 연마된 강철 날 | filo de acero pulido |
| metallic equipment | 金属器具 | 金属製の装具 | 금속 장비 | equipo metálico |
| reinforced staff | 强化长杆 | 強化された長棒 | 강화 장봉 | bastón reforzado |
| tactical gear | 战术装具 | 戦術装備 | 전술 장비 | equipo táctico |
| protective implement | 防护器械 | 防護器具 | 방호 기구 | implemento protector |
| dual edges | 双刃 | 双刃 / 二刀 | 쌍날 | doble filo |
| curved steel | 弧形钢刃 | 弧状の鋼刃 | 곡선 강철 | acero curvado |
| blunt instrument | 钝器 | 鈍器 | 둔기 | instrumento contundente |

### 9. 安全服装与盔甲词汇

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| tactical bodysuit | 战术连体服 | タクティカルスーツ | 전술 바디수트 | traje táctico |
| reinforced combat suit | 强化作战服 | 強化戦闘服 | 강화 전투복 | traje de combate reforzado |
| armored vest | 防护背心 | アーマードベスト | 방호 조끼 | chaleco blindado |
| lightweight armor | 轻型护甲 | 軽量アーマー | 경량 갑옷 | armadura ligera |
| carbon-fiber plating | 碳纤维护板 | カーボンファイバープレート | 카본파이버 플레이트 | placas de fibra de carbono |
| combat boots | 作战靴 / 战术靴 | コンバットブーツ | 전투 부츠 | botas de combate |
| field uniform | 机能作战服 | フィールドユニフォーム | 야전복 | uniforme de campo |
| duty wear | 制式装备 | 任務服 | 임무복 | ropa de servicio |
| protective plating | 防护板 | プロテクションプレート | 방호판 | placas protectoras |
| layered fabric armor | 多层织物甲 | 重ね布鎧 | 다층 직물 갑옷 | armadura de tela multicapa |
| hooded cloak | 连帽斗篷 | フード付きマント | 후드 망토 | capa con capucha |
| full-coverage robe | 全覆盖长袍 | 全身ローブ | 전체를 덮는 로브 | túnica de cobertura completa |
| leather bracers | 皮质护腕 | 革のブレーサー | 가죽 팔보호대 | brazales de cuero |
| shoulder pauldron | 肩甲 | 肩当て / ポールドロン | 어깨 갑옷 | hombrera |
| waist sash / utility belt | 腰带 / 战术腰封 | 腰帯 / ユーティリティベルト | 허리띠 / 전술 벨트 | fajín / cinturón táctico |
| gauntlets | 护手甲 | ガントレット / 籠手 | 건틀릿 | guanteletes |
| greaves / shin guards | 胫甲 | 脛当て / グリーブ | 정강이 보호대 | grebas |
| chainmail layer | 锁子甲层 | 鎖帷子の層 | 쇄자갑 층 | capa de cota de malla |

### 10. 安全身体与体格词汇

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| athletic build | 运动型体格 | アスレチック体型 | 운동선수 체형 | complexión atlética |
| combat-ready stance | 格斗架势 | 戦闘態勢 | 전투 자세 | postura de combate |
| trained physique | 训练有素的身形 | 鍛え上げた体格 | 단련된 체격 | físico entrenado |
| agile frame | 敏捷体态 | 俊敏な体型 | 민첩한 체형 | constitución ágil |
| lean and balanced | 匀称身形 | 引き締まった均整の体 | 균형 잡힌 체격 | esbelto y equilibrado |
| disciplined posture | 端正姿态 | 規律正しい姿勢 | 단정한 자세 | postura disciplinada |
| broad-shouldered | 宽肩 | 広い肩幅 | 넓은 어깨 | de hombros anchos |
| compact build | 紧凑体型 | コンパクトな体格 | 다부진 체형 | complexión compacta |
| towering figure | 高大身影 | 高くそびえる人影 | 우뚝 선 인물 | figura imponente |
| weathered features | 饱经风霜的面容 | 風雪に鍛えられた容貌 | 풍파를 겪은 얼굴 | rasgos curtidos |

### 11. VFX —— 粒子与能量

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| particle trail | 粒子尾迹 | パーティクルトレイル | 파티클 궤적 | estela de partículas |
| energy aura | 能量光环 | エネルギーオーラ | 에너지 오라 | aura de energía |
| spark burst | 火花迸射 | スパークバースト / 火花爆発 | 불꽃 폭발 | ráfaga de chispas |
| ember drift | 余烬飘浮 | 残り火の漂い | 잔불 표류 | ascuas a la deriva |
| energy beam | 能量光束 | エネルギービーム | 에너지 빔 | rayo de energía |
| translucent barrier | 半透明屏障 | 半透明バリア | 반투명 방벽 | barrera translúcida |
| pulsing glow | 脉动光芒 | 脈動する光 | 맥동하는 빛 | brillo pulsante |
| ice crystallization | 冰晶扩散 | 氷結晶の拡散 | 얼음 결정 확산 | cristalización de hielo |
| flame tongue | 火舌 | 炎の舌 | 불꽃 혀 | lengua de fuego |
| lightning arc | 闪电弧 | 雷光アーク | 번개 아ーク | arco eléctrico |
| ground crack | 地面龟裂 | 地面のひび割れ | 지면 균열 | grieta en el suelo |
| debris scatter | 碎片飞溅 | 破片の飛散 | 파편 비산 | dispersión de escombros |
| dust cloud eruption | 尘土扬起 | 土煙の噴出 | 먼지 구름 분출 | erupción de polvo |
| shockwave expansion | 冲击波扩散 | 衝撃波の拡大 | 충격파 팽창 | expansión de onda de choque |
| air distortion | 空气扭曲 | 空気の歪み | 공기 왜곡 | distorsión del aire |

### 12. 声音 —— 故事内音频

| English | 中文 | 日本語 | 한국어 | Español |
|---|---|---|---|---|
| metallic ring | 金属撞击声 | 金属の響き | 금속 울림 | resonancia metálica |
| stone crumble | 石块碎裂声 | 石の崩壊音 | 돌 부서지는 소리 | desmoronamiento de piedra |
| wind howl | 风啸声 | 風の唸り | 바람 울음 | aullido del viento |
| fabric rustle | 衣物摩擦声 | 布の擦れる音 | 옷감 스치는 소리 | roce de tela |