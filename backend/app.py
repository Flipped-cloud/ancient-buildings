"""
FastAPI 后端主应用
负责数据处理、API 路由、数据接口
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.data_service import DataService
from backend.api import villages, policies, data as data_api, media

# ==========================================
# 1. 初始化 FastAPI 应用
# ==========================================
app = FastAPI(
    title="中国传统村落数据洞察系统 API",
    description="提供数据、政策、村落等相关接口",
    version="1.0.0"
)

# ==========================================
# 2. 配置 CORS (允许前端跨域请求)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有，生产环境需要限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 3. 初始化全局数据服务
# ==========================================
data_service = DataService()

@app.on_event("startup")
async def startup_event():
    """应用启动事件：预加载数据"""
    try:
        print("系统启动中，正在加载数据...")
        data_service.load_all_data()
        print("✓ 数据加载完成！")
    except Exception as e:
        print(f"⚠️  数据加载异常: {e}")
        import traceback
        traceback.print_exc()

# ==========================================
# 4. 包含所有 API 路由
# ==========================================
app.include_router(villages.router, prefix="/api/villages", tags=["villages"])
app.include_router(policies.router, prefix="/api/policies", tags=["policies"])
app.include_router(data_api.router, prefix="/api/data", tags=["data"])
app.include_router(media.router, prefix="/api/media", tags=["media"])

# ==========================================
# 5. 基础路由
# ==========================================

@app.get("/api")
async def api_root():
    """API 根路径，返回 API 信息"""
    return {
        "name": "中国传统村落数据洞察系统",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "data_loaded": data_service.df is not None and not data_service.df.empty}

@app.get("/api/config")
async def get_config():
    """获取前端配置（主题颜色、版本等）"""
    return {
        "title": "中国传统村落数据洞察系统",
        "version": "1.0.0",
        "theme": {
            "primary": "#C0392B",      # 中国红
            "secondary": "#2C3E50",    # 靛蓝
            "accent": "#8E44AD",       # 紫气东来
            "background_top": "#F7F5F0",    # 宣纸米色
            "background_bottom": "#F0EBE5",
            "text_main": "#34495E",    # 深灰
            "text_light": "#7F8C8D"    # 浅灰
        }
    }

# ==========================================
# 6. 前端路由
# ==========================================

@app.get("/", response_class=HTMLResponse)
async def serve_frontend_root():
    """提供前端首页"""
    template_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "templates", "base.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "<h1>欢迎使用中国传统村落数据洞察系统</h1><p>前端资源未找到</p>"

# ==========================================
# 7. 静态文件挂载 (前端资源)
# ==========================================
frontend_static = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "static")
if os.path.exists(frontend_static):
    app.mount("/static", StaticFiles(directory=frontend_static), name="static")

assets_static = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
if os.path.exists(assets_static):
    app.mount("/assets", StaticFiles(directory=assets_static), name="assets")

# ==========================================
# 7. 错误处理
# ==========================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "error": exc.detail,
        "status_code": exc.status_code
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
