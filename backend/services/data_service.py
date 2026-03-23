"""
数据处理服务层
负责数据加载、清洗、处理，提供给 API 使用
"""
import pandas as pd
import os
import re
import json
import urllib.request
from typing import Optional, List, Dict, Any

class DataService:
    """数据处理核心服务"""
    
    # 行政区划代码字典
    PROVINCE_ADCODES = {
        '北京市': 110000, '天津市': 120000, '河北省': 130000, '山西省': 140000, '内蒙古自治区': 150000,
        '辽宁省': 210000, '吉林省': 220000, '黑龙江省': 230000,
        '上海市': 310000, '江苏省': 320000, '浙江省': 330000, '安徽省': 340000, '福建省': 350000, '江西省': 360000, '山东省': 370000,
        '河南省': 410000, '湖北省': 420000, '湖南省': 430000, '广东省': 440000, '广西壮族自治区': 450000, '海南省': 460000,
        '重庆市': 500000, '四川省': 510000, '贵州省': 520000, '云南省': 530000, '西藏自治区': 540000,
        '陕西省': 610000, '甘肃省': 620000, '青海省': 630000, '宁夏回族自治区': 640000, '新疆维吾尔自治区': 650000,
        '台湾省': 710000, '香港特别行政区': 810000, '澳门特别行政区': 820000
    }
    
    def __init__(self):
        """初始化数据服务"""
        self.df: Optional[pd.DataFrame] = None
        self.geojson_cache: Dict[str, Any] = {}
    
    def load_all_data(self):
        """加载所有必要的数据"""
        self.df = self._load_dataset()
        return self.df
    
    def _load_dataset(self) -> pd.DataFrame:
        """加载主数据集"""
        possible_paths = [
            os.path.join("assets", "data", "中国传统村落名录(共六批8155个).xls"),
            "中国传统村落名录(共六批8155个).xls",
            "data.xls"
        ]
        
        file_path = None
        for p in possible_paths:
            if os.path.exists(p):
                file_path = p
                break
        
        if not file_path:
            print("⚠️  未找到数据文件")
            return pd.DataFrame()
        
        try:
            if file_path.endswith('.xls'):
                df = pd.read_excel(file_path, engine='xlrd')
            else:
                df = pd.read_excel(file_path, engine='openpyxl')
            
            # 重命名列
            rename_map = {
                'Province': 'Province', 'City': 'City', 'County': 'County',
                'Town': 'Town', 'Village': 'Village', 'Title': 'Title',
                'Batch': 'Batch', 'lng_wgs84': 'lng', 'lat_wgs84': 'lat'
            }
            df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
            
            # 数据清洗
            cols = ['Province', 'City', 'County', 'Town', 'Batch']
            for col in cols:
                if col in df.columns:
                    df[col] = df[col].fillna('').astype(str)
            
            # 处理坐标
            if 'lng' in df.columns and 'lat' in df.columns:
                df['lng'] = pd.to_numeric(df['lng'], errors='coerce')
                df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
                df = df.dropna(subset=['lng', 'lat'])
            
            # 过滤省份
            if 'Province' in df.columns:
                df = df[df['Province'] != '']
            
            # 批次处理
            if 'Batch' in df.columns:
                df['Batch_Num'] = df['Batch'].apply(self._clean_batch_number)
                df['Batch_Label'] = df['Batch_Num'].apply(lambda x: f"第{x}批" if x > 0 else "未知")
            
            print(f"✓ 数据加载成功: {len(df)} 条记录")
            return df
        
        except Exception as e:
            print(f"❌ 数据读取失败: {e}")
            return pd.DataFrame()
    
    @staticmethod
    def _clean_batch_number(val) -> int:
        """清洗批次号"""
        val_str = str(val).strip()
        cn_map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
        
        if val_str in cn_map:
            return cn_map[val_str]
        
        digits = re.findall(r'\d+', val_str)
        if digits:
            return int(digits[0])
        
        for cn_key, num_val in cn_map.items():
            if cn_key in val_str:
                return num_val
        
        return 0
    
    def get_provinces(self) -> List[str]:
        """获取所有省份列表"""
        if self.df is None or self.df.empty:
            return []
        return sorted(self.df['Province'].unique().tolist())
    
    def get_cities(self, province: Optional[str] = None) -> List[str]:
        """获取城市列表"""
        if self.df is None or self.df.empty:
            return []
        
        if province:
            df_filtered = self.df[self.df['Province'] == province]
        else:
            df_filtered = self.df
        
        return sorted(df_filtered['City'].unique().tolist())
    
    def get_batches(self) -> List[str]:
        """获取所有批次"""
        if self.df is None or self.df.empty:
            return []
        
        batch_nums = sorted(self.df['Batch_Num'].unique().tolist())
        return [f"第{b}批" if b > 0 else "未知" for b in batch_nums]
    
    def filter_villages(self, 
                       provinces: Optional[List[str]] = None,
                       cities: Optional[List[str]] = None,
                       batches: Optional[List[str]] = None,
                       limit: int = 1000) -> List[Dict]:
        """筛选村落数据"""
        if self.df is None or self.df.empty:
            return []
        
        df = self.df.copy()
        
        if provinces:
            df = df[df['Province'].isin(provinces)]
        
        if cities:
            df = df[df['City'].isin(cities)]
        
        if batches:
            batch_nums = []
            for b in batches:
                if '第' in b and '批' in b:
                    num_str = b.replace('第', '').replace('批', '')
                    try:
                        batch_nums.append(int(num_str))
                    except:
                        pass
            if batch_nums:
                df = df[df['Batch_Num'].isin(batch_nums)]
        
        df = df.head(limit)
        return df.to_dict('records')
    
    def get_province_geojson(self, province_name: str) -> Optional[Dict]:
        """获取省份的 GeoJSON 数据"""
        if province_name in self.geojson_cache:
            return self.geojson_cache[province_name]
        
        adcode = self.PROVINCE_ADCODES.get(province_name)
        if not adcode:
            return None
        
        url = f"https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json"
        
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode())
            self.geojson_cache[province_name] = data
            return data
        except Exception as e:
            print(f"GeoJSON 获取失败 ({province_name}): {e}")
            return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计数据"""
        if self.df is None or self.df.empty:
            return {"total": 0, "provinces": 0, "batches": 0}
        
        return {
            "total": len(self.df),
            "provinces": self.df['Province'].nunique(),
            "cities": self.df['City'].nunique(),
            "batches": int(self.df['Batch_Num'].max()) if 'Batch_Num' in self.df.columns else 0
        }
