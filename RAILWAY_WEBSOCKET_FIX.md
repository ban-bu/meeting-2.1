# Railway WebSocket连接问题修复指南

## 问题描述

部署到Railway后，WiFi图标一直显示"连接中..."，WebSocket无法正常连接。

## 已实施的修复

### 1. 服务器端优化

**文件**: `server/server.js`

- ✅ 修改Socket.IO配置，优先使用polling传输
- ✅ 增加Railway环境CORS特殊处理
- ✅ 增加连接超时时间
- ✅ 添加详细的调试日志

关键修改：
```javascript
// Socket.IO配置 - 针对Railway环境优化
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            // Railway环境特殊处理
            if (origin.includes('railway.app') || origin.includes('up.railway.app')) {
                return callback(null, true);
            }
            // ... 其他逻辑
        }
    },
    transports: ['polling', 'websocket'], // Railway环境优先使用polling
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000
});
```

### 2. 客户端优化

**文件**: `realtime-client.js`

- ✅ Railway环境检测和特殊配置
- ✅ 优先使用polling传输方式
- ✅ 增加连接超时时间
- ✅ 添加详细的错误日志和调试信息

关键修改：
```javascript
if (this.isRailway) {
    // Railway环境优先使用polling，然后升级到WebSocket
    socketConfig.transports = ['polling', 'websocket'];
    socketConfig.upgrade = true;
    socketConfig.rememberUpgrade = true;
}
```

### 3. 科大讯飞代理修复

**文件**: `xfyun-realtime-transcription.js`

- ✅ 修复Railway环境下的WebSocket URL
- ✅ 正确使用WSS协议

```javascript
else if (hostname.includes('railway.app') || hostname.includes('up.railway.app')) {
    // Railway环境使用HTTPS，所以WebSocket应该使用WSS
    const wsUrl = `wss://${hostname}/xfyun-proxy`;
    return wsUrl;
}
```

### 4. 调试工具

**文件**: `index.html`

- ✅ 添加全局调试函数
- ✅ 连接状态检测
- ✅ Socket.IO状态测试

可在浏览器控制台使用：
- `debugConnection()` - 测试连接状态
- `testSocketIO()` - 检查Socket.IO库状态

## 部署后的调试步骤

### 1. 检查服务器日志

在Railway控制台查看应用日志，关注：
- Socket.IO CORS检查消息
- WebSocket连接错误
- 环境检测信息

### 2. 浏览器调试

1. 打开浏览器开发者工具
2. 在控制台运行：
   ```javascript
   debugConnection()
   testSocketIO()
   ```

3. 查看网络标签页，检查：
   - Socket.IO握手请求
   - WebSocket连接状态
   - 错误响应

### 3. 常见问题排查

#### 问题1: CORS错误
**症状**: 控制台显示CORS相关错误
**解决**: 确认服务器端CORS配置正确处理Railway域名

#### 问题2: WebSocket升级失败
**症状**: 连接停留在polling状态
**解决**: 检查Railway是否支持WebSocket升级

#### 问题3: 超时错误
**症状**: 连接超时
**解决**: 
- 检查Railway服务状态
- 确认端口配置正确
- 检查环境变量

## 环境变量检查

确保在Railway中设置了必要的环境变量：

```bash
NODE_ENV=production
LOG_LEVEL=debug  # 临时启用调试日志
PORT=3001       # Railway会自动设置
```

## 测试连接的命令

### 测试基本HTTP连接
```bash
curl https://your-app.railway.app/health
```

### 测试Socket.IO端点
```bash
curl https://your-app.railway.app/socket.io/?EIO=4&transport=polling
```

### 测试科大讯飞状态
```bash
curl https://your-app.railway.app/api/xfyun/status
```

## 预期的正常流程

1. **页面加载**: 
   - 检测Railway环境 ✅
   - 生成正确的服务器URL ✅

2. **Socket.IO连接**:
   - 首先尝试polling连接 ✅
   - CORS检查通过 ✅
   - 建立连接，显示"实时连接已建立" ✅

3. **WebSocket升级**:
   - 从polling升级到WebSocket ✅
   - 保持连接稳定 ✅

4. **功能测试**:
   - 实时消息同步 ✅
   - 语音转录功能 ✅
   - 科大讯飞转录 ✅

## 回滚方案

如果修复后仍有问题，可以：

1. **禁用WebSocket升级**:
   ```javascript
   socketConfig.upgrade = false;
   socketConfig.transports = ['polling'];
   ```

2. **启用本地模式**:
   ```javascript
   window.realtimeClient.useLocalMode();
   ```

3. **检查Railway服务限制**:
   - 确认WebSocket支持
   - 检查并发连接限制
   - 验证内存和CPU配额

## 成功指标

连接修复成功的标志：
- ✅ WiFi图标显示绿色并显示"实时连接"
- ✅ 控制台显示"WebSocket连接成功"
- ✅ 能够发送和接收实时消息
- ✅ 科大讯飞转录功能正常工作

---

**修复时间**: ${new Date().toLocaleString('zh-CN')}
**适用版本**: Railway部署环境
**测试状态**: 待验证