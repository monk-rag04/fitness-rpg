# Fitness RPG Repository Guide

このリポジトリは、ハッカソン向けの「現実連動型フィットネスRPG」を開発するためのものです。主人公はユーザー自身であり、現実のTraining・Nutrition・Recovery・Strength成長を、Quest・EXP・Character Growth・Adventure Map・Boss Battleへ変換します。

## 最初に読む資料

作業前に、変更対象に応じて次を読むこと。

1. `AGENTS.md`
2. `README.md`
3. `docs/PRODUCT.md`
4. `docs/UX.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DATA_MODEL.md`
7. `docs/AI.md`
8. `docs/DECISIONS.md`
9. `docs/DEVELOPMENT_WORKFLOW.md`

仕様変更時は、コードだけでなく関連する設計ドキュメントも同じ変更で更新する。

## Source of Truth

- Product・UX・ArchitectureのSource of Truthは、ルートの`docs/`と`AGENTS.md`。
- 実際に動作するProduction実装が追加された後は、Production codeとテストが実装挙動のSource of Truthになる。
- `figma-reference/`は、Figma MakeからDownload codeで書き出した参照用Snapshotであり、Production codeではない。
- Figma上の表示、Dummy Data、固定値、デモ用切替、仮計算をProduction仕様として扱わない。
- Figma変更を伴うUI作業では、作業時点のFigmaまたは最新の`figma-reference/`を確認し、「Prototypeで確認した事実」と「Productとして確定した仕様」を分ける。
- UI / Figmaに関わる変更を始める前に`docs/DEVELOPMENT_WORKFLOW.md`を読み、変更タイプに対応する同期Flowと影響範囲確認を行う。
- Frontend / UI変更では`docs/DECISIONS.md`のMobile-first Decision（D-019）を確認し、Smartphone viewportをPrimaryとして検証する。Mobile-firstをPWA / Native App化の決定と混同しない。
- 未決定事項を実装都合だけで確定しない。必要な場合は`docs/DECISIONS.md`へ提案と論点を記録する。

## `figma-reference/`の扱い

- 読み取り専用の参照資料として扱う。
- Productionのimport元、ビルド対象、実行時依存にしない。
- コードをそのままProductionへコピーしない。意図を確認し、Productionの責務・型・テストへ合わせて再設計する。
- Snapshotは欠落・未接続・矛盾を含み得る。ファイルの存在だけで機能完成と判断しない。
- 参照コードを更新する必要がある場合は、Figma Makeの公式Download codeからSnapshot全体を更新し、確認日と差分を関連ドキュメントへ反映する。

## Product原則

- 単なる筋トレ記録アプリや健康Dashboardにしない。
- 「日々の行動によってMapを進める」と「現実のStrength成長によってBossを倒す」の二層構造を守る。
- MVPは18〜30歳程度の筋トレ初心者〜中級者を主対象とし、筋力向上・筋肥大へ集中する。
- TrainingだけでなくRecoveryも正当な攻略行動として扱う。
- Main Training QuestはExercise単位で完了を記録し、必須Exercise完了前にQuest Clearさせない。
- Bonus QuestはMain Training Questの必須Clear条件にしない。
- Schedule変更をQuest完了として扱わない。予定変更だけでEXP付与、Map進行、QUEST CLEAR表示を行わない。
- 否定的な評価ではなく、Play Style・Title・Buildとして楽しくフィードバックする。
- ハッカソンMVPを優先し、未確定の将来要件まで過剰設計しない。

## Architecture原則

- Frontend、Backend、Domain、AI integration、Persistenceの責務を分離する。
- AI APIは必ずBackend経由で呼び、API keyをFrontendへ露出しない。
- `.env`をcommitしない。必要なキー名だけを`.env.example`で共有する。
- `AiProvider` abstractionの正式採用は未決定。採用判断まではOpenAI SDK固有型をDomainへ漏らさず、変更可能な境界を保つ。
- e1RM、EXP、Level、Boss条件、Quest完了、日付、Stage番号、Validation、保存、Securityは決定論的なTypeScriptのServiceまたはToolで処理する。
- AI出力は提案として扱い、型・業務ルール・許可されたExercise・日付制約を決定論的に検証してから利用する。
- DatabaseとAuthenticationの正式採用は未決定。候補を確定事項として実装しない。
- MealAIからはProvider abstraction、Structured Output、Tool境界など有効な設計だけを評価し、コードやArchitectureを無条件に移植しない。

## 開発ルール

- `main`は常に動作可能な状態を維持する。
- `develop` branchは使わない。
- 作業branchは`feature/*`、`fix/*`、`setup/*`を使用する。
- `main`へ直接commitしない。ユーザー確認前に`main`へmergeしない。
- 大規模な仕様変更、依存追加、外部サービス導入を勝手に行わない。
- ユーザーが設計・調査だけを依頼した場合、アプリ本体・依存関係・インフラを変更しない。
- 既存の未コミット変更はユーザーのものとして保持し、無関係な整形や上書きをしない。

## 変更後の確認

変更内容に応じ、可能な範囲で以下を実施する。

- typecheck
- test
- build
- `git status`
- `git diff`
- 関連docsとの整合性確認

テストやBuildを実行できない場合は、理由と未検証範囲を報告する。

## ドキュメント記述ルール

- 「決定済み」「有力方針」「候補」「未決定」「Prototype確認」を明示する。
- Dummy Dataや仮ロジックを記録するときは、必ずProduction仕様ではない旨を併記する。
- 数値・閾値・計算式を新規に確定する場合は、根拠とDecisionを`docs/DECISIONS.md`へ追加する。
- Product要件と現行Prototypeが違う場合は、Prototypeへ合わせてProduct要件を書き換えず、差分として残す。
