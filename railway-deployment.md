# Railway多语言部署指南

## 架构概述

本项目采用微服务架构，包含两个独立的服务：
1. **Node.js主服务** - 提供前端页面、WebSocket实时通信、数据库管理
2. **Python转录服务** - 基于Whisper的AI语音转录功能

## Railway部署方案

### 方案一：单仓库多服务部署（推荐）

```
项目结构:
vibe-meeting/
├── server/                 # Node.js主服务
│   ├── server.js
│   ├── package.json
│   └── railway.toml
├── python-transcription-service/  # Python转录服务
│   ├── app.py
│   ├── requirements.txt
│   └── railway.toml
├── index.html             # 前端页面
├── app.js
├── transcription-client.js
└── railway.toml           # 主配置
```

### 配置文件

#### 1. 主服务配置 (railway.toml)
```toml
[build]
builder = "nixpacks"
buildCommand = "cd server && npm install"

[deploy]
startCommand = "cd server && npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[env]
NODE_ENV = "production"
LOG_LEVEL = "error"
TRANSCRIPTION_SERVICE_URL = "${{RAILWAY_STATIC_URL}}"
PORT = "${{PORT}}"
```

#### 2. Python转录服务配置 (python-transcription-service/railway.toml)
```toml
[build]
builder = "nixpacks"
buildCommand = "pip install -r requirements.txt"
watchPatterns = ["requirements.txt", "app.py", "**/*.py"]

[deploy]
startCommand = "python app.py"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[env]
PORT = "${{PORT}}"
WHISPER_MODEL_SIZE = "base"
MONGODB_URI = "${{MONGODB_URI}}"
REDIS_URL = "${{REDIS_URL}}"
```

## 部署步骤

### 第一步：准备仓库
```bash
# 克隆或准备项目代码
git clone <your-repo-url>
cd vibe-meeting

# 确保所有配置文件都已正确创建
ls railway.toml
ls server/package.json
ls python-transcription-service/requirements.txt
```

### 第二步：创建Railway项目和服务

#### 1. 安装Railway CLI
```bash
npm install -g @railway/cli
railway login
```

#### 2. 创建主项目
```bash
railway init
railway link
```

#### 3. 部署Node.js主服务
```bash
# 设置环境变量
railway variables set NODE_ENV=production
railway variables set LOG_LEVEL=error
railway variables set MONGODB_URI=<your-mongodb-uri>

# 部署主服务
railway up
```

#### 4. 创建Python转录服务
```bash
# 创建新的Railway服务
railway service create
railway service use <transcription-service-name>

# 切换到Python服务目录并部署
cd python-transcription-service
railway up --service <transcription-service-name>

# 设置Python服务环境变量
railway variables set WHISPER_MODEL_SIZE=base
railway variables set MONGODB_URI=<your-mongodb-uri>
railway variables set REDIS_URL=<your-redis-url>
```

#### 5. 配置服务间通信
```bash
# 获取Python服务的URL
railway status --service <transcription-service-name>

# 在主服务中设置转录服务URL
railway service use <main-service-name>
railway variables set TRANSCRIPTION_SERVICE_URL=https://<transcription-service-url>
```

### 第三步：数据库配置

#### MongoDB配置
```bash
# 使用Railway MongoDB插件或外部MongoDB
railway add mongodb

# 或使用外部MongoDB Atlas
railway variables set MONGODB_URI="mongodb+srv://..."
```

#### Redis配置（可选，用于缓存）
```bash
# 使用Railway Redis插件
railway add redis
```

### 第四步：验证部署

#### 1. 检查服务状态
```bash
# 检查主服务
railway status --service <main-service-name>

# 检查转录服务
railway status --service <transcription-service-name>
```

#### 2. 测试API端点
```bash
# 测试主服务健康检查
curl https://<main-service-url>/health

# 测试转录服务健康检查
curl https://<transcription-service-url>/health

# 测试转录服务代理
curl https://<main-service-url>/api/transcription/health
```

## 方案二：分离部署

如果单仓库多服务部署有困难，可以分离为两个独立的Railway项目：

### 主服务项目
```bash
# 只包含Node.js服务的仓库
git subtree push --prefix=server origin main-service

# 部署主服务
railway init --name vibe-meeting-main
railway up
```

### 转录服务项目
```bash
# 只包含Python服务的仓库
git subtree push --prefix=python-transcription-service origin transcription-service

# 部署转录服务
railway init --name vibe-meeting-transcription
railway up
```

## 环境变量配置

### Node.js主服务环境变量
```bash
NODE_ENV=production
LOG_LEVEL=error
PORT=${{PORT}}
MONGODB_URI=${{MONGODB_URI}}
TRANSCRIPTION_SERVICE_URL=https://<transcription-service-url>
ALLOWED_ORIGINS=*
```

### Python转录服务环境变量
```bash
PORT=${{PORT}}
WHISPER_MODEL_SIZE=base
MONGODB_URI=${{MONGODB_URI}}
REDIS_URL=${{REDIS_URL}}
```

## 监控和维护

### 日志监控
```bash
# 查看主服务日志
railway logs --service <main-service-name>

# 查看转录服务日志
railway logs --service <transcription-service-name>
```

### 性能优化
1. **Whisper模型选择**：
   - `tiny`: 最快，准确性较低
   - `base`: 平衡选择（推荐）
   - `small`: 更好准确性
   - `medium/large`: 最高准确性，需要更多资源

2. **资源配置**：
   - 主服务：512MB内存即可
   - 转录服务：建议1GB+内存（根据Whisper模型大小）

### 故障排除

#### 常见问题
1. **转录服务启动失败**：
   ```bash
   # 检查Python依赖
   railway logs --service <transcription-service-name>
   
   # 减小Whisper模型
   railway variables set WHISPER_MODEL_SIZE=tiny
   ```

2. **服务间通信失败**：
   ```bash
   # 检查TRANSCRIPTION_SERVICE_URL配置
   railway variables --service <main-service-name>
   
   # 测试网络连接
   curl https://<transcription-service-url>/health
   ```

3. **内存不足**：
   ```bash
   # 升级Railway计划或优化模型大小
   railway variables set WHISPER_MODEL_SIZE=base
   ```

## 成本优化

1. **使用较小的Whisper模型**：`base`或`small`
2. **合理配置资源限制**
3. **使用Redis缓存减少重复转录**
4. **设置合理的健康检查间隔**

## 安全考虑

1. **环境变量**：确保敏感信息通过环境变量传递
2. **CORS配置**：限制允许的域名
3. **文件上传限制**：限制音频文件大小和格式
4. **速率限制**：防止滥用转录API

---

通过以上配置，您可以在Railway上成功部署包含Node.js和Python的混合语言Vibe Meeting应用，实现完整的AI语音转录功能。