/**
 * main.js - アプリケーションのメインエントリーポイント
 * 各モジュールの初期化と連携を行う
 */

import './style.css';
import { initEditor, getContent, setContent } from './editor.js';
import { initPreview, updatePreview } from './preview.js';
import { initFileManager, openFile, saveFile, saveFileAs, openDroppedFile, getActiveTab, getTabs, addTab, closeTab, switchTab, updateActiveTab } from './file-manager.js';
import { initToolbar } from './toolbar.js';
import { initTheme } from './theme.js';
import { initOutline, toggleOutline, updateOutline } from './outline.js';
import { createEditorState, setEditorState } from './editor.js';
import { openFolder, getWorkspaceFolderHandle, getWorkspaceFiles, getWorkspaceName, getWorkspaceTree, clearWorkspace, searchInWorkspace } from './workspace.js';

/**
 * トースト通知を表示する
 * @param {string} message - 通知メッセージ
 * @param {'success'|'error'|'info'} type - 通知タイプ
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // アイコンの選択
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  // 自動的に非表示にする
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * ステータスバーを更新する
 * @param {string} content - エディターのテキスト内容
 */
function updateStatusBar(content) {
  const lines = content.split('\n').length;
  const chars = content.length;

  document.getElementById('status-lines').textContent = `行: ${lines}`;
  document.getElementById('status-chars').textContent = `文字: ${chars}`;
}

/**
 * カーソル位置の表示を更新する
 * @param {Object} cursor - カーソル位置
 * @param {number} cursor.line - 行番号
 * @param {number} cursor.col - 列番号
 */
function updateCursorPosition(cursor) {
  document.getElementById('status-cursor').textContent = `行 ${cursor.line}, 列 ${cursor.col}`;
}

/**
 * 保存状態インジケーターを更新する
 * @param {boolean} isSaved - 保存済みかどうか
 */
function updateSaveIndicator(isSaved) {
  const indicator = document.getElementById('save-indicator');
  indicator.className = `save-indicator ${isSaved ? 'saved' : 'unsaved'}`;
  indicator.title = isSaved ? '保存済み' : '未保存の変更あり';
}

/** プレビュー更新のデバウンス用タイマー */
let previewTimer = null;

/**
 * プレビューをデバウンス付きで更新する
 * @param {string} content - マークダウンテキスト
 */
function debouncedPreviewUpdate(content) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const previewEl = document.getElementById('preview-content');
    updatePreview(previewEl, content);
    updateOutline(content);
  }, 150);
}

/**
 * リサイズハンドルのドラッグ処理を設定する
 */
function setupResizeHandle() {
  const handle = document.getElementById('resize-handle');
  const editorPanel = document.getElementById('editor-panel');
  const previewPanel = document.getElementById('preview-panel');
  const mainContent = document.getElementById('main-content');

  let isDragging = false;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const rect = mainContent.getBoundingClientRect();
    const outlinePanel = document.getElementById('outline-panel');
    const workspacePanel = document.getElementById('workspace-panel');
    const outlineWidth = outlinePanel.classList.contains('hidden') ? 0 : outlinePanel.offsetWidth;
    // ワークスペースパネルの幅も考慮する
    const workspaceWidth = workspacePanel.classList.contains('hidden') ? 0 : workspacePanel.offsetWidth;
    const totalSideWidth = outlineWidth + workspaceWidth;

    // サイドパネル合計幅を考慮した相対位置
    const relativeX = e.clientX - rect.left - totalSideWidth;
    const availableWidth = rect.width - totalSideWidth - handle.offsetWidth;

    // パネルの最小幅を確保（20%以上）
    const minRatio = 0.2;
    const ratio = Math.max(minRatio, Math.min(1 - minRatio, relativeX / availableWidth));

    editorPanel.style.flex = `0 0 ${ratio * 100}%`;
    previewPanel.style.flex = `0 0 ${(1 - ratio) * 100}%`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

/**
 * カスタム確認ダイアログを表示する
 * @param {string} message - 確認メッセージ
 * @returns {Promise<boolean>} 「破棄する」が選ばれたらtrue
 */
function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    const messageEl = overlay.querySelector('.confirm-message');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');

    messageEl.textContent = message;
    overlay.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      btnCancel.removeEventListener('click', onCancel);
      btnOk.removeEventListener('click', onOk);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    btnCancel.addEventListener('click', onCancel);
    btnOk.addEventListener('click', onOk);
  });
}

/**
 * ドラッグ&ドロップのイベントを設定する
 */
function setupDragAndDrop() {
  const overlay = document.getElementById('drop-overlay');
  let dragCounter = 0;

  // ドラッグオーバーでオーバーレイを表示
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      overlay.classList.remove('hidden');
    }
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      overlay.classList.add('hidden');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  // ファイルのドロップ処理
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add('hidden');

    // Handle FileAPI with item.getAsFileSystemHandle if possible
    let file = null;
    let fileHandle = null;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0];
      if (item.kind === 'file') {
        file = item.getAsFile();
        if (item.getAsFileSystemHandle) {
          try {
            const handle = await item.getAsFileSystemHandle();
            if (handle && handle.kind === 'file') {
              fileHandle = handle;
            }
          } catch (err) {
            console.warn('Could not get file system handle', err);
          }
        }
      }
    } else {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    try {
      const activeTab = getActiveTab();
      // タブが1つで未保存かつ空の場合は確認なし（新規直後など）
      if (activeTab && activeTab.isModified && activeTab.content.trim() !== '') {
        // タブモデルでは上書きでなく「別タブ」または「そのタブで開く」などを検討しますが
        // 今回はドロップされたファイルは「新しいタブ」として開く方針に変更します
      }

      const result = await openDroppedFile(file, fileHandle);
      if (result) {
        addTab(result);
        showToast(`${result.name} を開きました`, 'success');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

/**
 * ウェルカムスクリーンとタブバーの表示管理
 * ワークスペース（フォルダ）が開いている場合はウェルカムスクリーンを表示しない
 */
function updateAppVisibility() {
  const tabs = getTabs();
  // ワークスペースが開いているかどうかをフォルダハンドルの有無で判定する
  const isWorkspaceOpen = !!getWorkspaceFolderHandle();
  const tabsBar = document.getElementById('tabs-bar');
  const mainContent = document.getElementById('main-content');
  const welcome = document.getElementById('welcome-screen');

  if (tabs.length > 0) {
    // タブが1件以上ある場合：タブバーを表示してエディタ画面へ
    tabsBar.classList.remove('hidden');
    mainContent.classList.remove('no-tabs');
    if (welcome) welcome.classList.add('hidden');
  } else if (isWorkspaceOpen) {
    // タブは0件だがワークスペースが開いている場合：タブバー非表示でエディタ画面を表示
    tabsBar.classList.add('hidden');
    mainContent.classList.add('no-tabs');
    if (welcome) welcome.classList.add('hidden');
  } else {
    // タブもワークスペースもない場合：ウェルカムスクリーンを表示する
    tabsBar.classList.add('hidden');
    mainContent.classList.add('no-tabs');
    if (welcome) welcome.classList.remove('hidden');

    // 内容をクリア
    setContent('');
    debouncedPreviewUpdate('');
    updateStatusBar('');
    updateSaveIndicator(true);
    document.getElementById('file-name').textContent = ' MarkDown Studio ';
    document.title = 'MarkDown Studio';
  }
}

/**
 * タブバーのUIを更新する
 */
function renderTabs() {
  const container = document.getElementById('tabs-container');
  if (!container) return;

  const tabs = getTabs();
  const activeTab = getActiveTab();

  container.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${activeTab && activeTab.id === tab.id ? 'active' : ''} ${tab.isModified ? 'is-modified' : ''}`;

    // Indicator
    const indicator = document.createElement('div');
    indicator.className = 'tab-indicator';
    tabEl.appendChild(indicator);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-item-name';
    nameSpan.textContent = tab.name;
    nameSpan.title = tab.name;
    tabEl.appendChild(nameSpan);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-item-close';
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.title = '閉じる';

    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (tab.isModified) {
        const confirmed = await showConfirmDialog(`"${tab.name}" に未保存の変更があります。保存せずに閉じますか？`);
        if (!confirmed) return;
      }
      closeTab(tab.id);
    });
    tabEl.appendChild(closeBtn);

    // Click to switch
    tabEl.addEventListener('click', () => {
      switchTab(tab.id);
    });

    container.appendChild(tabEl);
  });

  updateAppVisibility();
}

/**
 * アクティブなタブが切り替わったときの処理
 */
function handleActiveTabChange(activeTab) {
  if (activeTab) {
    // 状態を復元
    setEditorState(activeTab.editorState);
    debouncedPreviewUpdate(activeTab.content);
    updateStatusBar(activeTab.content);
    updateSaveIndicator(!activeTab.isModified);

    document.getElementById('file-name').textContent = activeTab.name;
    document.title = `${activeTab.name} - MarkDown Studio`;
  }
  renderTabs(); // 選択状態を反映
}

/**
 * ウェルカムスクリーンを非表示にする
 */
function hideWelcomeScreen() {
  const welcome = document.getElementById('welcome-screen');
  if (welcome) {
    welcome.classList.add('hidden');
  }
}


/**
 * ファイルを開く操作
 */
async function handleOpen() {
  try {
    const result = await openFile();
    if (result) {
      addTab(result);
      showToast(`${result.name} を開きました`, 'success');
    }
  } catch (error) {
    showToast('ファイルを開けませんでした', 'error');
  }
}

/**
 * 上書き保存操作
 */
async function handleSave() {
  const activeTab = getActiveTab();
  if (!activeTab) return;

  try {
    const currentContent = getContent();
    const saved = await saveFile(currentContent);
    if (saved) {
      showToast('保存しました', 'success');
    }
  } catch (error) {
    showToast('保存に失敗しました', 'error');
  }
}

/**
 * 名前を付けて保存操作
 */
async function handleSaveAs() {
  const activeTab = getActiveTab();
  if (!activeTab) return;

  try {
    const currentContent = getContent();
    const saved = await saveFileAs(currentContent);
    if (saved) {
      showToast('保存しました', 'success');
    }
  } catch (error) {
    showToast('保存に失敗しました', 'error');
  }
}

/**
 * 新規作成操作
 */
async function handleNew() {
  addTab({
    name: '無題のドキュメント',
    content: ''
  });
  showToast('新規ドキュメントを作成しました', 'info');
}

/**
 * ページ離脱時の警告
 */
function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    const hasModified = getTabs().some(t => t.isModified);
    if (hasModified) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ====================================================
// ワークスペース（フォルダツリー・全文検索）関連
// ====================================================

/**
 * ツリーノードを再帰的にHTML要素として構築する
 * @param {TreeNode} node - ツリーノード
 * @param {number} depth - 現在の深さ（インデント用）
 * @returns {HTMLElement} 生成されたリスト要素
 */
function buildTreeNode(node, depth = 0) {
  const li = document.createElement('li');

  if (node.kind === 'directory') {
    // フォルダアイテムを作成する
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';
    itemDiv.style.setProperty('--tree-indent', `${depth * 12}px`);
    itemDiv.style.paddingLeft = `${12 + depth * 12}px`;

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'tree-folder-toggle open';
    toggleIcon.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
    itemDiv.appendChild(toggleIcon);

    const folderIcon = document.createElement('span');
    folderIcon.className = 'tree-item-icon folder-icon';
    folderIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    itemDiv.appendChild(folderIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-item-name';
    nameSpan.textContent = node.name;
    nameSpan.title = node.name;
    itemDiv.appendChild(nameSpan);
    li.appendChild(itemDiv);

    // 子ノードを再帰的に生成する
    const childrenUl = document.createElement('ul');
    childrenUl.className = 'tree-children';
    node.children.forEach(child => {
      childrenUl.appendChild(buildTreeNode(child, depth + 1));
    });
    li.appendChild(childrenUl);

    // フォルダクリックで折りたたみ/展開する
    itemDiv.addEventListener('click', () => {
      const isOpen = toggleIcon.classList.contains('open');
      toggleIcon.classList.toggle('open', !isOpen);
      childrenUl.style.display = isOpen ? 'none' : '';
    });

  } else {
    // ファイルアイテムを作成する
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';
    itemDiv.style.paddingLeft = `${12 + depth * 12 + 16}px`;
    itemDiv.dataset.path = node.path;

    const fileIcon = document.createElement('span');
    fileIcon.className = 'tree-item-icon file-icon';
    fileIcon.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    itemDiv.appendChild(fileIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-item-name';
    nameSpan.textContent = node.name;
    nameSpan.title = node.path;
    itemDiv.appendChild(nameSpan);
    li.appendChild(itemDiv);

    // ファイルクリックでタブを開く
    itemDiv.addEventListener('click', () => {
      openFileFromWorkspace(node.handle, node.name, node.path);
      // アクティブ状態を更新する
      document.querySelectorAll('#workspace-tree .tree-item').forEach(el => el.classList.remove('active'));
      itemDiv.classList.add('active');
    });
  }

  return li;
}

/**
 * ワークスペースのファイルツリーUIを描画する
 * @param {TreeNode} treeRoot - ツリーのルートノード
 */
function renderWorkspaceTree(treeRoot) {
  const container = document.getElementById('workspace-tree');
  if (!container) return;

  container.innerHTML = '';

  const ul = document.createElement('ul');
  ul.className = 'tree-list';

  // ルートの子ノードを描画する（ルートフォルダ自体は表示しない）
  treeRoot.children.forEach(child => {
    ul.appendChild(buildTreeNode(child, 0));
  });

  container.appendChild(ul);
}

/**
 * ワークスペースのファイルをタブで開く
 * 既に同じパスのタブが開いている場合はそこに切り替える
 * @param {FileSystemFileHandle} handle - ファイルハンドル
 * @param {string} name - ファイル名
 * @param {string} path - ワークスペース内相対パス
 */
async function openFileFromWorkspace(handle, name, path) {
  // 同じファイルが既に開かれているか確認する
  const existingTab = getTabs().find(t => t.workspacePath === path);
  if (existingTab) {
    switchTab(existingTab.id);
    return;
  }

  try {
    const file = await handle.getFile();
    const content = await file.text();
    addTab({ name, content, fileHandle: handle, workspacePath: path });
    showToast(`${name} を開きました`, 'success');
  } catch (error) {
    showToast(`ファイルを開けませんでした: ${name}`, 'error');
    console.error('ワークスペースファイルのオープンに失敗しました:', error);
  }
}

/** 検索デバウンス用タイマー */
let searchTimer = null;

/**
 * 全文検索を実行してUIを更新する
 * @param {string} query - 検索クエリ
 */
async function executeSearch(query) {
  const resultsEl = document.getElementById('workspace-search-results');
  if (!resultsEl) return;

  if (!query.trim()) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
    return;
  }

  // 検索中スピナーを表示する
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = `
    <div class="workspace-search-loading">
      <div class="workspace-search-spinner"></div>
      <span>検索中...</span>
    </div>`;

  try {
    const results = await searchInWorkspace(query);

    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="workspace-search-empty">「${escapeHtml(query)}」に一致する結果が見つかりませんでした</div>`;
      return;
    }

    // 検索結果をHTML文字列で生成する
    resultsEl.innerHTML = results.map(fileResult => `
      <div class="search-result-file">
        <div class="search-result-file-header">
          <svg class="search-result-file-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span class="search-result-file-name" title="${escapeHtml(fileResult.filePath)}">${escapeHtml(fileResult.fileName)}</span>
          <span class="search-result-match-count">${fileResult.matches.length}</span>
        </div>
        ${fileResult.matches.slice(0, 10).map(match => `
          <div class="search-result-line"
               data-file-path="${escapeHtml(fileResult.filePath)}"
               data-line="${match.line}">
            <span class="search-result-line-num">${match.line}</span>
            <span class="search-result-line-text">${highlightMatch(match.text, query)}</span>
          </div>
        `).join('')}
      </div>
    `).join('');

    // マッチ行クリックで対象ファイルを開きジャンプする
    resultsEl.querySelectorAll('.search-result-line').forEach(lineEl => {
      lineEl.addEventListener('click', async () => {
        const filePath = lineEl.dataset.filePath;
        const lineNum = parseInt(lineEl.dataset.line, 10);
        const fileEntry = getWorkspaceFiles().find(f => f.path === filePath);
        if (!fileEntry) return;

        // ファイルをタブで開いてから行へジャンプする
        const existingTab = getTabs().find(t => t.workspacePath === filePath);
        if (existingTab) {
          switchTab(existingTab.id);
        } else {
          await openFileFromWorkspace(fileEntry.handle, fileEntry.name, fileEntry.path);
        }

        // 少し待ってからエディターの行へジャンプする
        import('./editor.js').then(({ scrollToLine }) => {
          setTimeout(() => scrollToLine(lineNum), 80);
        });
      });
    });

  } catch (error) {
    resultsEl.innerHTML = `<div class="workspace-search-empty">検索中にエラーが発生しました</div>`;
    console.error('全文検索エラー:', error);
  }
}

/**
 * 検索クエリにマッチした部分をハイライト表示する
 * @param {string} text - 対象テキスト
 * @param {string} query - 検索クエリ
 * @returns {string} HTMLエスケープ・ハイライト済みのHTML文字列
 */
function highlightMatch(text, query) {
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(regex, match => `<mark>${match}</mark>`);
}

/**
 * HTML特殊文字をエスケープする
 * @param {string} str - 対象文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ワークスペースパネルを開いてツリーを表示する
 */
async function handleOpenFolder() {
  try {
    showToast('フォルダを読み込み中...', 'info', 1500);
    const result = await openFolder();
    if (!result) return;

    // ワークスペース名を表示する
    const nameEl = document.getElementById('workspace-name');
    if (nameEl) nameEl.textContent = result.name;

    // パネルを表示する
    const panel = document.getElementById('workspace-panel');
    if (panel) panel.classList.remove('hidden');

    // 検索フィールドをリセットする
    const searchInput = document.getElementById('workspace-search-input');
    if (searchInput) searchInput.value = '';
    const searchResults = document.getElementById('workspace-search-results');
    if (searchResults) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
    }
    const clearBtn = document.getElementById('btn-workspace-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');

    // ツリーを描画する
    renderWorkspaceTree(result.tree);

    showToast(`「${result.name}」を開きました（${result.files.length}件のファイル）`, 'success');

    // UIを更新してウェルカムスクリーンを非表示にする
    updateAppVisibility();
  } catch (error) {
    showToast(`フォルダを開けませんでした: ${error.message}`, 'error');
    console.error('フォルダのオープンに失敗しました:', error);
  }
}

/**
 * ワークスペースパネルを閉じてワークスペースをリセットする
 */
function handleCloseWorkspace() {
  const panel = document.getElementById('workspace-panel');
  if (panel) panel.classList.add('hidden');
  clearWorkspace();

  // ツリーをリセットする
  const treeEl = document.getElementById('workspace-tree');
  if (treeEl) treeEl.innerHTML = '<div class="workspace-tree-empty">フォルダを開いてください</div>';

  // UIを更新してウェルカムスクリーンに戻す
  updateAppVisibility();
}

/**
 * ワークスペースの検索UIイベントを設定する
 */
function setupWorkspaceSearch() {
  const input = document.getElementById('workspace-search-input');
  const clearBtn = document.getElementById('btn-workspace-search-clear');
  const resultsEl = document.getElementById('workspace-search-results');

  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value;

    // クリアボタンの表示制御
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);

    // デバウンスで検索を実行する（300ms待機）
    clearTimeout(searchTimer);
    if (!query.trim()) {
      if (resultsEl) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
      }
      return;
    }
    searchTimer = setTimeout(() => executeSearch(query), 300);
  });

  // クリアボタンで検索をリセットする
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      if (resultsEl) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
      }
      input.focus();
    });
  }
}

/**
 * アプリケーションの初期化
 */
function init() {
  // プレビューエンジンの初期化
  initPreview();

  // テーマ管理の初期化
  initTheme();

  // ファイルマネージャーの初期化
  initFileManager({
    onTabsChange: () => {
      renderTabs();
    },
    onActiveTabChange: (activeTab) => {
      handleActiveTabChange(activeTab);
    },
  });

  // エディターの初期化
  const editorContainer = document.getElementById('editor-container');
  const dummyState = createEditorState(''); // 初期化用ダミー

  // initEditorに渡すオプションを調整（内部でエディタが作成されるため一旦内容空で起動）
  initEditor(editorContainer, {
    initialContent: '',
    onChange: (content) => {
      const activeTab = getActiveTab();
      if (activeTab) {
        // エディター側で変更されたら内容を更新する
        updateActiveTab({ content, isModified: true });

        // エディタ状態も手動でキャプチャするか、もしくは
        activeTab.editorState = window.editorView ? window.editorView.state : activeTab.editorState;

        debouncedPreviewUpdate(content);
        updateStatusBar(content);
        updateSaveIndicator(false);
      }
    },
    onCursorChange: (cursor) => {
      updateCursorPosition(cursor);
    },
  });

  // エディタのインスタンスをグローバル参照（手抜きで取れるように）
  import('./editor.js').then(module => {
    window.editorView = module.getEditorView();
  });

  // アウトラインの初期化
  initOutline();

  // ツールバーの初期化
  initToolbar({
    onViewModeChange: () => { },
    onOutlineToggle: () => toggleOutline(),
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onOpen: handleOpen,
    onNew: handleNew,
    onOpenFolder: handleOpenFolder,
  });

  // リサイズハンドルの設定
  setupResizeHandle();

  // ドラッグ&ドロップの設定
  setupDragAndDrop();

  // ページ離脱時の警告
  setupBeforeUnload();

  // ワークスペース検索UIのイベント設定
  setupWorkspaceSearch();

  // フォルダを開くボタン
  document.getElementById('btn-open-folder')?.addEventListener('click', handleOpenFolder);

  // ワークスペースパネル閉じるボタン
  document.getElementById('btn-workspace-close')?.addEventListener('click', handleCloseWorkspace);

  // ブラウザが showDirectoryPicker 未対応の場合はボタンを非表示にする
  if (!window.showDirectoryPicker) {
    const folderBtn = document.getElementById('btn-open-folder');
    if (folderBtn) folderBtn.style.display = 'none';
    const welcomeFolderBtn = document.getElementById('btn-welcome-open-folder');
    if (welcomeFolderBtn) welcomeFolderBtn.style.display = 'none';
  }

  // ウェルカムスクリーンのイベント設定
  document.getElementById('btn-welcome-open')?.addEventListener('click', handleOpen);
  document.getElementById('btn-welcome-open-folder')?.addEventListener('click', handleOpenFolder);
  document.getElementById('btn-welcome-new')?.addEventListener('click', handleNew);

  // 初期設定
  updateAppVisibility();
}

// DOMContentLoaded後にアプリを初期化
document.addEventListener('DOMContentLoaded', init);
