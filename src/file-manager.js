/**
 * file-manager.js - ファイル読み書き管理（マルチタブ対応）
 * File System Access API を使用してローカルファイルの読み書きを行う
 */
import { createEditorState } from './editor.js';

/**
 * タブのデータ構造:
 * {
 *   id: string,               // ユニークID
 *   name: string,             // ファイル名
 *   fileHandle: FileSystemFileHandle|null, // ファイルハンドル
 *   content: string,          // 最新のテキスト内容
 *   editorState: EditorState, // CodeMirrorのEditorState
 *   isModified: boolean       // 未保存の変更があるか
 * }
 */

/** タブの配列 */
let tabs = [];

/** アクティブなタブのID */
let activeTabId = null;

/** イベントコールバック */
let onTabsChangeCallback = null;
let onActiveTabChangeCallback = null;

/**
 * ランダムなIDを生成する
 */
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * ファイルマネージャーを初期化する
 * @param {Object} options - オプション
 * @param {Function} options.onTabsChange - タブ一覧が変更されたときのコールバック
 * @param {Function} options.onActiveTabChange - アクティブなタブが変更されたときのコールバック
 */
export function initFileManager({ onTabsChange, onActiveTabChange } = {}) {
    onTabsChangeCallback = onTabsChange;
    onActiveTabChangeCallback = onActiveTabChange;
}

/**
 * アクティブなタブを取得する
 */
export function getActiveTab() {
    return tabs.find(t => t.id === activeTabId) || null;
}

/**
 * すべてのタブを取得する
 */
export function getTabs() {
    return [...tabs];
}

/**
 * イベントを通知する
 */
function notifyTabsChange() {
    if (onTabsChangeCallback) {
        onTabsChangeCallback(getTabs());
    }
}

function notifyActiveTabChange() {
    if (onActiveTabChangeCallback) {
        onActiveTabChangeCallback(getActiveTab());
    }
}

/**
 * 新しいタブを追加する
 */
export function addTab(tabData) {
    const id = generateId();
    const newTab = {
        id,
        name: tabData.name || '無題のドキュメント',
        fileHandle: tabData.fileHandle || null,
        content: tabData.content || '',
        editorState: tabData.editorState || createEditorState(tabData.content || ''),
        isModified: tabData.isModified || false
    };

    tabs.push(newTab);
    activeTabId = id;

    notifyTabsChange();
    notifyActiveTabChange();

    return id;
}

/**
 * 指定したタブを閉じる
 */
export function closeTab(id) {
    const activeIndex = tabs.findIndex(t => t.id === activeTabId);
    tabs = tabs.filter(t => t.id !== id);

    if (id === activeTabId) {
        if (tabs.length > 0) {
            // 前のタブ（なければ次のタブ）をアクティブにする
            const nextIndex = Math.min(activeIndex, tabs.length - 1);
            activeTabId = tabs[nextIndex].id;
        } else {
            activeTabId = null;
        }
        notifyActiveTabChange();
    }
    notifyTabsChange();
}

/**
 * アクティブなタブを切り替える
 */
export function switchTab(id) {
    if (activeTabId !== id && tabs.some(t => t.id === id)) {
        activeTabId = id;
        notifyTabsChange(); // アクティブ状態の表示を変えるため
        notifyActiveTabChange();
    }
}

/**
 * アクティブタブのファイル内容・状態を更新する
 */
export function updateActiveTab(updates) {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    Object.assign(activeTab, updates);
    notifyTabsChange(); // 名前や未保存フラグの更新用
}

/**
 * ファイルを開くダイアログを表示し、選択されたファイルの内容を返す
 */
export async function openFile() {
    try {
        if (!window.showOpenFilePicker) {
            return await openFileFallback();
        }

        const [handle] = await window.showOpenFilePicker({
            types: [
                {
                    description: 'マークダウンファイル',
                    accept: {
                        'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx'],
                        'text/plain': ['.txt'],
                    },
                },
            ],
            multiple: false,
        });

        const file = await handle.getFile();
        const content = await file.text();

        return { content, name: handle.name, fileHandle: handle };
    } catch (error) {
        if (error.name === 'AbortError') return null;
        console.error('ファイルを開けませんでした:', error);
        throw error;
    }
}

async function openFileFallback() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown,.mdown,.mkd,.mdx,.txt';

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) {
                resolve(null);
                return;
            }

            const content = await file.text();
            resolve({ content, name: file.name, fileHandle: null });
        };

        input.oncancel = () => resolve(null);
        input.click();
    });
}

/**
 * 現在のアクティブタブに上書き保存する
 */
export async function saveFile(content) {
    const activeTab = getActiveTab();
    if (!activeTab) return false;

    try {
        if (!activeTab.fileHandle) {
            return await saveFileAs(content);
        }

        const writable = await activeTab.fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        updateActiveTab({ content, isModified: false });
        return true;
    } catch (error) {
        if (error.name === 'AbortError') return false;
        console.error('ファイルの保存に失敗しました:', error);
        throw error;
    }
}

/**
 * 名前を付けて保存ダイアログを表示する
 */
export async function saveFileAs(content) {
    const activeTab = getActiveTab();
    if (!activeTab) return false;

    try {
        if (!window.showSaveFilePicker) {
            return saveFileFallback(content, activeTab);
        }

        const handle = await window.showSaveFilePicker({
            suggestedName: activeTab.name || '無題.md',
            types: [
                {
                    description: 'マークダウンファイル',
                    accept: { 'text/markdown': ['.md'] },
                },
                {
                    description: 'テキストファイル',
                    accept: { 'text/plain': ['.txt'] },
                },
            ],
        });

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();

        updateActiveTab({
            content,
            name: handle.name,
            fileHandle: handle,
            isModified: false
        });
        return true;
    } catch (error) {
        if (error.name === 'AbortError') return false;
        console.error('ファイルの保存に失敗しました:', error);
        throw error;
    }
}

function saveFileFallback(content, activeTab) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.name || '無題.md';
    a.click();
    URL.revokeObjectURL(url);

    updateActiveTab({ content, isModified: false });
    return true;
}

/**
 * ドラッグ&ドロップされたファイルを読み込む
 */
export async function openDroppedFile(file, fileHandle = null) {
    if (!file) return null;

    const validExts = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExts.includes(ext)) {
        throw new Error('マークダウンファイルのみ対応しています');
    }

    const content = await file.text();
    return { content, name: file.name, fileHandle };
}

