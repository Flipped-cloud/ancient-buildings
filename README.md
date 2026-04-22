# 中国传统村落数据洞察系统

一个基于 FastAPI + 原生前端的中国传统村落数据分析与展示系统。当前运行入口为 backend.app:app，前端由 FastAPI 提供静态资源与 API。

## 项目现状

- 后端框架：FastAPI
- 前端技术：HTML + Tailwind CSS (CDN) + Vanilla JS + Plotly.js (CDN)
- 数据规模：8155 个村落、31 个省份、387 个城市县区、6 个保护批次
- 启动方式：python -m uvicorn backend.app:app --reload --port 8000

## 快速启动

### 1) 环境准备

<<<<<<< HEAD
- Python 3.9
=======
- Python 3.12+
>>>>>>> 0a1dd199abff79c661e04099b746b446edd00c1f
- pip

### 2) 安装依赖

```powershell
<<<<<<< HEAD
cd /d e:/jisuanjisheji/ancient-buildings
=======
cd d:/Python-Program/ancient-buildings
>>>>>>> 0a1dd199abff79c661e04099b746b446edd00c1f
pip install -r requirements.txt
```

### 3) 启动服务

```powershell
<<<<<<< HEAD
# 方式 A（推荐）：先进入项目根目录再启动
cd /d e:/jisuanjisheji/ancient-buildings
conda activate ancient_buildings
python -m uvicorn backend.app:app --reload --port 8000

# 方式 B：不切目录也能启动（用 --app-dir 指定项目根目录）
# python -m uvicorn --app-dir e:/jisuanjisheji/ancient-buildings backend.app:app --reload --port 8000 --reload-dir e:/jisuanjisheji/ancient-buildings
=======
python -m uvicorn backend.app:app --reload --port 8000
>>>>>>> 0a1dd199abff79c661e04099b746b446edd00c1f
```

成功日志示例：

```text
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 4) 访问地址

- 主页：[http://127.0.0.1:8000](http://127.0.0.1:8000)
- API 文档：[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- 健康检查：[http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## 功能概览

- 首页：统计概览、功能入口
- 相关政策：政策时间线、分年检索
- 数据一览：筛选、空间分布、多维统计、明细导出
- 时空导览：省市联动、地图分组、图片画廊
- 内容推荐：视频清单与元数据展示

## API 概览

### 村落接口

- GET /api/villages/list
- GET /api/villages/provinces
- GET /api/villages/cities
- GET /api/villages/batches
- GET /api/villages/statistics
- GET /api/villages/geojson/{province}

### 数据分析接口

- GET /api/data/distribution-by-province
- GET /api/data/distribution-by-batch
- GET /api/data/coordinates
- GET /api/data/summary

### 政策与媒体接口

- GET /api/policies/list
- GET /api/policies/timeline
- GET /api/policies/by-year/{year}
- GET /api/media/list
- GET /api/media/province-gallery/{province}

### 系统接口

- GET /api
- GET /api/config
- GET /health

## 项目结构

```text
ancient-buildings/
├─ backend/
│  ├─ app.py
│  ├─ api/
│  └─ services/
├─ frontend/
│  ├─ templates/
│  └─ static/
├─ assets/
├─ requirements.txt
└─ README.md
```

## 常见问题与排查

<<<<<<< HEAD
### 0) 启动时报 `ModuleNotFoundError: No module named 'backend'`

这是因为你在“非项目根目录”运行了 uvicorn（例如在 `C:\Users\<你>` 下面启动），Python 找不到同级的 `backend/` 包。

- 解决办法：先 `cd` 到本项目根目录再启动（见上面的“方式 A”）
- 或者：用 `--app-dir` 显式指定项目根目录（见上面的“方式 B”）

另外，`--reload` 模式下建议加上 `--reload-dir <项目根目录>`，避免 reloader 去监听用户目录导致“日志看起来像在看 C 盘”。

=======
>>>>>>> 0a1dd199abff79c661e04099b746b446edd00c1f
### 1) 端口 8000 被占用

```powershell
netstat -ano | findstr 8000
taskkill /PID <PID> /F
```

或改端口：

```powershell
python -m uvicorn backend.app:app --reload --port 8001
```

### 2) 依赖缺失

```powershell
pip install -r requirements.txt --upgrade
```

### 3) 数据未加载

```powershell
Test-Path "assets/data/中国传统村落名录(共六批8155个).xls"
```

并检查启动日志是否出现数据加载异常。

### 4) 页面空白或接口 404

1. 确认服务在运行
2. 打开 /docs 检查路由
3. 打开浏览器控制台查看报错

## 测试建议

- 打开 /health 检查健康状态
- 打开 /docs 验证 API 是否齐全
- 在数据一览页面执行筛选和导出进行冒烟验证

## 部署提示

可部署到任何支持 Python 的环境（如 Azure App Service）。

核心命令：

```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```
<<<<<<< HEAD
=======

## 文档合并说明

本 README 已合并原 QUICKSTART、TROUBLESHOOTING、DOCUMENTATION_INDEX 的核心内容，项目改为单一文档入口，降低后续维护成本。
>>>>>>> 0a1dd199abff79c661e04099b746b446edd00c1f
