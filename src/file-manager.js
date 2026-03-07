/**
 * file-manager.js - ファイル読み書き管理
 * File System Access API を使用してローカルファイルの読み書きを行う
 */

/** 現在開いているファイルのハンドル */
let currentFileHandle = null;

/** ファイル変更状態 */
let isModified = false;

/** ファイル名変更コールバック */
let onFileNameChangeCallback = null;

/** 保存状態変更コールバック */
let onSaveStateChangeCallback = null;

/**
 * ファイルマネージャーを初期化する
 * @param {Object} options - オプション
 * @param {Function} options.onFileNameChange - ファイル名変更コールバック
 * @param {Function} options.onSaveStateChange - 保存状態変更コールバック
 */
export function initFileManager({ onFileNameChange, onSaveStateChange } = {}) {
    onFileNameChangeCallback = onFileNameChange;
    onSaveStateChangeCallback = onSaveStateChange;
}

/**
 * ファイルを開くダイアログを表示し、選択されたファイルの内容を返す
 * @returns {Promise<{content: string, name: string}|null>} ファイル内容とファイル名
 */
export async function openFile() {
    try {
        // File System Access API が利用可能かチェック
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

        currentFileHandle = handle;
        const file = await handle.getFile();
        const content = await file.text();

        // ファイル名を通知
        if (onFileNameChangeCallback) {
            onFileNameChangeCallback(handle.name);
        }

        // 保存状態を更新
        setModified(false);

        return { content, name: handle.name };
    } catch (error) {
        // ユーザーがキャンセルした場合はnullを返す
        if (error.name === 'AbortError') return null;
        console.error('ファイルを開けませんでした:', error);
        throw error;
    }
}

/**
 * File System Access API が利用できない場合のフォールバック
 * @returns {Promise<{content: string, name: string}|null>}
 */
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
            currentFileHandle = null; // フォールバックではハンドルを保持できない

            if (onFileNameChangeCallback) {
                onFileNameChangeCallback(file.name);
            }

            setModified(false);
            resolve({ content, name: file.name });
        };

        input.oncancel = () => resolve(null);
        input.click();
    });
}

/**
 * 現在のファイルに上書き保存する
 * @param {string} content - 保存するテキスト内容
 * @returns {Promise<boolean>} 保存成功時true
 */
export async function saveFile(content) {
    try {
        // ファイルハンドルがない場合は「名前を付けて保存」にフォールバック
        if (!currentFileHandle) {
            return await saveFileAs(content);
        }

        // ファイルへの書き込み
        const writable = await currentFileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        setModified(false);
        return true;
    } catch (error) {
        if (error.name === 'AbortError') return false;
        console.error('ファイルの保存に失敗しました:', error);
        throw error;
    }
}

/**
 * 名前を付けて保存ダイアログを表示する
 * @param {string} content - 保存するテキスト内容
 * @returns {Promise<boolean>} 保存成功時true
 */
export async function saveFileAs(content) {
    try {
        // File System Access API が利用可能かチェック
        if (!window.showSaveFilePicker) {
            return saveFileFallback(content);
        }

        const handle = await window.showSaveFilePicker({
            suggestedName: currentFileHandle ? currentFileHandle.name : '無題.md',
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

        currentFileHandle = handle;

        // ファイルへの書き込み
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();

        // ファイル名を通知
        if (onFileNameChangeCallback) {
            onFileNameChangeCallback(handle.name);
        }

        setModified(false);
        return true;
    } catch (error) {
        if (error.name === 'AbortError') return false;
        console.error('ファイルの保存に失敗しました:', error);
        throw error;
    }
}

/**
 * File System Access API が利用できない場合のフォールバック保存
 * @param {string} content - 保存するテキスト内容
 * @returns {boolean} 常にtrue
 */
function saveFileFallback(content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '無題.md';
    a.click();
    URL.revokeObjectURL(url);
    setModified(false);
    return true;
}

/**
 * ドラッグ&ドロップされたファイルを読み込む
 * @param {File} file - ドロップされたファイル
 * @returns {Promise<{content: string, name: string}|null>}
 */
export async function openDroppedFile(file) {
    if (!file) return null;

    // マークダウンファイルかチェック
    const validExts = ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExts.includes(ext)) {
        throw new Error('マークダウンファイルのみ対応しています');
    }

    const content = await file.text();
    currentFileHandle = null; // ドロップではハンドルを取得できない

    if (onFileNameChangeCallback) {
        onFileNameChangeCallback(file.name);
    }

    setModified(false);
    return { content, name: file.name };
}

/**
 * 新規ファイルを作成する（状態をリセット）
 */
export function newFile() {
    currentFileHandle = null;

    if (onFileNameChangeCallback) {
        onFileNameChangeCallback('無題のドキュメント');
    }

    setModified(false);
}

/**
 * ファイルの変更状態を設定する
 * @param {boolean} modified - 変更されているかどうか
 */
export function setModified(modified) {
    isModified = modified;
    if (onSaveStateChangeCallback) {
        onSaveStateChangeCallback(!modified);
    }
}

/**
 * ファイルが変更されているかどうかを取得する
 * @returns {boolean} 変更されている場合true
 */
export function getIsModified() {
    return isModified;
}

/**
 * 現在のファイルハンドルを取得する
 * @returns {FileSystemFileHandle|null} 現在のファイルハンドル
 */
export function getCurrentFileHandle() {
    return currentFileHandle;
}
