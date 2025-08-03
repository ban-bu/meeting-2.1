# Railway本地Whisper模型部署指南

## 概述

该方案在Railway服务器上直接部署Whisper语音转录模型，无需依赖第三方API，实现完全自主的语音转录服务。

## 架构设计

### 双服务架构
```
Railway部署:
├── Node.js主服务 (端口3001)
│   ├── Web应用和Socket.IO
│   ├── 转录请求代理
│   └── MongoDB数据存储
└── Python转录服务 (端口8000)
    ├── 优化的Whisper模型
    ├── FastAPI接口
    └── 音频处理和转录
```

### 服务间通信
- Node.js → Python: HTTP代理转发
- 内部URL: `http://python-service:8000`
- 外部访问: `https://your-app.railway.app/api/transcription/*`

## Railway部署配置

### 1. 主服务配置 (Node.js)

**文件**: `railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "cd server && npm install"

[deploy]
startCommand = "node server/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
LOG_LEVEL = "error"
PORT = "${{PORT}}"
TRANSCRIPTION_SERVICE_URL = "${{TRANSCRIPTION_SERVICE_URL}}"
```

### 2. Python转录服务配置

**文件**: `python-transcription-service/railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "pip install -r optimized_requirements.txt"
watchPatterns = ["optimized_requirements.txt", "optimized_app.py", "**/*.py"]

[deploy]
startCommand = "python optimized_app.py"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[env]
PORT = "${{PORT}}"
WHISPER_MODEL_SIZE = "tiny"
MONGODB_URI = "${{MONGODB_URI}}"
PYTHONUNBUFFERED = "1"
TORCH_HOME = "/tmp"
HF_HOME = "/tmp"
```

## 优化特性

### 1. 内存优化
- **模型选择**: 默认使用`tiny`模型（约1GB内存）
- **线程限制**: `torch.set_num_threads(2)`
- **缓存清理**: 自动垃圾回收和GPU缓存清理
- **临时存储**: 模型缓存到`/tmp`目录

### 2. 模型配置选项
```python
model_config = {
    'tiny': {'memory': '~1GB', 'speed': 'fastest', 'accuracy': 'good'},
    'base': {'memory': '~1.5GB', 'speed': 'fast', 'accuracy': 'better'},
    'small': {'memory': '~2GB', 'speed': 'medium', 'accuracy': 'very good'},
    'medium': {'memory': '~5GB', 'speed': 'slow', 'accuracy': 'excellent'}
}
```

### 3. 性能优化
- **异步处理**: 使用线程池避免阻塞
- **音频预处理**: 自动转换为16kHz单声道
- **文件大小限制**: 最大50MB音频文件
- **降级机制**: 模型加载失败时自动降级到更小模型

## 部署步骤

### 方法1: Railway CLI部署（推荐）

1. **安装Railway CLI**
```bash
npm install -g @railway/cli
railway login
```

2. **部署Node.js主服务**
```bash
# 在项目根目录
railway init
railway up
```

3. **部署Python转录服务**
```bash
cd python-transcription-service
railway init --name transcription-service
railway up
```

4. **配置环境变量**
```bash
# 主服务
railway variables set TRANSCRIPTION_SERVICE_URL=https://transcription-service-production.up.railway.app

# Python服务
railway variables set WHISPER_MODEL_SIZE=tiny
railway variables set MONGODB_URI=your-mongodb-uri
```

### 方法2: GitHub集成部署

1. **推送代码到GitHub**
```bash
git add .
git commit -m "添加本地Whisper转录服务"
git push
```

2. **在Railway控制台**
- 创建新项目，连接GitHub仓库
- 为根目录和`python-transcription-service`分别创建服务
- 配置环境变量

## 环境变量配置

### Node.js服务环境变量
```env
NODE_ENV=production
LOG_LEVEL=error
PORT=3001
TRANSCRIPTION_SERVICE_URL=https://your-transcription-service.railway.app
MONGODB_URI=mongodb+srv://...
DEEPBRICKS_API_KEY=your-ai-api-key
```

### Python服务环境变量
```env
PORT=8000
WHISPER_MODEL_SIZE=tiny
MONGODB_URI=mongodb+srv://...
PYTHONUNBUFFERED=1
TORCH_HOME=/tmp
HF_HOME=/tmp
```

## 资源需求与限制

### Railway免费额度
- **内存**: 8GB (足够运行tiny/base模型)
- **CPU**: 8核 (转录性能良好)
- **存储**: 临时存储用于模型缓存
- **网络**: 无限制流量

### 性能预期
| 模型 | 内存使用 | 转录速度 | 准确率 | 推荐场景 |
|------|----------|----------|--------|----------|
| tiny | ~1GB | 最快 | 良好 | 实时对话 |
| base | ~1.5GB | 快 | 较好 | 一般会议 |
| small | ~2GB | 中等 | 很好 | 重要会议 |
| medium | ~5GB | 慢 | 优秀 | 高质量需求 |

## 测试验证

### 1. 健康检查
```bash
# 主服务
curl https://your-app.railway.app/health

# 转录服务
curl https://your-app.railway.app/api/transcription/health
```

### 2. 转录测试
```javascript
// 浏览器控制台
const testAudio = async () => {
    const response = await fetch('/api/transcription/health');
    const data = await response.json();
    console.log('转录服务状态:', data);
};
testAudio();
```

### 3. 功能测试
1. 打开会议应用
2. 点击"实时转录"图标
3. 测试麦克风权限
4. 开始录音并验证转录结果

## 故障排除

### 常见问题

#### 1. 模型加载失败
**错误**: `Whisper模型加载失败`
**解决**:
- 检查内存使用情况
- 尝试更小的模型 (`tiny`)
- 查看Railway部署日志

#### 2. 服务连接失败
**错误**: `转录服务健康检查失败`
**解决**:
- 验证`TRANSCRIPTION_SERVICE_URL`配置
- 检查Python服务是否正常运行
- 确认Railway内部网络连接

#### 3. 音频处理错误
**错误**: `音频预处理失败`
**解决**:
- 检查音频文件格式
- 确认文件大小 < 50MB
- 验证ffmpeg安装

#### 4. 内存不足
**错误**: `Container停止运行`
**解决**:
- 降级到更小模型
- 优化并发处理数量
- 增加内存清理频率

### 监控指标
```python
# Python服务监控
@app.get("/metrics")
async def get_metrics():
    return {
        "model_loaded": bool(transcription_service.model),
        "model_size": transcription_service.model_size,
        "memory_usage": "...",
        "active_requests": "...",
        "total_transcriptions": "..."
    }
```

## 成本分析

### Railway部署成本
- **开发阶段**: 免费 (足够测试和开发)
- **生产环境**: 按实际资源使用计费
- **优势**: 无第三方API费用

### 与OpenAI API对比
| 项目 | 本地Whisper | OpenAI API |
|------|-------------|------------|
| 初始成本 | Railway服务费 | 无 |
| 使用成本 | 固定月费 | $0.006/分钟 |
| 数据隐私 | 完全私有 | 发送到OpenAI |
| 定制能力 | 高 | 低 |
| 可用性 | 依赖部署 | 99.9%+ |

### 经济临界点
- **低使用量** (< 1000分钟/月): OpenAI API更便宜
- **中等使用量** (1000-5000分钟/月): 成本相近
- **高使用量** (> 5000分钟/月): 本地部署更便宜

## 扩展优化

### 1. 性能优化
- 实现音频流式处理
- 添加模型预热机制
- 优化队列处理系统

### 2. 功能增强
- 支持多语言识别
- 添加说话人分离
- 实现实时流式转录

### 3. 运维优化
- 添加监控和告警
- 实现自动伸缩
- 增加日志分析

这个本地Whisper部署方案为你提供了完全自主的语音转录能力，避免了对第三方API的依赖，同时在Railway的8GB内存限制下实现了优化的性能表现。