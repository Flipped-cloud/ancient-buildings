"""
媒体与内容推荐 API 路由
"""
from fastapi import APIRouter, Query
from typing import Dict, List
import json
import os
from urllib.parse import quote

router = APIRouter()


def _safe_join(base_dir: str, *parts: str) -> str:
    """安全拼接路径，避免路径穿越。"""
    joined = os.path.normpath(os.path.join(base_dir, *parts))
    base_norm = os.path.normpath(base_dir)
    if not joined.startswith(base_norm):
        raise ValueError("非法路径")
    return joined


def _load_media_meta() -> Dict[str, Dict]:
    meta_path = os.path.join("assets", "texts", "内容推荐.json")
    if not os.path.isfile(meta_path):
        return {}

    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            items = json.load(f)
        result = {}
        for item in items:
            video_file = item.get("video_file")
            if video_file:
                result[video_file] = item
        return result
    except Exception:
        return {}


@router.get("/list")
async def media_list():
    """返回本地视频列表及元信息。"""
    video_dir = os.path.join("assets", "videos")
    meta_map = _load_media_meta()

    videos: List[Dict] = []
    if os.path.isdir(video_dir):
        for filename in sorted(os.listdir(video_dir)):
            if not filename.lower().endswith(".mp4"):
                continue
            info = meta_map.get(filename, {})
            videos.append(
                {
                    "video_file": filename,
                    "video_url": f"/assets/videos/{quote(filename)}",
                    "title": info.get("title") or os.path.splitext(filename)[0],
                    "summary": info.get("summary", ""),
                    "quote": info.get("quote", ""),
                    "tags": info.get("tags", []),
                }
            )

    return {"count": len(videos), "videos": videos}


@router.get("/province-gallery/{province}")
async def province_gallery(province: str, limit: int = Query(6, ge=1, le=30)):
    """返回省份图片库列表。"""
    base_dir = os.path.join("assets", "images", "provinces")
    try:
        province_dir = _safe_join(base_dir, province)
    except ValueError:
        return {"province": province, "count": 0, "images": []}

    if not os.path.isdir(province_dir):
        return {"province": province, "count": 0, "images": []}

    images: List[Dict] = []
    for filename in sorted(os.listdir(province_dir)):
        lower = filename.lower()
        if not lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        caption = os.path.splitext(filename)[0]
        images.append(
            {
                "name": filename,
                "caption": caption,
                "url": f"/assets/images/provinces/{quote(province)}/{quote(filename)}",
            }
        )

    return {"province": province, "count": len(images), "images": images[:limit]}
