# MarkDown Studio

ローカルのマークダウンファイルを快適に編集できる専用デスクトップエディター。

## 概要

MarkDown Studioは、Tauriフレームワークを使用した軽量かつ高機能なクロスプラットフォーム対応のマークダウンエディターです。
ローカルファイルの直接編集、リアルタイムプレビュー、Mermaid図のレンダリングなど、快適な執筆環境を提供します。

## 主な機能

- **ネイティブファイル操作**: ローカルのマークダウンファイルを直接編集・保存。
- **リアルタイムプレビュー**: マークダウンの編集内容を即座に表示。
- **Mermaid図のレンダリング**: フローチャートやシーケンス図などを自動レンダリング。
- **リッチなエディター機能**: CodeMirrorベースの高性能エディター（シンタックスハイライト対応）。
- **アウトライン表示**: 見出し構造からアウトラインを自動生成。
- **テーマ切り替え**: ダークモードとライトモードに対応。

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript (Vite)
- **バックエンド**: Rust ([Tauri](https://tauri.app/))
- **エディター**: [CodeMirror 6](https://codemirror.net/)
- **レンダリング**: [marked](https://marked.js.org/), [Mermaid](https://mermaid.js.org/)

## 開発環境のセットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (LTS)
- [Rust Toolchain](https://www.rust-lang.org/tools/install)
- Windowsの場合: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### インストール

```bash
npm install
```

### 開発用サーバーの起動

#### デスクトップアプリ (Tauri)
```bash
npm run tauri dev
```

#### Webアプリ (ブラウザ)
```bash
npm run dev
```

## ビルド手順

### デスクトップアプリ (インストーラー作成)

配布用のインストーラー（.msi や .exe）を作成するには、以下のコマンドを実行します。

```bash
npm run tauri build
```

ビルドされた成果物は `src-tauri/target/release/bundle/` 以下に出力されます。

### Webアプリ (静的ファイル作成)

通常のWebサイトとして公開するための静的ファイルを生成する場合は、以下のコマンドを実行します。

```bash
npm run build
```

`dist/` ディレクトリにファイルが出力されます。

## テスト

アプリケーションのテストを実行する場合は、以下のコマンドを使用します。

### バックエンド (Rust) のテスト
```bash
cd src-tauri
cargo test
```

### フロントエンドのテスト
(現在は未設定ですが、Vitestなどの導入を推奨します)
