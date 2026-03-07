/**
 * preview.js - マークダウンプレビュー機能
 * marked.js と highlight.js を使用してリアルタイムプレビューを生成
 */

import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import mermaid from 'mermaid';

/**
 * marked.js の設定を初期化する
 */
export function initPreview() {
    marked.setOptions({
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

    // コードブロックのカスタムレンダリング (mermaidおよびhighlight対応)
    const defaultCode = renderer.code;
    renderer.code = function (...args) {
        const token = args[0];
        const codeText = token?.text || args[0];
        const langInfo = token?.lang || args[1];
        const isEscaped = args[2] || false;

        if (langInfo === 'mermaid') {
            const escapedCode = isEscaped ? codeText : codeText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            return `<div class="mermaid">${escapedCode}</div>`;
        }

        // highlight.jsによるシンタックスハイライト（marked v17での回避策）
        let highlightedCode = codeText;
        if (langInfo && hljs.getLanguage(langInfo)) {
            try {
                highlightedCode = hljs.highlight(codeText, { language: langInfo }).value;
            } catch {
                // do nothing
            }
        } else if (!langInfo) {
            try {
                highlightedCode = hljs.highlightAuto(codeText).value;
            } catch {
                // do nothing
            }
        }

        // ハイライト済みの場合はカスタムの出力を行う
        if (highlightedCode !== codeText) {
            const langClass = langInfo ? ` language-${langInfo}` : '';
            return `<pre><code class="hljs${langClass}">${highlightedCode}</code></pre>`;
        }

        return defaultCode.call(this, ...args);
    };

    marked.use({ renderer });

    // Mermaidの初期化
    mermaid.initialize({
        startOnLoad: false,
        theme: document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose', // 信頼できるローカルファイル用
    });
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
export async function updatePreview(container, markdownText) {
    if (!container) return;

    const html = renderMarkdown(markdownText);
    container.innerHTML = html;

    // Mermaidの描画を実行
    try {
        // テーマの動的切り替え
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
        mermaid.initialize({ theme });
        await mermaid.run({
            nodes: container.querySelectorAll('.mermaid'),
        });
    } catch (e) {
        console.warn('Mermaid rendering error:', e);
    }
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
