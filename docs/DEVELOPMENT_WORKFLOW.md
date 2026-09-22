# Development Workflow

## Purpose

この文書は、Figma / Figma Make、`figma-reference/`、GitHub、Codex、ChatGPTの役割と、UI・仕様・Codeを明示的に同期する手順を定義する。FigmaとProduction codeは完全自動同期ではない。

## Toolの役割

### Figma / Figma Make

- 3人のTeamでUI / UXを検討する場。
- Prototype、Interaction、新しいUI案、Visual directionを試す。
- Frontendの画面構造・Visual・UX意図のSource of Truth。Production実装そのものではなく、Product RuleはGitHub docs、実際の動作はProduction codeを正とする。
- Dummy Data、固定値、Demo Toggle、仮計算、未接続InteractionをProduction仕様として確定しない。

### `figma-reference/`

- 現在のFigma Makeを公式Download codeで書き出した参照用Snapshot。
- Production codeではなく、import元、Build対象、実行時依存にしない。
- Gitへcommitしない。
- Figma Makeと自動同期されない。Figma更新後もSnapshotは自動更新されない。
- 更新が必要な場合は公式Download codeでSnapshot全体を置き換え、差分を確認して`docs/UX.md`または`docs/DECISIONS.md`へ反映する。

### GitHub docs

- Product、Architecture、Data Model、AI方針、DecisionのSource of Truth。
- 確定事項、提案、候補、未決定、Prototypeとの差分を明示する。
- 仕様変更はCode変更と同じPR、またはCodeより先のReview可能なPRで更新する。

### GitHub code

- 実際に動作するProduction AppのSource of Truth。
- Testは重要なProduct ruleと実装挙動を検証するSource of Truthの一部。
- Figmaの画面構造・Visual・Interactionを忠実に移植し、PrototypeのDummy State / LogicはProductionの責務、型、安全性、Testへ置き換える。

### Codex

- Production実装、Code変更、Test、Build、docs更新を行う。
- Figmaまたは`figma-reference/`を参照し、Prototype確認とProduct仕様を分離する。
- 変更前に影響範囲と確定度を確認し、必要に応じてFigmaとCodeの橋渡しを行う。
- 未決定事項を実装都合で自動的に確定しない。

### ChatGPT

- 要件整理、設計相談、選択肢とTrade-offの整理を行う。
- Codexへ渡す実装・調査指示を作成する。
- 問題の切り分けとDecision準備を支援する。
- 提案した内容を、Teamが決定する前に「決定済み」と扱わない。

## Source of Truthの優先順位

対象ごとにSource of Truthが異なる。

| 対象 | Source of Truth | 補足 |
|---|---|---|
| Product仕様 | `docs/PRODUCT.md`と`docs/DECISIONS.md` | Architecture、Data Model、AI詳細は各docsで補足する |
| Frontend画面構造・Visual・UX意図 | Figma / Figma Make | Dummy State / Logicは含めない。Product仕様と矛盾する場合は差分を解決する |
| 実際の動作 | Production codeとtest | 実装バグを仕様として追認しない |
| Prototypeとの差分 | `docs/UX.md`または`docs/DECISIONS.md` | 観察結果とProduct Decisionを分離する |

衝突を見つけた場合は、どれかへ無言で合わせない。Product仕様、UI意図、実装挙動のどこが異なるかを記録し、必要なDecisionを確定してから同期する。

## FigmaとCodeの同期

Figma変更はProduction codeへ自動反映されず、Code変更もFigmaへ自動反映されない。次の明示的な同期作業を行う。

```text
Figma変更
  ↓
変更内容確定
  ↓
Codexへ共有
  ↓
影響範囲確認
  ↓
Code変更
  ↓
Test
  ↓
Preview
  ↓
Team確認
```

1. Figma上で変更案を作り、対象Screen、State、Interaction、Responsive / Accessibility意図を明示する。
2. Teamで「UI案」か「確定した変更」かを区別する。
3. CodexへFigma URL、Node、変更前後、受け入れ条件を共有する。MCPでMake本文を取得できない場合は最新Snapshotと更新日時を共有する。
4. CodexはFrontendだけでなく、Product、Data Model、Backend/API、AI、Test、docsへの影響を確認する。
5. 対象branchでCodeと必要なdocsを変更する。
6. 変更タイプに応じたtypecheck / test / buildを実行する。
7. PreviewでSmartphone PortraitをPrimaryとして主要State、Error、Empty、Loading、Responsive、Touch、Keyboard操作を確認する。375〜430px程度を重点確認する目安とし、Desktop PreviewだけでUI完了としない。
8. TeamがFigma意図、Product仕様、実際の動作を比較して確認する。

Codeから始まったUI変更も同様に、Team確認後にFigmaへ反映する作業を別途行う。同期が完了するまでは、`docs/UX.md`またはPRへ未同期範囲を記録する。

## UI変更タイプ別のFlow

### 1. UIのみ

対象例：色、余白、Typography、Icon、Copy、既存State内のLayout。

1. Figma / 最新Snapshotと`docs/UX.md`を確認する。
2. Product rule、Data Model、API contractが変わらないことを確認する。
3. Frontendを変更し、Component / visual state / accessibilityに必要なTestを更新する。
4. typecheck / test / build、Preview、Team確認を行う。
5. UI意図やPrototype差分が変わる場合は`docs/UX.md`も更新する。
6. Mobile viewportで片手操作、Tap target、Hover非依存、主要Navigationを確認する。Desktop表示だけで完了判定しない。

### 2. UI + Data Model

対象例：新しいField、State、履歴、Quest Item、Progress表示の追加。

1. `docs/PRODUCT.md`、`docs/UX.md`、`docs/DATA_MODEL.md`、`docs/DECISIONS.md`の確定度を確認・更新する。
2. Entity / Field / State transition、Migration要否、既存Dataとの互換性を決める。
3. Domain / Persistence / API contractを先に整え、次にUIへ接続する。
4. Unit / migration / integration / frontend Testを更新する。
5. Previewで新旧Data、Empty / Partial / Error stateを確認する。

### 3. UI + Backend/API

対象例：保存、更新、認証、Server判定を伴うInteraction。

1. Product ruleとAPI contract、権限、Validation、Error、Idempotencyを決める。
2. `docs/ARCHITECTURE.md`、必要に応じて`docs/DATA_MODEL.md`と`docs/DECISIONS.md`を更新する。
3. Backend / Domainを実装し、contract / integration Testを作る。
4. Frontendを接続し、Loading / Error / Retry / duplicate actionを検証する。
5. typecheck / test / build、Preview、Team確認を行う。

### 4. AI機能

対象例：Training Plan、Schedule再計画、Exercise候補、Progress説明、Meal提案。

1. `docs/AI.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`を確認する。
2. OpenAI API style、Provider、model、Schema、Tool利用がDecision済みか確認し、未決定なら先にDecisionする。
3. API keyはBackendだけに置き、FrontendからOpenAI APIを直接呼ばない。
4. AI出力を候補としてSchema validationとDomain validationへ通し、確定操作はApplication Use Caseで行う。
5. Failure / timeout / invalid output / fallback / safety / loggingを設計し、実APIに依存しないTest方法を用意する。
6. Eval、integration Test、Previewで品質と中核Game Loopの継続性を確認する。

### 5. 大規模仕様変更

対象例：Core Loop、Boss条件、Progression、MVP Scope、主要Navigationの変更。

1. Production実装を始める前に、Teamで目的、Scope、代替案、移行影響を確認する。
2. `docs/PRODUCT.md`と`docs/DECISIONS.md`を先に更新し、必要に応じてUX、Architecture、Data Model、AI文書を揃える。
3. Figmaで主要FlowとStateを検証し、Prototype確認と確定仕様の差分を記録する。
4. Implementation plan、Migration / Rollback、Test範囲、PR分割を決める。
5. Teamの仕様確認後に、Review可能な小さい単位で実装する。

## Git Flow

`develop` branchは使わない。

```text
main
  ↓
feature/* / fix/* / setup/*
  ↓
実装
  ↓
typecheck / test / build
  ↓
diff確認
  ↓
commit
  ↓
push
  ↓
PR
  ↓
確認
  ↓
merge
```

- `main`は常に動作可能に保ち、直接commitしない。
- Branchは1つの目的へ絞り、無関係な変更を混ぜない。
- Commit前に少なくとも`git status`、`git diff --stat`、`git diff --check`を確認する。
- Code変更時は影響に応じてtypecheck / test / buildを実行する。Docs-only変更では不要なInstall / Buildを行わない。
- PRには変更目的、Decision、Figma参照、Test結果、未決定・未同期事項を記載する。
- Reviewと必要なTeam確認後に`main`へmergeする。

## Figma Makeの現在の制約

今回、CodexのFigma MCPではFigma MakeのResource Link自体は確認できたが、Resource Link本文の取得で問題が発生し、Make内の実装をMCP経由で完全には読めなかった。

そのため現在は、Figma Makeの公式Download codeで書き出した`figma-reference/`を、現行Prototypeを確認するためのSnapshotとして参照している。これは暫定的な確認経路であり、恒久的な自動同期ではない。

- Figma Makeを変更しても`figma-reference/`は更新されない。
- `figma-reference/`を変更してもFigma Makeには反映されない。
- Snapshot取得時点より後のFigma変更は確認できない。
- MCP接続が改善しても、Product DecisionとPrototype観察を分離する原則は変わらない。
- Snapshotを更新した場合は、取得日、対象Figma、主要差分、docsへの反映状況を記録する。

