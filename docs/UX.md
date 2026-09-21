# UX Specification and Figma Prototype Audit

## 文書の位置づけ

この文書は、Productionで目指すInformation Architecture・画面遷移・Interaction要件と、`figma-reference/`から確認できたFigma Make Prototypeの現状を記録する。

- **Production要件**はProduct仕様として実装対象になる。
- **Prototype確認**は現状把握のための証拠であり、Production仕様を確定しない。
- **Prototype差分**は、未実装・未接続・仮ロジック・Product要件との不一致を示す。

Prototype Snapshot確認日: 2026-09-21。

## Mobile-first Production UX

**決定済み**: スマートフォンを日常利用のPrimary Clientとし、React / TypeScript / ViteのWeb FrontendをMobile-firstで設計する。DesktopはDevelopment / Preview / Secondary accessであり、完全非対応にはしない。

- PortraitをPrimaryとし、片手で主要Actionへ到達しやすい情報階層・画面遷移を優先する。Desktop幅へ引き伸ばしたDashboardを基本形にしない。
- Touchで操作・状態確認が完結するようにし、小さすぎるTap targetやHoverだけで発見・実行できるInteractionを避ける。Keyboard操作等のAccessibilityも損なわない。
- NavigationはMobile App的な構造を前提とし、全画面に近いScreen transitionと明確な現在地を設計する。Bottom Navigationは基本候補だが、Tab数・固定配置・遷移方式の詳細は未決定。
- Safe Areaを将来考慮できるLayoutとする。具体的な余白・Tap targetのPixel値はこのProduct Decisionでは固定しない。

**UX確認の目安（固定仕様ではない）**: 375〜430px程度の一般的なスマートフォン幅を重点確認し、Portrait、Touch、主要Actionの到達性をPreviewで検証する。Desktop Previewだけで完了としない。

**Figma → Production**: Smartphone viewportを基準にUI意図を照合する。Prototypeの見た目・Hover装飾・固定寸法をそのままProduction仕様とはせず、Touch / Responsive / Accessibility要件へ合わせて再設計する。

**Prototype確認**: `figma-reference/src/App.tsx`には最大430pxのPhone ColumnとBottom Navigationがある。これはMobile-firstのUI意図と整合するが、Productionの固定幅・Navigation実装の確定根拠ではない。

## ProductionのInformation Architecture

Onboarding完了後の主要Navigationは次の4領域とする方向で進める。領域構成は有力方針であり、Bottom Navigationの正式なTab構成は未決定。

1. **MAP**: Adventure Map、現在地、Stage、Bossへの道のり。
2. **QUEST**: 当日のTraining / Recovery、Nutritionを含むBonus Quest。
3. **CHARACTER**: Level、EXP、HP、Play Style、Strength / Support Stats、Body Status。
4. **PROGRESS**: Strength・Body Weight・Boss・継続の履歴。

Bossは基本候補のBottom Navigationへ常設せず、MapのBoss Nodeから遷移する方向とする。NutritionとRecoveryは独立した主Navigationにせず、QuestまたはCharacterから到達できる構成とする。

## Figma Prototypeで確認できたScreen一覧

| Screen / State | 実装ファイル | Prototypeで確認できた内容 | 到達性 |
|---|---|---|---|
| Onboarding | `src/screens/Onboarding.tsx` | 3 Step。Character情報、Main Strength、食事制約・Final Goal | 初回起動時に必ず表示 |
| Adventure Map / Roadmap | `src/screens/MapScreen.tsx` | 日付付きNode、現在地、Bossまでの日数、Stage Gauge、Schedule変更表示 | Onboarding完了後の初期画面、Bottom Navから到達 |
| Training Quest | `src/screens/QuestScreen.tsx` | Main Exercise、Bonus Quest、個別完了、代替Exercise、予定変更 | Training NodeまたはBottom Navから到達 |
| Recovery Quest | `src/screens/QuestScreen.tsx` | HP Gauge、Recovery / Nutrition Bonus、休養完了 | Recovery Node選択時に到達 |
| Beginner Quest | `src/screens/QuestScreen.tsx` | CHEST BEGINNER QUESTの固定Tutorial | Quest画面の手動Toggleで表示 |
| Character | `src/screens/CharacterScreen.tsx` | Level、EXP内訳、Play Style、Status、Support Stats、HP、Body Status | Bottom Navから到達 |
| Boss | `src/screens/BossScreen.tsx` | Boss / Player Power、e1RM条件、Shield / Challenge / Battle | Boss Nodeから到達 |
| Progress | `src/screens/ProgressScreen.tsx` | Achievement、e1RM / 体重Trend、Support Stats、Boss履歴、Streak | Bottom Navから到達 |
| Quest Clear Overlay | `src/screens/Overlays.tsx` | EXP内訳、Treasure獲得表示、次の日付への進行 | Quest完了後に到達 |
| Level Up Overlay | `src/screens/Overlays.tsx` | Level前後値と成長演出 | Quest Clearを閉じた後、閾値超過時に到達 |
| Treasure Overlay | `src/screens/Overlays.tsx` | 開封中表示、1.1秒後のRandom Reward、受取 | 実装はあるが現在のUIから`OPEN_TREASURE`がdispatchされず到達不能 |
| Boss Defeated Overlay | `src/screens/Overlays.tsx` | Boss名、Bench Press達成値 | Boss Battleで撃破Action後に到達 |
| Stage Clear Overlay | `src/screens/Overlays.tsx` | EXP、Treasure、次Stage必要e1RM | Boss Defeatedを閉じた後に到達 |

`src/App.tsx`がScreen切替、Bottom Navigation、全Overlayの配置を担う。Client-side routerはなく、`src/game/state.tsx`の`screen` Stateで切り替えるSingle Page Prototypeである。

## Navigation

### Prototype確認

- 未Onboarding時はOnboardingだけを表示し、Bottom Navigationは表示しない。
- Onboarding完了後はMapへ移動する。
- Bottom NavigationはMap / Quest / Character / Progressの4項目。
- Boss表示中はMap TabをActiveとして扱う。
- BossからMapへ戻る専用Buttonがある。
- Bottom NavのQuestは、Map Nodeを選ばずにQuest画面へ直接遷移できる。

### Production要件

- Mobile App的なNavigationを前提とし、Smartphone Portraitで現在地・次の主要Action・戻り先を分かりやすくする。Bottom Navigationは基本候補であり、Prototypeの4 Tabを正式仕様として固定しない。
- 当日Questへ直接アクセスするNavigationは許容するが、「どの日付・どの計画NodeのQuestか」を常に一意にする。
- BossはMap上のBoss Nodeから遷移させる。
- Overlay表示中は背面操作を防ぎ、完了Actionの多重実行を防ぐ。
- Browser back、Reload、Session復元時の遷移方針は未決定。

## Onboarding UX

### Prototype確認

Step 1:

- 体重: 45〜120kg、初期72kg。
- Training歴: 未経験 / 3ヶ月未満 / 半年〜1年 / 1〜3年 / 3年以上。
- 週のTraining可能日数: 1〜7日、初期3日。

Step 2:

- Main Lift: Bench Press / Squat / Deadlift / Overhead Press / Pull-up。
- 経験者は重量20〜200kg、reps 1〜15を入力。
- 未経験者は体重比から開始重量を自動表示する。
- e1RMを表示する。

Step 3:

- 食事制約・アレルギーの自由入力。
- 現在e1RM、推奨Goal、Final Goal。
- Goalを1kg単位で上下するButton。
- Stage数、1 Stage日数、全体目安日数を表示。

完了時にStateへ残るのは`trainingDays`、`currentE1rm`、`targetE1rm`のみ。体重、Training歴、Main Lift名、重量、reps、食事制約・アレルギーはPrototypeのGlobal Stateへ保存されない。CharacterやBossは引き続き固定のBench Press・固定Body Weightを表示する。

### Production要件

- 入力値を一貫したProfile・Strength Record・Goalとして保存する。
- 推奨値とユーザー確定値を区別する。
- 自動算出の根拠と「後から変更可能」を明示する。
- 未経験者へ表示する値をAI結果と誤表示しない。決定論的計算なら「自動算出」等の表現にする。

## Adventure Map / Roadmap UX

### Prototype確認

- `createStageRoadmap`が日付付きのTraining / Recovery Nodeと最後のBoss Nodeを生成する。
- 現在のNodeだけが通常選択可能。Schedule移動先は将来Nodeでも選択可能。
- 完了済みNodeはCheck、未来Nodeは薄く表示、現在Nodeには`YOU`を表示する。
- 変更元Nodeには`SCHEDULE CHANGED`、変更先には`MOVED QUEST`を表示する。
- Map背景、ランドマーク、曲線Routeによりスケジュール表ではなく冒険Mapとして表現している。
- `NodeType`と`NODE_META`にはTreasure / Event / Elite / Campがあるが、実際に使う動的RoadmapはTraining / Recovery / Bossだけを生成する。
- `MAP_NODES`というTreasure等を含む固定Routeも存在するが、画面では使用されていない。

### Production要件

- 各Nodeは安定したID、日付、種別、状態を持つ。
- 過去・当日・未来・Rescheduled・Completed・Skipped等のState定義を確定する。
- Map進行はQuest完了Transactionの結果としてだけ更新する。
- Schedule変更だけではMap Positionを進めない。
- Treasure / Event / Elite / CampをMVPに含めるかは最終MVP Scopeで決める。

## Training Quest UX

### Prototype確認

- 3 Exercise: Bench Press、Incline Dumbbell Press、Cable Row。
- CheckboxまたはExercise行のTapで個別完了をToggleする。
- 全Main Exercise完了前は`QUESTを完了する`がDisabled。
- Bonus QuestはProtein、Calories、PR challenge。完了は任意。
- Exerciseごとに`器具なし`で代替へ切り替え、`元に戻す`で復元できる。
- 代替対象だけが変わり、他Exerciseへ影響しない。
- 代替後も画面上の重量・reps・setsは元Exerciseの値をそのまま表示する。

### Production要件

- Exerciseごとの完了状態を保存する。
- Main Quest完了条件とBonus Questを分離する。
- 代替時は元Exercise ID、採用Exercise ID、変更理由、提案元を保持する。
- 代替後の負荷・reps・setsを元値のままにするか、換算するかは未決定。

## Recovery Quest UX

### Prototype確認

- Main表示は「正しく身体を休ませよ」とHP Gauge。
- Bonusは7時間以上の睡眠、Protein 140g、20分Walk。
- Bonus未完了でも`休養を完了する`は常に押せる。
- 完了するとRecovery EXPとHP回復、Map進行、Quest Clearが発生する。
- Character画面にもHPを即時最大化する`睡眠を完了する`Demo Actionがある。

### Production要件

- Recovery DayのMain Clear条件を定義し、条件未達なら完了させない。
- Character画面の即時回復ActionはProductionではQuest記録またはRecovery入力へ接続する。
- HPはゲーム演出であり、医療状態や健康リスクの判定値として扱わない。

## Beginner Quest UX

### Prototype確認

- どのユーザーでもQuest画面のButtonから手動でON/OFFできる。
- CHEST / Bench Press専用の固定Textで、4項目の説明と初回Training `40kg × 8 × 2`を表示する。
- 完了状態、自動発生条件、履歴はない。

### Production要件

- 初回、Training歴、Exercise経験等から表示条件を決める。
- 固定重量を全ユーザーへ提示しない。
- 教材の監修、注意事項、再表示方法を決定する。

## Schedule rescheduling UX

### Prototype確認

- `今日は予定通りできない`から、現在位置より後の非Boss Nodeを最大5件表示する。
- 日付を選び`予定を更新`すると、元NodeをRecovery / Rescheduled、選択先をTrainingへ書き換える。
- EXP、Map Position、Quest Clearは発生せずMapへ戻る。この点はProduct要件と一致する。
- `AIが以降のScheduleを調整しました`と表示するが、実処理は元Nodeと移動先Nodeの2件を書き換えるだけで、以降全体の再計画は行わない。
- 移動先Quest完了時、`mapPosition`を移動先の次まで進めるため、間のNodeをまとめて飛ばし得る。
- `schedule`配列はStateにあるが、Reschedule処理では更新されず、UIにも週間Scheduleとして表示されない。

### Production要件

- 変更前後の計画、理由、提案、ユーザー確定を区別する。
- Schedule変更TransactionとQuest完了Transactionを分離する。
- 再計画後も日付順・休養制約・Stage期限・Map進行の整合性を保つ。
- 移動先の完了で未完了日を暗黙にClearしない。

## Quest Clear / EXP / Level Up

### Prototype確認

- Training Main Exerciseが全完了、またはRecovery完了Button押下でQuest Clearになる。
- Quest Clear時にEXPを即時加算し、Map Positionを更新する。
- OverlayでTraining / Nutrition / Recovery EXPとMap進行を表示する。
- EXPが固定閾値を超えるとLevel Upし、Quest Clearを閉じた後にLevel Up Overlayを表示する。
- Quest ClearのTreasure表示はBooleanだけで、Treasure OverlayやInventory追加へ接続されていない。

### Production要件

- Quest完了判定、EXP付与、Map進行、Reward生成を一つの整合したUse Caseとして扱い、再実行で二重付与しない。
- EXP値とLevel curveは未決定。Prototype値を利用しない。
- OverlayはDomain結果を表示するだけにし、表示の有無でDomain Stateを決めない。

## Character / Play Style / Support Stats

### Prototype確認

- LevelはStateに連動する。
- Training / Nutrition / Recovery EXPとTotalを表示する。
- Normal / Muscularをユーザーが手動Toggleする。
- Play Styleは累積3種EXPの最大・最小だけで判定する。
- Status BarはStrengthのみCharacter Toggleに連動し、他は固定値。
- Main StatはBench Press 76kg固定。
- Support Statsは固定配列で、Leg Pressは常にLagging。
- Laggingにより`BOSS SHIELD`を表示するが、Boss挑戦条件とは接続されていない。
- Inventory Stateは存在するが、Character画面にInventory表示はない。

### Production要件

- **有力方針**として、AppearanceをLevel / EXP等の条件で自動成長させる。連動指標・段階・遷移条件は未決定で、手動Demo Toggleは採用しない。
- Play Styleは評価期間・データ不足時の扱いを含めて定義する。
- Support Stats警告とBoss条件を接続する場合は、Product Decisionとして明示する。
- Body WeightはStrength・Boss条件と別表示にする。

## Boss / Boss Defeated / Stage Clear

### Prototype確認

- Boss Challengeは`mapReached && strengthMet`のときだけ開始できる。
- Strength未達またはMap未到達時はBoss Shieldを表示する。
- Prototype専用ButtonでStrength達成 / 未達を切り替える。
- 達成へ切り替えるとCurrent e1RMをRequired e1RMへ置換し、未達へ戻すと76kg固定にする。
- Boss Battle開始後、撃破Buttonで必ず勝利する。
- 撃破時にTraining EXP +500とRandom Treasureを付与する。
- Boss Defeatedを閉じるとStage Clearを表示し、次Stageへ進める。
- Player Powerは76固定で、StrengthやCharacter Stateから導出されない。

### Production要件

- Boss条件はMap到達、ゲーム条件、現実Strength条件を決定論的に判定する。
- Demo Toggleを除去し、検証済みStrength Recordから判定する。
- Boss撃破・Reward・Stage進行の多重実行を防ぐ。
- Battle演出、失敗、再挑戦の有無は未決定。

## Progress / Treasure

### Prototype確認

- ProgressのLevel表示だけがGame Stateに連動する。
- Achievement、e1RM・体重履歴、Support Stats、Boss履歴、7日Streakは固定Dummy Data。
- Treasure候補は6件あり、`Math.random()`で抽選する。
- Treasure Overlayは実装済みだが、MapのTreasure NodeやQuest Clearから開く導線がない。
- Boss撃破RewardだけはRandom TreasureをInventoryへ直接追加し、Stage Clearに表示する。

### Production要件

- Progressは保存済みのRecordから集計する。
- Treasureを採用する場合、獲得条件・効果・重複・Random性・再現性を定義する。
- Rewardは無料のゲーム内報酬とし、課金ガチャとして扱わない。

## Visual / Copy Direction

**決定済み**:

- Modern Dark Fantasy RPG。
- Base: Black、Charcoal、Deep Navy。
- Accent: Antique Gold、Warm Gold、Magical Blue。
- 装飾的なGold Border、RPG Gauge、Dark Panel、大型Boss、Fantasy Map、控えめなGlow。
- 日本語を説明・操作の主言語とし、RPG Keywordや演出にEnglishを使う。
- 派手なMotionはQuest Clear、Level Up、Treasure、Boss等のHero Momentへ集中させる。
- スマートフォンでTapしやすく、情報階層を明確にし、古いPC RPGのような情報過多を避ける。

Prototypeは約430px幅のPhone Column、Cinzel / Cinzel Decorative / Spectral / Space Mono、Near-black / Gold / Arcane Blue / Boss RedのThemeでこの方向を具体化している。フォント・色の正確なTokenはProduction Design System確定時に再評価する。

## PrototypeとProductの主要な一致点

- 4 Tab NavigationとMap起点のBoss導線。
- OnboardingからRoadmap生成への流れ。
- Training / Recoveryの計画表示。
- Exercise単位の完了とMain Quest Guard。
- 対象ExerciseだけのSubstitution。
- Schedule変更がQuest Clearにならない。
- Quest Clear → EXP → Map進行 → Level Up。
- Map到達とStrength条件の両方を使うBoss Challenge。
- Character、Play Style、Support Stats、Progress、Hero Overlayの表現。
- Modern Dark FantasyのVisual Direction。

## PrototypeとProductの主要な差分

- Onboarding入力の多くがGlobal Stateへ保存されず、後続画面に反映されない。
- Beginner Questは初回自動発生ではなく手動Toggle。
- Recovery Questの必須完了条件がない。
- RoadmapにTreasure / Event / Elite / Campが実際には生成されない。
- Treasure Overlayが現在の操作導線から到達不能。
- Schedule再調整は表示文言ほど広い再計画をしない。
- Character Appearanceは自動成長ではなく手動切替。
- Play Style、Support Stats、Progressの多くが固定値または単純仮判定。
- Support StatsのBoss Shieldと実際のBoss条件が接続されていない。
- Boss Strengthは実RecordではなくDemo Toggle。

これらの差分をProductionへそのまま持ち込まず、未決定事項を解決したうえで受け入れ条件を定義する。
