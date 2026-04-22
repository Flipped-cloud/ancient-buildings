/*
 * 知识图谱页面专用脚本
 * - Vanilla JS（不依赖 jQuery）
 * - Cytoscape 渲染
 * - 通过 /api/graph/* 拉取数据
 */
(function () {
    const API_ROOT = '/api';
    const CYTOSCAPE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js';

    function escapeHtml(input) {
        return String(input ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getThemeVar(name, fallback) {
        const rootStyle = getComputedStyle(document.documentElement);
        return rootStyle.getPropertyValue(name).trim() || fallback;
    }

    function buildCyStyle() {
        const nodeMain = getThemeVar('--accent-color', '#8b2b1d');
        const nodeSub = getThemeVar('--bg-tint-50', '#f4eae1');
        const edge = getThemeVar('--border-soft', '#d0c4b2');
        const textPrimary = getThemeVar('--text-primary', '#222');
        const panel = getThemeVar('--bg-panel', '#fff');

        return [
            {
                selector: 'node',
                style: {
                    content: 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'background-color': nodeMain,
                    color: '#fff',
                    'font-size': '14px',
                    'text-outline-width': 2,
                    'text-outline-color': nodeMain,
                    'border-width': 2,
                    'border-color': '#fff',
                    width: 60,
                    height: 60,
                    'font-family': "STKaiti, KaiTi, '楷体', serif",
                },
            },
            {
                selector: 'node[type="country"]',
                style: {
                    width: 110,
                    height: 110,
                    'font-size': '22px',
                    'border-width': 4,
                    'z-index': 20,
                },
            },
            {
                selector: 'node[type="province"], node[type="batch"]',
                style: {
                    'background-color': '#b47b4d',
                    'text-outline-color': '#b47b4d',
                    width: 75,
                    height: 75,
                    'font-size': '16px',
                    'z-index': 15,
                },
            },
            {
                selector: 'node[type="village"]',
                style: {
                    'background-color': nodeSub,
                    color: textPrimary,
                    'text-outline-width': 1,
                    'text-outline-color': panel,
                    'border-color': '#b47b4d',
                    width: 55,
                    height: 55,
                    'font-size': '13px',
                },
            },
            {
                selector: 'edge',
                style: {
                    width: 2,
                    'line-color': edge,
                    'target-arrow-color': edge,
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    opacity: 0.75,
                },
            },
            {
                selector: '.focus-node',
                style: {
                    'border-width': 4,
                    'border-color': '#c28741',
                    width: 90,
                    height: 90,
                    'font-size': '20px',
                    'z-index': 30,
                },
            },
        ];
    }

    async function ensureCytoscapeLoaded() {
        if (window.cytoscape) return;
        await new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-cy-src="${CYTOSCAPE_CDN}"]`);
            if (existing) return resolve();

            const s = document.createElement('script');
            s.src = CYTOSCAPE_CDN;
            s.async = true;
            s.setAttribute('data-cy-src', CYTOSCAPE_CDN);
            s.addEventListener('load', resolve);
            s.addEventListener('error', reject);
            document.head.appendChild(s);
        });
    }

    async function fetchJson(url, { timeoutMs = 30000 } = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let resp;
        try {
            resp = await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
        if (!resp.ok) {
            let detail = '';
            try {
                detail = await resp.text();
            } catch {
                // ignore
            }
            const snippet = detail ? `: ${detail.slice(0, 200)}` : '';
            throw new Error(`请求失败: ${resp.status} ${resp.statusText}${snippet}`);
        }
        return await resp.json();
    }

    function applyFullBleed(container) {
        const pageGraph = document.getElementById('page-graph');
        if (pageGraph) pageGraph.removeAttribute('style');
        if (container) container.removeAttribute('style');
    }

    function renderSkeleton(container) {
        const embedded = container?.classList?.contains('graph-embed-host');

        if (embedded) {
            container.innerHTML = `
                <div class="graph-page">
                    <div class="graph-toolbar">
                        <div class="graph-search">
                            <div class="graph-search-row">
                                <input type="text" id="graph-search-input" class="graph-search-input" placeholder="搜索省份、批次或村落名...">
                                <button id="graph-search-btn" class="graph-search-btn" type="button" aria-label="搜索">
                                    <svg class="graph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <circle cx="11" cy="11" r="6"></circle>
                                        <path d="M20 20l-3.3-3.3"></path>
                                    </svg>
                                </button>
                                <button id="graph-reset-btn" class="graph-search-btn" type="button">返回顶层</button>
                            </div>
                            <div id="graph-search-results" class="graph-search-results hidden"></div>
                        </div>
                    </div>

                    <div class="graph-layout">
                        <div id="graph-canvas" class="graph-canvas"></div>

                        <aside id="graph-drawer" class="graph-drawer hidden">
                            <div class="graph-drawer-header">
                                <h3 id="graph-drawer-title" class="graph-drawer-title m-0 line-clamp-1">村落详情</h3>
                                <button id="graph-drawer-close" class="graph-drawer-close" type="button">关闭</button>
                            </div>
                            <div id="graph-drawer-body" class="graph-drawer-body"></div>
                            <div class="p-3 pt-2">
                                <button id="graph-drawer-link" class="seal-button w-full py-2 rounded-lg font-semibold transition" type="button">前往数据页查看</button>
                            </div>
                        </aside>
                    </div>
                </div>
            `;

            return {
                canvas: container.querySelector('#graph-canvas'),
                searchInput: container.querySelector('#graph-search-input'),
                searchBtn: container.querySelector('#graph-search-btn'),
                resetBtn: container.querySelector('#graph-reset-btn'),
                searchResults: container.querySelector('#graph-search-results'),
                drawer: container.querySelector('#graph-drawer'),
                drawerTitle: container.querySelector('#graph-drawer-title'),
                drawerBody: container.querySelector('#graph-drawer-body'),
                drawerClose: container.querySelector('#graph-drawer-close'),
                drawerLink: container.querySelector('#graph-drawer-link'),
            };
        }

        container.innerHTML = `
            <section class="graph-page max-w-6xl mx-auto px-4 py-12">
                <header class="catalog-page-header text-center mb-10">
                    <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-3 catalog-section-title">知识图谱</h2>
                    <p class="text-gray-600 max-w-3xl mx-auto">按省份、批次或村落名进行检索，查看节点关系与村落详情。</p>
                </header>

                <div class="graph-toolbar">
                    <div class="graph-search">
                        <div class="graph-search-row">
                            <input type="text" id="graph-search-input" class="graph-search-input" placeholder="搜索省份、批次或村落名...">
                            <button id="graph-search-btn" class="graph-search-btn" type="button" aria-label="搜索">
                                <svg class="graph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <circle cx="11" cy="11" r="6"></circle>
                                    <path d="M20 20l-3.3-3.3"></path>
                                </svg>
                            </button>
                            <button id="graph-reset-btn" class="graph-search-btn" type="button">返回顶层</button>
                        </div>
                        <div id="graph-search-results" class="graph-search-results hidden"></div>
                    </div>
                </div>

                <div class="graph-layout">
                    <div id="graph-canvas" class="graph-canvas"></div>

                    <aside id="graph-drawer" class="graph-drawer hidden">
                        <div class="graph-drawer-header">
                            <h3 id="graph-drawer-title" class="graph-drawer-title m-0 line-clamp-1">村落详情</h3>
                            <button id="graph-drawer-close" class="graph-drawer-close" type="button">关闭</button>
                        </div>
                        <div id="graph-drawer-body" class="graph-drawer-body"></div>
                        <div class="p-3 pt-2">
                            <button id="graph-drawer-link" class="seal-button w-full py-2 rounded-lg font-semibold transition" type="button">前往数据页查看</button>
                        </div>
                    </aside>
                </div>
            </section>
        `;

        return {
            canvas: container.querySelector('#graph-canvas'),
            searchInput: container.querySelector('#graph-search-input'),
            searchBtn: container.querySelector('#graph-search-btn'),
            resetBtn: container.querySelector('#graph-reset-btn'),
            searchResults: container.querySelector('#graph-search-results'),
            drawer: container.querySelector('#graph-drawer'),
            drawerTitle: container.querySelector('#graph-drawer-title'),
            drawerBody: container.querySelector('#graph-drawer-body'),
            drawerClose: container.querySelector('#graph-drawer-close'),
            drawerLink: container.querySelector('#graph-drawer-link'),
        };
    }

    function openDrawer(ui, title, bodyHtml) {
        ui.drawerTitle.textContent = title;
        ui.drawerBody.innerHTML = bodyHtml;
        ui.drawer.classList.remove('hidden');
    }

    function closeDrawer(ui) {
        ui.drawer.classList.add('hidden');
    }

    function upsert(cy, payload) {
        if (!payload) return;
        const nodes = payload.nodes || [];
        const edges = payload.edges || [];

        const additions = [];
        for (const n of nodes) {
            const id = n?.data?.id;
            if (!id) continue;
            if (cy.getElementById(id).empty()) additions.push(n);
        }
        for (const e of edges) {
            const id = e?.data?.id;
            if (!id) continue;
            if (cy.getElementById(id).empty()) additions.push(e);
        }
        if (additions.length) cy.add(additions);
    }

    function runLayout(cy, focusId) {
        cy.elements().removeClass('focus-node');
        const focus = cy.getElementById(focusId);
        if (!focus.empty()) focus.addClass('focus-node');

        cy.layout({
            name: 'breadthfirst',
            roots: focus.empty() ? undefined : focus,
            circle: true,
            directed: true,
            spacingFactor: 1.35,
            animate: true,
            animationDuration: 650,
            fit: true,
            padding: 120,
        }).run();
    }

    async function initGraphPage(container) {
        applyFullBleed(container);
        const ui = renderSkeleton(container);
        closeDrawer(ui);

        ui.drawerClose.addEventListener('click', () => closeDrawer(ui));
        ui.drawerLink.addEventListener('click', () => {
            if (window.songyun && window.songyun.navigate) {
                window.songyun.navigate('#page-data');
            }
        });

        await ensureCytoscapeLoaded();

        const cy = window.cytoscape({
            container: ui.canvas,
            elements: [],
            style: buildCyStyle(),
            layout: { name: 'preset' },
            wheelSensitivity: 0.2,
            minZoom: 0.15,
            maxZoom: 3,
        });

        // 提供给外部（main.js 切页）做 resize/render 兜底，避免 hidden -> visible 空白
        try {
            container.__cy = cy;
        } catch {
            // ignore
        }

        const state = {
            loadedParents: new Set(),
            focusId: 'root:china',
        };

        document.addEventListener('songyun-theme-changed', () => {
            cy.style(buildCyStyle());
        });

        async function fetchChildren(nodeId) {
            if (!nodeId || state.loadedParents.has(nodeId)) return;
            state.loadedParents.add(nodeId);
            const payload = await fetchJson(`${API_ROOT}/graph/children?node_id=${encodeURIComponent(nodeId)}`);
            upsert(cy, payload);
        }

        async function focusOn(nodeId) {
            state.focusId = nodeId;
            await fetchChildren(nodeId);
            runLayout(cy, nodeId);
        }

        async function openVillageDetail(villageId) {
            const payload = await fetchJson(`${API_ROOT}/graph/village/${encodeURIComponent(villageId)}`);
            const v = payload?.village;
            if (!v) return;

            const title = v.title || v.village || '村落详情';
            const body = `
                <dl class="space-y-2">
                    <div><dt class="text-xs" style="color: var(--text-muted)">行政区划</dt><dd class="text-sm" style="color: var(--text-primary)">${escapeHtml(v.province || '')} ${escapeHtml(v.city || '')} ${escapeHtml(v.county || '')} ${escapeHtml(v.town || '')}</dd></div>
                    <div><dt class="text-xs" style="color: var(--text-muted)">所在名称</dt><dd class="text-sm" style="color: var(--text-primary)">${escapeHtml(v.village || v.title || '')}</dd></div>
                    <div><dt class="text-xs" style="color: var(--text-muted)">所属批次</dt><dd class="text-sm" style="color: var(--text-primary)">${escapeHtml(v.batch_label || '')}</dd></div>
                    <div><dt class="text-xs" style="color: var(--text-muted)">地理坐标</dt><dd class="text-sm" style="color: var(--text-primary)">${(v.lng != null && v.lat != null) ? `${escapeHtml(v.lng)}, ${escapeHtml(v.lat)}` : '暂无数据'}</dd></div>
                </dl>
            `;
            openDrawer(ui, title, body);
        }

        cy.on('tap', 'node', async (evt) => {
            const node = evt.target;
            const id = node.id();
            const type = node.data('type');

            if (type === 'village') {
                await focusOn(id);
                await openVillageDetail(id);
                return;
            }

            closeDrawer(ui);
            await focusOn(id);
        });

        cy.on('tap', (evt) => {
            if (evt.target === cy) closeDrawer(ui);
        });

        function setResultsOpen(open) {
            ui.searchResults.classList.toggle('hidden', !open);
        }

        function clearResults() {
            ui.searchResults.innerHTML = '';
            setResultsOpen(false);
        }

        async function runSearch() {
            const q = (ui.searchInput.value || '').trim();
            if (!q) {
                clearResults();
                return;
            }

            const payload = await fetchJson(`${API_ROOT}/graph/search?q=${encodeURIComponent(q)}&limit=20`);
            const results = payload?.results || [];

            if (!results.length) {
                ui.searchResults.innerHTML = `<div class="p-4 text-center" style="color: var(--text-muted)">未匹配到结果</div>`;
                setResultsOpen(true);
                return;
            }

            ui.searchResults.innerHTML = results
                .map((r, idx) => {
                    const node = r?.node?.data;
                    const label = escapeHtml(node?.label || '未知节点');
                    const type = escapeHtml(node?.type || '');
                    return `
                        <button type="button" data-idx="${idx}" class="graph-search-item">
                            <div>${label}</div>
                            <small>${type}</small>
                        </button>
                    `;
                })
                .join('');
            setResultsOpen(true);

            ui.searchResults.querySelectorAll('button[data-idx]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const idx = Number(btn.getAttribute('data-idx'));
                    const r = results[idx];
                    const nodeId = r?.node?.data?.id;
                    const path = r?.path || [];

                    clearResults();
                    closeDrawer(ui);

                    for (const pid of path) {
                        if (pid) await fetchChildren(pid);
                    }

                    if (nodeId) {
                        await focusOn(nodeId);
                        if (r?.node?.data?.type === 'village') {
                            await openVillageDetail(nodeId);
                        }
                    }
                });
            });
        }

        ui.searchBtn.addEventListener('click', () => runSearch().catch((e) => console.error(e)));
        ui.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch().catch((err) => console.error(err));
            if (e.key === 'Escape') clearResults();
        });
        document.addEventListener('click', (e) => {
            if (ui.searchResults.classList.contains('hidden')) return;
            const t = e.target;
            if (!t) return;
            if (ui.searchResults.contains(t) || ui.searchInput.contains(t)) return;
            clearResults();
        });

        ui.resetBtn.addEventListener('click', async () => {
            closeDrawer(ui);
            ui.searchInput.value = '';
            await focusOn('root:china');
        });

        const rootPayload = await fetchJson(`${API_ROOT}/graph/root`);
        upsert(cy, rootPayload);
        state.loadedParents.add('root:china');
        await fetchChildren('root:china');
        runLayout(cy, 'root:china');
    }

    window.GraphPage = {
        initGraphPage,
    };
})();
