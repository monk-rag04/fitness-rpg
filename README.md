# Fitness RPG

現実の自分を鍛え、BOSSを討つAIフィットネスRPG。

TrainingとRecoveryをDaily Questに、記録した行動をEXPとCharacter Growthに変換し、Adventure Mapを進みます。Stageの最後には、実際のStrength記録を使ったBoss Battleが待っています。AIはRoadmapの期間見積もりとStage Training Programの作成を支え、Quest進行やStrength判定などのルールは決定論的なDomainロジックが管理します。

## Demo

[https://fitness-rpg-rzut.onrender.com](https://fitness-rpg-rzut.onrender.com)

## このアプリについて

Fitness RPGは、現実のトレーニングとRecoveryを冒険の進行へつなぐ、モバイルファーストのWebアプリです。

- Daily Questを完了してAdventure Mapを進める
- Workoutの記録からEXPと部位別Character Growthを得る
- 実際のMain Strength記録をもとにBossへ挑戦する
- Bossを倒すとStage Clearとなり、Final Goalに届いていなければ次のStageへ進む

## 主な機能

- Main Strength、トレーニング経験、頻度などを入力するOnboarding。現在の重量が分からない場合は開始時のStrength目安を案内します。
- AIの期間見積もりと決定論的なStage PlanningによるRoadmap。Stage 1にはQuick Startの期間選択があります。
- 最初のTraining Questで器具を設定し、その器具と各Training Dayの条件に合うStage Training Programを生成します。
- Training / Recovery Quest、WorkoutのSet記録、Difficulty Feedback、理由付きExercise Skip、日程変更。
- Quest ClearによるTraining / Recovery EXP、Character Growth、Exercise Baselineの記録とAdaptive Progression。
- Adventure Map、CHARACTER、PROGRESSの各画面。
- e1RMを使うBoss Battle、Stage Clear、Final Goalまでの次Stage Roadmap。

## Game Loop

```text
Onboarding
  ↓
Roadmap
  ↓
Equipment Check → Stage Training Program
  ↓
Training / Recovery Quest
  ↓
Quest Clear → EXP / Character Growth / Exercise Progression
  ↓
Adventure Map → Boss Battle
  ↓
Stage Clear → Next Stage（Final Goal未達の場合）
```

## AIと決定論的Domain

OpenAI APIは、Roadmap用の到達期間見積もりとStage Training Programの作成に使います。Program生成ではServerが先に器具とTraining DayごとのExercise候補を検証し、候補を限定してStructured Outputを要求します。生成結果はShared Domainで全体検証し、失敗時の内部再試行は最大1回です。完全に検証されたProgramだけをSessionへ保存します。

e1RM計算、Equipment / Exercise候補の検証、Roadmapの日程、Quest Clear、EXP、Exercise Progression、Boss判定、Stage stateはTypeScriptの決定論的な処理です。AIがゲームルールやQuestの結果を自由に決めることはありません。

## 技術構成

- Frontend: React、TypeScript、Vite
- Backend: Node.js、Express、TypeScript
- AI: OpenAI API、公式OpenAI SDK、Responses API、Structured Outputs
- Tests: Node.js組み込みの`node:test`
- npm Workspacesで`client/`、`server/`、`shared/`を管理

## Architecture

```text
client/   React UI、ユーザー操作、Adventure Session state
server/   Express API、Server側のOpenAI連携
shared/   Catalog、Domain rule、candidate builder、validation
docs/     Product、UX、Architecture、AI、Decision資料
```

DevelopmentではViteが`/api`をローカルExpress Serverへproxyします。ProductionではReactのBuild成果物をExpressが配信し、Frontendと`/api`を同一originで提供します。OpenAI API KeyはServer環境だけで使い、Client bundleへ渡しません。

## Local Setup

Node.js 22.12以降を推奨します。Repositoryはnpm `11.19.0`を指定しています。

Repositoryをcloneした後、root directoryで依存関係をインストールします。

```sh
cd fitness-rpg
npm install
```

Environment fileを作成します。

```sh
# macOS / Linux
cp server/.env.example server/.env
```

```powershell
# Windows PowerShell
Copy-Item server/.env.example server/.env
```

`server/.env`で`OPENAI_API_KEY`を設定してください。API KeyはServer専用です。`OPENAI_MODEL`は任意で、未設定の場合は`gpt-5.6-luna`を使います。Development ServerはAPI Key未設定時に安全に起動を停止します。

2つのTerminalで起動します。

```sh
# Terminal 1
npm run dev:server
```

```sh
# Terminal 2
npm run dev:client
```

ViteのURLは通常[http://localhost:5173](http://localhost:5173)です。PowerShellの実行ポリシーによって`npm`が拒否される場合は、`npm.cmd`を使ってください（例：`npm.cmd run dev:server`）。

Roadmap見積もりとStage Training Program生成ではOpenAI APIを呼び出します。

## Production Build / Start

```sh
npm run build
npm start
```

`npm start`はBuild済みのExpress Serverを起動します。PORT環境変数があればそれを使用し、未設定なら`3000`で待ち受けます。Clientの静的ファイルと`/api`は同じoriginから配信されます。

## Tests

```sh
npm run test:shared
npm run test:server
npm run test:client
npm run build
```

Client / ServerのTypeScript typecheckは次のコマンドで実行できます。

```sh
npm run typecheck --workspace @fitness-rpg/client
npm run typecheck --workspace @fitness-rpg/server
```

通常のTestsとBuildは実OpenAI APIを呼び出しません。明示的なProvider Smokeには`npm run smoke:openai`を使います。このSmokeおよびアプリ内のAI機能は実APIを呼ぶため、API利用量が発生する場合があります。

## MVPの範囲と制約

Adventure Sessionは現在Browser内のメモリで管理されます。ページを再読み込みするとSessionはリセットされ、アカウント間・端末間の保存もありません。Database、Authentication、継続的なクラウド保存はこのMVPには含まれません。Nutritionの記録・Quest進行も現在のProduction機能には含まれていません。

## Security

- API Keyや他のSecretをRepositoryへ含めないでください。
- `OPENAI_API_KEY`はServer側の環境変数（ローカルでは`server/.env`）だけに設定します。
- `server/.env`はGit管理対象外です。`server/.env.example`には変数名とModel defaultのみを記載しています。

## 関連資料

- [Product](docs/PRODUCT.md)
- [UX](docs/UX.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)
- [AI](docs/AI.md)
- [Decisions](docs/DECISIONS.md)
