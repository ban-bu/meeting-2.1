# AssemblyAI流式转录实现指南

## 🌊 流式转录架构

### 技术栈
```
前端: Web Audio API + Socket.IO
└── 实时音频采集 → PCM转换 → Socket传输

后端: Node.js + AssemblyAI Real-time API
└── Socket.IO事件处理 → AssemblyAI WebSocket → 结果广播

AssemblyAI: 实时语音识别服务
└── WebSocket连接 → 流式音频处理 → 实时转录结果
```

## 🚀 部署和配置

### 1. 依赖安装
确保已安装必要的依赖：
```json
{
  "ws": "^8.14.2",
  "axios": "^1.6.2",
  "socket.io": "^4.7.4"
}
```

### 2. 环境变量
```env
ASSEMBLYAI_API_KEY=9a9bc1cad7b24932a96d7e55469436f2
```

### 3. Railway部署配置
```toml
[env]
ASSEMBLYAI_API_KEY = "${{ASSEMBLYAI_API_KEY}}"
```

## ⚡ 流式转录特性

### 延迟对比
| 模式 | 录音时间 | 处理延迟 | 总延迟 | 实时性 |
|------|----------|----------|--------|--------|
| **传统模式** | 用户控制 | 5-30秒 | 录音时间+处理时间 | ❌ 低 |
| **流式模式** | 连续 | 200-500ms | < 1秒 | ✅ 高 |

### 用户体验
```
传统模式: 用户说话 → 手动停止 → 等待10-30秒 → 显示结果
流式模式: 用户说话 → 实时显示部分结果 → 自动完成最终结果
```

## 🎯 核心功能

### 1. 实时音频处理
```javascript
// Web Audio API配置
this.audioContext = new AudioContext({ sampleRate: 16000 });
this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

// 实时音频处理
this.processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const pcmData = this.convertToPCM16(inputData);
    this.sendAudioData(pcmData); // 发送到服务器
};
```

### 2. 双重结果显示
```javascript
// 部分结果（实时更新）
updatePartialTranscription(text) {
    // 显示灰色、斜体的临时转录文本
    // 用户可以看到正在转录的内容
}

// 最终结果（确定内容）
addFinalTranscription(text, confidence) {
    // 添加到正式消息列表
    // 移除临时显示
}
```

### 3. Socket.IO事件流
```
客户端                    服务器                    AssemblyAI
├─ startStreamingTranscription ─→ 建立AssemblyAI连接
├─ audioData ─────────────────→ 转发音频数据 ────→ 实时处理
├─ ←─── streamingTranscriptionResult ←─ 部分结果 ←─ PartialTranscript
├─ ←─── streamingTranscriptionResult ←─ 最终结果 ←─ FinalTranscript
└─ stopStreamingTranscription ─→ 关闭连接
```

## 🔧 使用方法

### 基本用法
```javascript
// 初始化（自动执行）
const client = new TranscriptionClient();
await client.init();

// 开始流式转录
client.isStreamingMode = true; // 启用流式模式
client.toggleRecording(); // 开始录音

// 停止转录
client.toggleRecording(); // 停止录音
```

### 手动控制
```javascript
// 直接启动流式模式
await client.startStreamingMode(roomId);

// 停止流式模式
await client.stopStreamingMode();

// 切换到传统模式
client.isStreamingMode = false;
```

## 📊 性能和限制

### AssemblyAI限制
- **采样率**: 必须16kHz
- **音频格式**: PCM16
- **连接数**: 有限制（检查API配额）
- **会话时长**: 最长几小时

### 浏览器兼容性
- ✅ Chrome 66+
- ✅ Firefox 60+
- ✅ Safari 14+
- ✅ Edge 79+
- ❌ IE（不支持Web Audio API）

### 网络要求
- **稳定连接**: WebSocket需要稳定网络
- **带宽**: 约32kbps（16kHz PCM）
- **延迟**: 建议<200ms网络延迟

## 🎨 UI/UX设计

### 视觉反馈
```css
/* 部分转录样式 */
.partial-transcription {
    background: rgba(99, 102, 241, 0.1);
    border: 1px dashed #6366f1;
    font-style: italic;
    animation: pulse 2s infinite;
}

/* 最终转录样式 */
.final-transcription {
    background: rgba(34, 197, 94, 0.1);
    border-left: 4px solid #22c55e;
}
```

### 状态指示
- 🎙️ **录音中**: 脉冲动画的麦克风图标
- 📝 **转录中**: 部分结果实时更新
- ✅ **完成**: 最终结果添加到聊天

### 错误处理
- 网络断开: 自动重连
- 权限拒绝: 友好提示
- API错误: 降级到传统模式

## 🚨 故障排除

### 常见问题

#### 1. 无法启动流式转录
**症状**: 点击后没有反应
**检查**:
```javascript
// 浏览器控制台检查
console.log('Socket连接:', window.realtimeClient?.socket?.connected);
console.log('转录客户端:', window.transcriptionClient);
```

#### 2. 没有部分结果显示
**症状**: 只有最终结果，没有实时更新
**原因**: AssemblyAI连接问题或音频数据格式错误

#### 3. 音频质量差
**症状**: 转录准确率低
**解决**:
- 检查麦克风质量
- 确认16kHz采样率
- 减少环境噪音

#### 4. 延迟过高
**症状**: 结果延迟超过2秒
**检查**:
- 网络延迟
- AssemblyAI服务状态
- 音频数据传输频率

### 调试方法

#### 服务器端日志
```bash
# Railway日志中查看
[INFO] AssemblyAI流式转录连接建立
[INFO] 用户 xxx 开始流式转录
[INFO] AssemblyAI会话开始: session_xxx
```

#### 浏览器端调试
```javascript
// 启用详细日志
window.transcriptionClient.isStreamingMode = true;

// 手动测试
await window.transcriptionClient.startStreamingMode('test-room');
```

## 🔄 版本迁移

### 从传统模式升级
```javascript
// 保持向后兼容
const client = new TranscriptionClient();
client.isStreamingMode = false; // 继续使用传统模式

// 或启用新功能
client.isStreamingMode = true;  // 使用流式模式
```

### 配置切换
```javascript
// 运行时切换模式
function switchToStreaming() {
    window.transcriptionClient.isStreamingMode = true;
    console.log('已切换到流式转录模式');
}

function switchToTraditional() {
    window.transcriptionClient.isStreamingMode = false;
    console.log('已切换到传统转录模式');
}
```

## 📈 性能监控

### 关键指标
- **连接成功率**: AssemblyAI WebSocket连接
- **转录延迟**: 从说话到显示结果的时间
- **准确率**: 转录文本的准确性
- **错误率**: 连接失败和转录错误

### 监控方法
```javascript
// 性能统计
const stats = {
    connectTime: Date.now(),
    messagesReceived: 0,
    averageLatency: 0
};

// 在转录结果处理中添加统计
handleStreamingTranscriptionResult(data) {
    stats.messagesReceived++;
    const latency = Date.now() - data.timestamp;
    stats.averageLatency = (stats.averageLatency + latency) / 2;
}
```

现在你拥有了一个完整的AssemblyAI流式转录系统！🎉

## 🎯 立即测试

1. **部署更新的代码**到Railway
2. **打开会议应用**
3. **点击"实时转录"**开始测试
4. **说话时观察**：部分结果实时显示 → 最终结果确认

预期结果：近乎实时的语音转文字体验！