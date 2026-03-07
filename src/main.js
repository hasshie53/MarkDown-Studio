/**
 * main.js - アプリケーションのメインエントリーポイント
 * 各モジュールの初期化と連携を行う
 */

import './style.css';
import { initEditor, getContent, setContent } from './editor.js';
import { initPreview, updatePreview } from './preview.js';
import { initFileManager, openFile, saveFile, saveFileAs, openDroppedFile, newFile, setModified, getIsModified } from './file-manager.js';
import { initToolbar } from './toolbar.js';
import { initTheme } from './theme.js';
import { initOutline, toggleOutline, updateOutline } from './outline.js';

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
    const outlineWidth = outlinePanel.classList.contains('hidden') ? 0 : outlinePanel.offsetWidth;

    // アウトラインパネルの幅を考慮した相対位置
    const relativeX = e.clientX - rect.left - outlineWidth;
    const availableWidth = rect.width - outlineWidth - handle.offsetWidth;

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

    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      // 未保存の変更がある場合は確認
      if (getIsModified()) {
        const confirmed = await showConfirmDialog('未保存の変更があります。破棄して新しいファイルを開きますか？');
        if (!confirmed) return;
      }

      const result = await openDroppedFile(file);
      if (result) {
        setContent(result.content);
        debouncedPreviewUpdate(result.content);
        updateStatusBar(result.content);
        showToast(`${result.name} を開きました`, 'success');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

/**
 * ファイルを開く操作
 */
async function handleOpen() {
  // 未保存の変更がある場合は確認
  if (getIsModified()) {
    const confirmed = await showConfirmDialog('未保存の変更があります。破棄して新しいファイルを開きますか？');
    if (!confirmed) return;
  }

  try {
    const result = await openFile();
    if (result) {
      setContent(result.content);
      debouncedPreviewUpdate(result.content);
      updateStatusBar(result.content);
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
  try {
    const content = getContent();
    const saved = await saveFile(content);
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
  try {
    const content = getContent();
    const saved = await saveFileAs(content);
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
  // 未保存の変更がある場合は確認
  if (getIsModified()) {
    const confirmed = await showConfirmDialog('未保存の変更があります。破棄して新規ドキュメントを作成しますか？');
    if (!confirmed) return;
  }

  newFile();
  setContent('');
  debouncedPreviewUpdate('');
  updateStatusBar('');
  showToast('新規ドキュメントを作成しました', 'info');
}

/**
 * ページ離脱時の警告
 */
function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (getIsModified()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
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
    onFileNameChange: (name) => {
      document.getElementById('file-name').textContent = name;
      document.title = `${name} - MarkDown Studio`;
    },
    onSaveStateChange: (isSaved) => {
      updateSaveIndicator(isSaved);
    },
  });

  // エディターの初期化
  const editorContainer = document.getElementById('editor-container');
  initEditor(editorContainer, {
    initialContent: '',
    onChange: (content) => {
      setModified(true);
      debouncedPreviewUpdate(content);
      updateStatusBar(content);
    },
    onCursorChange: (cursor) => {
      updateCursorPosition(cursor);
    },
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
  });

  // リサイズハンドルの設定
  setupResizeHandle();

  // ドラッグ&ドロップの設定
  setupDragAndDrop();

  // ページ離脱時の警告
  setupBeforeUnload();

  // 初期状態を設定
  updateStatusBar('');
  updateSaveIndicator(true);

  // 初期プレビュー表示
  const previewEl = document.getElementById('preview-content');
  updatePreview(previewEl, '');
}

// DOMContentLoaded後にアプリを初期化
document.addEventListener('DOMContentLoaded', init);
