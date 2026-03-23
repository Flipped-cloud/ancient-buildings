"""
政策数据 API 路由
"""
from fastapi import APIRouter
import os
import json
from urllib.parse import quote

router = APIRouter()


def _find_policy_image_url(year: str):
    """根据年份匹配政策配图，返回可访问的静态URL。"""
    base_dir = os.path.join("assets", "images", "policies")
    if not os.path.isdir(base_dir):
        return None

    extensions = [".jpg", ".jpeg", ".png", ".webp"]
    # 先精确匹配年份文件，如 2012.png
    for ext in extensions:
        filename = f"{year}{ext}"
        full_path = os.path.join(base_dir, filename)
        if os.path.isfile(full_path):
            return f"/assets/images/policies/{quote(filename)}"

    # 再尝试前缀匹配，兼容 2023-2025.png 这类命名
    try:
        candidates = sorted(os.listdir(base_dir))
    except OSError:
        return None

    for item in candidates:
        lower_item = item.lower()
        if not any(lower_item.endswith(ext) for ext in extensions):
            continue
        if item.startswith(str(year)):
            return f"/assets/images/policies/{quote(item)}"

    return None

def load_policies() -> list:
    """加载政策数据"""
    file_path = os.path.join("assets", "texts", "policies.json")
    
    default_policies = [
        {
            "year": "2012",
            "title": "启动中国传统村落调查",
            "content": "住房城乡建设部、文化部、财政部联合印发通知，启动全国传统村落调查。这是中国首次在国家层面开展的针对传统村落的摸底工作，标志着传统村落保护工作正式进入国家战略视野。"
        },
        {
            "year": "2013",
            "title": "认定第一批中国传统村落",
            "content": "公布第一批中国传统村落名录，共2555个村落入选。这一举措使更多具有重要历史文化价值的传统村落得到官方认可和保护。"
        },
        {
            "year": "2014",
            "title": "加强传统村落保护指导意见",
            "content": "三部门联合印发《关于切实加强中国传统村落保护的指导意见》，明确了保护的总体目标、基本原则和主要任务。提出建立传统村落名录，通过中央财政支持，重点改善村落基础设施和公共环境。"
        },
        {
            "year": "2025",
            "title": "传统村落保护最新进展",
            "content": "继续推进传统村落的数字化保护和传承工作，加强文化遗产的数字化记录和展示，推动数字人文在传统村落保护中的应用。"
        }
    ]
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                policies = json.load(f)
            for item in policies:
                year = str(item.get("year", "")).strip()
                item["image_url"] = _find_policy_image_url(year)
            return policies
        except:
            pass
    
    for item in default_policies:
        year = str(item.get("year", "")).strip()
        item["image_url"] = _find_policy_image_url(year)
    return default_policies

@router.get("/list")
async def list_policies():
    """获取所有政策"""
    policies = load_policies()
    return {
        "count": len(policies),
        "policies": sorted(policies, key=lambda x: x.get("year", "0"), reverse=True)
    }

@router.get("/by-year/{year}")
async def get_policy_by_year(year: str):
    """按年份获取政策"""
    policies = load_policies()
    policy = next((p for p in policies if p.get("year") == year), None)
    
    if not policy:
        return {"error": f"未找到 {year} 年的政策信息"}
    
    return policy

@router.get("/timeline")
async def get_timeline():
    """获取政策时间轴"""
    policies = load_policies()
    timeline = sorted(policies, key=lambda x: x.get("year", "0"))
    return {
        "count": len(timeline),
        "timeline": timeline
    }
