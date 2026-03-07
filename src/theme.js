/**
 * theme.js - テーマ管理（ダークモード / ライトモード）
 * システム設定に連動し、手動切替にも対応
 */

/** 現在のテーマ */
let currentTheme = 'light';

/** テーマ変更コールバック */
let onThemeChangeCallback = null;

/**
 * テーマ管理を初期化する
 * @param {Object} options - オプション
 * @param {Function} options.onThemeChange - テーマ変更時のコールバック
 */
export function initTheme({ onThemeChange } = {}) {
    onThemeChangeCallback = onThemeChange;

    // ローカルストレージから保存されたテーマを復元
    const savedTheme = localStorage.getItem('md-studio-theme');

    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // システム設定に従う
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }

    // システム設定の変更を監視
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // ユーザーが手動で設定していない場合のみシステム設定に従う
        if (!localStorage.getItem('md-studio-theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    // テーマ切替ボタンのイベント
    document.getElementById('btn-theme').addEventListener('click', () => {
        toggleTheme();
    });
}

/**
 * テーマを設定する
 * @param {string} theme - 'light' または 'dark'
 */
function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // アイコンの切替
    const lightIcon = document.getElementById('icon-theme-light');
    const darkIcon = document.getElementById('icon-theme-dark');

    if (theme === 'dark') {
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'block';
    } else {
        lightIcon.style.display = 'block';
        darkIcon.style.display = 'none';
    }

    if (onThemeChangeCallback) {
        onThemeChangeCallback(theme);
    }
}

/**
 * テーマを切り替える
 */
export function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    // 手動切替の結果をローカルストレージに保存
    localStorage.setItem('md-studio-theme', newTheme);
}

/**
 * 現在のテーマを取得する
 * @returns {string} 'light' または 'dark'
 */
export function getCurrentTheme() {
    return currentTheme;
}
