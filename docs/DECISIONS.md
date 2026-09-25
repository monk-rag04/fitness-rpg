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

### D-019: Smartphone Primary Client / Mobile-first Web UX

- Status: Accepted
- Context: Fitness RPGは日々のTraining / Recoveryで利用する。Desktop Dashboardではなく、スマートフォンで主要Actionへ到達しやすいUXを優先する。
- Decision: Primary Clientはスマートフォン。MVP FrontendはReact / TypeScript / ViteのWeb Clientを維持し、Mobile-first、Touch、片手操作を優先する。DesktopはDevelopment / Preview / Secondary accessとして扱い、完全非対応にはしない。
- UX guidance: Portraitと375〜430px程度のSmartphone幅を重点確認する。具体的なPixel値をProduction仕様として固定しない。
- Decision: Production UIとFigmaからの移植はSmartphone viewportを基準にする。Mobile App的なNavigationを前提とし、小さすぎるTap targetとHover依存のInteractionを避ける。Bottom Navigationは基本候補だが、詳細構成は未決定。
- Rationale: `docs/mobile-first-direction`でユーザーがPrimary ClientとMVPのUI方向を明示した。現行Figma SnapshotのPhone Column / Bottom Navigationとも方向は整合するが、Prototypeの固定寸法や実装をProduction仕様にはしない。
- Consequence: Desktop PreviewだけでUI完了とせず、Mobile viewportで主要Flowを確認する。PWA、Native packaging、Store配布、Native API等はこのDecisionで採用しない。

### D-020: Training Plan Draft / Candidate Validation Boundary

- Status: Accepted
- Context: D-018のCandidate Builderから将来AIへ渡した後も、AI OutputをCatalog所属だけで信用せず、今回許可されたCandidate集合に対して再検証する必要がある。
- Decision: Training Planner Outputは自由文ではなく構造化`TrainingPlanDraft`とする。順序付きExerciseは`exerciseId`、`main` / `accessory` role、sets、rep range（min / max）だけを持つ。
- Decision: AIはCandidate内のExercise ID、sets、rep range、roleを提案できる。`validateTrainingPlanDraft()`は空Plan、Candidate外ID、重複、Main Exerciseの存在・role、複数Main、正の整数sets / rep range、定義済みroleを決定論的に検証する。Catalogに存在するだけでは許可しない。
- Decision: weightはDraftへ含めず、Validated Planの後段にある決定論的Load / Progression Logicへ分離する。
- Rationale: `feature/training-plan-schema`で、AI提案と権威あるTraining Quest / Load計算の境界をユーザーが明示した。
- Consequence: D-018で未決定だったsets / repsはOutputの形だけを確定し、具体的な推奨数値・上限やTraining Volume Policyは未決定のままにする。OpenAI model、Responses API、Structured Outputs機能、SDK、Promptも採用しない。

### D-021: OpenAI API Integration Foundation

- Status: Accepted
- Context: D-018のCandidateとD-020のDraft Validationを、Production endpointを作る前に実APIで検証可能にする。
- Decision: 公式OpenAI JavaScript / TypeScript SDKを`server/`のみに追加し、Responses API + Strict JSON Schema Structured Outputsで`TrainingPlanDraft`を生成する。API keyはBackend環境変数だけから取得し、AI出力後は`shared/`の`validateTrainingPlanDraft()`で必ず再検証する。Function Callingは今回使用しない。
- Development choice: `gpt-5.6-luna`を初期Defaultとし、`OPENAI_MODEL`で変更可能にする。最終Production Modelを確定しない。
- Scope: 固定の小さなEquipment Profileを使う明示実行のSmoke Scriptのみ。通常のtest/buildは実APIを呼ばず、Production endpoint、Frontend連携、User Context、weight決定は含めない。
- Consequence: SDK固有型はBackend Integration内に閉じる。`AiProvider` abstraction、Production Prompt / Context、最終Model、Retry / Timeout / Cost policy、Tool採用は引き続きOpen。Zod、dotenv、Agents SDKは導入しない。

### D-022: Training Session Planner Input Boundary

- Status: Accepted（MVP時点。将来のTraining LogicやSchedule / Roadmap設計に応じて変更可能）
- Context: D-018のCandidate ResultとD-020のDraftの間に、1回のSessionの目的とTraining経験を明示するInput Boundaryが必要。週次Schedule全体のPlannerと混同しない。
- Decision: 現行`TrainingPlanDraft`は1回のTraining Sessionを表す。Schedule / Roadmap Plannerが週頻度、Training / Recovery配置、Session Focusを担当し、Session Plannerは`TrainingSessionPlannerInput`のCandidate Result、事実値の`trainingExperienceMonths`、`sessionFocus`だけをAIへ渡す。Focusは必須の`targetMuscles`配列と任意の`targetMovementPatterns`配列。
- Decision: 週頻度、Strength Record、e1RM、Final Goal、Stage target、Gym Equipment Profile、実重量、Nutrition / Game StateをSession Planner Inputへ直接含めない。Main Exercise IDはCandidate Result内にあるため重複しない。実重量は後続の決定論的Load / Progression側で決める。
- Decision: Inputの未知Field、CandidateのCatalog ID / Metadata、経験月数の有限整数・0以上、Focusの配列・既知Muscle / Movementを決定論的に検証する。経験月数による初心者・中級者等の閾値は設けない。
- Rationale: `feature/training-session-planner-input`でユーザーがMVP時点の責務とInput形状を明示した。
- Consequence: Candidate Builderの器具Filterは再実行しない。FocusとCandidateの重なり件数、Focusの最低・最大部位数、具体的なsets / reps、Schedule生成Ruleは未決定。Input Boundaryは将来Decisionで変更できる。

### D-023: MVP Production e1RM Domain Rule

- Status: Accepted
- Context: D-004で決定論的なe1RM利用は採用済みだが、式、対象Record、現在値、丸めが未決定だった。Figma Makeの整数丸めEpleyはPrototype専用であり、その実装をProductionへコピーしない。
- Decision: Setの式は1回なら実施重量、2〜10回なら未丸めEpley `weightKg * (1 + reps / 30)`。11回以上は正常Workout記録だがe1RM対象外。回数0以下・非整数、重量0以下、NaN / Infinity等はValidation Error。
- Decision: 同一Exerciseの1 Workoutでは全適格Setから最大の未丸めe1RMを代表とする。Warmup分類はMVPに設けない。`currentE1rm`は同一Exerciseの直近30×24時間にあるWorkout代表値の最大。基準日時からちょうど30日前を含み、未来記録は含めない。適格な最近の記録がなければ値なしとし、古いPBへFallbackしない。`historicalBestE1rm`は全期間最大として別に扱う。
- Decision: Boss Strength条件は未丸め`currentE1rm >= requiredE1rm`。MVPは期間内の1回の適格な到達でよい。撃破済み状態を後の現在値失効・低下で取り消さない。MVPのBoss対象は`barbell_bench_press`、`barbell_back_squat`、`barbell_deadlift`、`barbell_overhead_press`のみ。Pull-up / Weighted Pull-upはBoss e1RM対象外とし、Exercise Catalogからは削除しない。
- Decision: 内部計算値とBoss比較値は丸めない。UI表示丸めはDomain coreから分離する。FormulaとWindowのRule Versionを保持できる計算境界とし、`Date.now()`に依存せず基準日時を引数にする。
- Alternatives: Brzycki等の別式、10回より広い範囲、最新Workoutのみ、PBを現在値とする方式、複数回達成を要求する方式はMVPでは採用しない。
- Consequence: `shared/`に計算用の純粋関数とRegression Testを置く。保存Schema、Boss state machine、Stage、Load / Progression、UI、APIは今回含めない。30日Windowの将来調整、Warmup / Working Set、RPE / RIR、種目別Formula、`trainingMax`、Pull-up総負荷、自己申告記録の信頼性・修正、UI表示精度とCopyはOpen。
- Affected docs / code: `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/DECISIONS.md`、`shared/src/domain/training/e1rm.ts`、`shared/test/e1rm.test.mjs`。
- Date: 2026-09-22

### D-024: Workout Result Domain Boundary

- Status: Accepted
- Context: D-020はAIが作る1回のTraining PlanをExercise、role、sets、rep rangeへ限定し、weightを後段の決定論的処理へ分離した。D-023のe1RMには、実施済みSetを種目単位で追跡できる入力境界が必要である。
- Decision: MVPではAI / SystemがTraining Weightを自動決定せず、Main / Accessoryを問わずユーザーが実施した各Setの正の有限`weightKg`と正の整数`reps`を記録する。Strength HistoryがないExerciseへ根拠のない初期重量を生成しない。
- Decision: `ExerciseWorkoutResult`は予定Exercise IDと実施Exercise ID、role、予定Set数・rep range、Set番号ごとの完了Set、timestampを持つ。予定Set数未達とrep range外は有効なWorkout Recordを不正にしない。少なくとも1 Setを持たない入力はWorkout Resultではなく、途中DraftとしてもこのDomainへ保存しない。
- Decision: plannedExerciseIdとperformedExerciseIdの相違を許容し、Substitutionの正当性はここで再計算しない。e1RMは実施Exercise IDと実施Setから既存D-023 APIで計算し、元Exerciseのe1RM・重量履歴へ自動移管しない。
- Decision: Workout Result validation成功、Exercise completion、Quest Clear、Load Prescription、Progressionを別責務とする。Plan Snapshotとの予定Exercise・role・sets・rep range照合は可能だが、実重量・実repをPlan validation条件にしない。
- Consequence: `shared/`に未知入力を検証する純粋なWorkout Result APIとD-023 adapterを置く。API endpoint、Database、Frontend、Quest / EXP / Map / Boss、Schedule、重量推薦、previous weight prefill、Double Progression、RPE / RIR、Training Max、重量増分は今回実装しない。
- Affected docs / code: `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/DECISIONS.md`、`shared/src/domain/training/workoutResult.ts`、`shared/src/domain/training/index.ts`、`shared/test/workoutResult.test.mjs`。
- Date: 2026-09-22

### D-025: Deterministic Stage Target and AI Achievement Duration Boundary

- Status: Accepted
- Context: Stage / RoadmapはFitness RPGの主進行だが、Figma Makeの`createStageRoadmap()`にある+5kg、Session数、nearest duration、固定日付はPrototype専用であり、Production仕様ではなかった。D-023のcurrent e1RMを入力に、AIが権威あるStage / Scheduleを決めない最小MVP境界が必要である。
- Decision: Training Sessionは1回のWorkout、StageはFinal Strength Goalまでの中間進行単位、Stage TargetはそのStageのBoss Requirement、Roadmap DurationはStage Targetへ挑戦する期間と定義する。Stage TargetはAIでなくsharedの決定論的Domainで計算し、MVPは`min(finalGoalE1rmKg, currentE1rmKg + 5)`、Rule Versionは`stage-target-fixed-5kg-v1`とする。currentがfinal未満ならnext stageを作る。currentがfinalと等しい場合はgoal reached、finalを超える場合はgoal reached / goal update requiredとし、Final Goalを自動変更・Targetを引き下げない。
- Decision: current e1RMがない場合はHistorical PB / 0kg / AI推定へfallbackせずbaseline requiredとしてStage PlanningおよびDuration Estimateを開始しない。Onboardingのmain exercise、current weight、repsからbaselineを作る将来導線は保存設計とは別にOpenとする。
- Decision: Achievement Duration EstimatorはTraining Planとは別Use Caseである。Inputは`exerciseId`、`currentE1rmKg`、`stageTargetE1rmKg`、`trainingExperienceMonths`、`trainingFrequencyPerWeek`のみ。未知Field、Catalog外ID、正で有限でないcurrent、current以下または非有限Target、負または非整数の経験月数、正でないまたは非整数の頻度をshared Domainで拒否する。頻度のProduct上限は定めない。
- Decision: AIはStrict Structured Outputで`{ estimatedAchievementDays: integer >= 1 }`だけを返す。confidence、reasoning、textを含めず、出力をshared Domainで再検証する。既存のbackend-only OpenAI client、Responses API、SDK Error sanitizationは再利用するが、Prompt / Schema VersionはTraining Planから別管理する。AIはStage Target、Roadmap Duration候補、Boss Requirement / date、Training / Recovery Node、曜日、Quest Clear、EXP、Boss Defeatedを選ばない。
- Decision: Roadmap Duration候補はsharedに一箇所だけ`[14, 21, 28, 35, 42]`として置く。selectionはnearestではなくestimate以上の最小候補を選ぶceiling ruleとし、`<= 14`は14、`> 42`はclamp・自動Target変更・自動Stage分割をせず`stage_replanning_required`を返す。Rule Versionは`roadmap-duration-ceiling-v1`とする。
- Decision: Boss Requirement e1RMはStage Target e1RMと同値とする。DurationはBossを倒せる保証ではない。Boss State / Defeated / Shieldは今回実装しないが、Roadmap終端到達時に`currentE1rm < stageTarget`なら将来Boss Shieldを表示する前提を置く。
- Consequence: `shared/`に`planNextStage()`、`validateAchievementDurationEstimatorInput()`、`validateAchievementDurationEstimate()`、`selectRoadmapDuration()`とRegression Testを置く。serverには独立したDuration EstimatorのPrompt / Strict Schema / adapterとnetwork-free testを置く。Schedule / Roadmap Node、API endpoint、Database、Frontend、Onboarding persistence、Boss State、Quest / EXP / Map、Load / Progression、実API Smokeは今回含めない。
- Alternatives: FigmaのSession数とnearest duration、AIによるStage TargetやDuration候補選択、42日へのclamp、Historical PB fallback、0kg baseline、Training Plan Inputとの混用は採用しない。
- Affected docs / code: `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/AI.md`、`docs/DECISIONS.md`、`shared/src/domain/training/stagePlanning.ts`、`shared/src/domain/training/index.ts`、`shared/test/stagePlanning.test.mjs`、`server/src/openai/achievementDuration.ts`、`server/src/openai/achievementDurationSchema.ts`、`server/test/achievementDuration.test.mjs`。
- Date: 2026-09-22

### D-026: Deterministic Stage Roadmap Schedule

- Status: Accepted
- Context: D-025で決定論的Stage Targetと選択済みRoadmap Durationの境界は定義したが、そのDurationをどのCalendar DayにTraining / Recoveryとして配置し、Boss日をどう扱うかは未決定だった。Figma Makeの`createStageRoadmap()`は固定開始日、Session数、nearest duration、画面Stateを含むPrototype専用の仮実装であり、Productionへ移植しない。
- Decision: `generateStageRoadmap()`はD-025で選択済みの`durationDays`、`startDate`、`trainingFrequencyPerWeek`、Catalog `mainExerciseId`、正の`stageTargetE1rmKg`を受ける純粋なshared Domain関数とする。DurationはBoss Challengeまでのelapsed calendar daysとし、Day Nodeは`startDate`から`durationDays`件、Boss Anchorは`startDate + durationDays`に1件だけ置く。入力のDurationはD-025の`ROADMAP_DURATION_CANDIDATES`（14 / 21 / 28 / 35 / 42）以外を拒否する。
- Decision: Schedule生成専用の週頻度は構造上`1..7`の正整数とする。この範囲はD-025 Achievement Duration EstimatorのProduct上のfrequency rangeを変更しない。各相対7日blockについて`floor(i * 7 / frequency)`（`i = 0..frequency-1`）をTraining offset、その他をRecoveryとし、Duration候補が7の倍数であるため全期間のTraining数はfrequency × week数となる。
- Decision: Training Dayの`sessionFocus`はMain ExerciseのCatalog `primaryMuscles`だけを持つ。`targetMovementPatterns`、Exercise選択、sets、reps、weight、Full Body / Upper-Lower / PPL、Main Exercise fatigue制約はこのDomainに含めない。Schedule生成はBoss e1RM対象ExerciseのAllowlistを検証しない。
- Decision: ローカル日付は厳格な`YYYY-MM-DD`だけを受け、純粋なUTC calendar arithmeticで加算する。`Date.now()`、host timezone、DST、Browser localeへ依存しない。User timezoneの正式Policyは別Decisionとして残す。
- Decision (superseded by D-034): ProductionはTraining Day / Recovery Dayをswapしない。Current Questの日付延期はD-034に従う。
- Consequence: sharedに生成・変更API、入力エラー、Rule Version（`stage-roadmap-even-spread-v1`）とRegression Testを置く。API endpoint、Database、Frontend / Figma実装、AI Call、Schedule再計画、Quest / EXP / Map / Boss Stateは今回含めない。
- Alternatives: Figmaの固定開始日、Session数からの日数算出、nearest duration、Prototype Stateの更新、AIによる曜日・Node・Boss date選択、任意のTraining / Recovery自由選択、全日付の再計画は採用しない。
- Affected docs / code: `docs/PRODUCT.md`、`docs/UX.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/DECISIONS.md`、`shared/src/domain/training/stageRoadmap.ts`、`shared/src/domain/training/index.ts`、`shared/test/stageRoadmap.test.mjs`。
- Date: 2026-09-22

### D-027: Quest Completion and Linear Stage Progression

- Status: Accepted
- Context: D-024 is the Workout Result boundary, D-025 defines Stage Target / Duration, and D-026 defines an immutable StageRoadmap. The remaining MVP boundary is how a Daily Quest clears and which event moves the map. Figma Prototype `mapPosition`, checkboxes, date behavior, moved-node jumps, fixed EXP, and Boss toggles are prototype-only observations, not Production rules.
- Decision: Quest Clear does not mutate `StageRoadmap`; use only `StageProgress = { currentDayIndex }` for MVP progress. D-034 separately permits an explicit schedule action to replace Calendar dates without changing progress. Accept an integer from `0` through `roadmap.days.length`; derive completed / available / locked from its relation to each day index. The current quest is `roadmap.days[currentDayIndex]`. Calendar date, missed days, `Date.now`, skip, expire, and automatic catch-up do not move it. Day index is the MVP quest identity; do not add a global Quest ID or a Roadmap Day ID to D-026.
- Decision: All validated Training Plan `main` and `accessory` exercises are required. Each planned exercise needs exactly one Workout Result with at least one completed set that passes existing Workout Result and plan-snapshot validation. Partial sets and reps outside the planned range do not block clear. Checkboxes are derived rather than persisted. Only when planned and performed IDs differ, use existing `getSubstitutionCandidates()` with the provided GymEquipmentProfile; D-024 attribution remains with the performed exercise.
- Decision: Recording a valid Workout Result or evaluating it does not advance progress. An explicit Training Clear or Recovery Clear advances the current index by exactly one; Recovery has no MVP checklist. An old index returns `already_completed`, a future index returns `not_current_quest`, and neither changes state. Schedule Change, e1RM, OpenAI output, EXP, and result storage do not advance progress.
- Decision: When `currentDayIndex === roadmap.days.length`, the Boss Anchor is available. This only exposes the existing Stage Target for a later Boss domain; it does not implement Boss Strength eligibility, Shield, Challenge, Defeated, Stage Clear, Reward, EXP, HP, or Level.
- Consequence: Add pure `stageProgress.ts`, `linear-stage-progress-v1`, and shared regression tests. No API endpoint, database / persistence schema, Frontend / Figma migration, OpenAI call, global Quest ID, checkbox persistence, Boss State, EXP / HP / Reward, or Stage Clear is added. D-007's exercise-level completion intent remains, but its earlier unique Quest ID wording is not a D-027 persistence decision.
- Alternatives: Prototype map-position jumps, calendar auto-clear, automatic progression when a Workout Result is recorded, progression from Schedule Change, optional / bonus schema, free selection of any daily node, and Boss State in the same change are not adopted.
- Affected docs / code: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md`, `shared/src/domain/training/stageProgress.ts`, `shared/src/domain/training/index.ts`, `shared/test/stageProgress.test.mjs`.
- Date: 2026-09-22

### D-028: Figma Make Frontend Fidelity Boundary

- Status: Accepted
- Decision: Figma Makeの画面構造・Visual・UXをFrontend仕様のSource of Truthとし、Production Reactへ高い忠実度で移植する。別のUIとして再設計しない。
- Decision: FigmaのDummy State / Logic、固定Data、仮計算はProduction仕様にせず、既存のProduction Domain / State / Validationへ置き換える。Product RuleはdocsとAccepted Decision、実際の動作はProduction code / testを正とする。
- Consequence: UI移植ではFigmaとProductionの差分を明示し、Mobile viewportで確認する。`figma-reference/`は読み取り専用Snapshotのままで、Productionの実行時依存やGit管理対象にしない。
- Date: 2026-09-22

### D-029: Onboarding Baseline and Roadmap Application Boundary

- Status: Accepted
- Context: D-023〜D-027の純粋DomainとAdventure Map / Quest UIはあるが、Clientは固定Demo Fixtureを使用する。Figmaの初心者体重倍率、整数丸め、Goal倍率、仮Roadmap日数はProductionへ採用しない。
- Decision: OnboardingのBoss Main Strengthは`barbell_bench_press`、`barbell_back_squat`、`barbell_deadlift`、`barbell_overhead_press`だけを選択可能にする。Pull-upはCatalogに残すがMVP UIではComing later / disabledとし、Boss Mainに使用しない。未知IDとBoss対象外IDを区別して拒否する。
- Decision: 最近実施できたSetを本人が`weightKg > 0`と`reps 1..10`で自己申告し、既存D-023の`calculateSetE1rm()`から未丸めBaselineを計算する。`source: 'onboarding_self_reported'`とRule Versionを保持し、Workout History由来のrolling-window `currentE1rm`へ混入しない。重量不明なら`baseline_required`でRoadmapを生成しない。初心者体重倍率は採用せず、Strength Assessmentは将来機能とする。
- Decision: Training Historyはカテゴリ換算ではなく0以上の整数月数を直接入力する。Onboardingの週頻度は1..7の整数、体重は正の有限値として受け取るがRoadmap生成には使わず、Prototypeの45..120kg制限を採用しない。Food restrictions / Allergy入力はMVP Onboardingから外す。
- Decision: Final Goalは推薦値なしでUserが直接入力し、Onboarding Roadmap開始時は未丸めBaselineより大きい正の有限値だけを許す。既存`planNextStage()`のgoal reached semanticsを変更しない。Client/Applicationが開始操作時のBrowser local calendar dateを`YYYY-MM-DD`で取得し、Domainへ明示的に渡す。Domain内で`Date.now()`を使わない。
- Decision: `prepareOnboardingRoadmap()`はInput / Baseline / StageとDuration Estimator Inputを決定論的に用意し、`completeOnboardingRoadmap()`は検証済みAI日数に既存`selectRoadmapDuration()`、`generateStageRoadmap()`、`createInitialStageProgress()`を適用する。42日超は`stage_replanning_required`としてRoadmapを作らず、clamp、Stage Target / Goalの自動変更、Demo Duration fallbackをしない。
- Decision: ClientはExpressの`POST /api/achievement-duration`経由で既存Backend Estimatorを呼ぶ。Serverは既存Validatorを再利用し、成功時は`estimatedAchievementDays`だけ、失敗時はInvalid Request / Provider Failure / Invalid Structured Outputを識別できる安全なError codeだけを返す。OpenAI SDK、API key、Raw ResponseをClientへ渡さない。
- Implementation note: ClientはFigmaの3-Step画面構造・Visual意図を参照して、D-029 Application Flowへ接続した。UI Draftは体重、経験月数、週頻度、Boss Main、Baseline Set、Final GoalとcurrentStepのみを持ち、Baselineの即時表示はsharedのD-023 APIに委ねる。成功時は実Roadmap / 初期ProgressだけをMapへ渡す。これは新しいProduct Ruleではない。
- Scope: EquipmentとTraining Plan生成はOnboarding後の後続工程として保留した。固定Demo Bench Planを実User Roadmapへ流用しない。Plan未生成のOnboarding由来Training Dayは安全な準備中表示とする。具体的なEquipment timingとTraining Program生成方式は後続のD-030 / D-031で決定する。DB、Persistence、Auth、Beginner Assessment、Training Plan API、Pull-up e1RM、Goal推薦、Food入力、Character、EXP、Boss Battleは今回含めない。
- Open: 自己申告の修正・信頼性・永続化、42日超の再計画Algorithm / UX、長期Timezone Policy、Equipment UI、Training Plan APIの実装詳細と再生成Policy。Training Planの入力境界・失敗時fallback禁止・明示Retry・Day cacheはD-030で決定済み。
- Date: 2026-09-22

### D-030: On-demand Training Plan Generation

- Status: Accepted
- Context: D-029 deliberately creates only the Roadmap and initial Progress. A Training Plan must be generated for a Training Day without allowing the Client to inject arbitrary candidates, without generating plans for the entire Roadmap during Onboarding, and without reusing the Demo fixture.
- Decision: Equipment is not collected during Onboarding. When the first Production Training Node is opened, an unset Equipment Profile must be collected before Plan generation. The user may select zero or more IDs from the existing Equipment Catalog; an empty `availableEquipmentIds` means “no equipment” and Full Gym is never a default. One Equipment Profile is shared for the Stage; per-day Equipment Profiles are out of scope.
- Decision: If the selected Main Strength Exercise is unavailable for the current Equipment Profile, `buildTrainingCandidates()` must stop with `MAIN_EXERCISE_UNAVAILABLE`. AI and Domain logic must not silently substitute the Main Exercise. The user may revise Equipment or change the Main Strength Exercise. Changing the Main Exercise invalidates the existing Strength Goal / Stage Target / Roadmap, so the user must restart Onboarding and generate a new Roadmap.
- Decision: The Client sends only `equipmentIds`, `trainingExperienceMonths`, `mainExerciseId`, and the existing D-022 `sessionFocus` shape to the Training Plan endpoint. It never sends `TrainingCandidateResult`. The Server validates the Equipment input, constructs a `GymEquipmentProfile`, calls `buildTrainingCandidates()`, constructs and validates `TrainingSessionPlannerInput`, and only then calls the existing OpenAI Training Plan adapter.
- Decision: The Training Plan output remains `exerciseId`, `role`, `sets`, and `repRange`; AI never determines Training Weight. In addition to existing Candidate / duplicate / Main validation, deterministic runtime guardrails require at most 6 Exercises, 1–5 sets per Exercise, Main rep ranges of 1–10, Accessory rep ranges of 5–20, and at most 20 working sets per Session. These limits are enforced after Structured Output and are not prompt-only instructions.
- Decision: Generation failures have no Demo, fixed-plan, or silent fallback. The user receives an explicit error and may retry through an explicit user action only. OpenAI SDK `maxRetries: 0` remains in force. A failed result is never cached.
- Decision: Adventure Session state owns a `planByDay[dayIndex]`-equivalent cache. The first open of a Training Day generates and stores a validated plan for that day; reopening the same day reuses it without another OpenAI call. Recovery Days never generate a Training Plan. The cache is React Adventure Session state only; DB, Supabase, and localStorage persistence are out of scope.
- Decision: Figma Make remains the Frontend UI / UX Source of Truth. At the time D-030 was adopted, no formally approved Equipment input screen existed in Production; D-031 aligns the existing Figma Equipment Check / generating / error states with the Stage Program boundary. Production React must not invent a separate UI; Domain, endpoint, Client application helper, and session-state work may proceed independently, while the finalized Figma states are ported faithfully.
- Consequence: D-030 does not finalize the Production OpenAI model, prompt, provider abstraction, or persistence. Per-day Equipment variation is explicitly out of scope; Stage共通Profileを使う。
- Affected docs / code: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/AI.md`, `docs/DECISIONS.md`; future work will touch the Training Plan endpoint, Client application helper, Adventure Session cache, and Training Quest integration.
- Date: 2026-09-22

### D-031: Stage-wide Training Program Generation

- Status: Accepted
- Context: D-030 established the Equipment boundary, Candidate Builder, Training Plan guardrails, explicit retry policy, and a React Session-only `planByDay` cache. Its per-day generation timing is too fragmented for a Stage that should move consistently toward one Stage Target. Equipment is also intentionally collected after Onboarding, so generation must wait until the Stage Equipment Profile is known.
- Decision: Treat one Stage as one coherent Training Program. After the Roadmap exists and the user confirms the Stage-shared Equipment Profile at the first Training Node, generate the Program for all Training Days in one generation operation. Do not generate during Onboarding, for Recovery Days, or for the Boss Anchor.
- Decision: Stage Program context conceptually includes the Stage-shared Equipment Profile, Main Exercise ID, current e1RM, Stage Target e1RM, Training experience months, training frequency, Stage duration, the exact Roadmap Training Day indexes, and each Day's existing D-022 `sessionFocus`. The Final Goal is not a replacement for the current Stage Target. The Client still cannot submit `TrainingCandidateResult` or arbitrary Exercise IDs.
- Decision: The conceptual output is `{ sessions: [{ dayIndex, plan }] }`, where each `plan` reuses the existing `ValidatedTrainingPlan` shape (`exerciseId`, `role`, `sets`, `repRange`). No new Exercise Plan shape is introduced, and AI never chooses Training Weight, Roadmap placement, Quest Clear, EXP, Boss State, or Stage Clear.
- Decision: Stage Program validation requires exact Training Day coverage: no missing, duplicate, or extra `dayIndex`; no Recovery Day, Boss, or out-of-range assignment. Every Session must pass the existing Candidate membership, Main role, duplicate, and D-030 guardrails (maximum 6 Exercises, 1–5 sets, Main 1–10 reps, Accessory 5–20 reps, maximum 20 working sets).
- Decision: Program cache writes are Atomic. If any Session is invalid, reject the entire Program and write zero entries to `planByDay`. Only after all Sessions validate may the existing React Adventure Session state be populated for each Training Day. Recovery Days remain without Plans, and subsequent Training Node opens reuse the saved `planByDay[dayIndex]` without another OpenAI call.
- Decision: A failed Stage Program has no Demo, fixed-plan, silent, or partial fallback. OpenAI SDK `maxRetries: 0` remains in force. Only an explicit User action may retry the whole Stage Program; a Training Node open alone never retries or generates a separate Day Plan.
- Decision: Existing `POST /api/training-plan`, `requestTrainingPlan()`, Candidate Builder, `validateTrainingPlanDraft()`, safe Provider diagnostics, `ValidatedTrainingPlan`, and `planByDay` are retained. The existing per-day endpoint is not deleted, but it is not the final Production Stage Program flow until the next Runtime design audits whether it can be reused internally or must be replaced by a Stage-wide endpoint.
- Decision: Figma Equipment Check and generating/error states represent Stage Program Equipment registration and Stage-wide Program generation, not a daily equipment choice or a single-day AI quest. Production React must follow the finalized Figma UI; no new Production UI is designed by this Decision.
- Consequence: D-031 supersedes only D-030's Training Plan generation timing, per-day OpenAI generation, and day-level generation retry. D-030 Equipment rules, Main Exercise unavailable behavior, Candidate Builder boundary, output guardrails, no-fallback policy, explicit retry, `maxRetries: 0`, `planByDay` reuse, React Session-only persistence, and Figma Source-of-Truth boundary remain active.
- Open: Stage-wide public HTTP request contract, whether to reuse the existing per-day adapter internally, Stage Program Structured Output schema / version, prompt, model, Provider abstraction, Periodization algorithm, concurrent generation behavior, and future persistence remain undecided.
- Affected docs / code: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/AI.md`, `docs/DECISIONS.md`; Runtime code is intentionally unchanged by D-031.
- Date: 2026-09-22

## Proposed / 有力方針

| ID | Topic | Proposal | 決定に必要な確認 |
|---|---|---|---|
| P-001 | Stage幅の将来変更 | D-025の固定+5kg MVP後に種目・経験・Goal差へ適応 | 将来の効果測定、停滞時UX、移行方針 |
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
| C-006 | Web App拡張 | PWA、Service Worker、Push Notification、Offline / Background sync | 利用価値、Browser対応、運用・Test負荷 |
| C-007 | Native packaging | Capacitor、App Store / Google Play配布、Native API利用 | 配布要件、審査、保守、Platform依存 |
| C-008 | 別Frontend技術 | React Native / Expoへの将来移行 | Web Clientで満たせない要件、移行Cost |
| C-009 | Health data連携 | HealthKit / Google Health Connect等 | MVP範囲、Privacy、権限、Platform依存 |

## Open Decisions

### Product / Game rules

- 42日超estimate時のStage再分割Algorithm。
- 5kg Stepの将来変更（経験別・割合ベースを含む）。
- AI estimateの利用時点、再試行、fallback、評価。
- Onboarding self-reportの修正・信頼性・永続化（MVP sourceはD-029で決定済み）。
- Full Body / Upper-Lower / PPL、Main Exercise fatigue制約、Recovery Quest内容（Onboarding frequency 1..7はD-029で決定済み）。
- Schedule Changeの保存・履歴、過去日・完了日の扱い、競合、AI再計画の詳細、Roadmap Nodeの永続Schema。
- Boss Shield / Defeated / Stage Clear、timezone。
- 初心者Strength Assessmentと将来の開始重量推薦（MVP体重倍率は不採用）。
- e1RMの30日Windowの将来調整、Warmup / Working Set分類、RPE / RIR、種目別Formula、Pull-up総負荷、自己申告記録の信頼性・修正Policy、UI表示精度の最終Copy。
- `trainingMax`と決定論的Load / Progression Rule。
- previous weight prefill、Load Prescription、Double Progression、automatic increase / decrease、重量増分。
- Workout Result / Quest Clearの保存・取消・複数Session集約Policyと、自己申告Onboarding Recordの保存方法。
- 将来の推奨Final Goalと達成目安期間の表示UX（MVPは直接入力とD-025の1 Stage推定）。
- EXP値とCategory配分。
- Level curve。
- Character成長段階と自動遷移条件。
- HP / Recovery Gaugeの意味と回復量。
- Support Statsの評価期間・閾値・対象。
- Boss Shieldの条件とSupport Stats連動。
- Bossのゲーム条件、Battle失敗・再挑戦。
- Treasureの効果、獲得条件、確率、重複。
- Streakの定義。
- Recovery Questの将来Checklist、睡眠 / 栄養 / 軽活動との連動、HP / Rewardへの影響。
- Beginner Questの発生・修了条件と監修。
- Exercise Masterの情報源、監修、Catalog Versioningと更新運用。
- Training PlannerとSchedule再計画の詳細。
- Nutrition / MealAIのMVP範囲。
- 最終MVP範囲。

### Architecture / Operations

- PWA / Service Worker、Offline対応、Push Notification、Background syncの正式採用。
- Capacitor等のNative packaging、App Store / Google Play配布、Native API利用の正式採用。
- React Native / Expoへの移行、HealthKit / Google Health Connect等との連携。
- `AiProvider` / `OpenAIProvider`の正式採用とInterface粒度。
- Zodの正式採用。
- Tailwind CSS正式採用。
- Supabase PostgreSQL正式採用。
- AuthenticationのMVP採用。
- API contract、Persistence開始時期、Migration。
- Hosting / Deployment。
- Timezone、Offline、Sync。
- Logging / Monitoring / Data retention。
- 最終Production Model、Production Prompt / Session Contextの取得・更新方法と将来拡張、Tool、Cost / Retry / Timeout Policy。

## Figma Prototype-only Logic

次は`figma-reference/`で実際に確認したが、Productionへ採用していない。

| 領域 | Prototypeの仮ルール | 扱い |
|---|---|---|
| e1RM | Epley式 `round(weight * (1 + reps / 30))` | D-023は1回特例・1〜10回・未丸め・30日Windowを正式採用。Prototypeの整数丸め処理は採用しない |
| Beginner weight | Bench 0.30×BW、Squat 0.50、Deadlift 0.60、OHP 0.20、5 reps | 正式ロジックはOpen |
| Pull-up beginner | `round(BW * 0.65)`をCurrent e1RM相当として表示 | Productionへ採用しない |
| Recommended Goal | Currentの114%〜121% | 正式推奨RuleはOpen |
| Goal編集 | 1kg単位で上下 | UI / 単位はOpen |
| Stage数 | `ceil((target-current)/5)` | D-025は次の1 Stageだけを固定+5kgで決定する。全Stage数・再分割は採用しない |
| Stage target | Current + Stage×5kg、Goalでcap | D-025は`min(finalGoal, current + 5)`を正式採用。Prototypeのstage番号依存実装は採用しない |
| Sessions / Stage | 週1〜2回なら7、週3〜4回なら8、週5回以上なら6 Session | 正式RuleはOpen |
| Stage日数 | 算出日数に最も近い14/21/28/35/42日 | D-025はAI estimate以上の最小候補を選ぶ。Session数算出とnearest ruleは採用しない |
| Roadmap開始日 | 2026-09-22固定 | ProductionではUser timezone / Start dateが必要 |
| Training配置 | 週Frequencyをfloor計算で均等配置 | D-026は`floor(i * 7 / frequency)`のoffsetを採用するが、Figmaの開始日・画面State・Session数Ruleは採用しない |
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
| Schedule update | 2 Nodeだけを書換え「以降もAI調整」と表示 | D-034はCurrent Questの日付と以降のSlot / Bossを同日数だけ延期する。Node swap・AI再計画は行わない |

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
- 2026-09-21: D-019としてSmartphone Primary ClientとReact / Vite Web ClientのMobile-first UXを採用。PWA / Native化は未決定のまま分離。
- 2026-09-21: D-020としてTraining Plan DraftとCandidate Resultに対する決定論的Validation境界を採用。
- 2026-09-21: D-021として公式OpenAI SDK、Responses API、Structured Outputs、Backend key、Domain再ValidationのDevelopment Integration Foundationを採用。Model / PromptのProduction仕様は未決定。
- 2026-09-21: D-022として1回のTraining Session向けInput BoundaryとSchedule / Roadmapとの責務分離を採用。将来のTraining Logicに応じ変更可能とする。
- 2026-09-22: D-023としてMVPのe1RM式、適格Set、Workout代表値、rolling 30日現在値、PB分離、未丸めBoss比較、対象Exerciseを採用。
- 2026-09-22: D-024としてSet単位のWorkout Result、予定 / 実施Exerciseの分離、D-023 e1RM接続、Quest Clear・Load / Progressionとの責務分離を採用。
- 2026-09-22: D-025として固定+5kgの決定論的Stage Target、AIのAchievement Duration Estimate、候補Durationのceiling選択と42日超のreplanning statusを採用。Schedule / Boss Stateは含めない。
- 2026-09-22: D-026として選択済みRoadmap Durationからの決定論的Training / Recovery配置、Boss Anchor、Main Exercise Primary Muscle Focusを採用。将来Recovery DayへのSchedule swapは後続D-034で置き換えられた。
- 2026-09-22: D-027としてWorkout Resultから導出するTraining Clear、明示的Recovery Clear、day indexによるLinear Map進行、終端でのBoss availabilityを採用。EXP、Boss State、Stage Clear、永続化、UIは含めない。
- 2026-09-22: D-029として自己申告Baseline、Boss対象Main、直接入力の経験月数・Goal、Onboarding 1..7頻度、Backend Duration endpoint、純粋なRoadmap組立て境界を採用。後続Client実装でFigma 3-Step UIをApplication Flowへ接続し、実Training Plan生成は引き続き次工程とする。
- 2026-09-22: D-030としてEquipmentの初回Training Node収集、Main Exercise unavailable停止、Server-side Candidate Builder境界、Training Plan guardrail、明示Retry、day単位cache、React Session-only保持、当時のFigma未確定Equipment UI境界を採用。
- 2026-09-22: D-031として1 Stage = 1 Training Program、Equipment確定後のStage-wide生成、全Training Day exact coverage、Atomic `planByDay` cache、Stage Program全体の明示Retryを採用。D-030のper-day生成 timing / generation retryだけをsupersedeし、Equipment・guardrail・fallback禁止・Session-only保持は維持。
- 2026-09-24: D-034としてCurrent Quest Slotの日付延期、Current以降とBossの同日数shift、day-index identity、canonical delay validator、Training / Recovery QuestのMobile sheetを採用。D-026のProduction Schedule swapを置き換え、Progress / cache / Workout Result / Equipment stateは維持し、永続化は追加しない。
- 2026-09-24: D-035としてExerciseごとの5種Training EXP Category、eligible planned setあたり5 EXP、Recovery Clearの10 EXP、dayIndex基準のAtomic Progress / Growth / Reward Summary更新を採用。Character GrowthはSession内の累積EXPのみとし、LevelとPersistenceは追加しない。
- 2026-09-25: D-038として既存SessionのMain Strength / EXP / Stage進行を表示するCharacter Screen v1、MAP / CHARACTER / PROGRESS Hub Navigation、Progress Placeholderを採用。未実装RPG stats、Stage ordinal、Persistenceは追加しない。
- 2026-09-25: D-039としてProgress Placeholderを既存実績とExercise Suggestionの閲覧画面へ置き換える。Stage Growth Analysis、Chart、Persistenceは追加しない。

### D-032: Stage Training Program Balance and Boss Main Exposure

- **Status**: Accepted (MVP)
- **Decision**: Keep the onboarding-selected `mainExerciseId` as the Stage `bossMainExercise`; it supplies the Stage Target/e1RM metric and is not automatically the session `role: 'main'` on every Training Day.
- **Decision**: Generate a deterministic, frequency-based session split from the existing Muscle Group and Movement Pattern taxonomies (1: Full Body; 2: Full Body A/B; 3: Upper/Lower/Full Body; 4: Upper A/Lower A/Upper B/Lower B; 5: Push/Pull/Legs/Upper/Lower; 6: Push/Pull/Legs repeated; 7: Push/Pull/Legs repeated plus Full Body/Technique). Calendar weekdays are not used.
- **Decision**: Mark `bossMainExposure` on each canonical Training Day. The Boss Main is exposed once for 1–2 Training Days per cycle and twice for 3 or more, on focus-compatible days. Exposure requires the Boss Main as exactly one `main` role; non-exposure sessions must exclude it and choose exactly one focus-compatible candidate as `main`.
- **Decision**: Every generated session has exactly one `main` role. Existing candidate membership, duplicate, equipment, and D-030 guardrails remain deterministic and are revalidated after Structured Output. AI cannot replace the Boss Main or add exercises outside the server-built candidates.
- **Decision**: Roadmap generation, server candidate context, stage-wide prompt, client validation context, and atomic `planByDay` caching preserve the same focus/exposure metadata. Recovery and Boss nodes remain excluded; the legacy per-day endpoint remains compatible.
- **Consequence**: Stage-wide generation is no longer Main Strength-biased. The Stage Target/Boss metric remains separate from the session primary-exercise role.
- **Open**: Periodization details, fatigue limits, exact production prompt/model, persistence, and UI redesign remain undecided.

### D-034: Current Quest Date Rescheduling

- **Status**: Accepted (MVP)
- **Context**: D-026 defined the original Stage calendar and a Training / Recovery swap operation. The Production Current Quest flow needs to defer the current daily slot without moving its identity, changing its type, or altering game progress. The Figma Prototype's node swapping and AI rescheduling are not the intended Production behavior.
- **Decision**: A Quest Slot's identity is its `dayIndex`; its calendar `date` is a mutable schedule field. `rescheduleCurrentQuest(roadmap, currentDayIndex, newDate, today)` is deterministic shared Domain logic. It rejects an absent / Boss current slot, invalid or nonexistent strict `YYYY-MM-DD`, a new date before browser-local `today`, or before the current slot. The same date is an unchanged no-op; future dates have no configured maximum.
- **Decision**: For a positive calendar shift, preserve completed past slots and add the same number of calendar days to the current and every subsequent Daily Slot plus `roadmap.boss.date`. Keep array order/count, `dayIndex`, Training / Recovery type, `sessionFocus`, `bossMainExposure`, Main Strength, Stage Target, `startDate` (original Stage start), `durationDays` (original base duration / slot count), and `generationRuleVersion`. The actual scheduled Boss date is `roadmap.boss.date`. Repeated rescheduling shifts only the then-current slot and later slots.
- **Decision**: The server Stage Program snapshot validator accepts canonical dates or a canonical delay schedule: each actual daily date's offset from `startDate + dayIndex` is nonnegative and non-decreasing; Boss offset from `startDate + durationDays` equals the last Daily Slot's offset. Daily count / type, D-032 focus and Boss exposure, generation inputs and all other canonical validations remain enforced.
- **Decision**: Current Training and Recovery Quest surfaces provide a secondary `日程を変更` action, not shown for Boss. Its mobile-first sheet uses browser-local `today` as the minimum input date, while shared Domain independently validates. On success only the React Adventure Session Roadmap is atomically replaced. Progress, `planByDay[dayIndex]`, Workout Results, Equipment Profile, Stage Program context, quest contents, and Map Node identity / position are preserved. No quest completion, reward, AI call, or regeneration occurs.
- **Decision**: No database, localStorage, schedule history, or persistence is introduced. Reload / lifecycle persistence remains outside this MVP.
- **Alternatives**: Swapping Training and Recovery, moving a quest to a different Node, inserting / deleting / sorting nodes, regenerating plans, AI schedule adjustment, changing `durationDays`, and altering `currentDayIndex` are not adopted.
- **Consequence**: D-034 supersedes only D-026's former Production swap rule. D-026's canonical generation, offset, focus, and initial Boss date remain unchanged. D-027's index-based progress remains unchanged; an explicit date update does not complete or advance a Quest.
- **Affected docs / code**: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md`, shared Stage Roadmap Domain / tests, Stage Program request validation / tests, Adventure Quest context, Current Quest UI / tests.
- **Date**: 2026-09-24

### D-035: Character Growth EXP and Atomic Quest Rewards

- **Status**: Accepted (MVP)
- **Context**: D-027 already advances one current Roadmap `dayIndex` only after explicit Training or Recovery Quest Clear. Workout Result is stored separately and can be edited before Clear. Character Growth needs a deterministic reward boundary that cannot grant EXP on save, extra sets, or repeated completion.
- **Decision**: Shared Domain defines the five `TrainingExpCategory` values `chest`, `back`, `shoulders`, `arms`, and `legs`. A versioned `exercise-exp-category-v1` mapping assigns every Catalog Exercise ID to exactly one primary category. Unknown IDs have no fallback category and cannot receive a reward.
- **Decision**: `quest-reward-v1` awards 5 Training EXP per valid completed planned Set and 10 Recovery EXP for a successfully cleared Recovery Quest. A Set is eligible only when its validated Set number is in `1..plannedSets`; partial planned Sets count, extra Set numbers do not count, and a valid Set remains eligible when its reps miss the planned rep range. Category attribution uses validated `performedExerciseId`, including only a substitution accepted by the existing Quest completion validation.
- **Decision**: EXP is awarded only when explicit Quest completion succeeds. Recording or editing a Workout Result, opening or closing the overlay, rescheduling a Quest, and calendar date changes do not award EXP. `CharacterGrowth` contains only cumulative nonnegative integer EXP by the five Training categories and `recoveryExp`, initialized to zero; Level is not implemented.
- **Decision**: A successful clear applies `StageProgress`, `CharacterGrowth`, and a `QuestRewardSummary` snapshot together in one pure Domain completion result and one current-state Client reducer transition. The `dayIndex` remains the identity, so an old-day replay is idempotently rejected. Summary data records the reward actually applied; Presentation does not recalculate it from Workout Results.
- **Decision**: Growth state is held only in the in-memory React Adventure Session. No database, localStorage, or other persistence is introduced. D-023 e1RM, Stage Target, split/exposure, Stage Program, plan cache, Roadmap, Workout Result contents, overlay visuals, and AI prompts remain outside this decision.
- **Consequence**: Adds versioned Shared mapping/reward helpers and Session-only state with regression tests. D-035 Task 4E below adds per-Exercise Baseline and successfully completed Training Session count; suggested weight, Stage Growth Summary, Level, Boss evaluation, and Next Stage AI emphasis remain future tasks.
- **Date**: 2026-09-24

#### D-035 Task 4E: Exercise Progress and Baseline

- **Decision**: Keep `ExerciseProgressState` keyed by canonical Exercise ID in the in-memory Adventure Session. It contains an optional first baseline and a zero-initialized `sessionsCompleted`; it is not a progression algorithm or persisted profile.
- **Decision**: Initialize the Onboarding Main Strength Exercise from its accepted Onboarding weight / reps (`source: 'onboarding'`, captured at the initial Quest day). Other Exercises may opt into a positive finite kg / positive integer rep self-report (`source: 'self_report'`) or acquire their first baseline from a valid Workout Result (`source: 'workout_result'`). Self-report registration and Result save do not increment completed sessions or grant EXP.
- **Decision**: For a valid self-report or Onboarding record, use the existing D-023 `calculateSetE1rm()` eligibility. For the first valid Workout Result, choose its maximum eligible e1RM set and store that set's weight / reps. If no set is e1RM-eligible, keep a baseline from the first valid working set ordered by `setNumber` without an estimated e1RM. Preserve optional estimates unrounded with `E1RM_RULE.version`.
- **Decision**: Baseline is first-write-only for the Stage. Later Results cannot overwrite it. A Training Quest Clear increments `sessionsCompleted` once per unique actual `performedExerciseId` only after the existing atomic clear succeeds; old-day replay cannot increment again. Recovery clear, reschedule, mere Result save, and Baseline registration do not increment it. Substitution state belongs to `performedExerciseId`, never the planned ID.
- **Decision**: `push_up`, `pull_up`, and `glute_bridge` are excluded from kg self-report. Their Task 4G Workout Results are reps-only, so they do not create a kg Baseline or e1RM. This supersedes the earlier Result-derived weight possibility for these IDs; no bodyweight multiplier or added load is inferred.
- **Consequence**: This Task adds no current-performance tracker, Suggested Weight / reps, Difficulty Feedback, Load increment, progression algorithm, EXP / reward, level, Boss / Stage growth UI, persistence, DB, localStorage, or AI call. Refresh behavior remains the existing Session-only reset.
- **Date**: 2026-09-24

### D-036 Task 4F: Exercise Difficulty Feedback

- **Status**: Accepted (MVP)
- **Context**: Workout Result already stores completed Sets per planned Exercise and is editable before explicit Quest Clear. The user needs a lightweight way to report how the exercise load felt, without introducing a per-Set RPE model or allowing feedback to alter progression before that behavior is decided.
- **Decision**: Add optional `difficultyFeedback` to `ExerciseWorkoutResult`, with exactly `too_hard`, `just_right`, and `easy`. It describes one Exercise Result, not individual Sets. Missing feedback is valid; an unknown value is rejected, while strict unknown-field rejection remains in force.
- **Decision**: Save feedback atomically with the Workout Result. Editing an existing result restores its Set inputs, `performedExerciseId`, and feedback; resaving replaces the entire result, so changing or clearing feedback does not leave stale data. A substitution's feedback remains attached to the same result and actual `performedExerciseId`.
- **Decision**: Feedback is optional and does not affect Workout Result validity beyond the allowed enum, Quest Clear eligibility, Baseline or `sessionsCompleted`, EXP / Reward, Stage progress, or Training Plan. Task 4G consumes it only as a progression veto when it is `too_hard`; absence is neutral.
- **Decision**: Feedback remains in the existing in-memory Adventure Session as part of `workoutResultsByDay`; no separate feedback state, database, localStorage, or other persistence is introduced. Task 4F itself does not connect it to Suggested Weight / Reps or a progression algorithm; Task 4G below defines that separate behavior.
- **Consequence**: The Shared Workout Result validator, Client result form, Session save path, tests, and relevant Product / Architecture / Data Model / UX documentation accept the optional field. Selected UI state is explicit and can be cleared by toggling the selected option off.
- **Affected docs / code**: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md`, `shared/src/domain/training/workoutResult.ts`, `shared/test/workoutResult.test.mjs`, `client/src/features/quests/WorkoutResultForm.tsx`, `client/src/styles.css`, `client/test/adventureSession.test.mjs`, `client/test/workoutResultForm.test.mjs`.
- **Date**: 2026-09-24

### D-036 Task 4G: Suggested Weight / Reps and deterministic Exercise progression

- **Status**: Accepted (MVP)
- **Context**: Task 4E introduced immutable Exercise Baselines and successful-Clear Session counts. Task 4F stores optional Exercise-level difficulty feedback. Training Result is editable before an explicit, atomic Quest Clear; deterministic user-facing hints must therefore evaluate the final saved Result at the successful Clear boundary, not at save/edit time.
- **Decision**: Version the rule as `exercise-progression-v1`. `ExerciseProgressState` retains `exerciseId`, first-write-only `baseline`, and `sessionsCompleted`, and adds optional `nextSuggestion` and `loadStepKg`. Do not duplicate prior Suggestion, Feedback, or Performance fields. A Suggestion contains optional `weightKg`, one `targetReps`, the current `repRange`, `active` / `weight_up_ready` status, and rule version.
- **Decision**: Resolve the initial target to `repRange.min`. A non-bodyweight Baseline contributes numeric weight only when its recorded reps fall inside the current Plan range; otherwise weight remains unset. Re-resolve stored target reps by clamping to each current Plan range. Hints never prefill actual inputs and no e1RM inversion is used.
- **Decision**: Progress only after a successful Training Quest Clear and only when every planned Set number is present. All planned Sets must meet `targetReps`, and when numeric weight is suggested, each actual weight must be at least that value. `too_hard` vetoes any progression; missing feedback is neutral; `just_right` and `easy` cannot progress without actual Set criteria. If targets are met but not all reps reach `repRange.max`, increase target by exactly one rep. When all reps reach max, a configured `loadStepKg` adds exactly one step and resets target to range.min; without a step, keep the current weight / max reps as `weight_up_ready` rather than guessing a value. One Quest causes at most one progression action.
- **Decision**: If a Weighted Exercise has no numeric suggestion, a full planned Result with Feedback other than `too_hard` may establish a conservative next-weight reference from the minimum actual planned-Set weight; then apply at most one rep or weight step. This reference is not a Baseline. `too_hard`, Partial Sets, missed reps, or any planned Set below the numeric suggestion preserve the current Suggestion. No automatic Weight Down, failure streak, fixed equipment increment, or AI weight suggestion is added.
- **Decision**: `loadStepKg` is an optional user-entered finite positive decimal scoped to one Exercise. No default is chosen. From `weight_up_ready`, one action stores the increment and applies one increment atomically; a repeated action cannot add it again. Floating-point kg results normalize to six decimal places without integer rounding.
- **Decision**: Bodyweight v1 consists exactly of `push_up`, `pull_up`, and `glute_bridge`. Their Workout Result sets contain positive integer reps only; any weight field is rejected. They do not acquire kg Baseline / Suggestion, e1RM, or load step. Their progression is reps-only, +1 only after all planned Sets meet the target, capped at rep max; Partial or `too_hard` retains the target. Weighted Exercises still require positive finite weight on each completed Set.
- **Decision**: Weight recording convention is Barbell=total including bar, Dumbbell=per single dumbbell, Machine / Cable=displayed machine setting. Keep one convention per Exercise. Presentation helper text is ID-based and only appears for unambiguous Catalog exercises; ambiguous exercises receive no claim.
- **Decision**: Quest Clear applies Suggestion changes in the same in-memory domain transition as existing Stage Progress, Character Growth, Reward Summary, and unique performed-Exercise `sessionsCompleted`. Only `performedExerciseId` receives progression. Result save/edit, Recovery Clear, failed Clear, replay, and reschedule do not update suggestions. Baseline, EXP / Reward values, Clear criteria, and Quest identity are unchanged. No database, localStorage, other persistence, dependency, or OpenAI call is introduced.
- **Consequence**: Shared owns pure resolver, progression evaluator, bodyweight Result validation, and load-step transition. Client renders the hint, Weight Up Ready action, and reps-only Bodyweight form; actual inputs stay blank unless editing a saved Result. Session refresh remains the existing reset behavior.
- **Date**: 2026-09-24

### D-038: Character Screen v1 and Hub Navigation

- **Status**: Accepted (MVP)
- **Context**: D-035 defines Session-only cumulative Training / Recovery EXP, and D-036 defines Main Exercise Baseline and actual Workout Result progression. The Character screen needs to present those existing facts without implying unimplemented RPG stats or treating a suggestion as actual performance.
- **Decision**: Add a Character Screen with the Figma-confirmed Dark Fantasy hierarchy: Character Hero, Main Strength, five Training EXP cards plus Recovery EXP, and Stage progress. Use existing Adventure Session data only. Do not show Level, HP, MP, Attack, Defense, Rank, Equipment, Skill, Badge, or Achievement values.
- **Decision**: Main Strength START uses the existing Main Exercise Baseline; CURRENT uses an actual result from the latest Clear済み Training Quest whose `performedExerciseId` is the Main Exercise; TARGET uses the Onboarding-confirmed Final Goal, not the current Stage Target. For a result with multiple valid sets, the representative set is the valid completed Set with greatest `setNumber`; no best-record or e1RM summary is calculated. Suggestions are never used as CURRENT.
- **Decision**: Display the five existing `CharacterGrowth.trainingExp` categories and `recoveryExp` as-is, including zero. Completed Quest count is `StageProgress.currentDayIndex`; total Quest count is `roadmap.days.length` (Daily Quest slots, excluding the Boss Anchor); Boss remaining is `max(0, total - completed)`. Do not infer or display a Stage ordinal because the current Roadmap does not store one.
- **Decision**: Add the three-tab MAP / CHARACTER / PROGRESS bottom navigation to Adventure hub screens only. MAP returns to the existing Adventure Map, CHARACTER opens this screen, and PROGRESS initially opened a restrained placeholder (superseded by D-039). Hide the navigation during Quest and other focused flows. The active tab is exposed with `aria-current` as well as visual styling.
- **Decision**: A missing Session is rendered as a safe empty Character state by the Presentation boundary; the App's normal flow continues to keep hub navigation behind completed Onboarding. No fake Session or persistence is added.
- **Consequence**: No EXP, Quest, Baseline, progression, Roadmap, Reward, Boss, AI, or persistence behavior changes. The final Onboarding goal is retained in the existing in-memory Adventure Session so the Presentation can distinguish it from the Stage Target.
- **Affected docs / code**: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, Client Character presentation, hub navigation, and regression tests.
- **Date**: 2026-09-25

### D-039: Progress Screen v1 Training Log

- **Status**: Accepted (MVP)
- **Context**: D-038 introduced Main Strength / EXP / Stage presentation and a Progress placeholder. Production already retains clear-scoped actual results, Exercise baselines, session counts, and progression suggestions in the in-memory Adventure Session.
- **Decision**: Replace the placeholder with a read-only Training Log using only existing Session state. Reuse D-038 Stage summary and Main Strength actual / baseline / Final Goal rules so Character and Progress show the same facts. Main latest record and Exercise latest records come only from cleared Training Quest results matched by `performedExerciseId`; representative set remains the valid completed set with greatest `setNumber`. Main Exercise is omitted from the Exercise list; other entries require `sessionsCompleted > 0` and reuse the shared D-035 Exercise EXP Category mapping.
- **Decision**: Show Baseline and latest Workout Result as actual records, and `nextSuggestion` separately as “次回の目安”. Bodyweight records and suggestions are reps-only; `weight_up_ready` is shown as “重量UPのタイミング” without a load-step action. Stage counts use the same completed Roadmap prefix as Character.
- **Consequence**: PROGRESS v1 is existing records plus suggestions for viewing, not Stage Growth Analysis. No growth rates, comparisons, charts, PR / streak / achievement, AI Review, filters, new state, persistence, or API calls are added.
- **Affected docs / code**: `docs/PRODUCT.md`, `docs/UX.md`, `docs/ARCHITECTURE.md`, Client Progress presentation / screen, and Client presentation tests.
- **Date**: 2026-09-25
