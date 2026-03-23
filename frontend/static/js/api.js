/**
 * API 调用工具模块
 */

const API_BASE = 'http://127.0.0.1:8000/api';

// 配置缓存
let configCache = null;

/**
 * 获取系统配置
 */
async function getConfig() {
    if (configCache) return configCache;
    
    try {
        const response = await fetch('http://127.0.0.1:8000/api/config');
        configCache = await response.json();
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
        const response = await fetch(`${API_BASE}/villages/statistics`);
        return await response.json();
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
        const response = await fetch(`${API_BASE}/villages/provinces`);
        const data = await response.json();
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
        const response = await fetch(url);
        const data = await response.json();
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
        const response = await fetch(`${API_BASE}/policies/list`);
        const data = await response.json();
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
        const response = await fetch(`${API_BASE}/policies/timeline`);
        const data = await response.json();
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
        
        const response = await fetch(url);
        const data = await response.json();
        return data.villages || [];
    } catch (error) {
        console.error('村落数据获取失败:', error);
        return [];
    }
}

/**
 * 获取省份分布数据（用于表格）
 */
async function getDistributionByProvince() {
    try {
        const response = await fetch(`${API_BASE}/data/distribution-by-province`);
        return await response.json();
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
        const response = await fetch(`${API_BASE}/data/distribution-by-batch`);
        return await response.json();
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
        
        const response = await fetch(url);
        return await response.json();
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
        const response = await fetch(`${API_BASE}/data/summary`);
        return await response.json();
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
        const response = await fetch(`${API_BASE}/villages/geojson/${encodeURIComponent(province)}`);
        return await response.json();
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
        const response = await fetch(`${API_BASE}/media/list`);
        const data = await response.json();
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
        const response = await fetch(`${API_BASE}/media/province-gallery/${encodeURIComponent(province)}?limit=${limit}`);
        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('省份图片库获取失败:', error);
        return [];
    }
}
