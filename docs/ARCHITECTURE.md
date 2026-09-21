# Architecture

## Status

この文書はProduction Architectureの方針を定義する。Frontend / Backend / sharedの最小Foundation、Health Check、Training Domainに加え、BackendのOpenAI Integration Foundationと明示実行のSmoke Scriptは実装済み。ゲーム進行、Database、Authentication、Production Training Planner endpointは未実装。

区分：

- **決定済み**: 採用方針。
- **有力方針**: 現時点で推奨するが、Decisionとしては未採用の方針。
- **候補**: 比較・検証対象。採用を前提にしない技術。
- **未決定**: Productまたは技術Decisionが必要。
- **Prototype確認**: `figma-reference/`にだけ存在する構成。

## Architecture Goals

1. ハッカソンMVPを小さなVertical Sliceで構築できる。
2. Quest完了、EXP、Map、Boss等の重要処理を再現可能にする。
3. AI SDK固有型をDomainから隔離する。交換可能なProvider境界の正式採用は有力方針として検討する。
4. API key、Persistence、ValidationをBrowserから分離する。
5. 将来のNutrition / MealAI再利用を可能にしつつ、現在のMVPを過剰設計しない。
6. Figma PrototypeのDummy LogicをProductionへ混入させない。

## Logical Architecture

```mermaid
flowchart LR
    UI[React / TypeScript / Vite] --> API[Node.js / Express / TypeScript]
    API --> APP[Application Use Cases]
    APP --> DOMAIN[Deterministic Domain Services]
    APP --> OPENAI[OpenAI API via Backend]
    APP --> STORE[(Persistence: candidate / unresolved)]
```

この図はTrust boundaryを示す。Responses APIとStructured OutputsはTraining Plan Smoke Boundaryで採用済み。`AiProvider` / `OpenAIProvider`、`MockProvider`、Database製品はまだ固定しない。

### Trust boundary

- Browserは未信頼入力源として扱う。
- Express APIがAuthentication候補、Request Validation、Authorization、Rate Limit、Use Case起動の境界になる。
- OpenAI API keyとDatabase CredentialをBrowserへ送らない。
- AI出力も未信頼入力としてValidationする。

## Planned Stack

### 決定済み

- Frontend: React / TypeScript / ViteのWeb Clientを維持し、スマートフォンをPrimary ClientとするMobile-first UIを実装する。DesktopはSecondary accessとして扱う。
- Backend: Node.js / Express / TypeScript。以前共有されたProduct仕様で基本構成として明示されているため採用済みと扱う。
- AI: OpenAI APIをBackend経由で使用し、API keyをFrontendへ出さない。
- AI Integration Foundation: 公式OpenAI SDKを`server/`のみに置き、Responses API + Strict JSON Schema Structured Outputsを使用する。AI出力は`shared/`の`validateTrainingPlanDraft()`で再検証する。

### 有力方針

- AI boundary: `AiProvider` / `OpenAIProvider`をApplication層のPortとして採用し、OpenAI SDK固有型をDomainへ漏らさない

### 候補

- Web App拡張: PWA、Service Worker、Push Notification
- Native packaging: Capacitor
- 別Frontend技術への将来移行: React Native / Expo
- API Validation: Zod
- Styling: Tailwind CSS
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Development / Test: `MockProvider`

### 未決定

- PWA / Service Worker、Offline、Push Notification、Background syncの採用と運用
- Native packaging方法、App Store / Google Play配布、Native API利用
- HealthKit / Google Health Connect等のHealth data連携
- 最終Production Model（Development defaultは`gpt-5.6-luna`、`OPENAI_MODEL`で変更可）
- Production Prompt、User Training Context Schema、Tool call採用、Retry / Timeout / Cost policy
- Deployment / Hosting構成

有力方針と候補は導入前に`docs/DECISIONS.md`で正式採用を記録する。今回の採用範囲はD-021を参照する。

Mobile-firstはUI設計方針であり、Native App化を意味しない。現時点のProduction FrontendはWeb Clientで、PWAやCapacitorの設定は導入しない。

## Repository Layout

### 決定済み

npm workspacesを使用し、次の責務で分離する。

```text
client/           React / TypeScript / Vite
server/           Node.js / Express / TypeScript
shared/           Frontend / Backend共有型と決定論的Domain
docs/             Product / Architecture / Decision
figma-reference/  Figma Snapshot; Production対象外・Git管理外
```

`shared/`にはFrontend / Backendの両方から利用できる純粋なTypeScript Domainを置く。Prototype Dataや未確定のAPI contractは持ち込まない。

## Training Catalog Domain

### 決定済み

`shared/src/domain/training/`に、Equipment Master、Exercise Master、Gym Equipment Profile型、決定論的Filterを置く。

- EquipmentとExerciseを別Catalogとして管理し、安定したIDで参照する。
- ExerciseはPrimary / Secondary Muscle、Movement Pattern、Difficulty、必要Equipmentの選択肢、Alternative Exercise IDを持つ。
- Gym Equipment Profileは利用可能な`equipmentId`を保持する。UserやDatabaseへの保存方法はこのDomainへ含めない。
- Exercise FilterはPrimary Muscle、Movement Pattern、Difficulty、Gym Equipment Profileの指定された条件だけを適用する純粋関数とする。
- 必要Equipmentは、Exerciseに定義された完全なEquipment SetのいずれかをProfileが満たす場合だけ利用可能と判定する。
- Substitution候補は同じCatalogの明示的なAlternativeから、Muscle、Movement Pattern、利用可能Equipmentを決定論的に検証して返す。
- Training Candidate Builderは、Gym Equipment Profileと指定されたMuscle、Movement Pattern、Difficultyを既存Filterへ渡し、Plannerへ渡せるCatalog由来の候補だけを返す。
- Main Exercise指定時はCatalog所属とEquipment適合を検証し、正常なら他候補と別枠で保持する。不明なIDまたは実施不可能なMain Exerciseはcode付きErrorにする。
- Planner向け候補は`exerciseId`、表示名、Primary / Secondary Muscle、Movement Pattern、Difficultyに限定したDomain Dataであり、PromptやAI Provider契約ではない。
- MVPは主要Equipmentと代表Exerciseだけを収録し、Catalog Item追加で拡張する。全世界のExerciseやメーカー固有Machineは網羅しない。

Exercise情報の正式な情報源、監修、Catalog Versioningと更新運用、候補からの最終選択、件数、具体的なsets / reps推奨範囲、weightの決定は未決定。Draftのsets / rep range形状とCandidate再検証はD-020で決定済み。

## Frontend Responsibilities

Frontendが担当するもの：

- Screen / Navigation / Overlay表示
- Form inputとClient-side usability validation
- API request / responseの表示
- Loading、Error、Retry、Optimistic UIの制御
- AccessibilityとResponsive layout
- Serverから返されたGame State / View Modelの表示

Frontendが担当しないもの：

- e1RMの権威ある確定
- Quest完了判定
- EXP・Level・Boss・Stageの確定
- Schedule変更の正当性判定
- Databaseへの直接保存
- OpenAI API呼び出し
- API key管理

UI側で即時Preview計算を行う場合も、Server側で同じ決定論的ルールを再検証し、Server結果を正とする。

## Backend Layers

### HTTP / Transport

- Express route
- Request / Response schema validation。Validation libraryは未決定で、Zodは候補。
- Authentication / Authorization（採用時）
- Error mapping
- Idempotency keyまたは同等の多重実行防止

### Application Use Cases

候補となるUse Case：

- `CompleteOnboarding`
- `CreateRoadmap`
- `GetTodayQuest`
- `ToggleExerciseCompletion`または`RecordExerciseCompletion`
- `CompleteQuest`
- `SubstituteExercise`
- `RescheduleTraining`
- `RecordStrengthSet`
- `EvaluateBossEligibility`
- `DefeatBoss`
- `AdvanceStage`
- `GenerateTrainingPlanProposal`
- `GenerateMealProposal`

Application層はTransaction境界、Repository、Domain Service、AI integrationを調停する。Provider abstractionを採用する場合も、AI応答をそのまま保存・確定しない。

### Domain Services / Tools

Pure TypeScriptで決定論的に処理する。

- e1RM計算
- Quest完了条件
- EXP付与
- Level判定
- Map進行
- Date / Timezone計算
- Stage番号とBoss条件
- Schedule制約Validation
- Exercise Catalog FilterとEquipment適合判定
- Exercise substitution候補の決定論的絞り込み
- Reward確定ルール（採用時）
- Input / State transition validation

可能な限り副作用を持たない関数とし、入力、Rule Version、出力をテストできる形にする。

### Repository Ports

Application層はDatabase SDKを直接前提にせず、目的別のRepository interfaceを利用する。

例：

- `UserProfileRepository`
- `TrainingPlanRepository`
- `QuestRepository`
- `ProgressRepository`
- `CharacterRepository`
- `RewardRepository`

MVPでIn-memory実装を使うか、最初からDatabaseを使うかは未決定。

## Core Workflows

### Quest completion

1. ClientがQuest IDとExercise completion情報を送る。
2. APIがSchema、User、Quest ownership、Quest statusを検証する。
3. Domainが必須ExerciseとQuest完了条件を評価する。
4. 同一TransactionでQuestをCompletedにし、EXP、Map、HP / Reward結果を確定する。
5. APIが`QuestClearResult`を返す。
6. Frontendが結果に基づきQuest Clear / Level Up / Reward演出を表示する。

再送時にEXPやMap進行を二重付与しないことが必須。

### Schedule rescheduling

1. Clientが移動元Scheduled Activityと移動先日付を指定する。
2. Domainが未来日、重複、Training間隔、Stage境界等を検証する。
3. 必要ならAIが再計画案を提案する。
4. DomainがAI案を許可されたExercise、日付、Frequency等で再検証する。
5. ユーザー確定後にScheduleだけを保存する。
6. EXP、Map、Quest完了は変更しない。

### Boss eligibility / defeat

1. Map到達を保存済みProgressから判定する。
2. 必要なゲーム条件を決定論的に判定する。
3. 検証済みStrength Recordからe1RM条件を判定する。
4. 全条件達成時のみChallenge / Defeat Use Caseを許可する。
5. RewardとStage Clearを一度だけ確定する。

## AI Boundary

AIは次の処理を提案できる。

- Training Plan / Daily Training
- Schedule変更時の再計画候補
- Exercise / Alternative候補
- Progress解釈
- Meal提案
- NPC / Flavor text

Training PlannerやExercise提案へAIを採用する場合、Backend / sharedのTraining Candidate BuilderがProduction Exercise Catalogを決定論的にFilterする。AIには候補`exerciseId`と判断に必要なCatalog Metadataだけを渡し、自由なExercise名生成やCatalog外IDの確定を許可しない。

`shared/`の`validateTrainingPlanDraft()`は、AI出力を`TrainingCandidateResult`に対して再検証する決定論的Domain Boundaryである。構造化DraftはExerciseの順序、`exerciseId`、`main` / `accessory`、sets、rep rangeだけを扱い、weightを含めない。`server/src/openai/`はSDK Client、Responses API呼び出し、Strict JSON Schema、Domain再検証を分離する。明示実行のSmoke Script以外にAPI Callはなく、Backend endpoint、Production Prompt、実際のLoad計算は未実装・未決定。

AIへ任せない処理は`docs/AI.md`を正とする。Provider interfaceを正式採用する場合は、Model名やOpenAI固有Response typeをApplication / Domainへ公開しない。

## Persistence / Consistency

### 必須方針

- Quest、EXP、Map、Boss、Rewardの更新は整合したTransactionとして扱う。
- Domain EventまたはResult objectで、UI演出に必要な`leveledUp`、`mapAdvanced`、`rewardGranted`等を返す。
- 重要な計算にはRule Versionを持たせ、将来の計算式変更後も過去記録を説明可能にする。
- Timestampは保存時にUTC、Product上の日付判定はUser timezoneで扱う方向とする。正式なTimezone仕様は未決定。
- Random Rewardを採用する場合、Server側で確定し、再試行で変わらないID / Seed / Resultを保存する。

## Security / Privacy

- `.env`とSecretをcommitしない。
- OpenAI、Database、AuthのSecretをBackend環境だけに置く。
- Request、AI Output、Database writeをSchema Validationする。
- User間のProfile、Workout、Progressを分離する。
- Logへ食事制約、身体情報、認証情報、Prompt全文を無制限に残さない。
- AIへ送るPersonal Dataを最小化する。
- 正式なData retention、Export / Delete、Privacy方針は未決定。

## Observability

実装時の最小候補：

- Request ID / Use Case名 / User IDの安全な内部識別子
- AI Provider、Model、Latency、Schema validation結果、Fallback有無
- Domain rule version
- Quest / RewardのIdempotency結果
- Error category。Secretや不要なPersonal Dataは記録しない

監視Serviceの採用は未決定。

## Testing Strategy

### Domain unit tests

- Exercise / Equipment CatalogのID・参照・Equipment Option整合性
- Exercise FilterのMuscle・Movement・Difficulty・Equipment条件
- Exercise substitutionの明示的Alternative・Muscle・Movement・Equipment条件
- Training Candidate BuilderのMain Exercise validation、Equipment適合、Catalog所属、Muscle / Movement絞り込み
- Training Plan Draftの構造、Candidate ID再検証、Main Exercise role、重複、正の整数sets / rep range
- e1RM境界値
- Exercise completion guard
- Bonus QuestがMain Clearを阻害しないこと
- Schedule変更でEXP / Mapが変わらないこと
- EXP / Level境界
- Boss eligibility
- Stage advance
- Date / timezone
- Random Rewardの再現性

### Application / integration tests

- Quest完了のTransactionとIdempotency
- Schedule変更と再計画Validation
- AI Output schema rejection / fallback
- Repository failure時のRollback
- Authentication / Authorization（採用時）

### Frontend tests

- Main Exercise未完了時のButton disabled
- Substitutionが対象Exerciseだけに反映されること
- Quest Clear → Level Up等の表示順
- Boss Shield / Challengeの条件表示
- Loading / Error / Retry

## Figma PrototypeのArchitecture上の扱い

PrototypeはReact Context + `useReducer`、Local memory、Dummy Dataだけで動く。Backend、Database、Auth、Cloud Persistence、OpenAI APIはない。

Productionで再利用してよいのは、画面意図、用語、Interaction仮説、Visual directionである。次はそのまま移植しない。

- Reducer内の固定EXP、Stage、HP、Reward確率
- `Math.random()`によるClient-side Reward
- Demo Toggle
- 固定Progress / Support Stats
- Unsaved Onboarding fields
- Figma固有Vite plugin / deploy設定
- `figma-reference/`のComponent実装

## MealAI資産の再利用方針

別RepositoryのMealAIから評価対象にする設計：

- Structured Output
- Provider abstraction
- AgentTool abstraction
- BackendでToolを実行する制御
- Provider / Tool実行の検証方法

無条件に移植しないもの：

- Gemini固有型とProvider実装
- Fitness RPGに不要なAgent flow
- Repository構成、Domain model、Prompt
- API契約とError model

再利用時はFitness RPGの責務を優先し、採用済みのResponses APIとDomain Validationへ合わせてDecisionを残す。Zodは引き続き候補であり、今回は導入していない。

## 未決定のArchitecture事項

- Database正式採用とMigration方式
- AuthenticationをMVPに含めるか
- API styleとEndpoint contract
- `AiProvider` / `OpenAIProvider`の正式採用とinterface粒度
- Request / Response Validation library
- 最終Production Model、Production Prompt / Context、Tool利用方法、Retry / Timeout / Cost policy
- Deployment / Hosting
- Background jobの必要性
- Health data integration
- Observability service
- Caching、Offline、Sync
- Production Design SystemとTailwind CSS正式採用
