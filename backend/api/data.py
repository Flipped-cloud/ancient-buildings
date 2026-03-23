"""
数据分析 API 路由
"""
from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from ..services.data_service import DataService

router = APIRouter()

def get_data_service() -> DataService:
    from ..app import data_service
    return data_service

@router.get("/distribution-by-province")
async def distribution_by_province(data_service: DataService = Depends(get_data_service)):
    """按省份统计村落分布"""
    if data_service.df is None or data_service.df.empty:
        return []
    
    dist = data_service.df['Province'].value_counts().to_dict()
    return [{"province": k, "count": v} for k, v in sorted(dist.items(), key=lambda x: x[1], reverse=True)]

@router.get("/distribution-by-batch")
async def distribution_by_batch(data_service: DataService = Depends(get_data_service)):
    """按批次统计村落分布"""
    if data_service.df is None or data_service.df.empty:
        return []
    
    dist = data_service.df['Batch_Label'].value_counts().to_dict()
    return [{"batch": k, "count": v} for k, v in dist.items()]

@router.get("/coordinates")
async def get_coordinates(
    provinces: Optional[List[str]] = Query(None),
    limit: int = Query(5000, le=10000),
    data_service: DataService = Depends(get_data_service)
):
    """获取村落坐标数据（用于地图）"""
    if data_service.df is None or data_service.df.empty:
        return []
    
    df = data_service.df.copy()
    
    if provinces:
        df = df[df['Province'].isin(provinces)]
    
    # 确保有坐标
    if 'lng' in df.columns and 'lat' in df.columns:
        df = df.dropna(subset=['lng', 'lat'])
        df = df.head(limit)
        
        return df[['Province', 'City', 'Village', 'lng', 'lat', 'Batch_Label']].to_dict('records')
    
    return []

@router.get("/summary")
async def get_summary(data_service: DataService = Depends(get_data_service)):
    """获取数据摘要"""
    if data_service.df is None or data_service.df.empty:
        return {
            "total_villages": 0,
            "total_provinces": 0,
            "total_cities": 0,
            "total_batches": 0,
            "year_range": "N/A"
        }
    
    df = data_service.df
    return {
        "total_villages": len(df),
        "total_provinces": df['Province'].nunique(),
        "total_cities": df['City'].nunique(),
        "total_batches": int(df['Batch_Num'].max()) if 'Batch_Num' in df.columns else 0,
        "year_range": "2012-2025"
    }
