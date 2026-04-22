"""知识图谱服务层

从 DataService 的 DataFrame 构建 6 类节点（省/市/县/乡/村/批次）以及固定关系链，
并提供按节点取子节点、搜索、村落详情等能力。

约束：
- 不引入数据库；仅使用内存索引
- 节点类型严格限定为 province/city/county/town/village/batch
- 关系严格限定为 province->city->county->town->village->batch
  若 Town 缺失，则允许 county->village 直连
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .data_service import DataService


def _stable_id(prefix: str, parts: Tuple[str, ...]) -> str:
    raw = prefix + "|" + "|".join(parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"{prefix}:{digest}"


def _norm_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


@dataclass(frozen=True)
class _NodeKey:
    type: str
    parts: Tuple[str, ...]


class GraphService:
    def __init__(self, data_service: DataService):
        self._data_service = data_service
        self._built_signature: Optional[Tuple[int, Tuple[str, ...]]] = None

        self._nodes: Dict[str, Dict[str, Any]] = {}
        self._children: Dict[str, List[str]] = {}
        self._admin_parent: Dict[str, str] = {}

        self._village_details: Dict[str, Dict[str, Any]] = {}
        self._search_index: List[Tuple[str, str, str]] = []  # (node_id, type, haystack)

    def _ensure_built(self) -> None:
        df = self._data_service.df
        if df is None or df.empty:
            self._built_signature = (0, tuple())
            self._nodes = {}
            self._children = {}
            self._admin_parent = {}
            self._village_details = {}
            self._search_index = []
            return

        signature = (len(df), tuple(df.columns))
        if self._built_signature == signature:
            return

        self._build_from_df(df)
        self._built_signature = signature

    def _add_child(self, parent_id: str, child_id: str) -> None:
        self._children.setdefault(parent_id, [])
        if child_id not in self._children[parent_id]:
            self._children[parent_id].append(child_id)

    def _edge(self, source: str, target: str, rel: str) -> Dict[str, Any]:
        edge_id = _stable_id("edge", (source, target, rel))
        return {"data": {"id": edge_id, "source": source, "target": target, "rel": rel}}

    def _node(self, node_id: str) -> Dict[str, Any]:
        return self._nodes[node_id]

    def _set_node(self, node_id: str, *, label: str, type: str, meta: Optional[Dict[str, Any]] = None) -> None:
        data = {"id": node_id, "label": label, "type": type}
        if meta:
            data.update(meta)
        self._nodes[node_id] = {"data": data}

    def _build_from_df(self, df: pd.DataFrame) -> None:
        self._nodes = {}
        self._children = {}
        self._admin_parent = {}
        self._village_details = {}
        self._search_index = []

        self._set_node("root:china", label="中国", type="country")
        self._search_index.append(("root:china", "country", "中国 全国"))

        batch_ids_by_label: Dict[str, str] = {}

        def ensure_region_node(node_type: str, parts: Tuple[str, ...], label: str, meta: Optional[Dict[str, Any]] = None) -> str:
            node_id = _stable_id(node_type, parts)
            if node_id not in self._nodes:
                self._set_node(node_id, label=label, type=node_type, meta=meta)
                haystack = " ".join([label, *parts]).casefold()
                self._search_index.append((node_id, node_type, haystack))
            return node_id

        for row in df.itertuples(index=False):
            province = _norm_text(getattr(row, "Province", ""))
            city = _norm_text(getattr(row, "City", ""))
            county = _norm_text(getattr(row, "County", ""))
            town = _norm_text(getattr(row, "Town", ""))
            village = _norm_text(getattr(row, "Village", ""))
            title = _norm_text(getattr(row, "Title", ""))
            batch_label = _norm_text(getattr(row, "Batch_Label", ""))
            batch_raw = _norm_text(getattr(row, "Batch", ""))

            lng = getattr(row, "lng", None)
            lat = getattr(row, "lat", None)

            if not province:
                continue

            province_id = ensure_region_node("province", (province,), province)
            self._admin_parent[province_id] = "root:china"
            self._add_child("root:china", province_id)

            city_id = ensure_region_node("city", (province, city), city or "(未知市)", meta={"province": province})
            county_id = ensure_region_node(
                "county", (province, city, county), county or "(未知县)", meta={"province": province, "city": city}
            )

            self._admin_parent[city_id] = province_id
            self._admin_parent[county_id] = city_id

            self._add_child(province_id, city_id)
            self._add_child(city_id, county_id)

            town_id: Optional[str] = None
            if town:
                town_id = ensure_region_node(
                    "town", (province, city, county, town), town, meta={"province": province, "city": city, "county": county}
                )
                self._admin_parent[town_id] = county_id
                self._add_child(county_id, town_id)

            village_label = title or village or "(未知村)"
            village_parts = (province, city, county, town, village, title, batch_label, str(lng), str(lat))
            village_id = _stable_id("village", village_parts)

            if village_id not in self._nodes:
                self._set_node(
                    village_id,
                    label=village_label,
                    type="village",
                    meta={
                        "province": province,
                        "city": city,
                        "county": county,
                        "town": town,
                        "village": village,
                        "title": title,
                        "batch": batch_label,
                    },
                )
                haystack = " ".join([province, city, county, town, village, title, batch_label]).casefold()
                self._search_index.append((village_id, "village", haystack))

            if town_id:
                self._admin_parent[village_id] = town_id
                self._add_child(town_id, village_id)
            else:
                self._admin_parent[village_id] = county_id
                self._add_child(county_id, village_id)

            if batch_label:
                batch_id = batch_ids_by_label.get(batch_label)
                if not batch_id:
                    batch_id = ensure_region_node("batch", (batch_label,), batch_label)
                    batch_ids_by_label[batch_label] = batch_id
                self._add_child(village_id, batch_id)

            self._village_details[village_id] = {
                "id": village_id,
                "province": province,
                "city": city,
                "county": county,
                "town": town,
                "village": village,
                "title": title,
                "batch": batch_raw,
                "batch_label": batch_label,
                "lng": float(lng) if lng is not None else None,
                "lat": float(lat) if lat is not None else None,
            }

        for node_id, node in list(self._nodes.items()):
            node_type = node.get("data", {}).get("type")
            if node_type == "province":
                continue

            parent_id = self._admin_parent.get(node_id)
            if not parent_id:
                continue

            # 对于 admin 树（含 village），补齐父->子 children（已在遍历中添加），这里不再重复。

    def get_root(self) -> Dict[str, Any]:
        self._ensure_built()
        china_node = self._nodes.get("root:china")
        if not china_node:
            return {"nodes": [], "edges": []}
            
        provinces = []
        edges = []
        for pid in self._children.get("root:china", []):
            if pid in self._nodes:
                provinces.append(self._nodes[pid])
                edges.append(self._edge("root:china", pid, "country_province"))
        
        nodes = [china_node] + sorted(provinces, key=lambda x: x["data"].get("label", ""))
        return {"nodes": nodes, "edges": edges}

    def get_children(self, node_id: str) -> Dict[str, Any]:
        self._ensure_built()
        if node_id not in self._nodes:
            return {"parent": node_id, "nodes": [], "edges": []}

        child_ids = self._children.get(node_id, [])
        nodes = [self._node(cid) for cid in child_ids if cid in self._nodes]

        parent_type = self._nodes[node_id]["data"].get("type")
        edges: List[Dict[str, Any]] = []
        for cid in child_ids:
            child_type = self._nodes.get(cid, {}).get("data", {}).get("type")
            if parent_type == "village" and child_type == "batch":
                rel = "village_batch"
            elif parent_type == "province" and child_type == "city":
                rel = "province_city"
            elif parent_type == "city" and child_type == "county":
                rel = "city_county"
            elif parent_type == "county" and child_type == "town":
                rel = "county_town"
            elif parent_type == "county" and child_type == "village":
                rel = "county_village"
            elif parent_type == "town" and child_type == "village":
                rel = "town_village"
            else:
                rel = "link"
            edges.append(self._edge(node_id, cid, rel))

        return {"parent": node_id, "nodes": nodes, "edges": edges}

    def get_village_detail(self, village_id: str) -> Optional[Dict[str, Any]]:
        self._ensure_built()
        return self._village_details.get(village_id)

    def _admin_path(self, node_id: str) -> List[str]:
        self._ensure_built()
        if node_id not in self._nodes:
            return []

        node_type = self._nodes[node_id]["data"].get("type")
        if node_type not in {"country", "province", "city", "county", "town", "village"}:
            return []

        path: List[str] = []
        cur = node_id
        while cur:
            path.append(cur)
            parent = self._admin_parent.get(cur)
            if not parent:
                break
            cur = parent

        path.reverse()
        return path

    def search(self, q: str, limit: int = 20) -> Dict[str, Any]:
        self._ensure_built()
        query = (q or "").strip().casefold()
        if not query:
            return {"q": q, "count": 0, "results": []}

        matches: List[Tuple[str, str]] = []  # (node_id, type)
        for node_id, node_type, haystack in self._search_index:
            if query in haystack:
                matches.append((node_id, node_type))
                if len(matches) >= limit:
                    break

        results: List[Dict[str, Any]] = []
        for node_id, node_type in matches:
            node = self._nodes.get(node_id)
            if not node:
                continue

            results.append(
                {
                    "node": node,
                    "path": self._admin_path(node_id),
                    "is_village": node_type == "village",
                }
            )

        return {"q": q, "count": len(results), "results": results}
