/**
 * API 调用工具模块
 */

// Use same-origin API base so the app works on any host/port.
const API_BASE = '/api';

// 配置缓存
let configCache = null;

async function fetchJson(url, { timeoutMs = 30000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        let detail = '';
        try {
            detail = await response.text();
        } catch {
            // ignore
        }
        const snippet = detail ? `: ${detail.slice(0, 200)}` : '';
        throw new Error(`HTTP ${response.status} ${response.statusText}${snippet}`);
    }

    return await response.json();
}

/**
 * 获取系统配置
 */
async function getConfig() {
    if (configCache) return configCache;
    
    try {
        configCache = await fetchJson(`${API_BASE}/config`);
        return configCache;
    } catch (error) {
        console.error('配置获取失败:', error);
        return null;
    }
}

/**
 * 获取村落统计信息
 */
async function getStatistics() {
    try {
        return await fetchJson(`${API_BASE}/villages/statistics`);
    } catch (error) {
        console.error('统计信息获取失败:', error);
        return null;
    }
}

/**
 * 获取所有省份
 */
async function getProvinces() {
    try {
        const data = await fetchJson(`${API_BASE}/villages/provinces`);
        return data.provinces || [];
    } catch (error) {
        console.error('省份列表获取失败:', error);
        return [];
    }
}

/**
 * 获取城市列表
 */
async function getCities(province) {
    try {
        const url = province 
            ? `${API_BASE}/villages/cities?province=${encodeURIComponent(province)}`
            : `${API_BASE}/villages/cities`;
        const data = await fetchJson(url);
        return data.cities || [];
    } catch (error) {
        console.error('城市列表获取失败:', error);
        return [];
    }
}

/**
 * 获取政策列表
 */
async function getPolicies() {
    try {
        const data = await fetchJson(`${API_BASE}/policies/list`);
        return data.policies || [];
    } catch (error) {
        console.error('政策列表获取失败:', error);
        return [];
    }
}

/**
 * 获取政策时间轴
 */
async function getPolicyTimeline() {
    try {
        const data = await fetchJson(`${API_BASE}/policies/timeline`);
        return data.timeline || [];
    } catch (error) {
        console.error('政策时间轴获取失败:', error);
        return [];
    }
}

/**
 * 获取村落数据（带筛选）
 */
async function getVillages(filters = {}) {
    try {
        let url = `${API_BASE}/villages/list`;
        const params = new URLSearchParams();
        
        if (filters.provinces && filters.provinces.length > 0) {
            filters.provinces.forEach(p => params.append('provinces', p));
        }
        if (filters.cities && filters.cities.length > 0) {
            filters.cities.forEach(c => params.append('cities', c));
        }
        if (filters.batches && filters.batches.length > 0) {
            filters.batches.forEach(b => params.append('batches', b));
        }
        if (filters.limit) {
            params.append('limit', filters.limit);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const data = await fetchJson(url);
        return data.villages || [];
    } catch (error) {
        console.error('村落数据获取失败:', error);
        return [];
    }
}

/**
 * 获取某省全部村落数据（可选按城市过滤）
 */
async function getProvinceAllVillages(province, city = null) {
    try {
        let url = `${API_BASE}/villages/province-all?province=${encodeURIComponent(province)}`;
        if (city) {
            url += `&city=${encodeURIComponent(city)}`;
        }
        const data = await fetchJson(url);
        return data.villages || [];
    } catch (error) {
        console.error('省份全量村落数据获取失败:', error);
        return [];
    }
}

/**
 * 获取省份分布数据（用于表格）
 */
async function getDistributionByProvince() {
    try {
        return await fetchJson(`${API_BASE}/data/distribution-by-province`);
    } catch (error) {
        console.error('省份分布获取失败:', error);
        return [];
    }
}

/**
 * 获取批次分布数据（用于表格）
 */
async function getDistributionByBatch() {
    try {
        return await fetchJson(`${API_BASE}/data/distribution-by-batch`);
    } catch (error) {
        console.error('批次分布获取失败:', error);
        return [];
    }
}

/**
 * 获取村落坐标数据（用于地图）
 */
async function getCoordinates(filters = {}) {
    try {
        let url = `${API_BASE}/data/coordinates`;
        const params = new URLSearchParams();
        
        if (filters.provinces && filters.provinces.length > 0) {
            filters.provinces.forEach(p => params.append('provinces', p));
        }
        if (filters.limit) {
            params.append('limit', filters.limit);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        return await fetchJson(url);
    } catch (error) {
        console.error('坐标数据获取失败:', error);
        return [];
    }
}

/**
 * 获取数据摘要
 */
async function getDataSummary() {
    try {
        return await fetchJson(`${API_BASE}/data/summary`);
    } catch (error) {
        console.error('数据摘要获取失败:', error);
        return null;
    }
}

/**
 * 获取省份 GeoJSON
 */
async function getProvinceGeoJSON(province) {
    try {
        return await fetchJson(`${API_BASE}/villages/geojson/${encodeURIComponent(province)}`);
    } catch (error) {
        console.error(`GeoJSON 获取失败 (${province}):`, error);
        return null;
    }
}

/**
 * 获取内容推荐视频列表
 */
async function getMediaList() {
    try {
        const data = await fetchJson(`${API_BASE}/media/list`);
        return data.videos || [];
    } catch (error) {
        console.error('媒体列表获取失败:', error);
        return [];
    }
}

/**
 * 获取省份图片库
 */
async function getProvinceGallery(province, limit = 6) {
    try {
        const data = await fetchJson(`${API_BASE}/media/province-gallery/${encodeURIComponent(province)}?limit=${limit}`);
        return data.images || [];
    } catch (error) {
        console.error('省份图片库获取失败:', error);
        return [];
    }
}
