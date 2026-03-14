/**
 * workspace.js - ワークスペース（フォルダ）管理モジュール
 * File System Access API を使ってフォルダを開き、ツリー表示・全文検索を行う
 */

/**
 * ワークスペース内のファイルエントリ:
 * {
 *   name: string,              // ファイル名
 *   path: string,              // ルートからの相対パス（表示用）
 *   handle: FileSystemFileHandle, // ファイルハンドル
 * }
 */

/**
 * ワークスペース内のフォルダ/ファイルツリーノード:
 * {
 *   name: string,
 *   kind: 'file' | 'directory',
 *   handle: FileSystemFileHandle | FileSystemDirectoryHandle,
 *   path: string,              // ルートからの相対パス
 *   children: TreeNode[],      // kind === 'directory' のみ
 * }
 */

/** 現在開いているフォルダのハンドル */
let rootHandle = null;

/** ワークスペース名（フォルダ名） */
let workspaceName = '';

/** フラットなファイル一覧（全文検索用） */
let fileList = [];

/** ツリー構造 */
let treeRoot = null;

/** 対応している拡張子（Markdownとテキスト） */
const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt']);

/**
 * ファイル名が対応拡張子かどうかを判定する
 * @param {string} name - ファイル名
 * @returns {boolean}
 */
function isSupportedFile(name) {
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex === -1) return false;
    return SUPPORTED_EXTENSIONS.has(name.slice(dotIndex).toLowerCase());
}

/**
 * ディレクトリを再帰的に走査してツリーノードとファイル一覧を構築する
 * @param {FileSystemDirectoryHandle} dirHandle - 対象ディレクトリのハンドル
 * @param {string} currentPath - ルートからの現在の相対パス
 * @returns {Promise<{ node: TreeNode, files: FileEntry[] }>}
 */
async function traverseDirectory(dirHandle, currentPath) {
    const node = {
        name: dirHandle.name,
        kind: 'directory',
        handle: dirHandle,
        path: currentPath,
        children: [],
    };
    const files = [];

    // ディレクトリエントリをアルファベット順にソートして処理する
    const entries = [];
    for await (const entry of dirHandle.values()) {
        // ドットファイル（.git など）は除外する
        if (entry.name.startsWith('.')) continue;
        entries.push(entry);
    }

    // フォルダを先に、次にファイルをアルファベット順で表示する
    entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, 'ja');
    });

    for (const entry of entries) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
            // サブディレクトリを再帰的に走査する
            const sub = await traverseDirectory(entry, entryPath);
            // 対応ファイルが含まれるフォルダのみをツリーに追加する
            if (sub.files.length > 0) {
                node.children.push(sub.node);
                files.push(...sub.files);
            }
        } else if (entry.kind === 'file' && isSupportedFile(entry.name)) {
            // 対応ファイルをツリーとファイル一覧に追加する
            const fileNode = {
                name: entry.name,
                kind: 'file',
                handle: entry,
                path: entryPath,
                children: [],
            };
            node.children.push(fileNode);
            files.push({ name: entry.name, path: entryPath, handle: entry });
        }
    }

    return { node, files };
}

/**
 * フォルダ選択ダイアログを開いてワークスペースを読み込む
 * @returns {Promise<{ name: string, tree: TreeNode, files: FileEntry[] } | null>}
 */
export async function openFolder() {
    if (!window.showDirectoryPicker) {
        throw new Error('このブラウザはフォルダを開く機能（File System Access API）に対応していません。');
    }

    try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });

        rootHandle = handle;
        workspaceName = handle.name;

        // ディレクトリを再帰走査する
        const { node, files } = await traverseDirectory(handle, '');

        treeRoot = node;
        fileList = files;

        return { name: workspaceName, tree: treeRoot, files: fileList };
    } catch (error) {
        if (error.name === 'AbortError') return null;
        throw error;
    }
}

/**
 * 現在のワークスペースのフォルダハンドルを返す
 * @returns {FileSystemDirectoryHandle | null}
 */
export function getWorkspaceFolderHandle() {
    return rootHandle;
}

/**
 * 現在のワークスペース名を返す
 * @returns {string}
 */
export function getWorkspaceName() {
    return workspaceName;
}

/**
 * ワークスペース内のファイル一覧（フラット）を返す
 * @returns {FileEntry[]}
 */
export function getWorkspaceFiles() {
    return [...fileList];
}

/**
 * ワークスペースのツリー構造を返す
 * @returns {TreeNode | null}
 */
export function getWorkspaceTree() {
    return treeRoot;
}

/**
 * ワークスペースをリセットする
 */
export function clearWorkspace() {
    rootHandle = null;
    workspaceName = '';
    fileList = [];
    treeRoot = null;
}

/**
 * ワークスペース内の全Markdownファイルを検索する
 * @param {string} query - 検索クエリ文字列（大文字・小文字を区別しない）
 * @param {Function} onProgress - 進捗コールバック (processedCount, total) => void
 * @returns {Promise<SearchResult[]>} マッチした行情報の配列
 *
 * 各SearchResult:
 * {
 *   fileName: string,           // ファイル名
 *   filePath: string,           // ワークスペース内相対パス
 *   handle: FileSystemFileHandle,
 *   matches: [{ line: number, text: string }]  // マッチした行番号とテキスト
 * }
 */
export async function searchInWorkspace(query, onProgress) {
    if (!query || !fileList.length) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];

    for (let i = 0; i < fileList.length; i++) {
        const fileEntry = fileList[i];

        if (onProgress) {
            onProgress(i, fileList.length);
        }

        try {
            const file = await fileEntry.handle.getFile();
            const content = await file.text();
            const lines = content.split('\n');
            const matches = [];

            lines.forEach((text, idx) => {
                if (text.toLowerCase().includes(lowerQuery)) {
                    // matchesに行番号（1始まり）とテキストを追加する
                    matches.push({ line: idx + 1, text: text.trim() });
                }
            });

            if (matches.length > 0) {
                results.push({
                    fileName: fileEntry.name,
                    filePath: fileEntry.path,
                    handle: fileEntry.handle,
                    matches,
                });
            }
        } catch (e) {
            // 読み取りエラーは無視して次のファイルへ進む
            console.warn(`検索中にエラーが発生しました (${fileEntry.name}):`, e);
        }
    }

    return results;
}
