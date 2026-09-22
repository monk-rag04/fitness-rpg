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
- Decision: `rescheduleTrainingDay(roadmap, sourceDate, targetDate)`は、同一Roadmap内のTraining Dayを後続のRecovery Dayへswapする純粋関数とする。sourceとtargetの一致、Roadmap外、source非Training、target非Recovery、targetがsource以前、Boss日を拒否する。Training数、Boss Anchor、Duration、Stage Target、無関係なDayは保持する。Quest Clear、EXP、Map Position、e1RM、Workout Result、Boss State、進行ロジックを更新しない。
- Consequence: sharedに生成・変更API、入力エラー、Rule Version（`stage-roadmap-even-spread-v1`）とRegression Testを置く。API endpoint、Database、Frontend / Figma実装、AI Call、Schedule再計画、Quest / EXP / Map / Boss Stateは今回含めない。
- Alternatives: Figmaの固定開始日、Session数からの日数算出、nearest duration、Prototype Stateの更新、AIによる曜日・Node・Boss date選択、任意のTraining / Recovery自由選択、全日付の再計画は採用しない。
- Affected docs / code: `docs/PRODUCT.md`、`docs/UX.md`、`docs/ARCHITECTURE.md`、`docs/DATA_MODEL.md`、`docs/DECISIONS.md`、`shared/src/domain/training/stageRoadmap.ts`、`shared/src/domain/training/index.ts`、`shared/test/stageRoadmap.test.mjs`。
- Date: 2026-09-22

### D-027: Quest Completion and Linear Stage Progression

- Status: Accepted
- Context: D-024 is the Workout Result boundary, D-025 defines Stage Target / Duration, and D-026 defines an immutable StageRoadmap. The remaining MVP boundary is how a Daily Quest clears and which event moves the map. Figma Prototype `mapPosition`, checkboxes, date behavior, moved-node jumps, fixed EXP, and Boss toggles are prototype-only observations, not Production rules.
- Decision: Keep `StageRoadmap` immutable and use only `StageProgress = { currentDayIndex }` for MVP progress. Accept an integer from `0` through `roadmap.days.length`; derive completed / available / locked from its relation to each day index. The current quest is `roadmap.days[currentDayIndex]`. Calendar date, missed days, `Date.now`, skip, expire, and automatic catch-up do not move progress. Day index is the MVP quest identity; do not add a global Quest ID or a Roadmap Day ID to D-026.
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
- Scope: Equipmentは初回Training Quest生成前の別工程で収集し、Training PlanはOnboarding時に作らず将来各Training Quest初回Open時に生成する。固定Demo Bench Planを実User Roadmapへ流用しない。Plan未生成のOnboarding由来Training Dayは安全な準備中表示とする。DB、Persistence、Auth、Beginner Assessment、Training Plan API、Pull-up e1RM、Goal推薦、Food入力、Character、EXP、Boss Battleは今回含めない。
- Open: 自己申告の修正・信頼性・永続化、42日超の再計画Algorithm / UX、長期Timezone Policy、Equipment UI、Training Plan APIと再生成Policy。
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
| Schedule update | 2 Nodeだけを書換え「以降もAI調整」と表示 | D-026はTraining Dayと将来Recovery Dayの純粋swapのみ。AI調整・UI State更新・再計画は含めない |

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
- 2026-09-22: D-026として選択済みRoadmap Durationからの決定論的Training / Recovery配置、Boss Anchor、Main Exercise Primary Muscle Focus、将来Recovery Dayへの純粋なSchedule swapを採用。永続化、UI、AI再計画、Game Stateは含めない。
- 2026-09-22: D-027としてWorkout Resultから導出するTraining Clear、明示的Recovery Clear、day indexによるLinear Map進行、終端でのBoss availabilityを採用。EXP、Boss State、Stage Clear、永続化、UIは含めない。
- 2026-09-22: D-029として自己申告Baseline、Boss対象Main、直接入力の経験月数・Goal、Onboarding 1..7頻度、Backend Duration endpoint、純粋なRoadmap組立て境界を採用。後続Client実装でFigma 3-Step UIをApplication Flowへ接続し、実Training Plan生成は引き続き次工程とする。
