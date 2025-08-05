# Railway上转录同步调试指南

## 问题描述

在Railway部署环境中，科大讯飞转录功能工作正常：
- ✅ 科大讯飞API正确返回转录结果
- ✅ 客户端正确处理转录结果
- ✅ 发送转录结果到服务器成功

但是存在的问题：
- ❌ 转录结果没有在任何参与者的页面上显示
- ❌ 转录结果没有同步到所有用户

## 调试步骤

### 第一步：基础检查

在浏览器控制台中运行以下命令：

```javascript
debugTranscriptionSync()
```

这会输出以下信息：
- realtimeClient连接状态
- Socket.IO连接状态  
- 事件处理器是否正确设置
- DOM元素是否存在
- 必要的全局变量（roomId, currentUserId等）

### 第二步：监听事件

运行以下命令开始监听转录相关事件：

```javascript
monitorTranscriptionEvents()
```

这会拦截和显示所有转录相关的Socket.IO事件，包括：
- 发送的事件（发送到服务器）
- 接收的事件（从服务器接收）

### 第三步：测试发送

在科大讯飞转录开始后，观察浏览器控制台中的日志：

**期望看到的日志：**
1. `📡 准备发送转录结果:` + 数据
2. `📡 实时客户端连接状态: true`
3. `📡 已发送转录结果:`
4. `🔧 realtime-client 收到 transcriptionResult:` + 数据
5. `📝 收到转录结果:` + 数据
6. 转录结果显示在实时记录框中

**如果缺少某个步骤，说明问题在该环节。**

### 第四步：手动测试显示

如果事件接收正常但显示有问题，运行：

```javascript
testDisplayTranscriptionResult('测试文本')
```

这会手动触发转录结果显示，验证显示逻辑是否正常。

## 可能的问题和解决方案

### 问题1：连接状态异常

**症状：** `debugTranscriptionSync()` 显示 `realtimeClient连接状态: false`

**解决方案：**
```javascript
// 检查连接状态
window.realtimeClient.testConnection()

// 手动重连
window.realtimeClient.connect()
```

### 问题2：事件处理器未设置

**症状：** `onTranscriptionResult存在: false`

**解决方案：** 刷新页面确保 `setupRealtimeClient()` 正确执行

### 问题3：Socket.IO房间问题

**症状：** 发送成功但其他人收不到

**检查：** 确认所有用户都在同一个房间
```javascript
// 检查当前用户的房间
Array.from(window.realtimeClient.socket.rooms)

// 应该包含roomId
```

### 问题4：Railway环境特殊问题

**Railway特殊配置检查：**

1. **传输方式：** 确保使用 `polling` 而不是 `websocket`
```javascript
window.realtimeClient.socket.io?.engine?.transport?.name
// 应该是 "polling"
```

2. **CORS配置：** 确保Railway域名在服务器CORS列表中

3. **端口配置：** 确保服务器监听正确的端口

## Railway特定调试

### 检查服务器日志

在Railway控制台中查看服务器日志，应该看到：

```
📡 收到转录结果: 你好 (来自: 用户名, 临时: false)
📤 转录结果已广播到房间 房间ID: 你好... (接收者数量: 2)
```

如果看不到这些日志，说明：
1. 客户端发送的事件没有到达服务器
2. 服务器处理有问题

### 检查客户端事件发送

在浏览器控制台中应该看到：

```
📡 准备发送转录结果: {roomId: "...", userId: "...", ...}
📡 实时客户端连接状态: true
📡 已发送转录结果: 你好... (临时: false)
```

如果 `实时客户端连接状态: false`，说明连接有问题。

### 检查客户端事件接收

应该看到：

```
🔧 realtime-client 收到 transcriptionResult: {type: "xfyun", ...}
📝 收到转录结果: {type: "xfyun", ...}
📝 转录结果详细信息: {...}
```

如果缺少这些日志，说明服务器广播有问题或客户端接收有问题。

## 紧急修复方案

如果同步功能暂时无法工作，可以使用本地显示模式：

1. **临时禁用同步发送：**
```javascript
// 在xfyun-rtasr-official.js中临时注释掉
// this.sendTranscriptionResult(resultTextTemp, false);
```

2. **恢复本地显示：**
```javascript
// 恢复本地显示逻辑
if (resultTextTemp.trim()) {
    this.updateTranscriptDisplay(resultTextTemp);
}
```

## 完整诊断脚本

将以下脚本复制到浏览器控制台运行完整诊断：

```javascript
async function fullDiagnosis() {
    console.log('🔧 开始完整诊断...');
    
    // 基础检查
    debugTranscriptionSync();
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 开始监听
    monitorTranscriptionEvents();
    
    // 测试手动显示
    testDisplayTranscriptionResult('诊断测试文本');
    
    console.log('🔧 完整诊断完成！请开始转录测试...');
}

fullDiagnosis();
```

## 联系支持

如果以上步骤都无法解决问题，请提供：

1. `debugTranscriptionSync()` 的完整输出
2. 转录时的完整浏览器控制台日志
3. Railway服务器日志（如果可访问）
4. 网络环境信息（是否使用代理、防火墙等）

这将帮助快速定位和解决问题。