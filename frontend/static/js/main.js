/**
 * 主要应用逻辑
 * 四大模块：相关政策、数据一览、时空导览、内容推荐
 */

let currentPage = 'home';

function scrollToIdWhenReady(elementId, offset = 80, timeoutMs = 3000) {
    const start = performance.now();
    return new Promise((resolve) => {
        function tick() {
            const el = document.getElementById(elementId);
            if (el) {
                smoothScrollTo(el, offset);
                resolve(true);
                return;
            }
            if (performance.now() - start > timeoutMs) {
                resolve(false);
                return;
            }
            requestAnimationFrame(tick);
        }
        tick();
    });
}

function safeResizePlotlyWithin(root) {
    if (typeof Plotly === 'undefined') return;
    if (!root) return;
    const charts = root.querySelectorAll?.('.js-plotly-plot');
    if (!charts || charts.length === 0) return;
    charts.forEach((el) => {
        try {
            Plotly.Plots.resize(el);
        } catch {
            // ignore
        }
    });
}

function setActiveNav(page) {
    document.querySelectorAll('a.nav-link[data-page]').forEach((link) => {
        const p = link.getAttribute('data-page');
        const active = p === page;
        link.classList.toggle('is-active', active);
        if (active) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

const pageLoaded = {
    policy: false,
    data: false,
    tour: false,
    media: false,
};

function escapeHtml(input) {
    const str = String(input ?? '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function navigate(page) {
    // 兼容：旧的“知识图谱”入口已迁移到数据页
    const wantsGraphAnchor = page === 'graph';
    if (wantsGraphAnchor) page = 'data';

    if (currentPage === 'media' && page !== 'media') {
        const player = document.getElementById('media-player');
        if (player && typeof player.pause === 'function') {
            try {
                player.pause();
            } catch {
                // ignore
            }
        }
    }

    document.querySelectorAll('.page-section').forEach((el) => {
        el.classList.add('hidden');
        // 防止某些页面用内联 style 设置 display，覆盖 Tailwind 的 hidden
        if (el?.style) {
            el.style.removeProperty('display');
        }
    });

    const pageElement = document.getElementById(`page-${page}`);
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }

    currentPage = page;
    setActiveNav(page);

    switch (page) {
        case 'policy':
            if (!pageLoaded.policy) {
                loadPolicyPage();
                pageLoaded.policy = true;
            }
            break;
        case 'data':
            if (!pageLoaded.data) {
                loadDataPage();
                pageLoaded.data = true;
            }
            break;
        case 'tour':
            if (!pageLoaded.tour) {
                loadTourPage();
                pageLoaded.tour = true;
            }
            break;
        case 'media':
            if (!pageLoaded.media) {
                loadMediaPage();
                pageLoaded.media = true;
            }
            break;
        default:
            break;
    }

    // 页面切换后：恢复可视化组件尺寸（hidden -> visible 常见空白问题）
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (pageElement) safeResizePlotlyWithin(pageElement);
            // Cytoscape: 如果嵌入图谱已初始化，显示后做一次 resize/render
            if (page === 'data') {
                const host = document.getElementById('data-graph-content');
                const cy = host && (host.__cy || host._cy);
                if (cy && typeof cy.resize === 'function') {
                    try {
                        cy.resize();
                        if (typeof cy.render === 'function') cy.render();
                    } catch {
                        // ignore
                    }
                }
            }
        }, 80);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (wantsGraphAnchor) {
        scrollToIdWhenReady('data-graph-panel', 95, 4000);
    }
}

async function loadPolicyPage() {
    const container = document.getElementById('policy-content');
    if (!container) return;

    showLoadingState(container, '正在加载政策时间线...');

    try {
        const timeline = await getPolicyTimeline();
        if (!timeline || timeline.length === 0) {
            showErrorState(container, '暂无政策数据');
            pageLoaded.policy = false;
            return;
        }

        const timelineHtml = timeline
            .map((policy, idx) => {
                const year = escapeHtml(policy.year || '未知年份');
                const title = escapeHtml(policy.title || '未命名政策');
                const content = escapeHtml(policy.content || '');
                const imageUrl = policy.image_url ? escapeHtml(policy.image_url) : '';
                const delay = Math.min(idx * 0.08, 0.8);

                return `
                    <article class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-year">${year}</div>
                            <h3 class="timeline-title">${title}</h3>
                            <p class="timeline-text whitespace-pre-line">${content}</p>
                            ${imageUrl ? `
                                <div class="mt-4 overflow-hidden rounded-lg catalog-figure">
                                    <img src="${imageUrl}" alt="${title}" class="w-full h-56 object-cover" loading="lazy">
                                </div>
                            ` : ''}
                        </div>
                    </article>
                `;
            })
            .join('');

        container.innerHTML = `
            <section class="max-w-6xl mx-auto px-4 py-10 paper-page-section">
                <header class="text-center mb-12 catalog-page-header">
                    <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-3 catalog-section-title">相关政策</h2>
                    <p class="text-gray-600 max-w-3xl mx-auto">从 2012 年到现在，系统呈现传统村落保护政策的关键节点与演进路径。</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <div class="stat-card catalog-stat-card" data-stat="policy-nodes">
                        <div class="text-3xl font-bold">${timeline.length}</div>
                        <div class="text-gray-600 mt-2">政策节点</div>
                    </div>
                    <div class="stat-card catalog-stat-card" data-stat="policy-first">
                        <div class="text-3xl font-bold">${escapeHtml(timeline[0]?.year || '')}</div>
                        <div class="text-gray-600 mt-2">最早年份</div>
                    </div>
                    <div class="stat-card catalog-stat-card" data-stat="policy-last">
                        <div class="text-3xl font-bold">${escapeHtml(timeline[timeline.length - 1]?.year || '')}</div>
                        <div class="text-gray-600 mt-2">最新年份</div>
                    </div>
                </div>

                <div class="timeline">${timelineHtml}</div>
            </section>
        `;

        setupTableRowInteractions();
    } catch (error) {
        console.error('政策页面加载失败:', error);
        showErrorState(container, '政策数据加载失败');
        pageLoaded.policy = false;
    }
}

function renderVillageRows(villages) {
    if (!villages || villages.length === 0) {
        return `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">没有符合条件的数据</td>
            </tr>
        `;
    }

    return villages
        .map((v, idx) => {
            const batch = escapeHtml(v.Batch_Label || '未知');
            return `
                <tr class="catalog-table-row${idx % 2 === 0 ? '' : ' is-alt'}">
                    <td class="px-4 py-3 text-gray-500">${idx + 1}</td>
                    <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(v.Province || '-')}</td>
                    <td class="px-4 py-3 text-gray-700">${escapeHtml(v.City || '-')}</td>
                    <td class="px-4 py-3 text-gray-700">${escapeHtml(v.County || '-')}</td>
                    <td class="px-4 py-3 text-gray-700">${escapeHtml(v.Town || '-')}</td>
                    <td class="px-4 py-3 font-semibold text-gray-800">${escapeHtml(v.Village || v.Title || '-')}</td>
                    <td class="px-4 py-3 text-center"><span class="seal-badge inline-block px-2 py-1 rounded-full text-xs font-semibold">${batch}</span></td>
                </tr>
            `;
        })
        .join('');
}

function renderBatchDistribution(villages) {
    const map = new Map();
    villages.forEach((v) => {
        const key = v.Batch_Label || '未知';
        map.set(key, (map.get(key) || 0) + 1);
    });

    const items = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const max = items.length ? items[0][1] : 1;

    return items
        .map(([label, count]) => {
            const width = Math.max(6, Math.round((count / max) * 100));
            return `
                <div class="mb-3">
                    <div class="flex items-center justify-between text-sm mb-1">
                        <span class="text-gray-700 font-medium">${escapeHtml(label)}</span>
                        <span class="text-gray-500">${count}</span>
                    </div>
                    <div class="h-2 catalog-progress-track overflow-hidden">
                        <div class="h-full catalog-progress-fill" style="width:${width}%"></div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function getCnMapboxLayout(centerLat, centerLng, zoom) {
    return {
        style: 'white-bg',
        layers: [
            {
                below: 'traces',
                sourcetype: 'raster',
                sourceattribution: '<b>高德地图</b>',
                source: [
                    'http://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                ],
            },
        ],
        center: { lat: centerLat, lon: centerLng },
        zoom,
    };
}

function estimateZoomBySpan(latSpan, lngSpan) {
    const maxSpan = Math.max(latSpan, lngSpan);
    if (maxSpan > 20) return 3.5;
    if (maxSpan > 10) return 4.5;
    if (maxSpan > 5) return 5.5;
    if (maxSpan > 2) return 7.0;
    return 8.5;
}

function kmeans2D(points, k, maxIter = 30) {
    if (!points || points.length < k) return null;

    const centroids = [];
    const used = new Set();
    while (centroids.length < k) {
        const idx = Math.floor(Math.random() * points.length);
        if (!used.has(idx)) {
            used.add(idx);
            centroids.push([...points[idx]]);
        }
    }

    const labels = new Array(points.length).fill(0);

    for (let iter = 0; iter < maxIter; iter += 1) {
        let changed = false;

        for (let i = 0; i < points.length; i += 1) {
            let best = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            for (let c = 0; c < k; c += 1) {
                const dx = points[i][0] - centroids[c][0];
                const dy = points[i][1] - centroids[c][1];
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                    bestDist = d;
                    best = c;
                }
            }
            if (labels[i] !== best) {
                labels[i] = best;
                changed = true;
            }
        }

        const sums = new Array(k).fill(0).map(() => [0, 0, 0]);
        for (let i = 0; i < points.length; i += 1) {
            const label = labels[i];
            sums[label][0] += points[i][0];
            sums[label][1] += points[i][1];
            sums[label][2] += 1;
        }

        for (let c = 0; c < k; c += 1) {
            if (sums[c][2] > 0) {
                centroids[c][0] = sums[c][0] / sums[c][2];
                centroids[c][1] = sums[c][1] / sums[c][2];
            }
        }

        if (!changed) break;
    }

    return labels;
}

async function loadDataPage() {
    const container = document.getElementById('data-content');
    if (!container) return;

    showLoadingState(container, '正在加载数据分析模块...');

    try {
        const [stats, provinces, batches, distribution, allVillages, allCoords] = await Promise.all([
            getStatistics(),
            getProvinces(),
            getDistributionByBatch(),
            getDistributionByProvince(),
            getVillages({ limit: 10000 }),
            getCoordinates({ limit: 10000 }),
        ]);

        container.innerHTML = `
            <section class="max-w-7xl mx-auto px-4 py-10 paper-page-section">
                <header class="text-center mb-10 catalog-page-header">
                    <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-3 catalog-section-title">数据一览</h2>
                    <p class="text-gray-600 max-w-3xl mx-auto">按省份、城市、批次进行联动筛选，查看传统村落的结构分布和明细数据。</p>
                </header>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="stat-card catalog-stat-card" data-stat="villages"><div class="text-3xl font-bold app-num">${Number(stats?.total || 0)}</div><div class="text-gray-600 mt-2">村落总数</div></div>
                    <div class="stat-card catalog-stat-card" data-stat="provinces"><div class="text-3xl font-bold app-num">${stats?.provinces || 0}</div><div class="text-gray-600 mt-2">覆盖省份</div></div>
                    <div class="stat-card catalog-stat-card" data-stat="cities"><div class="text-3xl font-bold app-num">${stats?.cities || 0}</div><div class="text-gray-600 mt-2">城市县区</div></div>
                    <div class="stat-card catalog-stat-card" data-stat="batches"><div class="text-3xl font-bold app-num">${stats?.batches || 0}</div><div class="text-gray-600 mt-2">保护批次</div></div>
                </div>

                <div class="paper-panel catalog-panel p-5 mb-8">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">筛选条件</h3>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select id="data-filter-province" class="paper-input px-4 py-2">
                            <option value="">全部省份</option>
                        </select>
                        <select id="data-filter-city" class="paper-input px-4 py-2">
                            <option value="">全部城市</option>
                        </select>
                        <select id="data-filter-batch" class="paper-input px-4 py-2">
                            <option value="">全部批次</option>
                        </select>
                        <input id="data-filter-keyword" type="text" class="paper-input px-4 py-2" placeholder="村落名称关键词">
                    </div>
                    <div class="flex flex-wrap gap-3 mt-4">
                        <button id="data-filter-run" class="btn btn-primary seal-button px-5 py-2">执行筛选</button>
                        <button id="data-filter-reset" class="btn btn-secondary ghost-button px-5 py-2">重置</button>
                        <span id="data-filter-result" class="text-sm text-gray-500 self-center"></span>
                    </div>
                </div>

                <div class="paper-panel catalog-panel p-5 mb-8">
                    <div class="flex flex-wrap gap-2 mb-4" id="data-tab-head">
                        <button data-tab="map" class="catalog-tab is-active" type="button">空间分布可视化</button>
                        <button data-tab="stats" class="catalog-tab" type="button">多维统计分析</button>
                        <button data-tab="table" class="catalog-tab" type="button">数据明细</button>
                    </div>

                    <div id="data-tab-map" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select id="data-map-mode" class="paper-input px-4 py-2">
                                <option value="point">传统村落点位图</option>
                                <option value="density">空间核密度图</option>
                                <option value="cluster">空间聚类分析</option>
                            </select>
                            <div>
                                <div class="text-xs text-gray-600 mb-1">核密度半径 <span id="label-map-radius" class="seal-accent">15</span></div>
                                <input id="data-map-radius" type="range" min="2" max="30" value="15" class="w-full catalog-slider">
                            </div>
                            <div>
                                <div class="text-xs text-gray-600 mb-1">透明度 <span id="label-map-opacity" class="seal-accent">0.70</span></div>
                                <input id="data-map-opacity" type="range" min="10" max="100" value="70" class="w-full catalog-slider">
                            </div>
                            <div>
                                <div class="text-xs text-gray-600 mb-1">聚类数量K <span id="label-map-k" class="seal-accent">6</span></div>
                                <input id="data-map-k" type="range" min="2" max="15" value="6" class="w-full catalog-slider">
                            </div>
                        </div>
                        <div id="data-map-chart" class="h-[620px] catalog-chart-frame"></div>
                    </div>

                    <div id="data-tab-stats" class="hidden space-y-4">
                        <div class="flex flex-wrap gap-2" id="stats-subtab-head">
                            <button data-subtab="hierarchy" class="catalog-subtab is-active" type="button">层级结构</button>
                            <button data-subtab="trend" class="catalog-subtab" type="button">趋势与流向</button>
                            <button data-subtab="geo" class="catalog-subtab" type="button">地理特征</button>
                            <button data-subtab="mining" class="catalog-subtab" type="button">深度挖掘</button>
                        </div>

                        <div id="stats-subtab-hierarchy" class="space-y-4">
                            <div class="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                                <div id="chart-sunburst" class="w-full h-[540px] catalog-chart-frame"></div>
                                <div id="chart-treemap" class="w-full h-[540px] catalog-chart-frame"></div>
                            </div>
                        </div>

                        <div id="stats-subtab-trend" class="hidden space-y-4">
                            <div id="chart-parcats" class="w-full h-[620px] catalog-chart-frame"></div>
                            <div id="chart-batch-bar" class="w-full h-[460px] catalog-chart-frame"></div>
                        </div>

                        <div id="stats-subtab-geo" class="hidden">
                            <div id="chart-violin" class="w-full h-[500px] catalog-chart-frame"></div>
                        </div>

                        <div id="stats-subtab-mining" class="hidden space-y-4">
                            <div id="chart-suffix-bar" class="w-full h-[500px] catalog-chart-frame"></div>
                            <div class="grid grid-cols-1 2xl:grid-cols-5 gap-4 items-start">
                                <div id="chart-center-track" class="h-[520px] 2xl:col-span-3 catalog-chart-frame"></div>
                                <div class="paper-panel catalog-panel p-4 overflow-auto max-h-[520px] 2xl:col-span-2">
                                    <h4 class="font-semibold text-gray-800 mb-3">空间孤立度分析（前十）</h4>
                                    <div id="table-isolation" class="text-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="data-tab-table" class="hidden"></div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div class="paper-panel catalog-panel p-5" data-panel="province-top">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">省份分布 Top 12</h3>
                        <div id="province-dist-table"></div>
                    </div>
                    <div class="paper-panel catalog-panel p-5" data-panel="batch-bars">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">当前结果批次分布</h3>
                        <div id="batch-dist-bars"></div>
                    </div>
                </div>

                <div id="data-graph-panel" class="paper-panel catalog-table-panel overflow-hidden mb-8">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-800">知识图谱</h3>
                        <div class="text-xs text-gray-500">可搜索省份 / 批次 / 村落名</div>
                    </div>
                    <div class="p-5">
                        <div id="data-graph-content" class="graph-embed-host"></div>
                    </div>
                </div>

                <div class="paper-panel catalog-table-panel overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 id="data-detail-title" class="text-lg font-semibold text-gray-800">村落明细（最多 300 条）</h3>
                        <div class="flex items-center gap-3">
                            <span id="data-table-count" class="text-sm text-gray-500"></span>
                            <button id="data-export-btn" class="seal-button px-3 py-1.5 text-sm rounded-lg">导出筛选数据</button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="catalog-table-head border-b border-gray-200">
                                <tr>
                                    <th class="px-4 py-3 text-left">#</th>
                                    <th class="px-4 py-3 text-left">省份</th>
                                    <th class="px-4 py-3 text-left">城市</th>
                                    <th class="px-4 py-3 text-left">县区</th>
                                    <th class="px-4 py-3 text-left">乡镇</th>
                                    <th class="px-4 py-3 text-left">村落名称</th>
                                    <th class="px-4 py-3 text-center">批次</th>
                                </tr>
                            </thead>
                            <tbody id="data-village-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;

        const provinceSelect = document.getElementById('data-filter-province');
        const citySelect = document.getElementById('data-filter-city');
        const batchSelect = document.getElementById('data-filter-batch');
        const keywordInput = document.getElementById('data-filter-keyword');
        const runBtn = document.getElementById('data-filter-run');
        const resetBtn = document.getElementById('data-filter-reset');
        const resultText = document.getElementById('data-filter-result');
        const dataTableCount = document.getElementById('data-table-count');
        const exportBtn = document.getElementById('data-export-btn');
        const tbody = document.getElementById('data-village-tbody');

        // 迁移后的知识图谱：初始化到数据页中间区域
        const graphHost = document.getElementById('data-graph-content');
        async function initEmbeddedGraph() {
            if (!graphHost) return;
            if (graphHost.dataset.graphInited === '1' || graphHost.dataset.graphInited === 'loading') return;
            graphHost.dataset.graphInited = 'loading';
            showLoadingState(graphHost, '正在加载知识图谱...');
            try {
                await ensureGraphScriptLoaded();
                if (!window.GraphPage || typeof window.GraphPage.initGraphPage !== 'function') {
                    throw new Error('GraphPage.initGraphPage not found');
                }
                await window.GraphPage.initGraphPage(graphHost);
                graphHost.dataset.graphInited = '1';
            } catch (e) {
                console.error('嵌入式知识图谱加载失败:', e);
                delete graphHost.dataset.graphInited;
                showErrorState(graphHost, '知识图谱模块加载失败');
            }
        }
        initEmbeddedGraph();

        provinces.forEach((p) => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            provinceSelect.appendChild(option);
        });

        batches.forEach((item) => {
            const label = item.batch || '未知';
            const option = document.createElement('option');
            option.value = label;
            option.textContent = `${label}（${item.count}）`;
            batchSelect.appendChild(option);
        });

        const distTable = document.getElementById('province-dist-table');

        function renderRegionTopTable(rows, selectedProvince, selectedCity) {
            const isNational = !selectedProvince && !selectedCity;
            const topN = isNational ? 10 : 5;

            const regionMap = new Map();
            rows.forEach((v) => {
                const key = selectedCity
                    ? (v.County || '未知县区')
                    : (selectedProvince ? (v.City || '未知城市') : (v.Province || '未知省份'));
                regionMap.set(key, (regionMap.get(key) || 0) + 1);
            });

            const ordered = Array.from(regionMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, topN);

            const total = rows.length || 1;
            const title = isNational
                ? '省份分布 Top 10'
                : (selectedCity ? '县区分布 Top 5' : '城市分布 Top 5');

            const titleNode = distTable.closest('[data-panel="province-top"]')?.querySelector('h3');
            if (titleNode) titleNode.textContent = title;

            const tbodyHtml = ordered.map((item, idx) => `
                <tr class="catalog-table-row${idx % 2 === 0 ? '' : ' is-alt'}">
                    <td class="px-3 py-2 text-gray-500">${idx + 1}</td>
                    <td class="px-3 py-2 font-medium text-gray-800">${escapeHtml(item[0])}</td>
                    <td class="px-3 py-2 text-right text-gray-700">${item[1]}</td>
                    <td class="px-3 py-2 text-right text-gray-500">${((item[1] / total) * 100).toFixed(1)}%</td>
                </tr>
            `).join('');

            distTable.innerHTML = `
                <table class="w-full text-sm">
                    <thead class="catalog-table-head">
                        <tr>
                            <th class="px-3 py-2 text-left">#</th>
                            <th class="px-3 py-2 text-left">地区</th>
                            <th class="px-3 py-2 text-right">数量</th>
                            <th class="px-3 py-2 text-right">占比</th>
                        </tr>
                    </thead>
                    <tbody>${tbodyHtml || '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">暂无数据</td></tr>'}</tbody>
                </table>
            `;
        }

        async function refreshCities() {
            const province = provinceSelect.value;
            const cities = await getCities(province || null);

            citySelect.innerHTML = '<option value="">全部城市</option>';
            cities.forEach((c) => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                citySelect.appendChild(option);
            });
        }

        let filteredVillages = [...allVillages];
        let filteredCoords = [...allCoords];

        function batchToNum(label) {
            const m = String(label || '').match(/(\d+)/);
            return m ? Number(m[1]) : 0;
        }

        function simplifyProvinceName(name) {
            return String(name || '')
                .replace(/壮族自治区|回族自治区|维吾尔自治区/g, '自治区')
                .replace(/特别行政区/g, '')
                .replace(/自治区$/, '')
                .replace(/省$/, '')
                .trim() || '未知省份';
        }

        function simplifyCityName(city, province) {
            const pRaw = String(province || '').trim();
            const pSimple = simplifyProvinceName(pRaw);
            let c = String(city || '').trim();

            if (pRaw && c.startsWith(pRaw)) c = c.slice(pRaw.length).trim();
            if (pSimple && c.startsWith(pSimple)) c = c.slice(pSimple.length).trim();

            c = c
                .replace(/^[\-—·\s]+/, '')
                .replace(/市辖区$/g, '')
                .replace(/特别行政区$/g, '')
                .replace(/自治州$/g, '')
                .replace(/地区$/g, '')
                .replace(/盟$/g, '')
                .replace(/市$/g, '')
                .trim();

            return c || String(city || '未知城市');
        }

        function resizeVisiblePlotly(panelId = null) {
            if (typeof Plotly === 'undefined') return;

            const root = panelId ? document.getElementById(panelId) : document;
            if (!root) return;

            // Plotly 在 hidden 容器初始化时会拿到较小宽度，切换后手动 resize 可恢复满宽。
            const charts = root.querySelectorAll('.js-plotly-plot');
            charts.forEach((el) => {
                try {
                    Plotly.Plots.resize(el);
                } catch (e) {
                    console.warn('Plotly resize skipped:', e);
                }
            });
        }

        function setActiveMainTab(tab) {
            ['map', 'stats', 'table'].forEach((name) => {
                const panel = document.getElementById(`data-tab-${name}`);
                if (panel) panel.classList.toggle('hidden', name !== tab);
            });
            document.querySelectorAll('#data-tab-head [data-tab]').forEach((btn) => {
                const active = btn.getAttribute('data-tab') === tab;
                btn.className = active ? 'catalog-tab is-active' : 'catalog-tab';
            });

            requestAnimationFrame(() => {
                setTimeout(() => resizeVisiblePlotly(`data-tab-${tab}`), 60);
            });
        }

        function setActiveSubTab(tab) {
            ['hierarchy', 'trend', 'geo', 'mining'].forEach((name) => {
                const panel = document.getElementById(`stats-subtab-${name}`);
                if (panel) panel.classList.toggle('hidden', name !== tab);
            });
            document.querySelectorAll('#stats-subtab-head [data-subtab]').forEach((btn) => {
                const active = btn.getAttribute('data-subtab') === tab;
                btn.className = active ? 'catalog-subtab is-active' : 'catalog-subtab';
            });

            requestAnimationFrame(() => {
                setTimeout(() => resizeVisiblePlotly(`stats-subtab-${tab}`), 60);
            });
        }

        function renderMapChart(dataRows) {
            const chartEl = document.getElementById('data-map-chart');
            if (!chartEl) return;

            if (typeof Plotly === 'undefined') {
                chartEl.innerHTML = '<div class="text-red-600">Plotly 未加载，无法绘图</div>';
                return;
            }

            const points = dataRows
                .map((v) => ({
                    lat: Number(v.lat),
                    lng: Number(v.lng),
                    batch: v.Batch_Label || '未知',
                    title: v.Title || v.Village || '未命名村落',
                    province: v.Province || '-',
                    city: v.City || '-',
                }))
                .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));

            if (!points.length) {
                chartEl.innerHTML = '<div class="text-gray-500 text-sm">当前筛选条件下无坐标点</div>';
                return;
            }

            const lats = points.map((p) => p.lat);
            const lngs = points.map((p) => p.lng);
            const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
            const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
            const zoom = estimateZoomBySpan(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));

            const mode = document.getElementById('data-map-mode')?.value || 'point';
            const radius = Number(document.getElementById('data-map-radius')?.value || 15);
            const opacity = Number(document.getElementById('data-map-opacity')?.value || 70) / 100;
            const k = Number(document.getElementById('data-map-k')?.value || 6);

            const labelRadius = document.getElementById('label-map-radius');
            const labelOpacity = document.getElementById('label-map-opacity');
            const labelK = document.getElementById('label-map-k');
            if (labelRadius) labelRadius.textContent = String(radius);
            if (labelOpacity) labelOpacity.textContent = opacity.toFixed(2);
            if (labelK) labelK.textContent = String(k);

            const layout = {
                mapbox: getCnMapboxLayout(centerLat, centerLng, zoom),
                height: 600,
                margin: { l: 0, r: 0, t: 0, b: 0 },
                legend: {
                    yanchor: 'top', y: 0.98, xanchor: 'left', x: 0.01,
                    bgcolor: 'rgba(0,0,0,0)',
                },
            };

            const batchPalette = ['#B23A2B', '#B55D4C', '#C89A4B', '#6C8B7A', '#5A7280', '#7B5B4F'];
            const stablePalette = ['#5A7280', '#6C8B7A', '#7B5B4F', '#C89A4B', '#9E2F25', '#B55D4C', '#516B78', '#7A8F8A', '#CDBCA3'];

            function hashString(str) {
                const s = String(str ?? '');
                let h = 2166136261;
                for (let i = 0; i < s.length; i += 1) {
                    h ^= s.charCodeAt(i);
                    h = Math.imul(h, 16777619);
                }
                return h >>> 0;
            }

            function getBatchColor(label) {
                const n = batchToNum(label);
                if (n > 0) return batchPalette[(n - 1) % batchPalette.length];
                return '#7A8F8A';
            }

            function getStableColor(key) {
                const idx = hashString(key) % stablePalette.length;
                return stablePalette[idx];
            }

            if (mode === 'density') {
                Plotly.react(chartEl, [
                    {
                        type: 'densitymapbox',
                        lat: points.map((p) => p.lat),
                        lon: points.map((p) => p.lng),
                        radius,
                        opacity,
                        colorscale: 'YlOrRd',
                    },
                ], layout, { displaylogo: false, responsive: true });
                return;
            }

            if (mode === 'cluster') {
                const pointPairs = points.map((p) => [p.lat, p.lng]);
                const kSafe = Math.max(2, Math.min(k, pointPairs.length));
                const labels = kmeans2D(pointPairs, kSafe) || new Array(pointPairs.length).fill(0);
                const traces = [];
                for (let i = 0; i < kSafe; i += 1) {
                    const rows = points.filter((_, idx) => labels[idx] === i);
                    traces.push({
                        type: 'scattermapbox',
                        mode: 'markers',
                        name: `社群 ${i + 1}`,
                        lat: rows.map((r) => r.lat),
                        lon: rows.map((r) => r.lng),
                        text: rows.map((r) => `${r.title}<br>${r.province}-${r.city}`),
                        marker: { size: 7, color: stablePalette[i % stablePalette.length] },
                        hoverinfo: 'text',
                    });
                }
                Plotly.react(chartEl, traces, layout, { displaylogo: false, responsive: true });
                return;
            }

            const grouped = new Map();
            points.forEach((p) => {
                if (!grouped.has(p.batch)) grouped.set(p.batch, []);
                grouped.get(p.batch).push(p);
            });

            const traces = Array.from(grouped.entries())
                .sort((a, b) => {
                    const na = batchToNum(a[0]);
                    const nb = batchToNum(b[0]);
                    const va = na > 0 ? na : 999;
                    const vb = nb > 0 ? nb : 999;
                    return va - vb;
                })
                .map(([batch, rows]) => ({
                type: 'scattermapbox',
                mode: 'markers',
                name: batch,
                lat: rows.map((r) => r.lat),
                lon: rows.map((r) => r.lng),
                text: rows.map((r) => `${r.title}<br>${r.province}-${r.city}`),
                hoverinfo: 'text',
                marker: { size: 7, color: getBatchColor(batch) },
            }));

            Plotly.react(chartEl, traces, layout, { displaylogo: false, responsive: true });
        }

        function renderStatsCharts(dataRows) {
            if (typeof Plotly === 'undefined') return;
            if (!dataRows || !dataRows.length) return;

            const aggMap = new Map();
            dataRows.forEach((r) => {
                const key = `${r.Province || ''}||${r.City || ''}`;
                aggMap.set(key, (aggMap.get(key) || 0) + 1);
            });
            const aggRows = Array.from(aggMap.entries()).map(([key, count]) => {
                const [Province, City] = key.split('||');
                return { Province, City, Count: count };
            });

            const provinceCountMap = new Map();
            aggRows.forEach((r) => {
                provinceCountMap.set(r.Province, (provinceCountMap.get(r.Province) || 0) + r.Count);
            });

            const labels = ['全国'];
            const ids = ['root'];
            const parents = [''];
            const values = [dataRows.length];

            Array.from(provinceCountMap.entries()).forEach(([province, count]) => {
                labels.push(simplifyProvinceName(province));
                ids.push(`p:${province}`);
                parents.push('root');
                values.push(count);
            });

            aggRows.forEach((r) => {
                labels.push(simplifyCityName(r.City, r.Province));
                ids.push(`c:${r.Province}:${r.City}`);
                parents.push(`p:${r.Province}`);
                values.push(r.Count);
            });

            const treeData = [{
                type: 'sunburst',
                ids,
                labels,
                parents,
                values,
                branchvalues: 'total',
                textinfo: 'label',
                hovertemplate: '<b>%{label}</b><br>数量：%{value}<extra></extra>',
            }];

            Plotly.react('chart-sunburst', treeData, {
                margin: { t: 20, l: 10, r: 10, b: 20 },
                height: 520,
                font: { size: 13 },
                uniformtext: { mode: 'hide', minsize: 11 },
            }, { displaylogo: false, responsive: true });
            Plotly.react('chart-treemap', [{ ...treeData[0], type: 'treemap' }], {
                margin: { t: 20, l: 10, r: 10, b: 20 },
                height: 520,
                font: { size: 13 },
                uniformtext: { mode: 'hide', minsize: 11 },
            }, { displaylogo: false, responsive: true });

            const topProvinces = [];
            const provinceCounts = new Map();
            dataRows.forEach((r) => {
                const p = r.Province || '-';
                provinceCounts.set(p, (provinceCounts.get(p) || 0) + 1);
            });
            Array.from(provinceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach((x) => topProvinces.push(x[0]));

            const sankeyBatchMap = new Map();
            const sankeyProvinceMap = new Map();
            const linkCountMap = new Map();
            dataRows.forEach((r) => {
                const b = r.Batch_Label || '未知';
                const p = r.Province || '-';
                sankeyBatchMap.set(b, true);
                if (topProvinces.includes(p)) sankeyProvinceMap.set(p, true);
                if (topProvinces.includes(p)) {
                    const key = `${b}__${p}`;
                    linkCountMap.set(key, (linkCountMap.get(key) || 0) + 1);
                }
            });

            const batchNodes = Array.from(sankeyBatchMap.keys()).sort((a, b) => batchToNum(a) - batchToNum(b));
            const provinceNodes = Array.from(sankeyProvinceMap.keys());
            const labelsSankey = [...batchNodes, ...provinceNodes];
            const batchIndex = new Map(batchNodes.map((x, i) => [x, i]));
            const provinceIndex = new Map(provinceNodes.map((x, i) => [x, i + batchNodes.length]));
            // 六批建议配色（宋韵统一）
            const songyunBatchPalette = ['#B23A2B', '#B55D4C', '#C89A4B', '#6C8B7A', '#5A7280', '#7B5B4F'];
            // Sankey 节点较多：在六批基础上做克制扩展（不引入高饱和）
            const sankeyPalette = [...songyunBatchPalette, '#516B78', '#7A8F8A', '#CDBCA3', ...songyunBatchPalette];

            const source = [];
            const target = [];
            const value = [];
            Array.from(linkCountMap.entries()).forEach(([key, count]) => {
                const splitIdx = key.indexOf('__');
                const b = key.slice(0, splitIdx);
                const p = key.slice(splitIdx + 2);
                if (!batchIndex.has(b) || !provinceIndex.has(p)) return;
                source.push(batchIndex.get(b));
                target.push(provinceIndex.get(p));
                value.push(count);
            });

            const linkColor = source.map((s) => {
                const hex = sankeyPalette[s % sankeyPalette.length];
                const r = Number.parseInt(hex.slice(1, 3), 16);
                const g = Number.parseInt(hex.slice(3, 5), 16);
                const b = Number.parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, 0.35)`;
            });

            Plotly.react('chart-parcats', [{
                type: 'sankey',
                arrangement: 'snap',
                node: {
                    pad: 14,
                    thickness: 14,
                    line: { color: '#8C6C4E', width: 1 },
                    label: labelsSankey,
                    color: labelsSankey.map((_, idx) => sankeyPalette[idx % sankeyPalette.length]),
                },
                link: {
                    source,
                    target,
                    value,
                    color: linkColor,
                },
            }], {
                margin: { t: 20, l: 10, r: 10, b: 20 },
                height: 600,
                font: { size: 13 },
            }, { displaylogo: false, responsive: true });

            const batchCounts = new Map();
            dataRows.forEach((r) => {
                const b = r.Batch_Label || '未知';
                batchCounts.set(b, (batchCounts.get(b) || 0) + 1);
            });
            const batchRows = Array.from(batchCounts.entries());
            Plotly.react('chart-batch-bar', [{
                type: 'bar',
                x: batchRows.map((r) => r[0]),
                y: batchRows.map((r) => r[1]),
                text: batchRows.map((r) => r[1]),
                textposition: 'outside',
                marker: {
                    color: batchRows.map((_, idx) => songyunBatchPalette[idx % songyunBatchPalette.length]),
                },
            }], {
                margin: { t: 40, l: 40, r: 10, b: 80 },
                xaxis: { title: '批次' },
                yaxis: { title: '数量' },
                height: 440,
                font: { size: 13 },
            }, { displaylogo: false, responsive: true });

            const top15 = Array.from(provinceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
            const candidateProvinces = top15.map((x) => x[0]);
            const boxRows = dataRows.filter((r) => candidateProvinces.includes(r.Province || '-') && Number.isFinite(Number(r.lat)));
            const topViolinProvinces = candidateProvinces.filter((prov) => boxRows.filter((r) => (r.Province || '-') === prov).length >= 8).slice(0, 12);
            const colorPalette = ['#5A7280', '#6C8B7A', '#7B5B4F', '#C89A4B', '#9E2F25', '#B55D4C', '#516B78', '#7A8F8A', '#CDBCA3'];
            const tracesGeo = topViolinProvinces.map((prov, idx) => {
                const ys = boxRows.filter((r) => (r.Province || '-') === prov).map((r) => Number(r.lat));
                return {
                    type: 'violin',
                    name: prov,
                    y: ys,
                    box: { visible: false },
                    points: false,
                    spanmode: 'soft',
                    bandwidth: 1.4,
                    meanline: { visible: false },
                    scalemode: 'width',
                    width: 0.95,
                    line: { color: colorPalette[idx % colorPalette.length], width: 1.2 },
                    fillcolor: colorPalette[idx % colorPalette.length],
                    opacity: 0.78,
                };
            });
            Plotly.react('chart-violin', tracesGeo, {
                margin: { t: 20, l: 40, r: 10, b: 95 },
                yaxis: { title: '纬度' },
                xaxis: { title: '省份', tickangle: -25 },
                violinmode: 'group',
                height: 470,
                showlegend: false,
                font: { size: 13 },
            }, { displaylogo: false, responsive: true });

            const suffixMap = new Map();
            dataRows.forEach((r) => {
                const title = String(r.Title || r.Village || '');
                const m = title.match(/[\u4e00-\u9fa5](?!.*[\u4e00-\u9fa5])/);
                if (m && m[0]) suffixMap.set(m[0], (suffixMap.get(m[0]) || 0) + 1);
            });
            const suffixRows = Array.from(suffixMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            Plotly.react('chart-suffix-bar', [{
                type: 'bar',
                x: suffixRows.map((r) => r[0]),
                y: suffixRows.map((r) => r[1]),
                text: suffixRows.map((r) => r[1]),
                textposition: 'outside',
                marker: { color: '#B23A2B' },
            }], {
                margin: { t: 20, l: 40, r: 10, b: 65 },
                xaxis: { title: '命名后缀' },
                yaxis: { title: '出现频次' },
                height: 430,
                font: { size: 13 },
            }, { displaylogo: false, responsive: true });

            const centerByBatch = new Map();
            dataRows.forEach((r) => {
                const b = r.Batch_Label || '未知';
                const lat = Number(r.lat);
                const lng = Number(r.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                if (!centerByBatch.has(b)) centerByBatch.set(b, { lat: 0, lng: 0, count: 0, bnum: batchToNum(b) });
                const item = centerByBatch.get(b);
                item.lat += lat;
                item.lng += lng;
                item.count += 1;
            });
            const centerRows = Array.from(centerByBatch.entries())
                .map(([batch, v]) => ({ batch, lat: v.lat / v.count, lng: v.lng / v.count, bnum: v.bnum }))
                .sort((a, b) => a.bnum - b.bnum);
            Plotly.react('chart-center-track', [{
                type: 'scatter',
                x: centerRows.map((r) => r.lng),
                y: centerRows.map((r) => r.lat),
                mode: 'lines+markers+text',
                text: centerRows.map((r) => r.batch),
                textposition: 'top center',
                line: { color: '#B23A2B', width: 3, dash: 'dot' },
                marker: { color: '#516B78', size: 10, symbol: 'star' },
            }], {
                margin: { t: 20, l: 40, r: 20, b: 40 },
                xaxis: { title: '经度' },
                yaxis: { title: '纬度' },
                height: 500,
            }, { displaylogo: false, responsive: true });

            const coords = dataRows
                .map((r) => ({
                    title: r.Title || r.Village || '-',
                    province: r.Province || '-',
                    city: r.City || '-',
                    lat: Number(r.lat),
                    lng: Number(r.lng),
                }))
                .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
                .slice(0, 1200);

            const toRad = (d) => (d * Math.PI) / 180;
            const haversine = (a, b) => {
                const R = 6371;
                const dLat = toRad(b.lat - a.lat);
                const dLng = toRad(b.lng - a.lng);
                const s1 = Math.sin(dLat / 2) ** 2;
                const s2 = Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
                return 2 * R * Math.asin(Math.sqrt(s1 + s2));
            };

            const isoRows = [];
            for (let i = 0; i < coords.length; i += 1) {
                let best = Number.POSITIVE_INFINITY;
                for (let j = 0; j < coords.length; j += 1) {
                    if (i === j) continue;
                    const d = haversine(coords[i], coords[j]);
                    if (d < best) best = d;
                }
                if (Number.isFinite(best)) {
                    isoRows.push({ ...coords[i], isolation: best });
                }
            }
            isoRows.sort((a, b) => b.isolation - a.isolation);
            const topIso = isoRows.slice(0, 10);
            const isoEl = document.getElementById('table-isolation');
            isoEl.innerHTML = `
                <table class="w-full text-sm table-fixed">
                    <thead><tr class="text-left text-gray-500"><th class="py-2">村落</th><th>省份</th><th>城市</th><th class="text-right">最近邻距离</th></tr></thead>
                    <tbody>
                        ${topIso.map((r) => `<tr class="border-t border-gray-200"><td class="py-2 break-words">${escapeHtml(r.title)}</td><td class="break-words">${escapeHtml(r.province)}</td><td class="break-words">${escapeHtml(r.city)}</td><td class="text-right">${r.isolation.toFixed(1)} km</td></tr>`).join('')}
                    </tbody>
                </table>
            `;
        }

        function renderDataTabTable(rows) {
            const panel = document.getElementById('data-tab-table');
            if (!panel) return;
            panel.innerHTML = `
                <div class="text-sm text-gray-500 mb-3">已筛选数据可在下方主表查看（当前 ${rows.length} 条），并支持上方条件联动。</div>
            `;
        }

        async function runFilter() {
            runBtn.disabled = true;
            runBtn.textContent = '筛选中...';

            const selectedProvince = provinceSelect.value;
            const selectedCity = citySelect.value;
            const selectedBatch = batchSelect.value;
            const keyword = keywordInput.value.trim();

            const result = allVillages.filter((v) => {
                if (selectedProvince && v.Province !== selectedProvince) return false;
                if (selectedCity && v.City !== selectedCity) return false;
                if (selectedBatch && (v.Batch_Label || '未知') !== selectedBatch) return false;
                if (keyword) {
                    const name = String(v.Village || v.Title || '');
                    if (!name.includes(keyword)) return false;
                }
                return true;
            });

            filteredVillages = result;
            filteredCoords = allCoords.filter((v) => {
                if (selectedProvince && v.Province !== selectedProvince) return false;
                if (selectedCity && v.City !== selectedCity) return false;
                if (selectedBatch && (v.Batch_Label || '未知') !== selectedBatch) return false;
                return true;
            });

            const isNational = !selectedProvince && !selectedCity;
            const detailLimit = isNational ? 100 : 50;

            tbody.innerHTML = renderVillageRows(result.slice(0, detailLimit));
            dataTableCount.textContent = `结果条数：${result.length}（明细显示前 ${detailLimit} 条）`;

            const tableTitle = document.getElementById('data-detail-title');
            if (tableTitle) {
                tableTitle.textContent = `村落明细（最多 ${detailLimit} 条）`;
            }
            resultText.textContent = `已完成筛选：${selectedProvince || '全国'} / ${selectedCity || '全部城市'} / ${selectedBatch || '全部批次'}${keyword ? ` / 关键词：${keyword}` : ''}`;

            const bars = document.getElementById('batch-dist-bars');
            bars.innerHTML = renderBatchDistribution(result);

            renderRegionTopTable(result, selectedProvince, selectedCity);

            renderMapChart(filteredCoords);
            renderStatsCharts(result);
            renderDataTabTable(result);

            requestAnimationFrame(() => {
                setTimeout(() => {
                    const activeMain = document.querySelector('#data-tab-head [data-tab].is-active')?.getAttribute('data-tab');
                    if (activeMain) resizeVisiblePlotly(`data-tab-${activeMain}`);
                    const activeSub = document.querySelector('#stats-subtab-head [data-subtab].is-active')?.getAttribute('data-subtab');
                    if (activeSub) resizeVisiblePlotly(`stats-subtab-${activeSub}`);
                }, 80);
            });

            setupTableRowInteractions();
            runBtn.disabled = false;
            runBtn.textContent = '执行筛选';
        }

        provinceSelect.addEventListener('change', async () => {
            await refreshCities();
            showNotification('已更新城市列表', 'info', 1200);
        });

        runBtn.addEventListener('click', runFilter);

        document.querySelectorAll('#data-tab-head [data-tab]').forEach((btn) => {
            btn.addEventListener('click', () => setActiveMainTab(btn.getAttribute('data-tab')));
        });

        document.querySelectorAll('#stats-subtab-head [data-subtab]').forEach((btn) => {
            btn.addEventListener('click', () => setActiveSubTab(btn.getAttribute('data-subtab')));
        });

        window.addEventListener('resize', debounce(() => {
            const activeMain = document.querySelector('#data-tab-head [data-tab].is-active')?.getAttribute('data-tab');
            if (activeMain) resizeVisiblePlotly(`data-tab-${activeMain}`);
            const activeSub = document.querySelector('#stats-subtab-head [data-subtab].is-active')?.getAttribute('data-subtab');
            if (activeSub) resizeVisiblePlotly(`stats-subtab-${activeSub}`);
        }, 120));

        function syncRangeProgress(rangeEl) {
            if (!rangeEl) return;
            const min = Number(rangeEl.min || 0);
            const max = Number(rangeEl.max || 100);
            const val = Number(rangeEl.value || 0);
            const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
            rangeEl.style.setProperty('--range-p', `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
        }

        function enforceCatalogRangeSkin(rangeEl) {
            if (!rangeEl) return;
            try {
                const rootStyle = getComputedStyle(document.documentElement);
                const accentRed = rootStyle.getPropertyValue('--accent-red').trim() || '#B23A2B';
                rangeEl.style.webkitAppearance = 'none';
                rangeEl.style.appearance = 'none';
                rangeEl.style.background = 'transparent';
                // 不能写 CSS var 字符串，否则部分浏览器会忽略并回退默认蓝色
                rangeEl.style.accentColor = accentRed;
                rangeEl.style.outline = 'none';
            } catch {
                // ignore
            }
        }

        ['data-map-mode', 'data-map-radius', 'data-map-opacity', 'data-map-k'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'data-map-radius' || id === 'data-map-opacity' || id === 'data-map-k') {
                enforceCatalogRangeSkin(el);
                syncRangeProgress(el);
                el.addEventListener('input', () => {
                    const radius = Number(document.getElementById('data-map-radius')?.value || 15);
                    const opacity = Number(document.getElementById('data-map-opacity')?.value || 70) / 100;
                    const k = Number(document.getElementById('data-map-k')?.value || 6);
                    const labelRadius = document.getElementById('label-map-radius');
                    const labelOpacity = document.getElementById('label-map-opacity');
                    const labelK = document.getElementById('label-map-k');
                    if (labelRadius) labelRadius.textContent = String(radius);
                    if (labelOpacity) labelOpacity.textContent = opacity.toFixed(2);
                    if (labelK) labelK.textContent = String(k);

                    enforceCatalogRangeSkin(document.getElementById('data-map-radius'));
                    enforceCatalogRangeSkin(document.getElementById('data-map-opacity'));
                    enforceCatalogRangeSkin(document.getElementById('data-map-k'));
                    syncRangeProgress(document.getElementById('data-map-radius'));
                    syncRangeProgress(document.getElementById('data-map-opacity'));
                    syncRangeProgress(document.getElementById('data-map-k'));
                });
            }
            el.addEventListener('change', () => renderMapChart(filteredCoords));
        });

        keywordInput.addEventListener('input', debounce(() => {
            runFilter();
        }, 300));

        function exportFilteredData() {
            if (!filteredVillages || !filteredVillages.length) {
                showNotification('当前没有可导出的数据', 'error', 1500);
                return;
            }

            const headers = ['Title', 'Province', 'City', 'County', 'Town', 'Village', 'Batch_Label', 'lat', 'lng'];
            const csvRows = [headers.join(',')];
            filteredVillages.forEach((row) => {
                const vals = headers.map((h) => {
                    const raw = row[h] == null ? '' : String(row[h]);
                    return `"${raw.replace(/"/g, '""')}"`;
                });
                csvRows.push(vals.join(','));
            });

            const csv = '\ufeff' + csvRows.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = '筛选后村落数据.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            showNotification(`已导出 ${filteredVillages.length} 条数据`, 'success', 1600);
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportFilteredData);
        }

        resetBtn.addEventListener('click', async () => {
            provinceSelect.value = '';
            await refreshCities();
            batchSelect.value = '';
            keywordInput.value = '';
            runFilter();
        });

        setActiveMainTab('map');
        setActiveSubTab('hierarchy');
        await refreshCities();
        await runFilter();
    } catch (error) {
        console.error('数据一览加载失败:', error);
        showErrorState(container, '数据模块加载失败');
        pageLoaded.data = false;
    }
}

function renderMiniMap(villages) {
    if (!villages || villages.length === 0) {
        return '<div class="text-gray-500 text-sm">暂无坐标数据</div>';
    }

    const valid = villages.filter((v) => Number.isFinite(Number(v.lng)) && Number.isFinite(Number(v.lat)));
    if (valid.length === 0) {
        return '<div class="text-gray-500 text-sm">暂无有效坐标</div>';
    }

    const lngs = valid.map((v) => Number(v.lng));
    const lats = valid.map((v) => Number(v.lat));
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const width = 760;
    const height = 260;
    const pad = 20;

    const dots = valid.slice(0, 400).map((v) => {
        const x = pad + ((Number(v.lng) - minLng) / Math.max(maxLng - minLng, 0.000001)) * (width - pad * 2);
        const y = height - pad - ((Number(v.lat) - minLat) / Math.max(maxLat - minLat, 0.000001)) * (height - pad * 2);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#5F7F68" fill-opacity="0.72"></circle>`;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-64 rounded-lg catalog-map-frame">
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            ${dots}
        </svg>
        <p class="text-xs text-gray-500 mt-2">经纬度分布示意（非行政底图），用于快速观察该省村落空间离散程度。</p>
    `;
}

async function loadTourPage() {
    const container = document.getElementById('tour-content');
    if (!container) return;

    showLoadingState(container, '正在加载时空导览...');

    try {
        const provinces = await getProvinces();

        container.innerHTML = `
            <section class="max-w-7xl mx-auto px-4 py-10 paper-page-section">
                <header class="text-center mb-10 catalog-page-header">
                    <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-3 catalog-section-title">时空导览</h2>
                    <p class="text-gray-600 max-w-3xl mx-auto">选择任一省份，查看其村落分布、批次结构和实景图片档案。</p>
                </header>

                <div class="paper-panel catalog-panel p-5 mb-8">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-2">省份</label>
                            <select id="tour-province" class="w-full paper-input px-4 py-2"></select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-2">城市（可选）</label>
                            <select id="tour-city" class="w-full paper-input px-4 py-2">
                                <option value="">全部城市</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-2">点位类型</label>
                            <select id="tour-map-mode" class="w-full paper-input px-4 py-2">
                                <option value="city">按城市分组</option>
                                <option value="batch">按批次分组</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button id="tour-load" class="btn btn-primary seal-button w-full">查看该省导览</button>
                        </div>
                        <div class="flex items-end md:col-span-1">
                            <div id="tour-summary" class="text-sm text-gray-500"></div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div class="paper-panel catalog-panel p-5">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">省/市村落点位图</h3>
                        <div id="tour-map-chart" class="h-[420px] catalog-chart-frame"></div>
                    </div>
                    <div class="paper-panel catalog-panel p-5">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">批次分布</h3>
                        <div id="tour-batch-bars"></div>
                    </div>
                </div>

                <div class="paper-panel catalog-panel p-5 mb-8">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">省份影像记忆</h3>
                    <div id="tour-gallery" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                </div>

                <div class="paper-panel catalog-table-panel overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-800">省份村落明细（最多 50 条）</h3>
                        <span id="tour-table-count" class="text-sm text-gray-500"></span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="catalog-table-head border-b border-gray-200">
                                <tr>
                                    <th class="px-4 py-3 text-left">#</th>
                                    <th class="px-4 py-3 text-left">城市</th>
                                    <th class="px-4 py-3 text-left">县区</th>
                                    <th class="px-4 py-3 text-left">村落</th>
                                    <th class="px-4 py-3 text-center">批次</th>
                                </tr>
                            </thead>
                            <tbody id="tour-village-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </section>
        `;

        const provinceSelect = document.getElementById('tour-province');
        const citySelect = document.getElementById('tour-city');
        const mapModeSelect = document.getElementById('tour-map-mode');
        const loadBtn = document.getElementById('tour-load');
        const summary = document.getElementById('tour-summary');
        const mapContainer = document.getElementById('tour-map-chart');
        const barsContainer = document.getElementById('tour-batch-bars');
        const galleryContainer = document.getElementById('tour-gallery');
        const tbody = document.getElementById('tour-village-tbody');
        const countEl = document.getElementById('tour-table-count');

        provinces.forEach((p) => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            provinceSelect.appendChild(option);
        });

        function renderTourMap(rows) {
            if (typeof Plotly === 'undefined') {
                mapContainer.innerHTML = '<div class="text-red-600">Plotly 未加载，无法绘图</div>';
                return;
            }

            const points = rows
                .map((v) => ({
                    lat: Number(v.lat),
                    lng: Number(v.lng),
                    city: v.City || '-',
                    batch: v.Batch_Label || '未知',
                    title: v.Title || v.Village || '未命名村落',
                    county: v.County || '-',
                }))
                .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));

            if (!points.length) {
                mapContainer.innerHTML = '<div class="text-gray-500 text-sm">该条件下无可视化点位</div>';
                return;
            }

            const lats = points.map((p) => p.lat);
            const lngs = points.map((p) => p.lng);
            const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
            const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
            const zoom = estimateZoomBySpan(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));

            const mode = mapModeSelect.value;
            const groupKey = mode === 'city' ? 'city' : 'batch';

            const batchPalette = ['#B23A2B', '#B55D4C', '#C89A4B', '#6C8B7A', '#5A7280', '#7B5B4F'];
            const stablePalette = ['#5A7280', '#6C8B7A', '#7B5B4F', '#C89A4B', '#9E2F25', '#B55D4C', '#516B78', '#7A8F8A', '#CDBCA3'];

            function hashString(str) {
                const s = String(str ?? '');
                let h = 2166136261;
                for (let i = 0; i < s.length; i += 1) {
                    h ^= s.charCodeAt(i);
                    h = Math.imul(h, 16777619);
                }
                return h >>> 0;
            }

            function getBatchColor(label) {
                const n = batchToNum(label);
                if (n > 0) return batchPalette[(n - 1) % batchPalette.length];
                return '#7A8F8A';
            }

            function getStableColor(key) {
                const idx = hashString(key) % stablePalette.length;
                return stablePalette[idx];
            }
            const grouped = new Map();
            points.forEach((p) => {
                const key = p[groupKey];
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(p);
            });

            const traces = Array.from(grouped.entries()).map(([key, list]) => ({
                type: 'scattermapbox',
                mode: 'markers',
                name: key,
                lat: list.map((x) => x.lat),
                lon: list.map((x) => x.lng),
                text: list.map((x) => `${x.title}<br>${x.city}·${x.county}<br>${x.batch}`),
                hoverinfo: 'text',
                marker: { size: 7, color: groupKey === 'batch' ? getBatchColor(key) : getStableColor(key) },
            }));

            Plotly.react(mapContainer, traces, {
                mapbox: getCnMapboxLayout(centerLat, centerLng, zoom),
                height: 400,
                margin: { l: 0, r: 0, t: 0, b: 0 },
                legend: {
                    yanchor: 'top', y: 0.98, xanchor: 'left', x: 0.01,
                    bgcolor: 'rgba(0,0,0,0)',
                },
            }, { displaylogo: false, responsive: true });
        }

        async function refreshTourCities() {
            const province = provinceSelect.value;
            const cities = await getCities(province || null);
            citySelect.innerHTML = '<option value="">全部城市</option>';
            cities.forEach((c) => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                citySelect.appendChild(option);
            });
        }

        async function loadProvinceDetail() {
            const province = provinceSelect.value;
            if (!province) return;
            const city = citySelect.value;

            loadBtn.disabled = true;
            loadBtn.textContent = '加载中...';

            const [villages, gallery] = await Promise.all([
                getVillages({ provinces: [province], limit: 10000 }),
                getProvinceGallery(province, 9),
            ]);

            const filtered = city ? villages.filter((v) => (v.City || '') === city) : villages;

            const limited = filtered.slice(0, 50);
            summary.textContent = `${province}${city ? ` / ${city}` : ''}：${filtered.length} 条村落记录`;
            countEl.textContent = `结果条数：${filtered.length}（显示前 50 条）`;
            tbody.innerHTML = limited
                .map((v, idx) => `
                    <tr class="catalog-table-row${idx % 2 === 0 ? '' : ' is-alt'}">
                        <td class="px-4 py-3 text-gray-500">${idx + 1}</td>
                        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.City || '-')}</td>
                        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.County || '-')}</td>
                        <td class="px-4 py-3 text-gray-800 font-medium">${escapeHtml(v.Village || v.Title || '-')}</td>
                        <td class="px-4 py-3 text-center"><span class="seal-badge inline-block px-2 py-1 rounded-full text-xs font-semibold">${escapeHtml(v.Batch_Label || '未知')}</span></td>
                    </tr>
                `)
                .join('');

            renderTourMap(filtered);
            barsContainer.innerHTML = renderBatchDistribution(filtered);

            if (gallery.length === 0) {
                galleryContainer.innerHTML = '<p class="text-gray-500 text-sm">该省暂无本地图片，请将图片放入 assets/images/provinces/省份名/。</p>';
            } else {
                galleryContainer.innerHTML = gallery
                    .map((img) => `
                        <figure class="catalog-card catalog-figure overflow-hidden">
                            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.caption)}" class="w-full h-44 object-cover" loading="lazy">
                            <figcaption class="px-3 py-2 text-sm text-gray-600">${escapeHtml(img.caption)}</figcaption>
                        </figure>
                    `)
                    .join('');
            }

            setupTableRowInteractions();
            loadBtn.disabled = false;
            loadBtn.textContent = '查看该省导览';
        }

        loadBtn.addEventListener('click', loadProvinceDetail);
        provinceSelect.addEventListener('change', async () => {
            await refreshTourCities();
            loadProvinceDetail();
        });
        citySelect.addEventListener('change', () => loadProvinceDetail());
        mapModeSelect.addEventListener('change', () => loadProvinceDetail());

        if (provinces.length > 0) {
            provinceSelect.value = provinces[0];
            await refreshTourCities();
            await loadProvinceDetail();
        }
    } catch (error) {
        console.error('时空导览加载失败:', error);
        showErrorState(container, '时空导览模块加载失败');
        pageLoaded.tour = false;
    }
}

async function loadMediaPage() {
    const container = document.getElementById('media-content');
    if (!container) return;

    showLoadingState(container, '正在加载内容推荐...');

    try {
        const videos = await getMediaList();

        container.innerHTML = `
            <section class="max-w-7xl mx-auto px-4 py-10 paper-page-section">
                <header class="text-center mb-10 catalog-page-header">
                    <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-3 catalog-section-title">内容推荐</h2>
                    <p class="text-gray-600 max-w-3xl mx-auto">自动读取本地视频与元数据，展示推荐片单、摘要、标签和引用语。</p>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 paper-panel catalog-panel p-5">
                        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold text-gray-800">推荐片单</h3>
                            <select id="media-select" class="w-full sm:w-96 paper-input px-4 py-2"></select>
                        </div>
                        <video id="media-player" class="w-full rounded-lg bg-black" controls preload="metadata"></video>
                    </div>

                    <aside class="paper-panel catalog-panel p-5">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">影片信息</h3>
                        <div id="media-info" class="text-sm text-gray-600 space-y-3"></div>
                    </aside>
                </div>

                <div class="mt-8 paper-panel catalog-panel p-5">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">全部视频列表</h3>
                    <div id="media-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
                </div>
            </section>
        `;

        const select = document.getElementById('media-select');
        const player = document.getElementById('media-player');
        const info = document.getElementById('media-info');
        const cards = document.getElementById('media-cards');

        if (!videos || videos.length === 0) {
            info.innerHTML = '<p class="text-gray-500">未检测到本地视频文件，请将 .mp4 放到 assets/videos 目录。</p>';
            cards.innerHTML = '<p class="text-gray-500 text-sm">暂无视频数据。</p>';
            return;
        }

        videos.forEach((video, idx) => {
            const option = document.createElement('option');
            option.value = String(idx);
            option.textContent = video.title || video.video_file;
            select.appendChild(option);
        });

        function renderVideoInfo(video) {
            const tags = Array.isArray(video.tags) ? video.tags : [];
            info.innerHTML = `
                <div>
                    <div class="text-xs text-gray-500">标题</div>
                    <div class="text-base font-semibold text-gray-800 mt-1">${escapeHtml(video.title || video.video_file)}</div>
                </div>
                <div>
                    <div class="text-xs text-gray-500">简介</div>
                    <p class="mt-1 leading-7">${escapeHtml(video.summary || '暂无简介')}</p>
                </div>
                <div>
                    <div class="text-xs text-gray-500">推荐语</div>
                    <p class="mt-1 italic seal-accent">${escapeHtml(video.quote || '暂无推荐语')}</p>
                </div>
                <div>
                    <div class="text-xs text-gray-500 mb-1">标签</div>
                    <div class="flex flex-wrap gap-2">
                        ${tags.length ? tags.map((t) => `<span class="seal-badge inline-block px-2 py-1 rounded-full text-xs">#${escapeHtml(t)}</span>`).join('') : '<span class="text-gray-400">暂无标签</span>'}
                    </div>
                </div>
            `;
        }

        function getVideoUrl(video) {
            if (video?.video_url) return video.video_url;
            const file = video?.video_file ? String(video.video_file) : '';
            return file ? `/assets/videos/${encodeURIComponent(file)}` : '';
        }

        function describeMediaError(err) {
            const code = err?.code;
            switch (code) {
                case 1:
                    return '视频加载被中止（可能是切换过快）。';
                case 2:
                    return '网络错误：视频文件可能不存在或连接中断。';
                case 3:
                    return '解码失败：可能是视频编码浏览器不支持（建议转 H.264/AAC）。';
                case 4:
                    return '格式不支持：浏览器无法播放该视频文件。';
                default:
                    return '视频加载失败。';
            }
        }

        let switchSeq = 0;
        function switchVideo(index) {
            const video = videos[index];
            if (!video) return;

            const url = getVideoUrl(video);
            if (!url) {
                info.innerHTML = '<p class="text-red-600">视频地址缺失，无法播放。</p>';
                return;
            }

            const seq = ++switchSeq;
            try {
                player.pause();
            } catch {
                // ignore
            }

            // 彻底取消上一段 src 的加载，避免快速切换造成卡顿/残留请求
            try {
                player.removeAttribute('src');
                player.load();
            } catch {
                // ignore
            }

            player.src = url;
            player.load();
            renderVideoInfo(video);

            // 如果切换很频繁，只保留最后一次的状态提示
            info.dataset.mediaSwitchSeq = String(seq);
        }

        function getDefaultVideoIndex() {
            const keywords = ['乌江寨', '贵州乌江寨', '贵州'];
            const haystacks = videos.map((v) => {
                const text = [v.title, v.video_file, v.summary, v.quote].filter(Boolean).join(' ');
                return String(text);
            });

            for (let i = 0; i < keywords.length; i++) {
                const kw = keywords[i];
                const idx = haystacks.findIndex((t) => t.includes(kw));
                if (idx >= 0) return idx;
            }
            return 0;
        }

        player.addEventListener('error', () => {
            const message = describeMediaError(player.error);
            info.innerHTML = `
                <div class="text-red-600 font-semibold">${escapeHtml(message)}</div>
                <div class="text-xs text-gray-500 mt-1">提示：若长时间卡住但不报错，可能是 MP4 未做 faststart（moov 在文件尾），需要重新封装。</div>
            `;
        });

        cards.innerHTML = videos
            .map((video, idx) => `
                <article class="catalog-card p-4 cursor-pointer" data-video-index="${idx}">
                    <h4 class="font-semibold text-gray-800 line-clamp-1">${escapeHtml(video.title || video.video_file)}</h4>
                    <p class="text-sm text-gray-600 mt-2 line-clamp-3">${escapeHtml(video.summary || '暂无简介')}</p>
                    <div class="mt-3 text-xs text-gray-500">点击卡片切换播放</div>
                </article>
            `)
            .join('');

        cards.querySelectorAll('[data-video-index]').forEach((el) => {
            el.addEventListener('click', () => {
                const idx = Number(el.getAttribute('data-video-index'));
                select.value = String(idx);
                switchVideo(idx);
                smoothScrollTo(player, 110);
            });
        });

        select.addEventListener('change', () => {
            switchVideo(Number(select.value));
        });

        const defaultIndex = getDefaultVideoIndex();
        select.value = String(defaultIndex);
        switchVideo(defaultIndex);
    } catch (error) {
        console.error('内容推荐加载失败:', error);
        showErrorState(container, '内容推荐模块加载失败');
        pageLoaded.media = false;
    }
}

let graphScriptPromise = null;

function ensureGraphScriptLoaded() {
    if (graphScriptPromise) return graphScriptPromise;

    graphScriptPromise = new Promise((resolve, reject) => {
        const src = '/static/js/graph.js?v=20260421_03';
        const existing = document.querySelector(`script[data-graph-src="${src}"]`);
        if (existing) return resolve();

        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.setAttribute('data-graph-src', src);
        s.addEventListener('load', () => resolve());
        s.addEventListener('error', () => reject(new Error('graph.js 加载失败')));
        document.head.appendChild(s);
    });

    return graphScriptPromise;
}

function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function onClick(e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('nav a[data-page]');
    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            const page = link.getAttribute('data-page');
            if (!page) return;
            e.preventDefault();
            navigate(page);

            const mobileMenu = document.querySelector('nav .md\\:hidden.border-t');
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }
        });
    });
}

async function initPage() {
    // footer 统计不阻塞页面初始化
    getStatistics()
        .then((stats) => {
            if (!stats) return;
            const footerStats = document.getElementById('footer-stats');
            if (!footerStats) return;
            footerStats.innerHTML = `
                <li>村落总数: ${stats.total}</li>
                <li>省份数: ${stats.provinces}</li>
                <li>城市数: ${stats.cities}</li>
                <li>批次数: ${stats.batches || 6}</li>
            `;
        })
        .catch(() => {
            // ignore
        });

    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.querySelector('nav .md\\:hidden.border-t');
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    setupSmoothScroll();
    setupNavigation();
    setActiveNav(currentPage);

    document.body.setAttribute('data-loaded', 'true');
    initPhase4Enhancements();
}

function debounce(func, delay) {
    let timeoutId = null;
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function throttle(func, limit) {
    let inThrottle = false;
    return function throttled(...args) {
        if (inThrottle) return;
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
            inThrottle = false;
        }, limit);
    };
}

function showLoadingState(container, message = '加载中...') {
    if (!container) return;
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-96 gap-4">
            <div class="loading-spinner"></div>
            <p class="text-gray-600 font-medium">${escapeHtml(message)}</p>
        </div>
    `;
}

function showErrorState(container, error = '加载失败') {
    if (!container) return;
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-96 gap-6">
            <div class="text-6xl">⚠️</div>
            <div class="text-center">
                <p class="text-red-600 font-semibold text-lg mb-2">${escapeHtml(error)}</p>
                <p class="text-gray-500 text-sm">请检查网络连接后重试</p>
            </div>
        </div>
    `;
}

function addLoadingAnimation(element) {
    if (element) element.classList.add('animate-pulse');
}

function removeLoadingAnimation(element) {
    if (element) element.classList.remove('animate-pulse');
}

function manageFocus(container) {
    const focusable = container?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable && focusable.length) {
        focusable[0].focus();
    }
}

function smoothScrollTo(element, offset = 80) {
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
}

function scrollTopWithAnimation() {
    const id = 'scroll-top-fab';
    if (document.getElementById(id)) return;

    const button = document.createElement('button');
    button.id = id;
    button.innerHTML = '↑';
    button.className = 'fixed bottom-8 right-8 w-12 h-12 rounded-full transition opacity-0 pointer-events-none z-50 seal-fab';
    button.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(button);

    window.addEventListener('scroll', throttle(() => {
        if (window.pageYOffset > 450) {
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        } else {
            button.style.opacity = '0';
            button.style.pointerEvents = 'none';
        }
    }, 200));
}

function showNotification(message, type = 'info', duration = 2000) {
    const wrapper = document.createElement('div');
    const kind = type === 'success' ? 'catalog-toast--success' : type === 'error' ? 'catalog-toast--error' : 'catalog-toast--info';
    wrapper.innerHTML = `<div class="fixed top-20 left-1/2 -translate-x-1/2 catalog-toast ${kind} px-4 py-2 rounded-lg z-50">${escapeHtml(message)}</div>`;
    document.body.appendChild(wrapper);
    setTimeout(() => wrapper.remove(), duration);
}

function addPageTransition(element) {
    if (!element) return;
    element.style.animation = 'pageEnter 0.4s ease';
}

function setupTableRowInteractions() {
    document.querySelectorAll('table tbody tr').forEach((row) => {
        if (row.dataset.rowInteractiveBound === '1') return;
        row.dataset.rowInteractiveBound = '1';
        row.addEventListener('click', () => {
            row.style.backgroundColor = 'rgba(192, 57, 43, 0.10)';
            setTimeout(() => {
                row.style.backgroundColor = '';
            }, 220);
        });
    });
}

function setupRegionAnnouncements() {
    const main = document.querySelector('main');
    if (!main) return;
    const live = document.createElement('div');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.className = 'sr-only';
    live.id = 'page-live-status';
    document.body.appendChild(live);
}

function initPhase4Enhancements() {
    scrollTopWithAnimation();
    setupRegionAnnouncements();

    document.querySelectorAll('.page-section').forEach((section) => {
        addPageTransition(section);
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                obs.unobserve(img);
            });
        });

        document.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
    }

    console.log('[Phase 4] 交互增强已初始化');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}
