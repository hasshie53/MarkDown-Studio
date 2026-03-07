/**
 * editor.js - CodeMirror 6 エディターの構築・設定
 * マークダウン編集に特化した拡張機能を組み込む
 */

import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, rectangularSelection, highlightSpecialChars, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput, foldGutter, HighlightStyle } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

/**
 * マークダウン用のカスタムハイライトスタイル
 */
const markdownHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, class: 'cm-header-1' },
    { tag: tags.heading2, class: 'cm-header-2' },
    { tag: tags.heading3, class: 'cm-header-3' },
    { tag: tags.heading4, class: 'cm-header-4' },
    { tag: tags.strong, class: 'cm-strong' },
    { tag: tags.emphasis, class: 'cm-em' },
    { tag: tags.strikethrough, class: 'cm-strikethrough' },
    { tag: tags.link, class: 'cm-link' },
    { tag: tags.url, class: 'cm-url' },
    { tag: tags.quote, class: 'cm-quote' },
]);

/** エディターのインスタンスを保持 */
let editorView = null;

/** ドキュメント変更時のコールバック */
let onChangeCallback = null;

/** カーソル移動時のコールバック */
let onCursorChangeCallback = null;

/**
 * CodeMirrorエディターを初期化する
 * @param {HTMLElement} container - エディターを配置するコンテナ要素
 * @param {Object} options - 初期化オプション
 * @param {string} options.initialContent - 初期コンテンツ
 * @param {Function} options.onChange - 内容変更時のコールバック
 * @param {Function} options.onCursorChange - カーソル変更時のコールバック
 * @returns {EditorView} エディターインスタンス
 */
export function initEditor(container, { initialContent = '', onChange, onCursorChange } = {}) {
    onChangeCallback = onChange;
    onCursorChangeCallback = onCursorChange;

    // エディターステートの作成
    const state = createEditorState(initialContent);

    // エディタービューの作成
    editorView = new EditorView({
        state,
        parent: container,
    });

    return editorView;
}

/**
 * 新しいEditorStateを作成する
 * @param {string} content - 初期コンテンツ
 * @returns {EditorState} 新しいエディターステート
 */
export function createEditorState(content = '') {
    // エディターの拡張機能一覧
    const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        autocompletion(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        placeholder('マークダウンを入力してください...'),
        markdown({
            base: markdownLanguage,
            codeLanguages: languages,
        }),
        syntaxHighlighting(defaultHighlightStyle),
        syntaxHighlighting(markdownHighlightStyle),
        keymap.of([
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
        ]),
        EditorView.updateListener.of((update) => {
            // ドキュメントの変更を通知
            if (update.docChanged && onChangeCallback) {
                onChangeCallback(update.state.doc.toString());
            }
            // カーソル位置の変更を通知
            if (update.selectionSet && onCursorChangeCallback) {
                const pos = update.state.selection.main.head;
                const line = update.state.doc.lineAt(pos);
                onCursorChangeCallback({
                    line: line.number,
                    col: pos - line.from + 1,
                });
            }
        }),
        // エディターのテーマ設定
        EditorView.theme({
            '&': {
                height: '100%',
            },
            '.cm-scroller': {
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
            },
        }),
    ];

    return EditorState.create({
        doc: content,
        extensions,
    });
}

/**
 * エディターのStateをまるごと入れ替える（タブ切り替え用）
 * @param {EditorState} state - 設定するエディターステート
 */
export function setEditorState(state) {
    if (!editorView) return;
    editorView.setState(state);
}

/**
 * エディターの内容を取得する
 * @returns {string} エディターのテキスト内容
 */
export function getContent() {
    if (!editorView) return '';
    return editorView.state.doc.toString();
}

/**
 * エディターの内容を設定する
 * @param {string} content - 設定するテキスト内容
 */
export function setContent(content) {
    if (!editorView) return;
    editorView.dispatch({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: content,
        },
    });
}

/**
 * 指定位置にテキストを挿入する
 * @param {string} text - 挿入するテキスト
 */
export function insertText(text) {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    editorView.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
    });
    editorView.focus();
}

/**
 * 選択テキストを指定の接頭辞・接尾辞で囲む
 * @param {string} prefix - 接頭辞
 * @param {string} suffix - 接尾辞
 */
export function wrapSelection(prefix, suffix) {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const selected = editorView.state.sliceDoc(from, to);

    if (selected) {
        // 選択テキストがある場合、囲む
        editorView.dispatch({
            changes: { from, to, insert: `${prefix}${selected}${suffix}` },
            selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
        });
    } else {
        // 選択テキストがない場合、プレースホルダーを挿入
        const placeholder = 'テキスト';
        editorView.dispatch({
            changes: { from, insert: `${prefix}${placeholder}${suffix}` },
            selection: { anchor: from + prefix.length, head: from + prefix.length + placeholder.length },
        });
    }
    editorView.focus();
}

/**
 * 現在の行の先頭に接頭辞を追加する（既存の接頭辞があれば置換する）
 * @param {string} prefix - 行頭に追加する接頭辞
 */
export function prependToLine(prefix) {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const fromLine = editorView.state.doc.lineAt(from);
    const toLine = editorView.state.doc.lineAt(to);

    const changes = [];
    // 行頭にある既存のマークダウン記号にマッチする正規表現
    // (#+, -, *, +, >, 数字., - [ ], - [x]) とそれに続くスペース
    const markerRegex = /^(\s*)(#{1,6}\s+|[-*+]\s+\[[ x]\]\s+|[-*+]\s+|>\s+|\d+\.\s+)/;

    for (let i = fromLine.number; i <= toLine.number; i++) {
        const line = editorView.state.doc.line(i);
        const text = line.text;
        const match = text.match(markerRegex);

        if (match) {
            // 既存のマーカーがある場合は置換する
            const indent = match[1];
            const oldMarkerLength = match[2].length;

            // 古いマーカーと同じマーカーを追加しようとした場合はトグル（削除）として動作させる
            if (match[2] === prefix) {
                changes.push({
                    from: line.from + indent.length,
                    to: line.from + indent.length + oldMarkerLength,
                    insert: ''
                });
            } else {
                changes.push({
                    from: line.from + indent.length,
                    to: line.from + indent.length + oldMarkerLength,
                    insert: prefix
                });
            }
        } else {
            // マーカーがない場合は単に追加する
            changes.push({ from: line.from, insert: prefix });
        }
    }

    editorView.dispatch({ changes });
    editorView.focus();
}

/**
 * 指定行へスクロールする
 * @param {number} lineNumber - 行番号（1始まり）
 */
export function scrollToLine(lineNumber) {
    if (!editorView) return;
    try {
        const line = editorView.state.doc.line(lineNumber);
        editorView.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true,
        });
        editorView.focus();
    } catch {
        // 行番号が範囲外の場合は何もしない
    }
}

/**
 * エディターにフォーカスを設定する
 */
export function focusEditor() {
    if (editorView) {
        editorView.focus();
    }
}

/**
 * エディターのインスタンスを取得する
 * @returns {EditorView|null} エディターインスタンス
 */
export function getEditorView() {
    return editorView;
}
