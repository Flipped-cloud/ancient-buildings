"""知识图谱 API 路由

独立于现有数据/村落/政策 API，提供图谱所需的最小接口：
- /root: 返回省份根节点
- /children: 返回某节点的直接子节点与连线
- /search: 关键词搜索，返回命中节点与其可展开路径
- /village/{id}: 村落详情（用于详情抽屉）
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional

from ..services.data_service import DataService
from ..services.graph_service import GraphService

router = APIRouter()

_graph_service: Optional[GraphService] = None


def get_data_service() -> DataService:
    from ..app import data_service
    return data_service


def get_graph_service(data_service: DataService = Depends(get_data_service)) -> GraphService:
    global _graph_service
    if _graph_service is None:
        _graph_service = GraphService(data_service)
    return _graph_service


@router.get("/root")
async def graph_root(graph_service: GraphService = Depends(get_graph_service)):
    return graph_service.get_root()


@router.get("/children")
async def graph_children(
    node_id: str = Query(..., description="父节点 id"),
    graph_service: GraphService = Depends(get_graph_service),
):
    return graph_service.get_children(node_id)


@router.get("/search")
async def graph_search(
    q: str = Query("", min_length=0, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=50),
    graph_service: GraphService = Depends(get_graph_service),
):
    return graph_service.search(q=q, limit=limit)


@router.get("/village/{village_id}")
async def graph_village_detail(
    village_id: str,
    graph_service: GraphService = Depends(get_graph_service),
):
    detail = graph_service.get_village_detail(village_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="village not found")
    return {"village": detail}
