/**
 * 暗色模式管理
 */

const THEME_KEY = 'theme-preference';
const DARK_MODE_CLASS = 'dark-mode';

function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const svg = themeToggle.querySelector('svg');
    if (!svg) return;

    if (isDark) {
        svg.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v6m0 12v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m12 0h6m-17.78-7.78l4.24-4.24m5.08 5.08l4.24-4.24" stroke="currentColor" stroke-width="2" fill="none"/>';
    } else {
        svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" fill="none"/>';
    }
}

function setTheme(isDark) {
    const body = document.body;
    if (isDark) {
        body.classList.add(DARK_MODE_CLASS);
        localStorage.setItem(THEME_KEY, 'dark');
    } else {
        body.classList.remove(DARK_MODE_CLASS);
        localStorage.setItem(THEME_KEY, 'light');
    }

    updateThemeIcon(isDark);
}

function setupThemeTransition() {
    const style = document.createElement('style');
    style.textContent = `
        body {
            transition: background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body * {
            transition: background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }
    `;
    document.head.appendChild(style);
}

let themeTransitionTimeout = null;
function debounceThemeChange(isDark) {
    clearTimeout(themeTransitionTimeout);
    themeTransitionTimeout = setTimeout(() => {
        setTheme(isDark);
    }, 80);
}

function initTheme() {
    setupThemeTransition();

    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark') {
        setTheme(true);
    } else if (savedTheme === 'light') {
        setTheme(false);
    } else {
        setTheme(prefersDark);
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.contains(DARK_MODE_CLASS);
            themeToggle.style.transform = 'rotate(-180deg)';
            themeToggle.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';

            setTimeout(() => {
                debounceThemeChange(!isDark);
                themeToggle.style.transform = 'rotate(0deg)';
            }, 60);
        });
    }

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
        const localSetting = localStorage.getItem(THEME_KEY);
        if (!localSetting) {
            setTheme(e.matches);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
