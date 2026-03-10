/**
 * toolbar.js - ツールバー操作とキーボードショートカット
 * マークダウン記法のクイック挿入とショートカットキー管理
 */

import { wrapSelection, prependToLine, insertText } from './editor.js';

/**
 * ツールバーのアクション定義
 * 各アクションはエディターに対するマークダウン記法の挿入処理を行う
 */
const actions = {
    heading1: () => prependToLine('# '),
    heading2: () => prependToLine('## '),
    heading3: () => prependToLine('### '),
    bold: () => wrapSelection('**', '**'),
    italic: () => wrapSelection('*', '*'),
    strikethrough: () => wrapSelection('~~', '~~'),
    code: () => wrapSelection('`', '`'),
    codeblock: () => insertText('\n```\nコードをここに入力\n```\n'),
    link: () => wrapSelection('[', '](url)'),
    image: () => insertText('![代替テキスト](画像URL)'),
    quote: () => prependToLine('> '),
    ul: () => prependToLine('- '),
    ol: () => prependToLine('1. '),
    checklist: () => prependToLine('- [ ] '),
    hr: () => insertText('\n---\n'),
    table: () => insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| データ | データ | データ |\n'),
};

/** 表示モード管理 */
let currentViewMode = 'split'; // 'split', 'editor', 'preview'
let onViewModeChangeCallback = null;
let onOutlineToggleCallback = null;

/**
 * ツールバーを初期化し、イベントリスナーを設定する
 * @param {Object} options - 初期化オプション
 * @param {Function} options.onViewModeChange - 表示モード変更コールバック
 * @param {Function} options.onOutlineToggle - アウトライン表示切替コールバック
 * @param {Function} options.onSave - 保存コールバック
 * @param {Function} options.onSaveAs - 別名保存コールバック
 * @param {Function} options.onOpen - ファイルを開くコールバック
 * @param {Function} options.onNew - 新規作成コールバック
 */
export function initToolbar({ onViewModeChange, onOutlineToggle, onSave, onSaveAs, onOpen, onNew } = {}) {
    onViewModeChangeCallback = onViewModeChange;
    onOutlineToggleCallback = onOutlineToggle;

    // ツールバーボタンのmousedownでフォーカスの移動を防止
    document.getElementById('toolbar').addEventListener('mousedown', (e) => {
        if (e.target.closest('.toolbar-btn')) {
            e.preventDefault();
        }
    });

    // ツールバーボタンのクリックイベント
    document.getElementById('toolbar').addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action && actions[action]) {
            actions[action]();
        } else if (action === 'toggleOutline') {
            if (onOutlineToggleCallback) onOutlineToggleCallback();
        }
    });

    // 表示切替ボタン
    document.getElementById('btn-view-toggle').addEventListener('click', () => {
        cycleViewMode();
    });

    // 印刷ボタン
    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => window.print());
    }

    // ヘッダーボタンのイベント
    document.getElementById('btn-new').addEventListener('click', () => onNew && onNew());
    document.getElementById('btn-open').addEventListener('click', () => onOpen && onOpen());
    document.getElementById('btn-save').addEventListener('click', () => onSave && onSave());
    document.getElementById('btn-save-as').addEventListener('click', () => onSaveAs && onSaveAs());

    // キーボードショートカットの設定
    setupKeyboardShortcuts({ onSave, onSaveAs, onOpen, onNew });
}

/**
 * 表示モードを順番に切り替える
 * split -> editor -> preview -> split
 */
function cycleViewMode() {
    const modes = ['split', 'editor', 'preview'];
    const currentIndex = modes.indexOf(currentViewMode);
    currentViewMode = modes[(currentIndex + 1) % modes.length];

    // CSSクラスの更新
    const mainContent = document.getElementById('main-content');
    mainContent.classList.remove('view-editor-only', 'view-preview-only');

    if (currentViewMode === 'editor') {
        mainContent.classList.add('view-editor-only');
    } else if (currentViewMode === 'preview') {
        mainContent.classList.add('view-preview-only');
    }

    if (onViewModeChangeCallback) {
        onViewModeChangeCallback(currentViewMode);
    }
}

/**
 * キーボードショートカットを設定する
 * @param {Object} callbacks - コールバック関数
 */
function setupKeyboardShortcuts({ onSave, onSaveAs, onOpen, onNew }) {
    document.addEventListener('keydown', (e) => {
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isCtrl) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ctrl+Shift+S: 名前を付けて保存
                        if (onSaveAs) onSaveAs();
                    } else {
                        // Ctrl+S: 上書き保存
                        if (onSave) onSave();
                    }
                    break;

                case 'o':
                    // Ctrl+O: 開く
                    e.preventDefault();
                    if (onOpen) onOpen();
                    break;

                case 'n':
                    // Ctrl+N: 新規
                    e.preventDefault();
                    if (onNew) onNew();
                    break;

                case 'b':
                    // Ctrl+B: 太字
                    e.preventDefault();
                    actions.bold();
                    break;

                case 'i':
                    // Ctrl+I: 斜体
                    e.preventDefault();
                    actions.italic();
                    break;

                case 'k':
                    // Ctrl+K: リンク
                    e.preventDefault();
                    actions.link();
                    break;

                case '1':
                    // Ctrl+1: 見出し1
                    e.preventDefault();
                    actions.heading1();
                    break;

                case '2':
                    // Ctrl+2: 見出し2
                    e.preventDefault();
                    actions.heading2();
                    break;

                case '3':
                    // Ctrl+3: 見出し3
                    e.preventDefault();
                    actions.heading3();
                    break;

                case 'p':
                    // Ctrl+P: 印刷
                    e.preventDefault();
                    window.print();
                    break;
            }
        }
    });
}
