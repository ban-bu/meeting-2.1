# 🎙️ Vibe Meeting AI语音转录功能完整指南

## 📋 功能概述

本项目成功集成了基于OpenAI Whisper的AI语音转录功能，支持实时语音转录和会议记录。该功能采用微服务架构，将Python AI服务与现有Node.js应用完美融合。

### 🌟 核心特性

- **实时语音转录**：支持实时录音并转录为文字
- **多语言支持**：支持中文、英文等多种语言识别
- **AI处理**：基于OpenAI Whisper高精度语音识别
- **会议集成**：转录结果自动集成到会议聊天流
- **离线降级**：网络不佳时自动降级到本地转录
- **权限管理**：智能麦克风权限检测和提示

## 🏗️ 技术架构

### 整体架构
```
Frontend (HTML/JS) ↔ Node.js Server (Express/Socket.IO) ↔ Python服务 (FastAPI/Whisper)
                                    ↓
                                MongoDB (共享数据库)
```

### 组件说明
1. **前端转录客户端** (`transcription-client.js`) - 处理录音和UI交互
2. **Node.js代理层** (`server/server.js`) - 转发请求和数据持久化
3. **Python转录服务** (`python-transcription-service/`) - AI语音识别核心

## 🚀 快速开始

### 本地开发环境

#### 1. 启动Node.js主服务
```bash
cd server
npm install
npm run dev
```

#### 2. 启动Python转录服务
```bash
cd python-transcription-service
pip install -r requirements.txt
python app.py
```

#### 3. 访问应用
```bash
# 打开浏览器访问
http://localhost:3001
```

### Railway生产部署

#### 方法一：单仓库部署（推荐）
```bash
# 1. 安装Railway CLI
npm install -g @railway/cli
railway login

# 2. 创建项目
railway init
railway link

# 3. 部署主服务
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=<your-mongodb-uri>
railway up

# 4. 创建Python服务
railway service create transcription-service
cd python-transcription-service
railway up --service transcription-service

# 5. 配置服务间通信
railway variables set TRANSCRIPTION_SERVICE_URL=https://<transcription-service-url>
```

#### 方法二：分离部署
详见 [Railway部署指南](railway-deployment.md)

## 💻 使用指南

### 基本操作

#### 1. 打开转录面板
- 点击聊天输入框下方的 **🔤 转录** 按钮
- 转录面板将在右侧弹出

#### 2. 测试麦克风
- 在转录面板中点击 **🎤** 测试按钮
- 系统会检测麦克风权限和设备状态
- 绿色✅表示正常，红色❌表示需要处理

#### 3. 开始转录
- 点击 **开始转录** 按钮
- 浏览器会请求麦克风权限（首次使用）
- 录音指示灯变红表示正在录音
- 说话内容会实时转录并显示

#### 4. 结束转录
- 点击 **停止录音** 按钮
- 或关闭转录面板自动停止

### 高级功能

#### 实时同步
- 转录结果会自动同步到所有房间参与者
- 转录消息标注为 `🎙️ [语音转录]`
- 支持多人同时转录（不冲突）

#### 权限处理
如果麦克风权限被拒绝：
1. 点击浏览器地址栏的🎤图标
2. 选择"允许"麦克风访问
3. 刷新页面重试

#### 网络降级
- 优先使用云端Whisper模型（高精度）
- 网络不佳时自动降级到浏览器Web Speech API
- 完全离线时显示相应提示

## 🔧 配置说明

### 环境变量

#### Node.js服务环境变量
```bash
NODE_ENV=production
LOG_LEVEL=error
MONGODB_URI=mongodb://...
TRANSCRIPTION_SERVICE_URL=http://localhost:8000
PORT=3001
```

#### Python服务环境变量
```bash
PORT=8000
WHISPER_MODEL_SIZE=base    # tiny/base/small/medium/large
MONGODB_URI=mongodb://...
REDIS_URL=redis://...      # 可选缓存
```

### Whisper模型选择

| 模型 | 大小 | 速度 | 准确性 | 推荐场景 |
|------|------|------|--------|----------|
| tiny | ~39MB | 最快 | 较低 | 快速测试 |
| base | ~74MB | 快 | 良好 | **生产推荐** |
| small | ~244MB | 中等 | 很好 | 高质量要求 |
| medium | ~769MB | 慢 | 极好 | 专业场景 |
| large | ~1550MB | 最慢 | 最好 | 最高精度 |

## 🐛 故障排除

### 常见问题

#### 1. 麦克风权限问题
**现象**：点击录音无反应或提示权限被拒绝
**解决**：
- Chrome：点击地址栏🎤→允许
- Firefox：点击地址栏🎤→允许
- Safari：系统偏好设置→安全性与隐私→麦克风

#### 2. 转录服务连接失败
**现象**：显示"转录服务不可用"
**解决**：
```bash
# 检查Python服务状态
curl http://localhost:8000/health

# 检查环境变量
echo $TRANSCRIPTION_SERVICE_URL

# 重启Python服务
cd python-transcription-service
python app.py
```

#### 3. 转录准确率低
**现象**：转录结果不准确
**解决**：
- 确保环境安静
- 说话清晰，语速适中
- 升级Whisper模型：`WHISPER_MODEL_SIZE=small`
- 检查麦克风质量

#### 4. 内存不足
**现象**：Python服务启动失败或转录缓慢
**解决**：
- 使用更小的模型：`WHISPER_MODEL_SIZE=tiny`
- 增加服务器内存
- 使用GPU加速（如可用）

### 调试技巧

#### 前端调试
```javascript
// 浏览器控制台检查转录客户端状态
console.log(window.transcriptionClient.getRecordingStatus());

// 检查WebSocket连接
console.log(window.transcriptionClient.websocket);
```

#### 后端调试
```bash
# Node.js服务日志
railway logs --service main

# Python服务日志
railway logs --service transcription-service

# 本地调试
DEBUG=* npm run dev
```

## 📊 性能优化

### 前端优化
- 音频压缩：使用`audioBitsPerSecond: 16000`
- 批量处理：每秒收集一次音频数据
- 错误重试：网络失败自动重试机制

### 后端优化
- 模型缓存：Whisper模型预加载
- 并发处理：支持多用户同时转录
- 资源清理：及时清理临时音频文件

### 部署优化
- CDN加速：静态资源使用CDN
- 负载均衡：多实例部署Python服务
- 数据库优化：索引转录记录表

## 🔒 安全考虑

### 数据安全
- 音频数据不存储：转录后立即删除
- 传输加密：HTTPS/WSS加密传输
- 权限控制：麦克风权限明确请求

### 隐私保护
- 本地处理优先：优先使用本地转录
- 数据脱敏：转录文本不包含敏感信息
- 用户控制：用户可随时停止转录

## 📈 扩展功能

### 已规划功能
- [ ] 实时语音翻译
- [ ] 说话人识别
- [ ] 情感分析
- [ ] 会议摘要生成
- [ ] 关键词提取

### 自定义开发
```python
# 在Python服务中添加新功能
@app.post("/transcribe/advanced")
async def advanced_transcription(audio_file: UploadFile):
    # 实现高级转录功能
    pass
```

## 🤝 贡献指南

### 开发环境设置
```bash
# 克隆仓库
git clone <repo-url>
cd vibe-meeting

# 安装依赖
cd server && npm install
cd ../python-transcription-service && pip install -r requirements.txt

# 启动开发服务器
npm run dev  # Node.js服务
python app.py  # Python服务
```

### 提交代码
1. Fork项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建Pull Request

## 📞 技术支持

### 获取帮助
1. 📖 查看本文档和部署指南
2. 🐛 检查浏览器开发者工具控制台
3. 🔍 确认服务状态和配置
4. 💬 在项目Issues中提问

### 联系方式
- GitHub Issues: [项目Issues页面]
- 技术文档: [README.md](README.md)
- 部署指南: [railway-deployment.md](railway-deployment.md)

---

**🎉 恭喜！您已成功为Vibe Meeting添加了强大的AI语音转录功能！**

通过本指南，您可以：
✅ 理解整个技术架构  
✅ 成功部署到Railway  
✅ 排除常见故障  
✅ 优化性能和安全性  
✅ 扩展更多AI功能  

语音转录功能将大大提升会议效率，让每一次讨论都能完整记录，让AI赋能每一次协作！🚀