/**
 * outline.js - アウトライン表示
 * マークダウンの見出し構造を解析し、ナビゲーション用のアウトラインを生成
 */

import { extractHeadings } from './preview.js';
import { scrollToLine, getContent } from './editor.js';

/** アウトライン表示状態 */
let isOutlineVisible = false;

/** アウトラインリスト要素 */
let outlineListEl = null;

/** アウトラインパネル要素 */
let outlinePanelEl = null;

/**
 * アウトラインモジュールを初期化する
 */
export function initOutline() {
    outlinePanelEl = document.getElementById('outline-panel');
    outlineListEl = document.getElementById('outline-list');

    // 閉じるボタンのイベント
    document.getElementById('btn-outline-close').addEventListener('click', () => {
        toggleOutline();
    });
}

/**
 * アウトラインの表示/非表示を切り替える
 */
export function toggleOutline() {
    isOutlineVisible = !isOutlineVisible;

    if (outlinePanelEl) {
        outlinePanelEl.classList.toggle('hidden', !isOutlineVisible);
    }

    // ボタンのアクティブ状態を更新
    const btn = document.getElementById('btn-outline-toggle');
    if (btn) {
        btn.classList.toggle('active', isOutlineVisible);
    }

    // パネルを開くタイミングで現在のエディター内容を反映する
    // （ファイルを開いた直後など、まだ更新されていない場合に対応）
    if (isOutlineVisible) {
        updateOutline(getContent());
    }
}

/**
 * アウトラインの内容を更新する
 * @param {string} markdownText - マークダウンテキスト
 */
export function updateOutline(markdownText) {
    if (!outlineListEl) return;

    const headings = extractHeadings(markdownText);

    // 見出しがない場合の表示
    if (headings.length === 0) {
        outlineListEl.innerHTML = `
      <li class="outline-empty" style="padding: 16px 14px; color: var(--text-muted); font-size: 12px; text-align: center;">
        見出しがありません
      </li>
    `;
        return;
    }

    // アウトライン項目の生成
    outlineListEl.innerHTML = headings
        .map(
            (h) =>
                `<li class="outline-item" data-level="${h.level}" data-line="${h.line}" title="${h.text}">${h.text}</li>`
        )
        .join('');

    // クリックイベントの設定
    outlineListEl.querySelectorAll('.outline-item').forEach((item) => {
        item.addEventListener('click', () => {
            const line = parseInt(item.dataset.line, 10);
            scrollToLine(line);

            // アクティブ状態の更新
            outlineListEl.querySelectorAll('.outline-item').forEach((i) => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

/**
 * アウトラインの表示状態を取得する
 * @returns {boolean} 表示中の場合true
 */
export function isOutlineShown() {
    return isOutlineVisible;
}
