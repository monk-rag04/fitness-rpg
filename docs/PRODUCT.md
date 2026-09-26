# Product Specification

## 文書の位置づけ

この文書はFitness RPGのProduct要件を定義するSource of Truthです。

記述は次の区分で扱います。

- **決定済み**: ユーザーが明示的に採用したProduct仕様。
- **有力方針**: Productとして目指す方向が示されているが、具体仕様または正式採用が未確定の内容。
- **候補**: 比較・検証対象であり、有力方針より確度が低い内容。
- **未決定**: Product判断が必要な内容。
- **Prototype確認**: `figma-reference/`で確認できる現状。Product仕様の根拠にはしない。

最終更新時に確認したFigma Make Snapshot: `figma-reference/`（2026-09-21確認）。

## Vision

**決定済み**: コンセプトは「現実の自分を鍛えることで攻略するRPG」。

現実世界で行う次の行動をゲーム進行へ変換する。

- 筋力トレーニング
- 食事
- Recovery・睡眠
- Strength向上

変換先となるゲーム要素：

- Daily Quest
- EXP
- Character Growth
- Adventure Map
- Boss Battle
- Stage Progression
- Reward

単なる筋トレ記録アプリ、健康Dashboard、AIチャット、AIパーソナルトレーナーを主役にしない。ユーザーが「次のBossを倒したい」「次のTreasureを取りたい」「Characterを育てたい」と考えた結果、現実の行動を継続する体験を目指す。

## Target

**決定済み**:

- 主対象は18〜30歳程度の筋トレ初心者〜中級者。
- MVPの目的は筋力向上・筋肥大に限定する。
- 筋トレを始めても継続しにくい、記録だけでは楽しめない、身体の成果が見える前に離脱しやすいユーザーを主に想定する。

## Primary Client / MVPの利用形態

**決定済み**:

- Fitness RPGの日常利用におけるPrimary Clientはスマートフォンとする。
- MVP FrontendはReact / TypeScript / ViteによるWeb Clientを維持し、Mobile-firstで設計・実装する。
- DesktopはDevelopment / Preview / Secondary accessとして扱う。完全非対応にはしないが、Desktop DashboardをPrimary UXにしない。
- Production UIはスマートフォンでの片手操作とTouch操作を優先する。

これは「今すぐNative App化する」という決定ではない。PWA、Native packaging、App Store / Google Play配布、Native API、Offline、通知、Health data連携の採用は未決定。詳細は`docs/DECISIONS.md`のD-019を参照する。

## Product原則

**決定済み**:

1. 主人公はユーザー自身である。
2. 日々の行動によってAdventure Mapを進める。
3. 現実のStrength成長によってBossを倒す。
4. TrainingだけでなくRecoveryも攻略行動として扱う。
5. AIは裏側の提案・調整を支え、体験の主役にはしない。
6. ゲーム内Characterの成長と現実の身体情報は関連するが、同一の値として扱わない。
7. 体重はBody Statusであり、Boss撃破条件にはしない。
8. Product上の重要判定は再現可能で説明できる決定論的処理にする。

## Core Game Loop

**決定済み**:

Main progressionはStrengthとする。日々のQuestでMapを進め、現実のStrength向上をBoss攻略へ接続する。

```text
Onboarding
  → Training Roadmap作成
  → 計画されたTraining / Recovery
  → Daily Quest
  → QUEST CLEAR
  → EXP獲得
  → Character Growth
  → Adventure Map進行
  → Boss地点到達
  → ゲーム条件と現実Strength条件を判定
  → BOSS DEFEATED
  → STAGE CLEAR / Reward
  → NEXT STAGE
```

## Onboarding

**D-029で決定済みのMVP入力境界**: 正の有限な体重、直接入力のTraining経験月数（0以上の整数）、週頻度（1〜7の整数）、Boss対象のMain Strength種目、最近実施できた自己申告Setの重量・reps、ユーザーが直接入力するFinal Goalを扱う。Main選択肢は`barbell_bench_press`、`barbell_back_squat`、`barbell_deadlift`、`barbell_overhead_press`。Catalogに残すPull-upはOnboardingでComing later / disabledとし、MVPのBoss Mainには選べない。体重はRoadmap生成に使わず、45〜120kgをProduction上の許容範囲としない。

Baseline Setは正の有限な重量と1〜10回のrepsから既存D-023の`calculateSetE1rm()`で未丸めe1RMを算出し、`onboarding_self_reported`としてWorkout History由来の`currentE1rm`と区別する。重量が分からなければ`baseline_required`とし、体重倍率・Historical PB・0kg・AI推定で埋めずRoadmapを生成しない。初心者のStrength Assessmentは将来機能である。Final GoalはBaseline e1RMより大きい値をユーザーが直接入力し、MVPでは推奨値を表示しない。食事制約・アレルギー入力はMVP Onboardingから外す。

開始操作時にClient/ApplicationがBrowser local calendar dateを`YYYY-MM-DD`として一度取得する。Backend経由のAchievement Duration Estimate、Domainのceiling選択、Roadmap生成と初期Progressへ接続する。D-043によりOnboardingが作るStage 1は14 / 21 / 28日のQuick Start ruleを使い、最初のestimateが28日を超える場合は+2.5kg Targetで一度だけ再Estimateする。Stage 2以降の42日超は従来どおり`stage_replanning_required`とし、clamp・TargetやGoalの自動変更・Demo値fallbackをしない。EquipmentはOnboarding後、最初のTraining Nodeを開いた時点でStage共通Profileとして収集する。Equipment確定後にStage全体のTraining Programを1回の生成操作で編成し、Roadmap上のTraining DayだけへPlanを割り当てる。Recovery DayとBossにはPlanを作らない。生成済みSessionは`planByDay[dayIndex]`へ一括保存し、部分保存しない。Demo Bench Planを実ユーザーRoadmapへ流用しない。

**D-031 Stage-wide Training Program**: 1 Stageを一貫したTraining Programとして扱う。Program生成はOnboarding完了直後ではなく、Equipment Profile確定後の最初のTraining Nodeで行う。AIへはStage Target、Main Exercise、current e1RM、Training経験月数、週頻度、Stage duration、Training Day一覧、各DayのSession Focus、Stage共通Equipmentを文脈として渡すが、AIはWeight、Roadmap配置、Quest Clear、EXP、Boss Stateを決めない。全Training Dayを過不足なく編成し、全SessionのDomain Validationが成功した場合だけAtomicに`planByDay`へ保存する。

**未決定**: 自己申告Baselineの信頼性・修正・永続化、再Onboarding、初心者Strength Assessment、将来のFinal Goal推薦、42日超の再計画Algorithmと画面導線、User timezoneの長期Policy、正式なProduction Equipment収集UI、D-030 / D-031で定めた境界を実装するStage Program endpointの詳細、最終Prompt / Model、Periodization AlgorithmとProduction UI接続。

## Strengthとe1RM

**決定済み**:

- Boss条件にはe1RM（Estimated 1RM）を使う。
- 毎回の実1RM挑戦を要求しない。
- e1RMはAIではなく決定論的なTypeScript ServiceまたはToolで計算する。
- 計算に使った重量、reps、式Versionを追跡可能にする。
- MVPの式はEpley。1回は実施重量そのもの、2〜10回は`weightKg * (1 + reps / 30)`を用いる。内部値は丸めない。
- 11回以上は正常なWorkout記録として扱えるがe1RM対象外。回数が0以下・整数以外、重量が0以下、非有限値は不正記録とする。
- 同一種目のWorkout内では、適格Setの未丸めe1RMの最大値を代表値にする。適格Setがなければ値はない。
- `currentE1rm`は同一種目の直近30×24時間内のWorkout代表値の最大。基準日時からちょうど30日前を含み、対象記録がなければ値なしとする。古いPersonal BestへFallbackしない。
- `historicalBestE1rm`は全期間の適格記録から求め、現在値とは分離する。
- BossのStrength条件は未丸め`currentE1rm >= requiredE1rm`で判定し、MVPでは期間内の1回の適格な到達でよい。撃破済み状態は、その後の現在値の失効・低下で取り消さない。
- MVPのe1RM Boss対象はBarbell Bench Press、Barbell Back Squat、Barbell Deadlift、Barbell Overhead Pressの正式Catalog IDとする。Pull-up / Weighted Pull-upは対象外だがCatalogからは削除しない。
- UI表示の丸めはDomain coreと分離する。式とWindowのRule Versionを追跡可能にする。

**未決定**: 30日Windowの将来調整、Warmup / Working Set分類、RPE / RIR、種目別Formula、Pull-up総負荷計算、自己申告記録の信頼性・修正Policy、UI表示精度の最終Copy、Load / Progressionと`trainingMax`。

## Stage

**決定済み**:

- Training Sessionは1回のWorkout、StageはFinal Strength Goalまでの中間的な進行単位として分離する。Stage TargetはそのStageのBoss Requirementとなる。
- 現在StrengthからFinal Goalまでを複数Stageへ分ける。
- 各Stageの最後にBossを配置する。
- Stage TargetはAIでなく決定論的Domainで計算する。D-025の初期候補は`min(finalGoalE1rmKg, currentE1rmKg + 5)`（`stage-target-fixed-5kg-v1`）。ただし最初のStageでestimateが28日を超え、Final Goalより小さいTargetを作れる場合はD-043により`min(finalGoalE1rmKg, currentE1rmKg + 2.5)`へ一度だけ縮小して再Estimateする。
- `currentE1rmKg`がない場合はHistorical PBや0kgへfallbackせず、baseline requiredとしてStageとDurationのPlanningを開始しない。`currentE1rmKg === finalGoalE1rmKg`はgoal reached、`currentE1rmKg > finalGoalE1rmKg`はgoal reached / goal update requiredであり、Final Goalを自動変更・Stage Targetを引き下げない。
- Boss Requirementのe1RMはStage Target e1RMと同値である。Boss State / Defeated / Shieldは別Domainだが、Roadmapの終端に到達しても`currentE1rm < stageTarget`なら将来Boss Shieldを表示する前提を置く。

**決定済み**: Stage Targetへの到達日数はAIが`estimatedAchievementDays`だけを提案し、Productが決めたRoadmap Duration候補から決定論的に選ぶ。

**未決定**: 42日超時のStage再分割Algorithm、5kg Stepの将来変更、経験別・割合ベースのStage幅、Stage上限、停滞・後退・目標変更時の扱い。

## Adventure Map / Roadmap

**決定済み**:

- 現実のTraining ScheduleをDark Fantasy RPGのAdventure Mapとして表示する。
- 各Nodeは日付を持つ。
- ユーザーが毎日TrainingかRecoveryかを都度選ぶ設計にはしない。
- Onboarding情報をもとに、SystemまたはAIがTraining / Recoveryを計画する。
- Mapは単なるカレンダー表示にせず、現在地・次の行動・Bossまでの進行が理解できるUIにする。
- Roadmap DurationはStage TargetへのChallenge Windowであり、Boss撃破や期間内成長の保証ではない。D-043のStage 1候補は`14 / 21 / 28`日、Stage 2以降は`14 / 21 / 28 / 35 / 42`日。AI estimate以上の最小候補を選ぶceiling ruleを使う。Stage 1の縮小Target estimateも28日を超えた場合は、Targetを維持したまま最大28日のChallenge Windowで開始する。Stage 2以降は42日超をclampせずstage replanning requiredとする。
- AIはStage Target、Duration候補、Boss date、Training / Recovery Node、Quest Clear、EXP、Boss Defeatedを決めない。頻度はDuration推定と将来Scheduleの入力だが、AIが曜日やNodeを選択しない。
- D-026では、D-025で選択済みのDuration、`startDate`、`trainingFrequencyPerWeek`、`mainExerciseId`、Stage Targetから、Duration日数ぶんのTraining / Recovery Calendar Dayと1件のBoss Anchorを決定論的に生成する。DurationはBoss Challengeまでのelapsed calendar daysであり、Boss Anchorは`startDate + durationDays`である。
- D-034の延期後も`startDate`はStageの当初開始日、`durationDays`はAIが当初選んだ基本期間とDaily Quest Slot数を示す。実際のBoss予定日は`roadmap.boss.date`、各Daily Slotの日付は`roadmap.days[].date`を参照する。
- Schedule Generatorの頻度は構造上`1..7`の正整数とする。各相対7日blockでは`floor(i * 7 / frequency)`のoffsetをTraining、その他をRecoveryにする。Duration候補はすべて7の倍数のため、全期間のTraining数はfrequency × week数となる。
- Training DayのSession FocusはMain ExerciseのCatalog `primaryMuscles`のみとし、`targetMovementPatterns`はMVPで設定しない。Exercise選択、sets、reps、weight、Full Body / Upper-Lower / PPLは含めない。
- D-034のSchedule ChangeはCurrent Quest Slotの日付を未来へ延期し、そのSlot以降の全Daily SlotとBoss dateを同じカレンダー日数だけ後ろへずらす。完了済み過去Slotは変えず、Training / Recovery種別、Slot順、Stage Target、Main Strength、進行、Plan、Workout Resultは維持する。TrainingとRecoveryの入替えは行わない。
- D-027ではRoadmap自体をQuest Clearで変更しない。別の`StageProgress.currentDayIndex`だけを進行Stateとし、`index < currentDayIndex`をcompleted、`===`をavailable、`>`をlockedとして導出する。`currentDayIndex === days.length`のときだけBoss Anchorがavailableになる。日付・missed day・Schedule Change・Workout Result記録・OpenAI・e1RM更新は進行させない。
- Boss availabilityはRoadmap終端への到達だけを表す。Boss Strength判定、Shield、Challenge、Defeated、Stage Clear、Rewardは含めない。Boss Requirementは既存のStage Targetを後続Domainが参照する。

**未決定**: 42日超時の再計画Algorithm・UX、Full Body / Upper-Lower / PPL、Main Exercise fatigue constraint、Recovery Quest内容、Schedule Changeの永続化・履歴、分岐、Event・Elite・Camp・Treasure NodeのProductionルール、timezone、Onboarding self-reportの永続化・修正、AI推定の再試行Policy。

## Daily Training Quest

**決定済み**:

- Training Dayには複数Exerciseを表示する。
- 各Exerciseは固有IDと個別の完了状態を持つ。
- すべての必須Main Training Exerciseが完了するまでQuest完了Actionを有効にしない。
- NutritionなどのBonus QuestはMain Training Questの必須Clear条件に含めない。
- Quest完了後にEXP、Map進行、必要なReward演出を処理する。

All planned `main` / `accessory` Exercises are required for a D-027 Training Clear. Each must have exactly one valid Workout Result with at least one completed set and a matching plan snapshot. Partial sets and reps outside the planned range remain valid completion evidence. The result-derived exercise display is not stored as a checkbox; a user must explicitly Clear the ready quest to advance exactly one node. Old-day retries return `already_completed`; future-day attempts return `not_current_quest`.

## Workout Result

**決定済み（D-024）**:

- MVPではTraining Planが`exerciseId`、role、sets、rep rangeを提示し、AIやSystemがTraining Weightを自動決定しない。
- Weighted Exerciseでは各Setに正の有限`weightKg`と正の整数`reps`を記録する。`BODYWEIGHT_EXERCISE_IDS`の種目はreps-onlyであり、重量Fieldを受け付けない。Strength Historyがない種目へ根拠のない初期重量を生成しない。
- D-035 4Eでは、ExerciseごとのStage開始時BaselineをSession内で保持する。Main StrengthはOnboardingの実記録を使い、その他の種目は任意の自己申告または最初の有効Workout Resultから取得する。架空の初期重量は作らない。
- Workout Resultは予定Exercise IDと実施Exercise IDを別に保持する。代替Exerciseの実績は実施したExerciseの履歴・e1RM根拠となり、元Exerciseのe1RMや重量履歴を自動移管しない。
- rep range未達・超過や予定Set数未達は、それ自体を不正なWorkout Recordにしない。Quest Clearと将来のProgressionは、それぞれ別のDomainで判断する。
- Weighted ExerciseのWorkout ResultはD-023に従ってe1RM計算の根拠になり得る。11回以上のSetも記録できるが、e1RM対象外である。Bodyweight v1はe1RMを計算せず、Baselineにも重量を作らない。
- D-036 Task 4Fでは、Exercise単位のWorkout Resultへ`difficultyFeedback`（`too_hard` / `just_right` / `easy`）を任意で含められる。Set単位ではなくResultと一緒に保存し、編集時はResult全体を置換する。未選択でも記録・Quest Clearできる。
- Baselineは初回固定し、以後のWorkout Resultで更新しない。Exerciseの完了Session数は、そのExerciseを実施したTraining QuestのClear成功時だけ1増やす。Baseline登録やResult保存ではEXP・Rewardを付けない。
- Difficulty FeedbackはWorkout Resultと一緒に保存する。D-036 Task 4Gでは`too_hard`だけがProgressionを拒否するVetoであり、未選択は中立、`just_right` / `easy`もActual Set条件を満たさない限り単独では進行させない。
- `exercise-progression-v1`はBaselineまたは保守的な実測重量を初期基準に、現在Planのrep range内でrepsを一回ずつ進める。全planned Set達成後のProgressionは明示的Training Quest Clear成功時だけ、Map / Growth / Reward / `sessionsCompleted`と同じSession transitionに適用する。Result保存・編集、Recovery Clear、Rescheduleでは更新しない。
- Suggested Weight / Repsは画面上の目安であり、actual入力へ自動入力しない。Weight Upは全planned Setがsuggested weight以上かつrep maxを達成した場合だけ候補となる。器具刻み`loadStepKg`はユーザーがExerciseごとに任意設定し、未設定なら`weight_up_ready`で止める。固定刻み、automatic Weight Down、失敗連続数は導入しない。
- `BODYWEIGHT_EXERCISE_IDS`の種目はreps-onlyで、追加重量、kg Suggestion、load step、e1RM、kg Baselineを持たない。repsだけを+1し、rep maxで維持する。
- 重量記録はBarbellがバーを含む総重量、Dumbbellが1個あたり、Machine / Cableが機械の表示重量。同じExerciseでは同じ基準で記録する。分類が曖昧な種目には説明を表示しない。
- Suggested Weight / Reps、Feedback、loadStep、Progressionは既存Adventure Session内だけに置き、DB / localStorage等へ永続化しない。Progression計算にAIを使わない。

**未決定**: RPE / RIR、Workout Result / Quest Clearの保存・取消・複数Session集約Policy、自己申告Onboarding Recordの永続化方法、Baseline修正Policy。

## Exercise substitution

**決定済み**:

- 器具不足などの場合、対象Exerciseだけを代替Exerciseへ変更する。
- 他のExerciseへ影響させない。
- 元Exerciseと代替Exerciseを識別できる状態を保存する。

**未決定**: 候補生成・優先順位・負荷換算・禁忌条件・Exercise Masterの情報源。

## Schedule変更

**決定済み**:

- D-034ではCurrent Training / Recovery Quest Slotを未来の日付へ延期できる。
- Schedule変更はQuest Clearではない。
- 予定変更だけではEXP付与、Map進行、QUEST CLEAR表示を行わない。
- `dayIndex`がSlot identityであり、Calendar dateだけを変更する。Current以降のSlotとBoss dateを同じ正の日数だけ延期し、完了済み過去Slotを保持する。`startDate`と基本期間 / Slot数を表す`durationDays`は維持し、実際のBoss予定日は`roadmap.boss.date`とする。
- Training / Recoveryのswap、Nodeの移動・追加・削除・並べ替えは行わない。Training種別、Session Focus、Boss Main Exposure、`planByDay[dayIndex]`、Workout Result、Equipment、Stage Program context、`currentDayIndex`とProgressは変えない。延期は再生成やOpenAI呼び出しを起こさない。
- 同じ日付は変更なしとして扱う。選択日がBrowser local todayまたはCurrent Slot日付より前なら拒否する。未来日の上限は設けない。日付の判定はdate-onlyカレンダー計算を用いる。
- Runtime状態は現在React Adventure Session内だけで更新し、DB / localStorage / 変更履歴は追加しない。

**未決定**: Scheduleの永続化・変更履歴、連続Trainingの追加制約、AI提案、timezoneを越える長期日付Policy。

## Recovery

**決定済み**:

- Recovery Dayもゲーム攻略の一部とする。
- 睡眠、Protein、軽い活動などを扱う。
- 正しいRecoveryの完了によってMapを進められる。
- RecoveryによってHPまたはRecovery Gaugeが回復する。

**未決定**: Recoveryの将来Checklist、HP回復量、睡眠・活動データの入力方法、外部Healthデータ連携。

D-027 Recovery is also explicit: the user clears the current Recovery node without an MVP checklist. Calendar passage does not clear it. This operation advances exactly one node and does not define EXP, HP, or rewards.

## Beginner Quest

**有力方針**:

- 初心者向けに、部位または代表Exerciseの初回へBeginner Questを表示する。
- MVPではText / Imageを中心にする。
- 動画とAIフォーム判定は将来機能とする。

**未決定**: 自動発生条件、再表示、修了判定、コンテンツ監修・情報源。

## Character / EXP / HP

**決定済み**:

- Character GrowthはCore Game Loopに含める。
- Characterは現実の身体そのものではなく、別のゲーム内表現として扱う。
- 手動の「標準 / 鍛錬後」切替はProduction仕様ではない。
- D-035では、5つのTraining EXP（chest / back / shoulders / arms / legs）と独立したRecovery EXPを、明示的なQuest Clear成功時に累積する。Exerciseごとの主Category、1 planned setあたり5 EXP、Recovery Clearあたり10 EXPをversion付きDomain Ruleとして扱う。
- Progress、Character Growth、実際に適用したReward Summaryは、1つのQuest completion state transitionで同時に確定する。Workout Result保存・編集だけではEXPを付与しない。
- D-035 MVPのCharacter Growthは累積EXPのみで、Level化しない。値は現在のReact Adventure Session内に限り、永続化しない。

**D-038 / D-039 Character・PROGRESS v1で決定済み**: CharacterとPROGRESSは既存Adventure SessionのMain Strength Baseline、Clear済みTraining Questの実Workout Result、Onboardingで確定したMain Strength Final Goal、Exercise Suggestion、Training / Recovery EXP、Roadmap進行を表示する。Actual recordと次回Suggestionを明確に分ける。Exercise RecordsはMain Strength以外の`sessionsCompleted > 0`のみを扱い、Bodyweightはreps-onlyで表示する。PROGRESS v1は既存実績とSuggestionの閲覧画面であり、Stage Growth Analysisではない。Level / HP等の未実装Status、Chart、Persistenceは追加しない。

**有力方針**: Character AppearanceをLevel / EXP等に応じて自動成長させる。ただし、連動指標、段階、遷移条件は未決定。

**候補となる表示項目**: Level、Total EXP、Training EXP、Nutrition EXP、Recovery EXP、HP、Status、Play Style / Title、Appearance、Equipment。

**未決定**: Level curve、Appearance段階、Status計算、HPルール、Equipment効果。EXPの将来のCategory配分変更や複数部位への比率配分も未決定。

## Play Style

**有力方針**:

- Training / Nutrition / RecoveryのバランスからTitleまたはBuildを表示する。
- 否定的な採点ではなく、現在のPlay Styleとしてゲーム的に表現する。

例：脳筋戦士、計画型アスリート、食事を忘れた戦士、力こそパワー。

**未決定**: 評価期間、判定ロジック、Title更新頻度、表現レビュー基準。

## Support Stats

**有力方針**:

- Main Strength以外の種目も追跡する。
- 数週間のTrendからMainとSupportの偏りを評価する。
- 将来的にBoss ShieldやSide Questへ連動させる構想を持つ。

**未決定**: 評価期間、閾値、対象Exercise、Boss Shieldへの正式な影響。

## Boss / Stage Clear

### D-040 Production v1

- Boss availability is the existing `currentDayIndex === roadmap.days.length` boundary. It is separate from Daily Quest completion and has no Training Plan.
- At the final Daily Quest Clear, freeze a versioned Boss target from `roadmap.stageTargetE1rmKg`. Only actual Main Exercise sets in cleared Training Quest results qualify; use D-023 e1RM and `min(finalGoal, max(stageTarget, bestActualMainE1rm * 1.03))`. With no eligible actual set, use the Stage target unchanged. Baselines, suggestions, skipped or uncleared results are excluded.
- Boss Challenge is one fixed Main Exercise, positive `weightKg`, integer `reps` from 1 through 10, and the existing D-023 e1RM calculation. `e1RM >= frozen target` wins, including exact equality. A defeat leaves Boss undefeated and retryable. A victory is idempotent and does not advance Daily Quest progress, grant EXP/rewards, or create a Workout Result / Baseline / progression update.
- Stage Clear is the Boss victory state. It adds no fictional reward or combat statistics. When the winning attempt meets the Final Goal, no further Stage is generated. Otherwise the explicit Next Stage action uses `max(best cleared actual Main e1RM, winning Boss attempt e1RM)` as D-025 planning strength; D-025 still selects the next target and the confirmed Final Goal remains the cap.
- Starting a subsequent Stage increments its number, creates a new Roadmap, resets only current Stage progress/Boss/plan/result/skip state, and retains profile/context, equipment, Character Growth, Exercise progression and an archive of completed Stage actual results. Stage 2 reuses the retained Equipment Profile; its first Training node exposes an explicit Stage Program generation action and does not reopen Equipment Check.
- The existing achievement-duration and Stage Training Program endpoints are called only after their explicit user actions. No Boss-specific provider call, reward rule, persistence, or dependency is added.
- This D-040 v1 behavior resolves the earlier open Boss retry/validation/defeat details for this flow: reaching the final Daily Quest is the only Map gate, and the e1RM challenge above is the full v1 game condition.

**決定済み**:

Boss挑戦には基本的に次の三条件を用いる。

1. MapでBoss地点へ到達している。
2. 必要なゲーム条件を満たしている。
3. 現実Strength条件を満たしている。

Strength不足時は`BOSS SHIELD ACTIVE`等の演出を使う。撃破後は、BOSS DEFEATED、STAGE CLEAR、Reward、NEXT STAGEの順で進行する。

根拠：以前共有されたProduct仕様で、Boss撃破条件をこの三条件「とする」と明示している。各条件の詳細は未決定のままとする。

**未決定**: 「必要なゲーム条件」の内訳、Boss Shield詳細、Strength記録の確定手順、再挑戦・失敗・不正入力の扱い。

## Nutrition

**有力方針**:

- NutritionをGame Progressへ組み込む。
- Protein目標達成等をNutrition EXPへ変換する。
- 食事自由度が低いユーザーへ完全なCalories管理を強制せず、Protein一品追加や朝食改善等の柔軟なQuestを提示する。
- アレルギーは除外条件として扱う。

**未決定**: MVPに含めるNutrition範囲、EXPとの対応、MealAI再利用範囲、栄養情報の監修方法。

## Progress / Reward

**有力方針**:

- Main Strength・e1RM・Body Weight・Support Stats・Boss撃破履歴・Quest継続を振り返れるようにする。
- Personal Record、Level Up、Boss Defeated、Streakを重要な達成として見せる。
- Reward / Treasureはゲーム内無料Rewardであり、課金ガチャとして扱わない。

**未決定**: Treasure効果、Drop条件・確率、Inventory上限、Reward重複、Streakの定義。

## MVP境界

**決定済み**: 筋力向上・筋肥大を中心にする。

**MVP候補の中核Vertical Slice**:

1. Onboarding
2. Main Strengthとe1RM
3. Training / Recovery Roadmap
4. Exercise単位のDaily Quest
5. Quest Clear、EXP、Map進行
6. Boss到達とStrength条件判定
7. Stage Clear

Nutrition詳細、Treasure効果、Support Stats連動、Authentication、Databaseの正式構成を含む最終MVP範囲は未決定。

## Non-goals / 将来機能

- 医療診断・治療判断
- AIによる自動フォーム判定（MVP外）
- 動画中心のBeginner教材（MVP外）
- 毎回の実1RM挑戦の強制
- AIチャットを中心にした体験
- 課金ガチャ

## Product成功の確認方法

定量KPIは未決定。少なくともユーザーテストでは次を確認する。

- Training / RecoveryとMap進行の関係を説明なしで理解できるか。
- Boss撃破に現実のStrengthが必要だと理解できるか。
- Schedule変更とQuest Clearを混同しないか。
- 次のQuest・Boss・Rewardが継続動機として機能するか。
- AIが主役ではなく、体験を支える存在に見えるか。
### D-032 Stage Training Program balance

The onboarding-selected Main Strength Exercise remains the Stage `bossMainExercise` and the Stage Target/e1RM metric. It is not the session primary on every Training Day. Production Stage Programs use a deterministic frequency-based split (Full Body, Upper/Lower, Push/Pull/Legs variants) derived from the existing Catalog Muscle Group and Movement Pattern taxonomies; calendar weekdays do not select the split.

Each Training Day carries a typed `sessionFocus` and `bossMainExposure` flag. Exposure Days include the Boss Main exactly once as `role: 'main'`; non-exposure Days exclude it and select exactly one focus-compatible candidate as the session main. Every session still has exactly one main, all candidates remain server-built, and the existing guardrails and atomic `planByDay` cache remain in force. Recovery and Boss nodes receive no Training Plan.

This D-032 section supersedes the earlier D-026 prototype-level statement that every Day reused the Main Exercise's primary-muscle focus and omitted movement patterns.

### D-041 Onboarding / Equipment resilience

Main Strengthの最初のTraining Questでは、保存済み4G progression hintがない場合、Onboarding実測または`estimated_profile`のBaselineからD-023 e1RMを計算し、Planの最低repsへ換算した数値目安を表示する。これは実測/推定BaselineやFinal Goal / Stage Targetを変更せず、SET入力にも反映しない。成功Clear後は通常の実Workout Result由来Baselineと4G suggestionを使う。

Main Strength入力は「分かる」と「分からない」に分岐する。分かるFlowはD-029の自己申告Setと手入力Final Goalを維持する。分からないFlowは体重、Training経験月数、Boss対象Main Exerciseから`main-strength-estimate-v1`で暫定e1RM、5-rep working set、84日後の自動Final Goalを決定論的に作る。Exercise係数はBench 0.55、Squat 0.75、Deadlift 0.90、OHP 0.35。経験月数で開始値とGoal成長率を補正し、Goalは暫定Baselineより最低2.5kg高くする。この節は、重量不明なら常に`baseline_required`として停止するD-029記述を、分からないFlowに限って置き換える。

暫定Baselineは`estimated_profile`として実測値と区別する。Main Strengthの最初の有効なTraining Quest Clear時だけ、保存済み実Workout Result由来Baselineへ置換し、その後は既存の初回固定Ruleを適用する。Character / ProgressのSTARTは置換前だけ推定表示とし、CURRENT / 最新記録には使用しない。

D-043はunknown Flowだけの42日fallbackを置き換える。Stage 1ではknown / `estimated_profile`を同じQuick Start planningに通し、最初のestimateが28日を超えた場合はFinal Goal cap付きの+2.5kg Targetを最大1回だけ再Estimateする。再Estimateも28日超なら28日Challenge Windowで開始する。Stage 2以降は既存42日候補と42日超時の`stage_replanning_required`を維持する。

Equipment Checkは16 Equipmentを基本8件と追加8件へ分ける。CTA条件は基本器具2件以上かつMain Exerciseの必要器具を満たすこと。追加器具は0件でよく、自重は選択項目ではなく常時候補となる。`pull_up`はBodyweightだが`pullup_bar`必須であり、No Equipmentとは区別する。器具なしfallback用にClose-grip Push-up、Reverse Snow Angel、Pike Push-up、Bodyweight Squat、Reverse Lunge、Bodyweight Calf RaiseをCatalogへ加え、既存Push-up / Glute Bridgeと共にreps-onlyで扱う。

**D-041追加決定**: 明示的にExerciseを「初めて」と選んだ場合、初回Workoutだけに版付きの保守的Recommendationを表示できる。これはBaseline / Actual Result / Progress Recordではなく、SET入力にも自動入力しない。Weighted Exerciseは体重、Training経験月数、Exercise ID別比率、予定rep rangeのminから目安を計算し、Bodyweight Exerciseはrepsのみを表示する。実際の記録は有効Resultとして保存され、成功したQuest Clear時だけBaseline / sessions / progressionが更新される。既存BaselineまたはD-036 `nextSuggestion`があればそちらを優先する。

**D-041追加決定**: Training QuestのPlanned Exerciseは理由と「他の種目で挽回する」誓約付きで個別Skipできる。すべてのPlanned Exerciseが有効な実Resultまたは有効Skipで満たされ、かつ1種目以上が実施済みの場合だけClearできる。全Skipは不可。SkipはWorkout Resultではなく、EXP・Baseline・Progression・sessions・Actual Recordを生成しない。Main StrengthもSkip可能であり、他の種目を1つ以上実施すれば通常どおりQuestをClearできる。理由は器具 unavailable、時間不足、コンディション、その他の4種。Clear前はResultとSkipを切り替えられる。
