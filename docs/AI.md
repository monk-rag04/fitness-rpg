# AI Design

## Status

OpenAI APIとの最小Integration FoundationをBackendに実装済み。明示実行のDevelopment Smoke ScriptでCandidate → Responses API → Structured Draft → Domain Validationを試せる。Production Planner、API endpoint、Frontend連携は未実装。

### 決定済み

- OpenAI APIを使用する。
- Browserから直接呼ばず、Node.js / Express / TypeScript Backend経由にする。
- OpenAI API keyをFrontendへ出さず、`.env`をGitへcommitしない。
- e1RM、Quest完了、EXP、Boss、Schedule制約等のProduct判定をAIへ委ねない。
- Training PlannerやExercise substitutionへAIを採用する場合も、Production Exercise Catalog内の`exerciseId`だけを選択対象にする。
- BackendがMuscle、Movement Pattern、Difficulty、利用可能Equipmentで決定論的に候補をFilterし、全Catalogではなく候補ExerciseだけをAIへ渡す。
- AI呼び出し前のTraining Candidate Builderは`shared/`の決定論的Domain Boundaryとし、Main ExerciseのCatalog所属・Equipment適合も検証する。
- Training Planner出力は自由文ではなく`TrainingPlanDraft`として扱い、Candidate内の`exerciseId`、`main` / `accessory` role、sets、rep rangeだけを受ける。weightはAI Outputに含めず、後続の決定論的Load / Progression Logicへ分離する。
- AI出力を今回の`TrainingCandidateResult`に対して`validateTrainingPlanDraft()`で再検証する。Catalog所属だけでは許可条件を満たさない。
- Backendで公式OpenAI JavaScript / TypeScript SDK、Responses API、JSON SchemaによるStructured Outputsを採用する。Function Callingは今回使用しない。
- API keyはBackend環境変数のみ。Structured Output取得後も`validateTrainingPlanDraft()`を必ず通す。

### Development choice

- 初期Development modelは`gpt-5.6-luna`。`OPENAI_MODEL`で変更可能であり、最終Production Modelの決定ではない。

### 有力方針

- `AiProvider` abstractionと`OpenAIProvider`でSDK依存をApplication / Domainから隔離する。
- AI出力はVersion付きSchemaで検証し、Productルールで再検証してから候補として扱う。

### 候補

- 開発・Test用`MockProvider`
- Schema validation libraryとしてZod
- Backendで制御するTool call

### 未決定

- `AiProvider` / `OpenAIProvider`、`MockProvider`、Zod、Tool利用の正式採用
- 最終Production Model、Production Prompt、User Training Context Schema、Cost上限、Timeout / Retry Policy

## 実装済みのDevelopment Smoke Boundary

- `server/src/openai/client.ts`: Backend環境変数からkeyとmodelを読み、公式SDK clientを生成する。key未設定は識別可能なErrorにする。
- `server/src/openai/trainingPlanSchema.ts`: `TrainingPlanDraft`の`exercises`、各Exerciseの`exerciseId` / `role` / `sets` / `repRange`だけを許すStrict JSON Schema。全Field必須、余分なField不可。正の整数をSchemaで制約し、`min <= max`や候補ID所属はDomainで再検証する。
- `server/src/openai/trainingPlan.ts`: 候補ResultのみをResponses APIへ渡し、取得したJSONを`validateTrainingPlanDraft()`で再検証する。API Error、Output欠落、Domain Validation失敗を区別する。SDK Errorの生MessageはSecret保護のため外へ出さない。
- `server/src/smokeOpenAI.ts`: 固定の小さなEquipment Profileで候補を組み立てる明示実行Script。`npm run smoke:openai`のみ実APIを呼ぶ。通常のtest/buildは呼ばない。2026-09-21にユーザーが実APIでSmokeを実行し、Structured Output取得と`validateTrainingPlanDraft()`による検証の成功を報告した。これはProduction Planner全体の検証完了を意味しない。
- このSmoke PromptはDevelopment専用。Training history、goal、weight、Production推奨sets / repsを確定しない。

## Product上のAIの位置づけ

AIチャットをアプリの主役にしない。AIは裏側でPlanningとPersonalizationを支え、UIでは必要な場所だけ`AI Recommended`、`Adjusted for you`等として説明する。

AI提案と決定論的なProduct判定を混同しない。AIが応答しなくても、保存済み計画の表示、Quest完了、EXP、Boss判定等の中核Game Loopが壊れないArchitectureを目指す。

## AIへ任せる候補

- Training Plan提案
- Daily Training内容の提案
- Schedule変更時の再計画案
- Exercise選択案
- Alternative Exercise候補
- Progressの自然言語による解釈
- Meal提案
- 一部のNPC / Flavor text

すべて「候補生成」であり、AIだけで確定・保存しない。

## AIへ任せないもの

次はTypeScriptのDomain Service / Toolで決定論的に処理する。

- e1RM計算
- EXP計算
- Level判定
- Boss挑戦・撃破条件
- Quest完了判定
- Map進行
- 日付とTimezone計算
- Stage番号
- Validation
- Database保存
- Authentication / Authorization
- Security
- API key管理
- Rewardの最終確定（Random Rewardを採用する場合を含む）
- Exercise Catalogへの所属確認とEquipment適合判定

AIがこれらの値を文章内で提案しても、権威ある結果として利用しない。

## Provider Boundary（有力方針）

正式採用する場合、Application層はOpenAI SDK型へ直接依存せず、Use Case単位のPortを利用する。

概念例：

```ts
interface AiProvider {
  proposeTrainingPlan(input: TrainingPlanInput): Promise<TrainingPlanProposal>;
  proposeScheduleRevision(input: ScheduleRevisionInput): Promise<ScheduleRevisionProposal>;
  proposeExerciseAlternatives(input: ExerciseAlternativeInput): Promise<ExerciseAlternativeProposal>;
  explainProgress(input: ProgressSummaryInput): Promise<ProgressExplanation>;
  proposeMeals(input: MealProposalInput): Promise<MealProposal>;
}
```

このinterfaceは設計候補であり、採用済み契約ではない。正式採用とinterface分割は実装前に決める。採用する場合は、大きな万能Agent interfaceより必要なUse Caseごとの小さなPortを優先する。

### OpenAIProvider案

- 採用する場合はBackendだけに配置する。
- 正式採用する場合は、現在`server/src/openai/`にあるResponses APIのRequest / Response変換を包む。
- Structured Outputの変換とError正規化を担当する。Tool callは別途採用Decisionが必要。
- Model固有Response、Token、Provider ErrorをDomainへ漏らさない。

### MockProvider候補

- NetworkなしでFrontend / Use Caseを開発できる。
- 固定Fixtureと失敗Caseを再現できる。
- Production判定をMock応答の値に依存させない。

## AI-assisted Workflow（機能採用時の案）

以下は各AI機能を採用した場合の安全なFlow案であり、全機能のMVP採用を意味しない。

### Training plan proposal

1. BackendがUserProfile、StrengthProfile、Goal、Gym Equipment Profile、Product制約を収集する。
2. Backendが`buildTrainingCandidates()`を呼び、Production Exercise Catalogから許可された候補を絞る。Main Exercise指定時はCatalog所属とEquipment適合を先に検証する。
3. 候補ごとの`exerciseId`、表示名、Primary / Secondary Muscle、Movement Pattern、Difficultyと、必要最小限のPersonal DataだけをProviderへ渡す。全Exercise Catalogや自由入力名を選択肢にしない。
4. Development SmokeではResponses APIのStructured Outputsで`TrainingPlanDraft`を返す。Production PromptとContextは未決定。
5. `validateTrainingPlanDraft()`が構造、Main Exercise、sets / rep rangeと、今回のCandidate ResultへのID所属を検証する。Catalogに存在しても今回Candidate外なら拒否する。
6. 将来のApplication / Domain ValidatorがFrequency、日付、Recovery間隔、Goal等のPlan全体条件を別途検証する。
7. Invalidなら修正Retry、Fallback、またはユーザーへ確認する。
8. ValidなProposalをユーザーへ提示する。
9. ユーザー確定後にActive Planとして保存する。

現在は手順2のCandidate Builder、手順4・5を試すDevelopment Smoke Boundary、Domain Validationを実装済み。Production Planner、Provider abstraction、Production Prompt、候補件数、具体的なsets / reps推奨範囲、weightの決定は未実装・未決定。

### Schedule revision

1. 移動元、希望日、残りSchedule、Stage条件を受け取る。
2. 未来日等の基本条件をAI呼び出し前に検証する。
3. AIが再計画案を返す。
4. Domainが連続Training、重複、Boss日、既完了Questを検証する。
5. ユーザー確定後にScheduleを更新する。
6. このFlowではEXP、Map、Quest Clearを変更しない。

### Exercise alternative

1. 対象Exercise IDとGym Equipment Profileを入力する。
2. Domainが同じExercise Catalogの`alternativeExerciseIds`から、Primary Muscle、Movement Pattern、利用可能Equipmentを満たす候補を決定論的に返す。
3. AIを将来採用する場合も、この候補IDだけから提案させる。
4. Catalog所属とEquipment条件をBackendで再検証する。
5. 選択した対象Exerciseだけを変更し、他Exerciseへ影響させない。
6. 負荷換算は決定論的Ruleが確定するまで、ユーザー確認なしに自動確定しない。

## Structured Output（採用済み）とTools（候補）

Training Plan Draftの出力制約にはResponses APIのStructured Outputsを採用済み。Tool callは未採用。将来Toolを採用する場合は次を要件候補とする。

- AI Responseは自由文ではなく、可能な限りVersion付きSchemaへ制約する。
- Structured OutputのJSON Parseと既存Domain Validationに失敗したOutputを保存・実行しない。追加Schema validatorのZodは候補。
- Tool callの引数も同じSchemaで検証する。
- AIがToolを要求しても、Backendが許可したToolだけを実行する。
- Tool実行結果をAIの主張ではなく、Backendの実結果として区別する。
- Read / Propose / Mutateを分け、変更系ToolはApplication Use Caseを経由する。

MealAIで確認済みのStructured Output、Provider abstraction、AgentTool abstraction、Backend Tool executionは再評価対象だが、Gemini固有実装や既存Codeは無条件に移植しない。

## Validation and Fallback

### Validation

- Schema / enum / ID存在確認
- Allergy / 食事制約の除外
- Exercise Equipment / 対象部位 / Main Goal整合性
- 日付、Timezone、過去日、重複
- Training frequencyとRecovery間隔
- Product上限とMVP Scope
- 禁止された決定論的値の上書き防止

### Fallback候補

- 最後に確定済みのPlanを維持する。
- 決定論的Templateから安全な候補を表示する。
- AI提案なしで手動候補を選択する。
- 一時的なUnavailableを説明し、Quest完了等の中核操作は継続可能にする。

Fallbackの優先順位とRetry Policyは未決定。

## Safety

このProductはFitness・身体情報を扱うが、医療診断や治療を目的にしない。

実装時の必須Guard候補：

- Pain、Injury、Medical conditionをAIだけで判定・治療提案しない。
- 危険な高重量、実1RM挑戦、極端なCalories制限を無条件に推奨しない。
- BeginnerへPrototypeの固定重量を正式推奨として出さない。
- AllergyをMeal提案のHard exclusionとして再検証する。
- AI生成内容の情報源、監修、DisclaimerのProduct方針を決める。

医療・安全Copyの正式要件とEscalation UXは未決定。

## Privacy and Security

- API keyをFrontendへ露出しない。
- `.env`をcommitしない。
- AIへ送る体重、履歴、食事制約等をUse Caseに必要な範囲へ限定する。
- Prompt / Response LoggingはSecretとPersonal DataをRedactする。
- User入力、外部Content、AI Outputを命令として無条件に信頼しない。
- AIがDatabase query、URL、Tool名等を生成してもAllowlist外を実行しない。
- Providerへ送るData、保持期間、Opt-outは未決定。

## Observability and Evaluation

候補となる記録：

- Provider / Model / Prompt Version
- Schema Version
- Latency / Retry / Error category
- Input validation / Output validation結果
- Tool requestとBackend実行結果の区別
- Fallback有無
- Userが提案をAccept / Edit / Rejectしたか

評価観点：

- PlanがProduct制約を守る割合
- Invalid ID / Schedule conflict / Allergy conflict
- Alternative Exerciseの妥当性
- 説明の理解しやすさ
- Latency / Cost
- 同一入力への安定性

具体的なEval dataset、合格基準、Monitoring Serviceは未決定。

## Figma PrototypeでのAI表現

Prototypeでは`AI PLAN`、`AI ROADMAP ESTIMATE`、`SCHEDULE UPDATED`等のLabelがあるが、実際のOpenAI API呼び出しはない。

次は決定論的または固定処理をAI風に表示している。

- 未経験者の開始重量: 体重比の固定係数。
- Goal推奨: Current e1RMへの固定倍率。
- Roadmap期間: 固定条件と候補日数からの計算。
- Schedule再調整: 元Nodeと移動先Nodeの書き換え。

Productionでは、決定論的計算をAIと誤表示せず、AIを利用した場合も提案・Validation・確定の境界を説明する。

## 未決定事項

- 最終Production Model（`gpt-5.6-luna`はDevelopment defaultのみ）
- Production Prompt / User Training Context Schema / Tool設計
- Tool callの利用有無とAPI style
- `AiProvider` / `OpenAIProvider`の正式採用
- Provider interfaceの粒度
- Schema validation library（Zodは候補）
- AI Retry / Timeout / Cost上限
- AI提案のUser confirmation UX
- Training knowledge / Exercise Masterの情報源
- MealAI再利用範囲
- MockProvider正式採用
- AI Output保存期間
- Eval datasetと合格基準
- Safety reviewと監修体制
