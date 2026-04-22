/**
 * Plotly 统一主题（浅色宋韵册页）
 * - 不改变数据与图表类型
 * - 不改 height/margin 等布局字段
 * - 仅统一字体、网格、图例、提示框等视觉 token
 */

(function songyunPlotlyThemeBootstrap() {
    function isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    function deepMerge(target, source) {
        const out = isPlainObject(target) ? { ...target } : {};
        if (!isPlainObject(source)) return out;

        Object.keys(source).forEach((key) => {
            const srcVal = source[key];
            const tgtVal = out[key];

            if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
                out[key] = deepMerge(tgtVal, srcVal);
                return;
            }

            if (isPlainObject(srcVal)) {
                out[key] = deepMerge({}, srcVal);
                return;
            }

            out[key] = srcVal;
        });

        return out;
    }

    function cssVar(name, fallback) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return value || fallback;
        } catch {
            return fallback;
        }
    }

    function buildThemeLayout() {
        const fontSans = cssVar('--font-sans', "'PingFang SC','Microsoft YaHei',system-ui,sans-serif");
        const fontSerif = cssVar('--font-serif', "'Noto Serif SC','Songti SC','STSong','SimSun',serif");

        const textPrimary = cssVar('--text-primary', '#24313A');
        const textMuted = cssVar('--text-muted', '#7B756D');
        const border = cssVar('--border-ink', 'rgba(140,108,72,0.22)');
        const grid = cssVar('--plot-grid', 'rgba(140,108,72,0.12)');
        const tooltipBg = cssVar('--plot-tooltip-bg', 'rgba(255,252,246,0.98)');

        return {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                family: fontSans,
                color: textPrimary,
                size: 13,
            },
            colorway: [
                '#B23A2B',
                '#516B78',
                '#5F7F68',
                '#C89A4B',
                '#9E2F25',
                '#7B5B4F',
            ],
            hoverlabel: {
                bgcolor: tooltipBg,
                bordercolor: border,
                font: {
                    family: fontSans,
                    color: textPrimary,
                    size: 12,
                },
            },
            legend: {
                bgcolor: 'rgba(0,0,0,0)',
                bordercolor: border,
                borderwidth: 0,
                font: {
                    family: fontSans,
                    color: textMuted,
                    size: 12,
                },
            },
            xaxis: {
                gridcolor: grid,
                zerolinecolor: grid,
                linecolor: border,
                tickcolor: border,
                tickfont: { family: fontSans, color: textMuted },
                titlefont: { family: fontSerif, color: textPrimary },
            },
            yaxis: {
                gridcolor: grid,
                zerolinecolor: grid,
                linecolor: border,
                tickcolor: border,
                tickfont: { family: fontSans, color: textMuted },
                titlefont: { family: fontSerif, color: textPrimary },
            },
            title: {
                font: { family: fontSerif, color: textPrimary, size: 15 },
            },
        };
    }

    function buildThemeRelayoutPatch() {
        const theme = buildThemeLayout();
        return {
            paper_bgcolor: theme.paper_bgcolor,
            plot_bgcolor: theme.plot_bgcolor,
            'font.family': theme.font.family,
            'font.color': theme.font.color,
            'title.font.family': theme.title.font.family,
            'title.font.color': theme.title.font.color,
            'legend.bgcolor': theme.legend.bgcolor,
            'legend.bordercolor': theme.legend.bordercolor,
            'legend.borderwidth': theme.legend.borderwidth,
            'legend.font.color': theme.legend.font.color,
            'hoverlabel.bgcolor': theme.hoverlabel.bgcolor,
            'hoverlabel.bordercolor': theme.hoverlabel.bordercolor,
            'hoverlabel.font.color': theme.hoverlabel.font.color,
            'xaxis.gridcolor': theme.xaxis.gridcolor,
            'xaxis.zerolinecolor': theme.xaxis.zerolinecolor,
            'xaxis.linecolor': theme.xaxis.linecolor,
            'xaxis.tickcolor': theme.xaxis.tickcolor,
            'xaxis.tickfont.color': theme.xaxis.tickfont.color,
            'xaxis.titlefont.color': theme.xaxis.titlefont.color,
            'xaxis.tickfont.family': theme.xaxis.tickfont.family,
            'xaxis.titlefont.family': theme.xaxis.titlefont.family,
            'yaxis.gridcolor': theme.yaxis.gridcolor,
            'yaxis.zerolinecolor': theme.yaxis.zerolinecolor,
            'yaxis.linecolor': theme.yaxis.linecolor,
            'yaxis.tickcolor': theme.yaxis.tickcolor,
            'yaxis.tickfont.color': theme.yaxis.tickfont.color,
            'yaxis.titlefont.color': theme.yaxis.titlefont.color,
            'yaxis.tickfont.family': theme.yaxis.tickfont.family,
            'yaxis.titlefont.family': theme.yaxis.titlefont.family,
        };
    }

    function applyThemeToLayout(layout) {
        const base = isPlainObject(layout) ? layout : {};
        const theme = buildThemeLayout();
        return deepMerge(base, theme);
    }

    function applyThemeToConfig(config) {
        const base = isPlainObject(config) ? config : {};
        return {
            displaylogo: false,
            responsive: true,
            ...base,
        };
    }

    function relayoutAllVisibleCharts() {
        if (!window.Plotly) return;
        const patch = buildThemeRelayoutPatch();
        document.querySelectorAll('.js-plotly-plot').forEach((el) => {
            try {
                window.Plotly.relayout(el, patch);
            } catch {
                // ignore
            }
        });
    }

    function setupThemeChangeListener() {
        try {
            document.addEventListener('songyun-theme-changed', () => {
                setTimeout(() => relayoutAllVisibleCharts(), 60);
            });
        } catch {
            // ignore
        }
    }

    function patchPlotly() {
        if (!window.Plotly || window.Plotly.__songyunThemePatched) return;

        const originalReact = window.Plotly.react.bind(window.Plotly);
        const originalNewPlot = window.Plotly.newPlot ? window.Plotly.newPlot.bind(window.Plotly) : null;

        window.Plotly.react = function themedReact(gd, data, layout, config) {
            return originalReact(gd, data, applyThemeToLayout(layout), applyThemeToConfig(config));
        };

        if (originalNewPlot) {
            window.Plotly.newPlot = function themedNewPlot(gd, data, layout, config) {
                return originalNewPlot(gd, data, applyThemeToLayout(layout), applyThemeToConfig(config));
            };
        }

        window.Plotly.__songyunThemePatched = true;
        window.__songyunPlotlyRelayout = relayoutAllVisibleCharts;
        setTimeout(() => relayoutAllVisibleCharts(), 100);
    }

    function initWithRetries() {
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            patchPlotly();
            if (window.Plotly?.__songyunThemePatched || tries >= 40) {
                clearInterval(timer);
            }
        }, 120);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            patchPlotly();
            setupThemeChangeListener();
            initWithRetries();
        });
    } else {
        patchPlotly();
        setupThemeChangeListener();
        initWithRetries();
    }
})();
