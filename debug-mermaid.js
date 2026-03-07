import { marked } from 'marked';
import mermaid from 'mermaid';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><div id="preview"></div>`);
global.document = dom.window.document;
global.window = dom.window;

// Setup marked 
const renderer = new marked.Renderer();
const defaultCode = renderer.code;
renderer.code = function (...args) {
    console.log(`renderer.code called with arguments:`, args);
    const code = args[0]?.text || args[0];
    const lang = args[0]?.lang || args[1];
    const isEscaped = args[2];

    if (lang === 'mermaid') {
        const escapedCode = isEscaped ? code : code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        console.log("Mermaid code in renderer:", JSON.stringify(code));
        return `<div class="mermaid">${escapedCode}</div>`;
    }
    return defaultCode.call(this, code, lang, isEscaped);
};
marked.use({ renderer });

const markdownText = [
    '```mermaid',
    'graph TD;',
    '    A[スタート] --> B[処理開始];',
    '    B --> C{条件判定};',
    '    C -- Yes --> D[成功処理];',
    '    C -- No --> E[失敗処理];',
    '    D --> F[終了];',
    '    E --> F;',
    '```'
].join('\n');

const html = marked.parse(markdownText);
console.log("Generated HTML:", html);

const container = document.getElementById('preview');
container.innerHTML = html;

try {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    const nodes = container.querySelectorAll('.mermaid');
    console.log("Nodes found:", nodes.length);
    console.log("Node 0 textContent:", JSON.stringify(nodes[0].textContent));

    // Mermaid run might fail in jsdom because it lacks SVG capabilities, but we can verify text extraction.
} catch (e) {
    console.error("Error:", e);
}
