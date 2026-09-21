# Fitness RPG

「現実の自分を鍛えることで攻略するRPG」を作る、ハッカソン向けプロジェクトです。

現実のTraining・Nutrition・Recovery・Strength成長を、Daily Quest、EXP、Character Growth、Adventure Map、Boss Battle、Stage Progression、Rewardへ変換します。主人公はゲーム内の架空キャラクターではなく、トレーニングを行うユーザー自身です。

## 現在の状態

Production AppとTraining DomainのFoundation、OpenAI APIのDevelopment Smoke Boundaryを実装済みです。ゲーム進行、Database、Authentication、Production Training Planner endpointはまだ実装していません。

このRepositoryには次が含まれます。

- Source of TruthとなるProduct・UX・Architecture設計
- React / TypeScript / Viteの最小Frontend
- Node.js / Express / TypeScriptの最小Backendと`GET /api/health`
- Exercise / Equipment Catalog、Gym Equipment Profile型、決定論的Filterを持つ`shared` Workspace
- Backendの公式OpenAI SDK / Responses API / Structured Outputsを使う明示実行のTraining Plan Smoke Script
- Figma Makeの現状確認用Snapshotである`figma-reference/`（Production codeではありません）

## 基本ゲームループ

```text
Onboarding
  → Training Roadmap作成
  → Training / Recovery
  → Daily Quest
  → QUEST CLEAR
  → EXP / Character Growth
  → Adventure Map進行
  → Boss地点到達
  → 現実のStrength条件判定
  → BOSS DEFEATED
  → STAGE CLEAR
  → NEXT STAGE
```

中核となる考え方は次の二つです。

- 日々のTraining・Nutrition・RecoveryによってMapを進める。
- 現実のStrength成長によってBossを倒す。

## Source of Truth

- [Product仕様](docs/PRODUCT.md)
- [UX・画面・Prototype監査](docs/UX.md)
- [Architecture](docs/ARCHITECTURE.md)
- [概念Data Model](docs/DATA_MODEL.md)
- [AI責務と境界](docs/AI.md)
- [決定事項・未決定事項](docs/DECISIONS.md)
- [Figma・Codex・GitHubの開発Workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Repository作業ルール](AGENTS.md)

## Figma Reference

`figma-reference/`は、Figma Makeから公式のDownload codeで書き出した参照用Snapshotです。

- 現在のPrototypeで実際に存在するScreen、State、Interaction、Dummy Dataの確認に使います。
- Production buildへ含めたり、Productionからimportしたりしません。
- 固定EXP、Stage日数、Treasure確率、デモ切替などはPrototype専用であり、Production仕様ではありません。
- Product要件と異なる場合は、`docs/`をSource of Truthとし、差分を`docs/UX.md`と`docs/DECISIONS.md`に残します。

## 予定技術構成

決定済み：

- Frontend: React / TypeScript / Vite
- Backend: Node.js / Express / TypeScript
- AI: OpenAI APIをBackend経由で利用
- Training Plan Integration: 公式OpenAI SDK、Responses API、Strict JSON Schema Structured Outputs、Domain再Validation

有力方針：

- `AiProvider` abstractionと`OpenAIProvider`

候補・未決定：

- Validation library: Zod候補
- Styling: Tailwind CSS候補
- Database: Supabase PostgreSQL候補
- Authentication: Supabase Auth候補。MVPでの必要性も未決定
- 開発用MockProvider
- 最終Production Model、Production Prompt / User Context、Retry / Timeout / Cost policy

## Workspace構成

```text
client/   React / TypeScript / Vite
server/   Node.js / Express / TypeScript
shared/   共有Training Domain（Catalog、Candidate Builder、Session Input / Plan Validation）
docs/     Product / Architecture / DecisionのSource of Truth
```

npm workspacesを使用します。

```powershell
npm install
npm run dev:server
npm run dev:client
```

`dev:server`と`dev:client`は別Terminalで実行します。FrontendはVite proxy経由で`GET /api/health`を呼び出します。

Workspace別および全体のBuild：

```powershell
npm run test:shared
npm run build:shared
npm run build:server
npm run build:client
npm run build
```

## OpenAI Development Smoke Test

Node.js 24の標準`--env-file-if-exists`を使い、`server/.env`を明示実行時だけ読み込みます。`server/.env.example`を参考に、API keyを自分で`server/.env`へ設定してください。実際の`.env`はGit管理外であり、Frontendへkeyを置きません。Development default modelは`gpt-5.6-luna`で、`OPENAI_MODEL`から変更可能です。

```powershell
npm run smoke:openai
```

このコマンドだけが実APIを呼び、料金が発生し得ます。固定Equipment Profileから`buildTrainingCandidates()`を呼び、候補・Training経験月数・Session Focusを検証して送信します。1回のSessionのStructured `TrainingPlanDraft`を生成し、`validateTrainingPlanDraft()`で再検証します。通常の`npm run test:shared` / `npm run test:server` / `npm run build`はAPIを呼びません。新Inputでの実API Smokeはユーザーが成功を報告済みです。現在のSmoke PromptとModel defaultはDevelopment用であり、Productionの推奨内容を確定しません。

## 開発方針

- `main`を常に動作可能に保ち、`develop`は使いません。
- `feature/*`、`fix/*`、`setup/*` branchで作業します。
- API keyをFrontendへ置かず、`.env`をcommitしません。
- AIへ決定論的な判定を任せません。
- 仕様変更時はProduction codeと関連docsを同時に更新します。

## 次のStep

次は未決定事項のうちMVP Blocking項目を絞り、最小のVertical Slice（Onboarding → Roadmap → 1日のQuest → Quest Clear → Map進行）について、受け入れ条件と実装計画を確定する段階です。未決定技術をFoundationへ追加せず、採用Decisionを先に記録します。詳細は[Decisions](docs/DECISIONS.md)を参照してください。
