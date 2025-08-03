# 🚨 Railway部署故障排除指南

## 常见问题及解决方案

### 1. "接口不存在" 错误

**问题现象**：
```
{"error":"接口不存在"}
```

**原因分析**：
- 访问了不存在的API端点
- 路由配置问题
- 静态文件服务配置问题

**解决方案**：
```bash
# 1. 检查Railway日志
railway logs

# 2. 确认健康检查端点
curl https://your-app.railway.app/health

# 3. 检查环境变量
railway variables
```

### 2. npm启动命令错误

**问题现象**：
```
npm error command sh -c node server/server.js
```

**原因分析**：
- railway.toml中的启动命令路径不正确
- 项目结构问题

**解决方案**：
```toml
# 修复railway.toml
[deploy]
startCommand = "node server/server.js"
```

### 3. 容器停止 (SIGTERM)

**问题现象**：
```
Stopping Container
npm error signal SIGTERM
```

**原因分析**：
- 健康检查失败
- 内存不足
- 启动超时

**解决方案**：
```bash
# 1. 增加健康检查超时时间
railway variables set HEALTHCHECK_TIMEOUT=600

# 2. 检查内存使用
railway logs --follow

# 3. 优化启动时间
# 在server.js中添加启动日志
console.log('🚀 服务器启动中...');
```

### 4. MongoDB连接问题

**问题现象**：
```
[ERROR] MongoDB 连接失败
```

**解决方案**：
```bash
# 1. 检查MongoDB URI
railway variables set MONGODB_URI="mongodb+srv://..."

# 2. 使用Railway MongoDB插件
railway add mongodb

# 3. 检查网络连接
railway logs | grep "MongoDB"
```

### 5. 转录服务连接失败

**问题现象**：
```
转录服务暂时不可用
```

**解决方案**：
```bash
# 1. 检查转录服务URL
railway variables set TRANSCRIPTION_SERVICE_URL="https://your-transcription-service.railway.app"

# 2. 测试转录服务健康检查
curl https://your-transcription-service.railway.app/health

# 3. 检查Python服务日志
railway logs --service transcription-service
```

## 部署检查清单

### 部署前检查
- [ ] 所有依赖已添加到package.json
- [ ] railway.toml配置正确
- [ ] 环境变量已设置
- [ ] 健康检查端点正常

### 部署后检查
- [ ] 服务启动成功
- [ ] 健康检查通过
- [ ] 数据库连接正常
- [ ] API端点可访问
- [ ] 前端页面加载正常

## 调试命令

### 查看服务状态
```bash
# 查看所有服务
railway status

# 查看特定服务
railway status --service main

# 查看日志
railway logs --follow

# 查看环境变量
railway variables
```

### 测试API端点
```bash
# 健康检查
curl https://your-app.railway.app/health

# 转录服务健康检查
curl https://your-app.railway.app/api/transcription/health

# 测试Socket.IO连接
curl -I https://your-app.railway.app/socket.io/
```

### 重新部署
```bash
# 强制重新部署
railway up --force

# 重新构建
railway up --build

# 重启服务
railway restart
```

## 性能优化

### 内存优化
```bash
# 设置Node.js内存限制
railway variables set NODE_OPTIONS="--max-old-space-size=512"

# 使用更小的Whisper模型
railway variables set WHISPER_MODEL_SIZE="tiny"
```

### 启动优化
```bash
# 减少启动时间
railway variables set NODE_ENV="production"
railway variables set LOG_LEVEL="error"
```

## 常见错误代码

| 错误代码 | 含义 | 解决方案 |
|---------|------|----------|
| 404 | 接口不存在 | 检查路由配置 |
| 500 | 服务器内部错误 | 查看错误日志 |
| 503 | 服务不可用 | 检查服务状态 |
| SIGTERM | 容器被终止 | 检查健康检查配置 |

## 联系支持

如果问题仍然存在：

1. **收集日志**：
   ```bash
   railway logs > deployment-logs.txt
   ```

2. **检查配置**：
   ```bash
   railway variables > env-vars.txt
   ```

3. **创建Issue**：
   - 提供错误日志
   - 描述重现步骤
   - 包含环境信息

---

**💡 提示**：大多数部署问题都可以通过检查日志和配置来解决。如果问题持续，可以尝试重新部署或联系Railway支持。 