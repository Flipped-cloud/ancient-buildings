"""
村落数据 API 路由
"""
from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from ..services.data_service import DataService

router = APIRouter()

def get_data_service() -> DataService:
    # 这会由 FastAPI 依赖注入来处理
    from ..app import data_service
    return data_service

@router.get("/list")
async def list_villages(
    provinces: Optional[List[str]] = Query(None),
    cities: Optional[List[str]] = Query(None),
    batches: Optional[List[str]] = Query(None),
    limit: Optional[int] = Query(None, ge=1),
    data_service: DataService = Depends(get_data_service)
):
    """
    获取筛选后的村落列表
    - provinces: 省份列表
    - cities: 城市列表
    - batches: 批次列表 (如 "第1批")
    - limit: 返回数量限制（不传时返回全部筛选结果）
    """
    villages = data_service.filter_villages(
        provinces=provinces,
        cities=cities,
        batches=batches,
        limit=limit
    )
    return {
        "count": len(villages),
        "villages": villages
    }

@router.get("/province-all")
async def get_province_all_villages(
    province: str = Query(...),
    city: Optional[str] = Query(None),
    data_service: DataService = Depends(get_data_service)
):
    """获取某省全部村落数据（可选按城市过滤，不做数量截断）"""
    cities = [city] if city else None
    villages = data_service.filter_villages(
        provinces=[province],
        cities=cities,
        batches=None,
        limit=None
    )
    return {
        "count": len(villages),
        "villages": villages
    }

@router.get("/provinces")
async def get_provinces(data_service: DataService = Depends(get_data_service)):
    """获取所有省份列表"""
    provinces = data_service.get_provinces()
    return {
        "count": len(provinces),
        "provinces": provinces
    }

@router.get("/cities")
async def get_cities(
    province: Optional[str] = Query(None),
    data_service: DataService = Depends(get_data_service)
):
    """获取城市列表（可按省份筛选）"""
    cities = data_service.get_cities(province)
    return {
        "count": len(cities),
        "cities": cities
    }

@router.get("/batches")
async def get_batches(data_service: DataService = Depends(get_data_service)):
    """获取所有批次"""
    batches = data_service.get_batches()
    return {
        "count": len(batches),
        "batches": batches
    }

@router.get("/statistics")
async def get_statistics(data_service: DataService = Depends(get_data_service)):
    """获取统计信息"""
    stats = data_service.get_statistics()
    return stats

@router.get("/geojson/{province}")
async def get_province_geojson(
    province: str,
    data_service: DataService = Depends(get_data_service)
):
    """获取省份的 GeoJSON 数据"""
    geojson = data_service.get_province_geojson(province)
    if geojson is None:
        return {"error": f"无法获取 {province} 的 GeoJSON 数据"}
    return geojson
