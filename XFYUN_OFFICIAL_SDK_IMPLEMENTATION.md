# 科大讯飞官方SDK实现指南

## 概述

基于您提供的科大讯飞官方JavaScript SDK，我已经成功重新实现了科大讯飞实时语音转写(RTASR)功能。这个实现使用了科大讯飞官方提供的正确API和认证方式。

## 实现特点

### ✅ 官方SDK支持
- 使用科大讯飞官方JavaScript SDK
- 包含完整的录音管理器(RecorderManager)
- 支持WebSocket实时传输

### ✅ 正确的API调用
- **接口地址**: `wss://rtasr.xfyun.cn/v1/ws`
- **认证方式**: MD5+HmacSHA1签名认证
- **数据格式**: 二进制音频数据直传

### ✅ 完整的功能特性
- 实时语音录制和传输
- 实时转录结果显示
- 临时结果和最终结果区分
- 错误处理和重连机制
- 用户友好的界面交互

## 文件结构

### 新增文件
```
├── index.umd.js              # 科大讯飞主SDK文件
├── processor.worker.js       # 录音处理器Worker
├── processor.worklet.js      # 录音处理器Worklet
├── hmac-sha256.js           # HMAC-SHA256算法
├── HmacSHA1.js              # HMAC-SHA1算法
├── md5.js                   # MD5算法
├── enc-base64-min.js        # Base64编码
└── xfyun-rtasr-official.js  # 我们的实现类
```

### 核心实现类: XfyunOfficialRTASR

```javascript
class XfyunOfficialRTASR {
    constructor() {
        this.APPID = "84959f16";
        this.API_KEY = "065eee5163baa4692717b923323e6853";
        // ... 其他配置
    }
    
    // 关键方法
    getWebSocketUrl()         // 生成带签名的WebSocket URL
    connect()                 // 连接到科大讯飞服务
    startRecording()          // 开始录音
    handleMessage()           // 处理转录结果
    stopRecording()           // 停止录音
}
```

## API认证机制

### 签名生成流程
1. **时间戳**: `ts = Math.floor(new Date().getTime() / 1000)`
2. **MD5签名**: `signa = hex_md5(appId + ts)`
3. **HMAC-SHA1**: `signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey)`
4. **Base64编码**: `signature = CryptoJS.enc.Base64.stringify(signatureSha)`
5. **URL构建**: `wss://rtasr.xfyun.cn/v1/ws?appid=${appId}&ts=${ts}&signa=${signature}`

### 配置要求
```javascript
// 需要在科大讯飞开放平台获取
const APPID = "84959f16";                              // 应用ID
const API_KEY = "065eee5163baa4692717b923323e6853";    // API密钥
```

## 音频处理参数

### 录音配置
```javascript
recorder.start({
    sampleRate: 16000,    // 采样率16kHz（科大讯飞要求）
    frameSize: 1280,      // 帧大小
});
```

### 数据传输
- **格式**: 直接发送二进制Int8Array
- **频率**: 实时传输音频帧
- **结束**: 发送`{"end": true}`标志

## 转录结果处理

### 消息类型
1. **started**: 握手成功确认
2. **result**: 转录结果数据
3. **error**: 错误信息

### 结果格式解析
```javascript
// 科大讯飞返回的数据结构
{
  "action": "result",
  "data": {
    "cn": {
      "st": {
        "rt": [
          {
            "ws": [
              {
                "cw": [
                  { "w": "文字内容" }
                ]
              }
            ]
          }
        ],
        "type": 0  // 0=最终结果, 1=临时结果
      }
    }
  }
}
```

## 用户界面集成

### 按钮状态管理
- **UNDEFINED/CLOSED**: 显示"科大讯飞转录"按钮
- **CONNECTING**: 显示"连接中..."（禁用状态）
- **OPEN**: 显示"停止科大讯飞转录"按钮
- **CLOSING**: 显示"停止中..."（禁用状态）

### 结果显示
- 实时更新转录文本
- 区分临时结果和最终结果
- 特殊的科大讯飞样式（蓝色主题）
- 时间戳和服务标识

## 使用方法

### 1. 开始转录
```javascript
// 用户点击"科大讯飞转录"按钮
startXfyunTranscription();
```

### 2. 停止转录
```javascript
// 用户点击"停止科大讯飞转录"按钮
stopXfyunTranscription();
```

### 3. 调试信息
```javascript
// 在浏览器控制台查看状态
debugXfyunConnection();
```

## 错误处理

### 常见错误类型
1. **WebSocket连接失败**: 网络问题或API密钥错误
2. **录音器初始化失败**: 浏览器权限或兼容性问题
3. **认证失败**: APPID或API_KEY配置错误
4. **音频处理错误**: 音频格式或设备问题

### 错误提示
所有错误都会通过Toast提示显示给用户，包含具体的错误信息和建议解决方案。

## 浏览器兼容性

### 支持的浏览器
- Chrome 66+
- Firefox 60+
- Safari 12+
- Edge 79+

### 权限要求
- 麦克风访问权限
- 必须在HTTPS或localhost环境下运行

## 部署注意事项

### 1. 文件路径
- 确保`processor.worker.js`和`processor.worklet.js`可通过HTTP访问
- RecorderManager构造函数的路径参数要正确

### 2. HTTPS要求
- 生产环境必须使用HTTPS
- 本地开发可以使用localhost

### 3. API密钥安全
- 生产环境建议通过后端代理API调用
- 避免在前端直接暴露API密钥

## 测试步骤

1. **检查依赖加载**
   ```javascript
   debugXfyunConnection();
   // 查看dependenciesLoaded是否为true
   ```

2. **测试连接**
   - 点击"科大讯飞转录"按钮
   - 观察连接状态变化
   - 检查浏览器控制台日志

3. **测试录音**
   - 允许麦克风权限
   - 说话测试转录效果
   - 观察实时结果显示

4. **测试停止**
   - 点击"停止"按钮
   - 检查最终结果
   - 验证资源清理

## 性能优化

### 音频处理
- 使用AudioWorklet优先，降级到ScriptProcessor
- 合理的帧大小设置(1280)
- 及时清理音频资源

### 网络优化
- WebSocket长连接复用
- 二进制数据直传，减少编码开销
- 合理的错误重试机制

## 总结

这个基于官方SDK的实现提供了：
- ✅ **完整的功能**: 实时录音、转写、显示
- ✅ **稳定的连接**: 官方API和认证方式
- ✅ **良好的体验**: 友好的界面和错误提示
- ✅ **易于维护**: 清晰的代码结构和文档

现在科大讯飞实时语音转写功能已经可以正常使用了！