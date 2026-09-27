# UX Specification and Historical Prototype Audit

## 文書の位置づけ

この文書は、Productionで目指すInformation Architecture・画面遷移・Interaction要件と、過去の`figma-reference/`監査結果を記録する。今後のUI / UX Source of Truthは現在のProduction実装と本書であり、新規作業でFigmaを前提にしない。

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

**Production継承**: Smartphone viewportを基準に、既存ProductionのDark Fantasy Visual、Japanese-first copy、Card / Grid構成、spacing、border、typographyを継承する。新UIは既存Domainの実データだけで成立させ、Touch / Responsive / Accessibility要件を満たす。

**Prototype確認**: `figma-reference/src/App.tsx`には最大430pxのPhone ColumnとBottom Navigationがある。これはMobile-firstのUI意図と整合するが、Productionの固定幅・Navigation実装の確定根拠ではない。

## ProductionのInformation Architecture

Onboarding完了後のProduct領域はMAP、QUEST、CHARACTER、PROGRESSとする。D-038でMVP Bottom Navigationの3 TabをMAP / CHARACTER / PROGRESSとして決定した。QUESTはMapから開く集中Flowであり、Bottom NavigationのTabにはしない。

1. **MAP**: Adventure Map、現在地、Stage、Bossへの道のり。
2. **QUEST**: 当日のTraining / Recovery、Nutritionを含むBonus Quest。
3. **CHARACTER**: v1では既存SessionのMain Strength実績・Goal、Body Growth EXP、Stage進行を表示する。Level / HP / Play Style等は未実装のため表示しない。
4. **PROGRESS**: 既存Session内のClear済みTraining / RecoveryとExercise別実績・次回目安を振り返るTraining Log。v1は閲覧専用で、Growth Analysisではない。

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

- D-038 MVP Bottom NavigationはMAP / CHARACTER / PROGRESSの3 Tab。Map / Character / Progressの主要Hubで表示し、OnboardingおよびTraining / Recovery Quest、生成・Clear等の集中Flowでは表示しない。
- MAPは既存Adventure Mapへ、CHARACTERはCharacter Screen v1へ、PROGRESSはProgress Screen v1へ遷移する。現在Tabは色だけでなく明示的なActive stateと`aria-current`で示す。
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

### Production実装 / D-029 MVP差分

- 3 Stepの画面構造・Visual意図は維持するが、Training歴はカテゴリではなく経験月数を直接入力し、週頻度は1..7とする。体重は正の有限値を受け付け、45..120kgをProduct validationにしない。
- Main LiftはBoss対象のBarbell Bench / Back Squat / Deadlift / Overhead Pressだけを選択可能とし、Pull-upはComing later / disabled。最近実施できたSetの重量と1..10 repsからD-023式で自己申告Baselineを算出し、Workout Historyとは区別する。重量不明なら`baseline_required`として開始を止め、体重倍率で埋めない。
- Final Goalはユーザーが直接入力し、Baselineより大きい値を要求する。MVPでGoal推薦値、Food restrictions / Allergy入力、全Stageの仮日数は表示しない。D-043 Stage 1のDurationは既存Roadmap成功表示に14 / 21 / 28日のいずれかとして現れ、first estimateが28日超なら必要に応じてTargetを縮小して同じ操作内で一度再Estimateする。これは28日以内の到達保証ではない。Stage 2以降の42日超やEstimator errorを偽の成功に置き換えない。
- Applicationは開始操作時にBrowser local dateを取得する。Baselineの根拠と`onboarding_self_reported`を明示し、未経験者へ体重倍率をAI結果として表示しない。入力・Roadmapの永続化と再Onboarding方針は未決定。
- Client初期表示はOnboardingとし、成功後に実生成Roadmapと初期ProgressをAdventure Mapへ渡す。Demo Fixtureは開発用に隔離し、実ユーザーRoadmapへDemo Bench Training Planを結合しない。EquipmentはOnboardingでは入力せず、最初のProduction Training Nodeを開いた時点で未設定ならStage共通のEquipment Profileを登録する。Profile確定後、D-031に従ってStage全体のTraining Programを一度だけ編成し、Roadmap上のTraining DayへPlanを割り当てる。Plan未生成・生成失敗時は安全な準備中 / Error表示とし、ClearやDemo fallbackを許可しない。Recovery DayとBossにはTraining Planを表示・生成せず、生成済みDayは保存済みPlanを再利用する。

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

### D-026 Schedule / Roadmap UI Boundary

Production UIはsharedが生成した`durationDays`件のCalendar Dayと、その翌日のBoss Anchorを表示する。Training / Recoveryの配置は`trainingFrequencyPerWeek`から決定論的に得る。Training DayにはMain ExerciseのPrimary Muscle由来のSession Focusだけを表示用に受け渡せるが、Exercise list、sets、reps、weight、Movement PatternはこのRoadmapの出力に含めない。Boss AnchorはStage Targetと同じRequirementを示す境界であり、Boss State / Shield / Defeatedを表すものではない。

日付の変更UIはD-034に従い、現在のDaily Questを未来へ延期する。Current Slotから後ろの各日付とBoss dateを同じカレンダー日数だけずらし、完了済み過去Slotは保持する。Quest Type、Node順・位置、Focus、Boss exposure、Current index、Progress、Training Program / Workout Resultは変わらない。TrainingとRecoveryをswapするUIではない。

### D-027 Quest / Map View Boundary

Production Map UI derives completed / available / locked nodes from `StageRoadmap` plus separate `StageProgress.currentDayIndex`. Its UI-independent read model exposes the current node, completed and locked nodes, Training / Recovery type, Training Session Focus, Boss Anchor, Boss availability, and completed / total counts. It deliberately excludes icons, copy, animation, EXP, Treasure, Boss Battle, and Stage Clear.

The current quest is `roadmap.days[currentDayIndex]`. Calendar date, missed days, time passage, skip, expire, and automatic catch-up do not move it. Boss becomes available only after all daily nodes are clear; availability is not Boss Strength eligibility or Boss Defeated.

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

### D-027 completion interaction boundary

For Training, all planned main and accessory exercises show completion only as derived from valid Workout Results. Recording results only makes the quest ready; the user explicitly clears it to advance one node. When `plannedExerciseId !== performedExerciseId`, the UI supplies the current Equipment Profile and relies on the existing Catalog substitution candidates. Direct performance needs no substitution check. Partial sets and out-of-range reps do not block D-027 clear.

### D-030 on-demand Training Plan UX boundary

- Equipment入力はOnboardingのStepへ追加しない。最初のTraining Nodeを開いた時、Stage共通のEquipment Profileが未設定なら、既存Catalog IDを0件以上選択する。空の選択は「器具なし」として有効であり、Full Gymを初期選択しない。
- Main Exerciseが選択Equipmentで実施不能な場合はPlan生成を停止し、Equipment見直しを促す。Main Exercise変更を選ぶ場合は既存Roadmapを継続せず、OnboardingからRoadmapを再生成する。
- Figma MakeのEquipment Check / generating / error statesをUI意図のSource of Truthとして扱う。Production Reactで別の完成UIを独自設計せず、Figma側のStage Program境界が確定した後に、Mobile-firstの画面構造・Visual・Touch interactionをfaithful portする。
- Training Plan生成中はLoading、失敗時は明示ErrorとUser操作によるRetryを表示する。Demo Plan、固定Plan、silent fallbackは表示しない。D-030の「Training Node初回Open時にそのDayだけ生成」というタイミングはD-031でStage-wide Program生成へ置き換えるが、明示Retry、失敗結果を保存しないこと、Recovery Dayで生成しないことは維持する。

### D-031 Stage-wide Training Program UX boundary

- Equipment Checkは「今日使える器具」の日次選択ではなく、StageのTraining Programに使う利用可能Equipment Profile登録として表示する。初期状態は0件選択で、Full Gymを自動選択しない。「器具なし」は空のEquipment IDとして有効である。
- Equipment Profile確定後に、StageのTraining Day一覧をまとめて編成するLoadingを表示する。文言は「今日のQuest生成」ではなく「このStageのTraining Programを編成中」とする。
- Program生成が失敗した場合は、部分的なPlanやDemo Planを表示せず、Stage Program全体を再生成する明示的な「もう一度試す」操作だけを提示する。
- Program成功後は現在DayのPlanを表示し、別のTraining Dayを開いても新しい生成画面やOpenAI呼び出しを表示しない。`planByDay[dayIndex]`の保存済みPlanを利用する。
- Recovery DayとBoss AnchorにはTraining Plan UIを表示しない。Main ExerciseがEquipmentに適合しない場合は`MAIN_EQUIPMENT_MISSING`相当の状態で停止し、Mainを自動代替しない。

### D-035 Exercise Baseline setup

- Onboardingで記録済みのMain Strength ExerciseにはBaseline設定Panelを表示しない。Main以外のExerciseでBaselineが未設定の場合にだけ、Workout Result入力前に「初回設定」を表示する。
- 通常のExerciseでは「経験あり / 初めて」を選べる。「経験あり」は重量と正の整数repsを空欄から入力し、「初めて」は架空のBaselineを作らず、最初のWorkout Resultから目安を作る旨を表示して進む。
- Push-up、Pull-up、Glute Bridgeではkg自己申告を求めず、「初めて」の案内を基本表示する。Baseline設定後はPanelを隠し、既存のSet記録フォームを維持する。Baseline値をWorkout inputへ自動入力しない。
- Baseline登録はEXP、Quest Clear、Map進行を発生させない。最初の有効Workout ResultからBaselineが取れた場合は記録後にPanelを隠す。

### D-036 Task 4F: Exercise difficulty feedback

- 各ExerciseのSET入力欄の下に「今回の負荷は？」と「任意」を表示し、「きつすぎた」「ちょうどいい」「余裕あり」の3つから選べる。
- 未選択でも記録とQUEST CLEARが可能であることを短く示す。Feedbackだけを先に確定せず、「記録する」とSet実績を一緒に保存する。
- 既存Resultを編集するときはFeedbackを復元し、選択を変更または解除できる。選択中は`aria-pressed`とborder / inset stateで明確にし、色だけに依存しない。
- 375〜430pxのMobile幅で3択とRecord CTAをカード内に収める。FeedbackはResult単位であり、Setごとの欄にはしない。
- Feedback自体は記録専用で、Baseline、Quest Clear条件、EXP / Rewardを変えない。D-036 Task 4Gでは成功Clear時のSuggested Weight / Reps判定にのみ利用する。Session内だけで保持し、Persistenceは追加しない。

### D-036 Task 4G: Suggested Weight / Reps and deterministic progression

- Exercise Cardに「今回の目安」を表示する。Baseline repsが現在Planのrange内ならそのBaseline重量とrange.minを提示し、Baselineなし・range不整合時は重量未設定とrange.minだけを示す。実重量・reps入力へ自動入力しない。
- `targetReps`は単一値で、Plan rangeが変わった場合は新rangeへclampする。実績入力は空欄のまま開始し、ユーザーが目安と異なる値を自由に記録できる。
- 画面はNo Suggestion、Suggestion、Reps Progressed、Weight Up Ready、Load Step適用後を同じProduction画面上で表現する。Figma専用のPreview selectorは追加しない。
- Weighted種目はResultの全planned Setが目標reps以上かつ数値Weight Suggestion以上の場合に限り、一回のClearでrepsを+1する。すべてrep max以上なら、設定済みload stepで一段だけ上げてrange.minへ戻す。刻み未設定なら`WEIGHT UP READY`を表示するが、Result入力・保存・Quest Clearは妨げない。
- Weight Up Ready Panelから有限の正数をExercise単位`loadStepKg`として登録する。確定時に刻みを保存して一段だけ適用し、同じActionの再実行では二重加算しない。初期値・Equipment別推奨刻みは設けない。
- `too_hard`、予定Set不足、target reps不足、どれか一Setでもsuggested weight未満ならSuggestionを維持する。Feedback単独では進行せず、Weight DownやFailure streakは表示・実装しない。
- 数値SuggestionがまだないWeighted種目は、Feedbackが`too_hard`でなく全planned Setがある場合に限り、そのSet群の最小実重量を保守的な基準として次回Suggestionへ利用する。Baselineは変更しない。
- `BODYWEIGHT_EXERCISE_IDS`の種目はreps-onlyで、重量欄・kg目安・Weight Up Panelを表示しない。全planned Set達成時のみrepsを+1し、rep maxで維持する。通常のDifficulty Feedbackは維持する。
- 重量の記録基準はBarbell=バー込み総重量、Dumbbell=1個あたり、Machine / Cable=機械の表示重量。同一種目で基準を統一する。Catalog上曖昧な種目には補助説明を出さない。
- Result save/editではSuggestionを更新しない。最終保存Resultのみを成功したTraining Quest Clearで評価し、Progress / Character Growth / Reward / `sessionsCompleted`と同じin-memory Session transitionで更新する。Baselineは初回固定、RescheduleはStateを維持する。

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

### D-027 recovery interaction boundary

Recovery has no MVP checklist. The user explicitly clears the current Recovery node; a date change or merely opening the screen does not clear it. The D-027 result advances one node only and does not decide EXP, HP, rewards, or overlay behavior.

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

### D-034 Production UI

- Current Training QuestとCurrent Recovery Questに、Primary Clear CTAより控えめな「日程を変更」Secondary Actionを表示する。Boss Anchorには表示しない。
- 操作はMobile-first Bottom Sheet / Modalで行い、「QUESTの日程を変更」、現在日、日付入力、延期内容、進行・Training内容が変わらない旨、「この日付に変更」「キャンセル」を示す。
- 日付入力の最小値はBrowser local todayとCurrent Slot日付の遅い方。Current日付そのものは変更なしなのでConfirmを無効にする。UI制約に加えてshared Domainでも厳格な日付・過去日検証を行う。
- 成功時はSheetを閉じ、同じQuest Slotの表示日だけ更新する。Mapへ戻っても同じNodeがCurrentのまま。追加Toastは表示しない。
- 不正日付は短い日本語Errorで伝える。内部Validation code / field / stackは表示しない。
- 変更Stateは画面離脱・Reload後まで永続化しない。`figma-reference/`に見られるNode swap / 移動先選択 / 以後のAI再計画のPrototype挙動は採用しない。

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

### D-038 / D-039 Production Character and Progress v1

- FigmaのDark Fantasy構成に沿ってCharacter Hero、Main Strength、2列のBody Growth EXP、Current Stage Progress、下部Navigationを表示する。
- Main Strength STARTはMain ExerciseのSession Baseline、CURRENTは最新Clear済みTraining Quest内のMain Exerciseの実記録、TARGETはOnboardingのFinal Goalを使う。CURRENTにProgression SuggestionやStage Targetを使わない。
- 1 Quest内の代表Setは`setNumber`が最大の有効なcompleted setとする。最新Clear済み結果をroadmap day indexの降順で探す。
- EXPは既存CharacterGrowthの5 Training CategoryとRecovery EXPをそのまま使い、0でも全Cardを表示する。
- Stageの完了数は既存`StageProgress.currentDayIndex`、totalは`roadmap.days.length`（Daily Quest Slot数。Boss Anchorは含めない）を使う。Boss remainingはtotalからcompletedを引き、0未満にしない。
- 現行RoadmapにはStage ordinalがないため画面にStage番号を捏造しない。Progress v1はTraining Logとして既存Roadmap / Session stateだけを閲覧表示し、placeholderから置き換える。
- Stageのcompleted / total、Training / Recovery clear count、Boss remainingはCharacterとProgressで共通のPresentation helperを使う。
- Exercise RecordsはMain Strengthを除き、`sessionsCompleted > 0`のExerciseだけを縦Card Listで表示する。CategoryはSharedのD-035 Exercise → EXP Category mappingを使う。
- Exercise Baselineと最新実績はActual data、`nextSuggestion`は別の「次回の目安」として表示する。最新Resultはclear済みTraining Quest内で`performedExerciseId`が一致するResultだけを使い、代表SetはD-038と同じ最大`setNumber`とする。
- Bodyweightはkgを表示せずreps-onlyとする。Weight Up Readyは「重量UPのタイミング」として表示するだけで、loadStep設定UIは置かない。
- Stage Growth Summary、成長率、比較分析、Chart、PR、AI Review、Search / Filter / Sort UIは対象外。
- Sessionがない場合はCharacter presentation helperが空状態（START `—`、CURRENT `記録なし`、EXP 0、進行0）を返す。AppのOnboarding flowではSession作成前にHub Navigationを表示しない。

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

### D-040 Production Boss / Stage Clear screens

- Boss Battle is a focused, mobile-first screen in the current dark-fantasy system; hide Bottom Navigation during Boss Battle and Stage Clear.
- Show the fixed Japanese Main Exercise label, BOSS TARGET e1RM, optional BOSS ADAPTED comparison, and blank actual weight/reps inputs. Validate 1–10 reps and positive weight with Japanese copy.
- Defeat shows the attempted set, calculated e1RM, target and remaining difference, with Retry and MAP actions. The same frozen target is used on every retry.
- Victory shows BOSS DEFEATED / STAGE CLEAR and the actual challenge evidence. Before Final Goal, the primary action creates the next Stage; PROGRESS and MAP remain secondary. At Final Goal, offer reflection and MAP only. No fictional EXP, loot, HP, combat stats, or level-up UI.
- The defeated Boss node remains distinguishable on the Map and opens the Stage Clear summary. The next Stage begins at its first Training node; the retained Equipment Profile is reused and the user explicitly starts Stage Program generation there.

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

## D-041 Onboarding / Equipment resilience UX

- Main Strengthには「現在の重量は分かりますか？」を表示する。分かる場合は既存重量・reps・Final Goal form、分からない場合は体重・経験・Main Exerciseから得た「開始時の目安（推定）」と「約3か月後の目標（自動）」を表示する。日本人平均等の断定をせず、最初の実記録で更新される暫定値だと説明する。
- Character / Progressは`estimated_profile`のSTARTだけを「推定」と表示する。CURRENT / 最新記録はClear済み実Resultだけを使い、置換後は通常の開始時表示へ戻す。
- Equipment Checkは基本器具、追加器具（任意）、自重トレーニングInfoの順に表示する。基本選択数を`n / 2`で示し、Main requiredへBadgeを付け、不足中は日本語説明とdisabled CTAを表示する。
- 自重ExerciseはEquipmentとして選択させない。Pull-upは例外的にbarが必要であることを案内する。375 / 390 / 430pxで長い器具名、Badge、count、CTAが重ならないことをHuman Smokeする。

### D-041追加UX：初回RecommendationとExercise Skip

- Main Strength初回WorkoutでPlan rangeとOnboarding Baselineのrepsが外れる場合も、実測 / `estimated_profile`のBaselineをD-023で換算した数値目安を「今回の目安」に表示する。SET欄は空のまま。stored 4G suggestionがある場合はそちらを表示する。Final GoalやStage Targetは目安に使わない。
- 「初めて」を確定したBaseline未設定Exerciseには「初回おすすめ」を表示する。表示は「開始時の目安です。実際の状態に合わせて調整してください。」のような説明を添え、Baselineや実績と混同させない。Machine / Cableには機種ごとに重量表記が異なる注意書き、Dumbbellには片手1個あたりの表記を添える。
- SuggestionはActual SET入力へ反映せず、初期値は空欄のまま。Bodyweightは重量欄を出さずrep range最小回数のみを示す。Accessory向け体重比RecommendationはBaseline / stored `nextSuggestion`があるExerciseでは表示せず、既存4Gの目安を優先する。Main StrengthのBaseline由来初回hintは上記のMain専用Ruleに従い、stored `nextSuggestion`があればそちらを優先する。
- 各Exercise Cardに控えめな「この種目をスキップ」を置く。選択後は日本語理由4択と誓約チェックを表示し、理由と誓約の両方が揃うまで確認CTAを無効にする。成立後は`SKIPPED`、日本語理由、「スキップを取り消す」を示す。
- Skipは記録・実施と視覚的に区別する。Undo後は通常のResult入力へ戻す。全種目SkipではClear CTAを無効にし、「最低1種目は実施してください。」と案内する。Skipのために数値やWorkout Resultを捏造しない。
- 初回Recommendation、Skip理由選択、誓約、Undo、Main Skip、all-skip blockedを375 / 390 / 430pxでHuman Smokeし、Secondary Actionが主要なWorkout保存・Clear操作を押しのけないことを確認する。

## D-044 Stage Program generation reliability UX

- Program生成中はStage Program全体を1回の処理として表示する。内部Repair attemptはLoading内で行い、Attempt番号やAI error detailsをUIへ出さない。
- Main Equipment不足は既存のMain Equipment Missing stateを使う。特定のTraining Dayで利用可能な候補がない場合は、既存のDark Fantasy / Gold equipment-flow表現に合わせた日本語の器具制約stateを表示し、Equipment Checkへ戻れるようにする。
- 最終的な生成失敗だけに既存の明示Retryを表示する。Retry開始時は古いFailure表示をGenerating stateへ置き換える。失敗したDraft、部分Plan、Demo Planを表示しない。
- Attempt / validation reasonなどの内部情報はDevelopment Server logだけに制限し、Provider本文、stack trace、secretは画面にもlogにも出さない。
