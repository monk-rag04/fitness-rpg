# Decisions

## How to use this document

この文書は、確定したProduct / Architecture Decision、候補、未決定事項、Prototype専用事項を分離する。

Status:

- **Accepted**: 現在のSource of Truth。
- **Proposed / 有力方針**: 目指す方向として有力だが、正式採用または具体仕様が未確定。
- **Candidate / 候補**: 比較・検証対象。Proposedより確度が低い。
- **Open**: 未決定。
- **Prototype only**: Figma Makeの確認用で、Production Decisionではない。
- **Superseded**: 後続Decisionで置き換え済み。

## Accepted Decisions

### D-001: Productは現実連動型Fitness RPG

- Status: Accepted
- Decision: 現実のTraining、Nutrition、Recovery、Strength成長をQuest、EXP、Character、Map、Boss、Stage、Rewardへ変換する。
- Consequence: 健康Dashboardや記録一覧ではなく、攻略動機を中心にUXを設計する。

### D-002: TargetとMVP目的

- Status: Accepted
- Decision: 主対象は18〜30歳程度の筋トレ初心者〜中級者。MVPは筋力向上・筋肥大に集中する。
- Consequence: 他競技、減量専用、医療・Rehab等を初期Scopeへ広げない。

### D-003: 二層のCore Loop

- Status: Accepted
- Decision: Main progressionはStrengthとする。日々の行動でMapを進め、現実のStrength成長でBossを倒す。
- Consequence: Quest完了だけでBossを自動撃破せず、Map進行とStrength条件を分離する。

### D-004: Boss判定にe1RMを利用

- Status: Accepted
- Decision: 実1RMの毎回挑戦ではなくe1RMを利用し、AIではなく決定論的TypeScript Service / Toolで計算する。
- Consequence: 正式な式、丸め、Record採用Ruleは別Decisionとして必要。

### D-005: Training / Recoveryは計画側が決める

- Status: Accepted
- Decision: ユーザーが毎日Training / Recoveryを任意選択せず、Onboarding情報をもとにSystemまたはAI-assisted Plannerが計画する。
- Consequence: AI案を採用する場合も日付・頻度・Recovery制約を決定論的にValidationする。

### D-006: Exercise単位のMain Quest完了

- Status: Accepted
- Decision: Training QuestはExerciseごとに固有IDと完了状態を持ち、全Required Exercise完了前にQuest Clearしない。
- Consequence: Nutrition等のBonus QuestはMain Training Clearの必須条件に含めない。

### D-007: Schedule変更はQuest Clearではない

- Status: Accepted
- Decision: Schedule変更だけではEXP、Map進行、QUEST CLEARを発生させない。
- Consequence: Schedule changeとQuest completionを別Use Case / Dataとして扱う。

### D-008: AIと決定論的処理を分離

- Status: Accepted
- Decision: e1RM、EXP、Level、Boss、Quest完了、日付、Stage、Validation、保存、SecurityはAIへ任せない。AI機能を採用する場合、そのOutputは権威ある判定ではなく提案として扱う。
- Consequence: Plan、Alternative、Progress解釈、Meal、Flavor text等は`docs/AI.md`の候補であり、機能ごとに採用判断とSchema / Domain ruleによる検証が必要。

### D-009: OpenAI APIはBackend経由

- Status: Accepted
- Decision: OpenAI APIを使用し、Browserから直接呼ばずBackend経由にする。
- Consequence: API keyをFrontendへ置かず、`.env`をcommitしない。
- Not decided here: Responses API、使用Model、`AiProvider` abstraction、`OpenAIProvider`、Tool設計。

### D-010: 基本Technology

- Status: Accepted
- Decision: FrontendはReact / TypeScript / Vite。BackendはNode.js / Express / TypeScript。
- Rationale: 以前共有されたProduct仕様の`DECISIONS.md`要件で、両構成が明示的に「決定済み」と指定された。
- Consequence: Zod、Tailwind CSS、Database、Authは別途正式採用が必要。

### D-011: FigmaとSource of Truth

- Status: Accepted
- Decision: `figma-reference/`はFigma Makeの現状確認用Snapshotであり、Production codeではなくGit管理しない。Product / Architectureはルート`docs/`、実装開始後の動作はProduction codeとtestを正とする。
- Consequence: FigmaのDummy Data・仮ロジック・Demo ToggleをProductionへコピーしない。差分は`docs/UX.md`へ記録する。

### D-012: Visual Direction

- Status: Accepted
- Decision: Modern Dark Fantasy RPG。Black / Charcoal / Deep NavyをBase、Antique / Warm GoldとMagical BlueをAccentとする。日本語で説明・操作し、RPG Keyword / 演出にEnglishを使う。
- Consequence: 健康Dashboard風、情報過多、AI chat中心の見せ方を避ける。

### D-013: Boss Gateの基本条件

- Status: Accepted
- Decision: Boss挑戦には、MapでBoss地点へ到達、必要なゲーム条件を達成、現実Strength条件を達成、の三条件を基本として用いる。
- Rationale: 以前共有されたProduct仕様でBoss撃破条件をこの三条件「とする」と明示している。
- Consequence: ゲーム条件の内訳、Boss Shield、記録確定、失敗・再挑戦は別Decisionが必要。

### D-014: Branch運用

- Status: Accepted
- Decision: `main`を常に動作可能に保ち、`develop`は使わない。`feature/*`、`fix/*`、`setup/*`で作業し、確認前に`main`へmergeしない。
- Consequence: 大きな変更は小さなReview可能単位へ分ける。

### D-015: MealAIは選択的に再利用

- Status: Accepted
- Decision: Structured Output、Provider / AgentTool abstraction、Backend Tool execution等、有効な設計だけを評価して再利用する。CodeやArchitectureを無条件にコピーしない。
- Consequence: Gemini固有実装を持ち込まず、Fitness RPGのOpenAI方針とDomainへ適合させる。

### D-016: Production FoundationのWorkspace構成

- Status: Accepted
- Decision: npm workspacesを採用し、Production codeを`client/`、`server/`、`shared/`へ分離する。`shared/`は将来のFrontend / Backend共有型用とし、FoundationではDomain Modelを実装しない。
- Rationale: `setup/app-foundation`でユーザーがDirectory構成とnpm workspaces採用を明示した。
- Consequence: Root scriptsから各Workspaceを実行し、Figma Snapshotや未決定技術をProduction依存へ含めない。

### D-017: Exercise / Equipment Catalog Domain

- Status: Accepted
- Decision: Equipment MasterとExercise Masterを分離し、`shared/src/domain/training/`で安定したIDにより管理する。ExerciseはPrimary / Secondary Muscle、Movement Pattern、Difficulty、必要Equipmentの選択肢、Alternative Exercise IDを持つ。Gym Equipment Profileは利用可能な`equipmentId`を保持する。
- Decision: Training PlannerやExercise substitutionへAIを将来採用する場合も、BackendがCatalogを決定論的にFilterした後、候補`exerciseId`だけをAIへ渡す。AIによる自由なExercise名生成やCatalog外IDの確定を許可しない。
- Decision: Substitutionは同じCatalogを使い、明示的Alternative、Muscle、Movement Pattern、利用可能Equipmentを満たす候補から対象Exerciseだけを変更する。
- Scope: MVPでは主要Equipmentと代表Exerciseから開始し、Item追加で拡張できる構造にする。全世界のExercise、メーカー固有名、Gym固有Machineは対象外。
- Rationale: `feature/exercise-catalog-foundation`でユーザーがCatalog境界、Metadata、決定論的Filter、AI候補制限を明示した。
- Consequence: Exercise情報の正式な情報源・監修、Catalog Versioning、Persistence、AI選択ロジック、sets / reps / weightは別Decisionが必要。

### D-018: Training Planner Candidate Boundary

- Status: Accepted
- Decision: AI Training Plannerへ渡す前に、`shared/`の決定論的Candidate BuilderでExercise CatalogをMuscle、Movement Pattern、Difficulty、Gym Equipment Profileにより絞る。AIへ全Catalogを渡さず、Builderが返したCatalog由来候補だけを選択可能にする。
- Decision: Main Exercise指定時はCatalog所属とEquipment適合を検証し、有効なら他候補と分離して結果へ保持する。不明なIDまたは実施不可能なMain Exerciseは無視せず、呼び出し側が識別できるErrorにする。
- Decision: Planner候補には`exerciseId`、表示名、Primary / Secondary Muscle、Movement Pattern、Difficultyを含める。
- Rationale: `feature/training-planner-boundary`で、将来のAIがExercise名やCatalog外IDを自由生成・確定しないための安全な入力境界をユーザーが明示した。
- Consequence: AI応答は将来Backendで候補ID所属を再検証する。AI Provider、Model、Prompt、Structured Output、候補件数・順序、Training Planアルゴリズム、sets / reps / weightは未決定・未実装のままとする。

## Proposed / 有力方針

| ID | Topic | Proposal | 決定に必要な確認 |
|---|---|---|---|
| P-001 | Stage幅 | 約+5kgごと | 種目、初心者、Goal差、停滞時のUX |
| P-002 | OpenAI API style | Responses API | 必要機能、SDK、Tool / Structured Output要件 |
| P-003 | AI boundary | `AiProvider` abstractionと`OpenAIProvider` | MVPで抽象化する価値、Interface粒度、Test方針 |
| P-004 | Character Appearance | Level / EXP等に応じた自動成長 | 連動指標、段階、遷移条件、Asset運用 |
| P-005 | MVP Vertical Slice | Onboarding → Roadmap → Quest → Clear → Map → Boss gate | Hackathon時間、Demo Scenario |

Proposedを実装しただけでAcceptedへ変更しない。採用理由、代替案、影響を記録してStatusを更新する。

## Candidate / 候補

| ID | Topic | Candidate | 決定に必要な確認 |
|---|---|---|---|
| C-001 | Validation library | Zod | API契約、Frontend共有、Bundle、代替比較 |
| C-002 | Styling | Tailwind CSS | Design System、Bundle、Team習熟度 |
| C-003 | Database | Supabase PostgreSQL | MVP persistence、RLS、Migration、運用負荷 |
| C-004 | Authentication | Supabase Auth | HackathonでMulti-user / Cloud保存が必要か |
| C-005 | AI Development | MockProvider | Fixture、Failure test、実API Cost |

## Open Decisions

### Product / Game rules

- Stage分割アルゴリズム。
- Stage所要日数算出。
- 初心者開始重量の正式ロジック。
- e1RM式、丸め、Record採用Rule。
- 推奨Final Goalと達成目安期間。
- EXP値とCategory配分。
- Level curve。
- Character成長段階と自動遷移条件。
- HP / Recovery Gaugeの意味と回復量。
- Support Statsの評価期間・閾値・対象。
- Boss Shieldの条件とSupport Stats連動。
- Bossのゲーム条件、Battle失敗・再挑戦。
- Treasureの効果、獲得条件、確率、重複。
- Streakの定義。
- Recovery Questの必須Clear条件。
- Beginner Questの発生・修了条件と監修。
- Exercise Masterの情報源、監修、Catalog Versioningと更新運用。
- Training PlannerとSchedule再計画の詳細。
- Nutrition / MealAIのMVP範囲。
- 最終MVP範囲。

### Architecture / Operations

- Responses APIの正式採用。
- `AiProvider` / `OpenAIProvider`の正式採用とInterface粒度。
- Zodの正式採用。
- Tailwind CSS正式採用。
- Supabase PostgreSQL正式採用。
- AuthenticationのMVP採用。
- API contract、Persistence開始時期、Migration。
- Hosting / Deployment。
- Timezone、Offline、Sync。
- Logging / Monitoring / Data retention。
- OpenAI Model、Prompt、Tool、Cost / Retry Policy。

## Figma Prototype-only Logic

次は`figma-reference/`で実際に確認したが、Productionへ採用していない。

| 領域 | Prototypeの仮ルール | 扱い |
|---|---|---|
| e1RM | Epley式 `round(weight * (1 + reps / 30))` | 正式式はOpen |
| Beginner weight | Bench 0.30×BW、Squat 0.50、Deadlift 0.60、OHP 0.20、5 reps | 正式ロジックはOpen |
| Pull-up beginner | `round(BW * 0.65)`をCurrent e1RM相当として表示 | Productionへ採用しない |
| Recommended Goal | Currentの114%〜121% | 正式推奨RuleはOpen |
| Goal編集 | 1kg単位で上下 | UI / 単位はOpen |
| Stage数 | `ceil((target-current)/5)` | +5kg案はProposed |
| Stage target | Current + Stage×5kg、Goalでcap | 正式RuleはOpen |
| Sessions / Stage | 週1〜2回なら7、週3〜4回なら8、週5回以上なら6 Session | 正式RuleはOpen |
| Stage日数 | 算出日数に最も近い14/21/28/35/42日 | 正式RuleはOpen |
| Roadmap開始日 | 2026-09-22固定 | ProductionではUser timezone / Start dateが必要 |
| Training配置 | 週Frequencyをfloor計算で均等配置 | Planner詳細はOpen |
| Quest EXP | Training day: 100/20、Recovery day: 20/90 | EXP値はOpen |
| Nutrition EXP | Nutrition Bonusが1件でもDoneなら60、未Doneでも40 | Productionへ採用しない |
| Level | 1 Level = 1000 EXP固定 | Level curveはOpen |
| Recovery HP | Quest完了で+55、Character Buttonで即100 | HP RuleはOpen |
| Quest Treasure | `Math.random() > 0.58`で表示Flag | 未接続。確率はOpen |
| Treasure Item | Client-side `Math.random()`で6件から選択 | Server確定 / 再現性が必要 |
| Boss Reward | Training EXP +500、Random Treasure | Reward RuleはOpen |
| Next Boss | 前Boss requirement +5kg | Stage RuleはOpen |
| Boss strength | Demo ToggleでRequired値または76kg | Productionへ採用しない |
| Player Power | 76固定 | DerivationはOpen |
| Character | Normal / Muscular手動Toggle | 自動成長は有力方針だが具体仕様はOpen |
| Play Style | 累積3種EXPの単純な最大・最小比較 | 正式RuleはOpen |
| Support Stats | 固定値。Leg Pressが常にLagging | ProductionではTrend評価予定 |
| Progress | 8週Trend、Boss履歴、7日Streakが固定 | 保存Dataから集計する |
| Beginner Quest | 手動Toggle、Chest / Bench固定、40kg×8×2 | 発生・重量・ContentはOpen |
| Schedule update | 2 Nodeだけを書換え「以降もAI調整」と表示 | 実再計画ではない |

## Known Prototype Gaps / Contradictions

これらはDecisionではなく、現状Snapshotの観察結果。

1. Onboardingの体重、Training歴、Main Lift、食事制約、Allergyが後続Stateへ保存されない。
2. 動的RoadmapはTraining / Recovery / Bossだけで、Treasure / Event / Elite / Campを生成しない。
3. Treasure Overlayを開く`OPEN_TREASURE` ActionはUIからdispatchされない。
4. Quest ClearのTreasure Flagは実Item / Inventoryへ接続されない。
5. Schedule変更先Questを完了すると、間のNodeを飛ばしてMap Positionが進む場合がある。
6. `schedule`、`equipmentAvailable`、`SET_DAY_TYPE`、固定`MAP_NODES`、`STRENGTH_STAGES`は現行UI Flowで実質未使用。
7. Boss EXP +500は`expIntoLevel`へ加算するが、その場でLevel再計算をしない。
8. Support StatsのBoss Shield表示は実際のBoss Challenge条件へ接続されない。
9. Progressの大半はGame State更新へ連動しない。
10. Recovery Questは必須項目未完了でもClearできる。

Production実装時は、Prototypeの挙動を再現するためではなく、Accepted Decisionと受け入れ条件を満たすために解消する。

## Decision Process

新しいDecisionには次を記録する。

- ID / Title
- Status
- Context
- Decision
- Alternatives
- Consequences
- Affected docs / code
- Date

未決定の数値やAlgorithmを実装で仮置きする場合は、Feature flag、Fixture、明示的なTemporary rule等として隔離し、ここへ`Prototype only`または`Proposed`として記録する。

## Change Log

- 2026-09-21: 初版。Product Promptと`figma-reference/`監査結果を分離して記録。
- 2026-09-21: Commit前レビュー。Responses API、Provider abstraction、Zod、Character自動成長をAcceptedから分離し、有力方針・候補・未決定へ再分類。
- 2026-09-21: D-016としてnpm workspacesと`client/` / `server/` / `shared/`のProduction Foundation構成を採用。
- 2026-09-21: D-017としてExercise / Equipment Catalog、Gym Equipment Profile、決定論的Filter、AIへ渡す候補境界を採用。
- 2026-09-21: D-018としてAI Training Planner前段の決定論的Training Candidate Builder境界を採用。
