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

**有力方針として検討中の入力**:

- 体重
- トレーニング歴
- 週のトレーニング可能回数
- Main Strength種目
- 現在の重量
- reps
- 食事制約
- アレルギー
- 最終Strength目標

Main Strength種目候補：Bench Press、Squat、Deadlift、Overhead Press、Pull-up / Weighted Pull-up。

**有力方針**: Final Boss目標は、ユーザー入力とアプリ推奨値を併記したうえでユーザーが確定する。達成期限を無理に自己申告させず、週のTraining頻度、現在Strength、Training歴などから達成目安期間を提示する。

**未決定**:

- 初心者の開始重量を決める正式ロジック。
- 推奨Final Goalの算出方法。
- 目安期間算出方法。
- 入力の必須・任意区分と再Onboarding方針。

## Strengthとe1RM

**決定済み**:

- Boss条件にはe1RM（Estimated 1RM）を使う。
- 毎回の実1RM挑戦を要求しない。
- e1RMはAIではなく決定論的なTypeScript ServiceまたはToolで計算する。
- 計算に使った重量、reps、式Versionを追跡可能にする。

**未決定**: 採用する正式なe1RM式、丸め規則、低rep・高rep時の有効範囲、種目別補正。

## Stage

**決定済み**:

- 現在StrengthからFinal Goalまでを複数Stageへ分ける。
- 各Stageの最後にBossを配置する。

**候補**: 約+5kgごとのStage分割。

**未決定**: Stage分割アルゴリズム、Stage所要日数、Stage上限、停滞・後退・目標変更時の扱い。

## Adventure Map / Roadmap

**決定済み**:

- 現実のTraining ScheduleをDark Fantasy RPGのAdventure Mapとして表示する。
- 各Nodeは日付を持つ。
- ユーザーが毎日TrainingかRecoveryかを都度選ぶ設計にはしない。
- Onboarding情報をもとに、SystemまたはAIがTraining / Recoveryを計画する。
- Mapは単なるカレンダー表示にせず、現在地・次の行動・Bossまでの進行が理解できるUIにする。

**未決定**: Stageの期間算出、Training/Recoveryの配置、分岐、Event・Elite・Camp・Treasure NodeのProductionルール。

## Daily Training Quest

**決定済み**:

- Training Dayには複数Exerciseを表示する。
- 各Exerciseは固有IDと個別の完了状態を持つ。
- すべての必須Main Training Exerciseが完了するまでQuest完了Actionを有効にしない。
- NutritionなどのBonus QuestはMain Training Questの必須Clear条件に含めない。
- Quest完了後にEXP、Map進行、必要なReward演出を処理する。

## Exercise substitution

**決定済み**:

- 器具不足などの場合、対象Exerciseだけを代替Exerciseへ変更する。
- 他のExerciseへ影響させない。
- 元Exerciseと代替Exerciseを識別できる状態を保存する。

**未決定**: 候補生成・優先順位・負荷換算・禁忌条件・Exercise Masterの情報源。

## Schedule変更

**決定済み**:

- 予定どおりTrainingできない場合、明日以降の具体的な日付へ移動できる。
- Schedule変更はQuest Clearではない。
- 予定変更だけではEXP付与、Map進行、QUEST CLEAR表示を行わない。
- 必要に応じ、その後のTraining / Recovery Scheduleも再調整する。

**未決定**: 再計画範囲、連続Trainingの制約、過去日の扱い、競合時の優先順位、AI提案と決定論的Validationの境界。

## Recovery

**決定済み**:

- Recovery Dayもゲーム攻略の一部とする。
- 睡眠、Protein、軽い活動などを扱う。
- 正しいRecoveryの完了によってMapを進められる。
- RecoveryによってHPまたはRecovery Gaugeが回復する。

**未決定**: Recovery Main Questの必須条件、HP回復量、睡眠・活動データの入力方法、外部Healthデータ連携。

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

**有力方針**: Character AppearanceをLevel / EXP等に応じて自動成長させる。ただし、連動指標、段階、遷移条件は未決定。

**候補となる表示項目**: Level、Total EXP、Training EXP、Nutrition EXP、Recovery EXP、HP、Status、Play Style / Title、Appearance、Equipment。

**未決定**: EXP値、Level curve、Appearance段階、Status計算、HPルール、Equipment効果。

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
