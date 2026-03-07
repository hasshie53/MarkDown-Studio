/**
 * preview.js - マークダウンプレビュー機能
 * marked.js と highlight.js を使用してリアルタイムプレビューを生成
 */

import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

/**
 * marked.js の設定を初期化する
 */
export function initPreview() {
    marked.setOptions({
        // コードブロックのシンタックスハイライト
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch {
                    // ハイライト失敗時はそのまま返す
                }
            }
            // 言語指定なしの場合は自動検出
            try {
                return hljs.highlightAuto(code).value;
            } catch {
                return code;
            }
        },
        // GFM（GitHub Flavored Markdown）を有効にする
        gfm: true,
        // 改行をbrタグに変換
        breaks: true,
        // スマートリスト
        smartLists: true,
        // XSSを防ぐためにHTMLを無害化しない（ローカルアプリのため）
        sanitize: false,
    });

    // カスタムレンダラーの設定
    const renderer = new marked.Renderer();

    // チェックボックスリストのカスタムレンダリング
    renderer.listitem = function (text) {
        const content = text.text || text;
        // チェックボックスを含むリスト項目を検出
        if (typeof content === 'string' && content.startsWith('<input')) {
            return `<li style="list-style: none; margin-left: -20px;">${content}</li>\n`;
        }
        return `<li>${content}</li>\n`;
    };

    // 外部リンクに target="_blank" を設定
    renderer.link = function (href, title, text) {
        const linkHref = href.href || href;
        const linkTitle = href.title || title || '';
        const linkText = href.text || text || linkHref;
        const titleAttr = linkTitle ? ` title="${linkTitle}"` : '';
        return `<a href="${linkHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    };

    marked.use({ renderer });
}

/**
 * マークダウンテキストをHTMLに変換する
 * @param {string} markdownText - マークダウン形式のテキスト
 * @returns {string} 変換されたHTML
 */
export function renderMarkdown(markdownText) {
    if (!markdownText || markdownText.trim() === '') {
        return getEmptyStateHtml();
    }

    try {
        return marked.parse(markdownText);
    } catch (error) {
        console.error('マークダウンのパースに失敗しました:', error);
        return `<div class="preview-error">プレビューの生成中にエラーが発生しました</div>`;
    }
}

/**
 * プレビューパネルを更新する
 * @param {HTMLElement} container - プレビューコンテナ要素
 * @param {string} markdownText - マークダウンテキスト
 */
export function updatePreview(container, markdownText) {
    if (!container) return;

    const html = renderMarkdown(markdownText);
    container.innerHTML = html;
}

/**
 * マークダウンテキストから見出しリストを抽出する
 * @param {string} markdownText - マークダウンテキスト
 * @returns {Array<{level: number, text: string, line: number}>} 見出しの配列
 */
export function extractHeadings(markdownText) {
    if (!markdownText) return [];

    const headings = [];
    const lines = markdownText.split('\n');

    lines.forEach((line, index) => {
        // ATXスタイルの見出し（# で始まる行）を検出
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
            headings.push({
                level: match[1].length,
                text: match[2].replace(/[#*_`\[\]]/g, '').trim(),
                line: index + 1,
            });
        }
    });

    return headings;
}

/**
 * 空状態のHTMLを返す
 * @returns {string} 空状態のHTML
 */
function getEmptyStateHtml() {
    return `
    <div class="preview-empty">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>
        <path d="M9 13h6"/>
        <path d="M9 17h3"/>
      </svg>
      <p>マークダウンを入力するとここにプレビューが表示されます</p>
    </div>
  `;
}
