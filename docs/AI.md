# AI Design

## Status

AI Integrationは未実装。この文書は、AIへ任せる責務、任せない責務、安全な実行Flow、およびProvider境界の有力案を定義する。

### 決定済み

- OpenAI APIを使用する。
- Browserから直接呼ばず、Node.js / Express / TypeScript Backend経由にする。
- OpenAI API keyをFrontendへ出さず、`.env`をGitへcommitしない。
- e1RM、Quest完了、EXP、Boss、Schedule制約等のProduct判定をAIへ委ねない。

### 有力方針

- OpenAI Responses APIを利用する。
- `AiProvider` abstractionと`OpenAIProvider`でSDK依存をApplication / Domainから隔離する。
- AI出力はVersion付きSchemaで検証し、Productルールで再検証してから候補として扱う。

### 候補

- 開発・Test用`MockProvider`
- Schema validation libraryとしてZod
- Structured OutputおよびBackendで制御するTool call

### 未決定

- Responses API、`AiProvider` / `OpenAIProvider`、`MockProvider`、Zod、Tool利用の正式採用
- OpenAI model、Prompt、Schema詳細、Cost上限、Timeout / Retry Policy

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
- Responses APIを採用する場合は、そのRequest / Response変換を担当する。
- Structured OutputやTool callを利用する場合は、その変換とRetry可能Errorの正規化を担当する。
- Model固有Response、Token、Provider ErrorをDomainへ漏らさない。

### MockProvider候補

- NetworkなしでFrontend / Use Caseを開発できる。
- 固定Fixtureと失敗Caseを再現できる。
- Production判定をMock応答の値に依存させない。

## AI-assisted Workflow（機能採用時の案）

以下は各AI機能を採用した場合の安全なFlow案であり、全機能のMVP採用を意味しない。

### Training plan proposal

1. BackendがUserProfile、StrengthProfile、Goal、許可Exercise、Product制約を収集する。
2. 必要なPersonal DataだけをProviderへ渡す。
3. AIがSchemaに沿ったPlan Proposalを返す。
4. 採用したSchema validatorで構造を検証する。Zodは候補。
5. Domain ValidatorがFrequency、日付、Exercise ID、Recovery間隔、Goal整合性を検証する。
6. Invalidなら修正Retry、Fallback、またはユーザーへ確認する。
7. ValidなProposalをユーザーへ提示する。
8. ユーザー確定後にActive Planとして保存する。

### Schedule revision

1. 移動元、希望日、残りSchedule、Stage条件を受け取る。
2. 未来日等の基本条件をAI呼び出し前に検証する。
3. AIが再計画案を返す。
4. Domainが連続Training、重複、Boss日、既完了Questを検証する。
5. ユーザー確定後にScheduleを更新する。
6. このFlowではEXP、Map、Quest Clearを変更しない。

### Exercise alternative

1. 対象Exercise ID、Equipment制約、Plan上の目的、User制約を入力する。
2. AIまたはRule-based Selectorが候補IDを返す。
3. Exercise Masterに存在し、制約・目的に合う候補だけを許可する。
4. 選択した1 Exerciseだけを変更する。
5. 負荷換算は決定論的Ruleが確定するまで、ユーザー確認なしに自動確定しない。

## Structured Output and Tools（採用候補）

Structured OutputとTool callを使うか、その具体的なOpenAI API styleは未決定。採用する場合は次を必須要件とする。

- AI Responseは自由文ではなく、可能な限りVersion付きSchemaへ制約する。
- 採用したSchema validatorでParseに失敗したOutputを保存・実行しない。Zodは候補。
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

- OpenAI Model
- OpenAI Responses APIの正式採用
- Prompt / Schema / Tool設計
- Tool call / Structured Outputの利用有無とAPI style
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
