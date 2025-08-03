# Railway部署优化指南

## 问题分析

你的Railway部署遇到了两个主要问题：

1. **日志速率限制**：`Railway rate limit of 500 logs/sec reached`
2. **速率限制触发**：IP地址被频繁触发速率限制

## 解决方案

### 1. 日志优化

已实施的优化：

- ✅ 添加了日志级别控制（LOG_LEVEL环境变量）
- ✅ 减少了不必要的console.log输出
- ✅ 将调试信息移到debug级别
- ✅ 优化了错误日志格式

### 2. 速率限制优化

已实施的优化：

- ✅ 增加了速率限制点数（1000 → 2000）
- ✅ 添加了blockDuration参数
- ✅ 优化了速率限制错误处理

### 3. Railway配置优化

已创建的配置文件：

- ✅ `railway.toml` - Railway部署配置
- ✅ `start-server 2.py` - 优化启动脚本

## 部署步骤

### 1. 环境变量设置

在Railway控制台中设置以下环境变量：

```bash
NODE_ENV=production
LOG_LEVEL=warn
MONGODB_URI=your_mongodb_connection_string
ALLOWED_ORIGINS=https://your-app.railway.app,https://*.railway.app
```

### 2. 部署命令

```bash
# 使用Railway CLI部署
railway up

# 或者使用Git部署
git push railway main
```

### 3. 健康检查

确保健康检查端点正常工作：

```bash
curl https://your-app.railway.app/health
```

预期响应：
```json
{
  "status": "ok",
  "service": "vibe-meeting",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production",
  "version": "1.0.0"
}
```

## 监控和调试

### 1. 日志级别

- `debug`: 详细调试信息
- `info`: 一般信息（默认）
- `warn`: 仅警告和错误
- `error`: 仅错误

### 2. 性能监控

```bash
# 检查应用状态
railway status

# 查看日志
railway logs

# 查看实时日志
railway logs --follow
```

### 3. 速率限制监控

在代码中已添加速率限制监控：

```javascript
logger.warn(`⚠️ 速率限制触发: ${socket.handshake.address}, 剩余时间: ${Math.round(rejRes.msBeforeNext / 1000)}秒`);
```

## 故障排除

### 1. 日志速率限制

如果仍然遇到日志速率限制：

1. 将LOG_LEVEL设置为`error`
2. 检查是否有循环日志输出
3. 考虑使用外部日志服务

### 2. 速率限制触发

如果用户频繁触发速率限制：

1. 检查客户端是否有重连循环
2. 增加速率限制点数
3. 优化客户端重连逻辑

### 3. 连接问题

如果遇到连接问题：

1. 检查CORS配置
2. 验证WebSocket传输设置
3. 确认防火墙设置

## 最佳实践

### 1. 日志管理

- 使用结构化日志
- 避免在循环中输出日志
- 设置合适的日志级别

### 2. 性能优化

- 启用压缩
- 使用缓存头
- 优化数据库查询

### 3. 安全配置

- 启用Helmet
- 配置CORS
- 实施速率限制

## 更新日志

### v1.1.0 (当前版本)

- ✅ 优化日志输出，减少速率限制
- ✅ 调整速率限制参数
- ✅ 添加Railway专用配置
- ✅ 创建优化启动脚本
- ✅ 改进错误处理和监控

### 下一步计划

- [ ] 添加应用性能监控
- [ ] 实施更细粒度的速率限制
- [ ] 添加自动扩展配置
- [ ] 优化数据库连接池

## 联系支持

如果问题仍然存在，请提供：

1. Railway应用URL
2. 错误日志截图
3. 环境变量配置
4. 客户端连接日志

---

**注意**：这些优化应该能显著减少日志输出和速率限制问题。如果问题持续，可能需要进一步分析具体的连接模式。