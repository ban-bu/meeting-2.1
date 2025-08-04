// 科大讯飞星火实时语音转写客户端
// 集成到现有的语音转录系统中

class XunfeiRealtimeTranscription {
    constructor() {
        // 科大讯飞配置
        this.appId = '84959f16';
        this.apiKey = '065eee5163baa4692717b923323e6853';
        this.apiSecret = null; // 如果需要的话
        
        // WebSocket连接
        this.websocket = null;
        this.isConnected = false;
        this.isRecording = false;
        
        // 音频相关
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.audioBuffer = [];
        
        // 转录状态
        this.sessionId = null;
        this.frameId = 0;
        
        console.log('🎤 科大讯飞实时语音转写客户端已初始化');
    }
    
    // 生成鉴权参数
    generateAuthParams() {
        const host = 'rtasr.xfyun.cn';
        const path = '/v1/ws';
        const date = new Date().toUTCString();
        
        // 构建鉴权字符串
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
        
        // 使用HMAC-SHA256进行签名
        const signature = this.hmacSha256(signatureOrigin, this.apiKey);
        const signatureBase64 = btoa(signature);
        
        // 构建Authorization头
        const authorization = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`;
        const authorizationBase64 = btoa(authorization);
        
        return {
            authorization: authorizationBase64,
            date: date,
            host: host
        };
    }
    
    // HMAC-SHA256签名函数
    hmacSha256(message, secret) {
        // 这里需要一个HMAC-SHA256的实现
        // 由于浏览器环境限制，我们使用简化的方式
        return this.simpleHash(message + secret);
    }
    
    // 简化的hash函数（实际应用中应使用crypto-js或其他库）
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    
    // 连接科大讯飞实时语音转写服务
    async connect() {
        try {
            console.log('🔗 连接科大讯飞实时语音转写服务...');
            
            // 通过本地服务器代理连接科大讯飞
            const wsUrl = this.getWebSocketUrl();
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ 科大讯飞代理WebSocket连接成功');
                this.isConnected = true;
                
                // 发送启动转录命令
                this.websocket.send(JSON.stringify({
                    action: 'start'
                }));
                
                this.showToast('实时转录服务已连接', 'success');
            };
            
            this.websocket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ 科大讯飞WebSocket连接错误:', error);
                this.showToast('转录服务连接失败', 'error');
            };
            
            this.websocket.onclose = () => {
                console.log('🔌 科大讯飞WebSocket连接已关闭');
                this.isConnected = false;
                this.showToast('转录服务已断开', 'warning');
            };
            
        } catch (error) {
            console.error('连接科大讯飞服务失败:', error);
            this.showToast('无法连接转录服务: ' + error.message, 'error');
        }
    }
    
    // 获取WebSocket URL（通过本地代理）
    getWebSocketUrl() {
        // 使用本地代理服务器来解决CORS问题
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port;
        
        console.log('🔗 科大讯飞代理URL检测:', { hostname, protocol, port });
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `ws://localhost:3001/xfyun-proxy`;
        } else if (hostname.includes('railway.app') || hostname.includes('up.railway.app')) {
            // Railway环境使用HTTPS，所以WebSocket应该使用WSS
            const wsUrl = `wss://${hostname}/xfyun-proxy`;
            console.log('🚂 Railway环境科大讯飞代理URL:', wsUrl);
            return wsUrl;
        } else {
            const wsUrl = `${protocol}//${hostname}${port ? ':' + port : ''}/xfyun-proxy`;
            console.log('🌐 标准环境科大讯飞代理URL:', wsUrl);
            return wsUrl;
        }
    }
    
    // 处理接收到的消息
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('📝 收到转录结果:', message);
            
            if (message.action === 'result') {
                this.handleTranscriptionResult(message.data);
            } else if (message.action === 'error') {
                console.error('转录错误:', message.desc);
                this.showToast('转录错误: ' + message.desc, 'error');
            }
            
        } catch (error) {
            console.error('解析转录结果失败:', error);
        }
    }
    
    // 处理转录结果
    handleTranscriptionResult(data) {
        if (!data || !data.cn || !data.cn.st) {
            return;
        }
        
        const results = data.cn.st.rt;
        if (!results || results.length === 0) {
            return;
        }
        
        let transcriptionText = '';
        for (const result of results) {
            if (result.ws) {
                for (const word of result.ws) {
                    if (word.cw && word.cw[0] && word.cw[0].w) {
                        transcriptionText += word.cw[0].w;
                    }
                }
            }
        }
        
        if (transcriptionText.trim()) {
            console.log('✅ 科大讯飞转录结果:', transcriptionText);
            this.displayTranscriptionResult(transcriptionText);
        }
    }
    
    // 显示转录结果
    displayTranscriptionResult(text) {
        // 创建转录消息
        const transcriptionMessage = {
            type: 'transcription',
            text: `🎙️ [科大讯飞转录] ${text}`,
            author: currentUsername || '语音转录',
            userId: currentUserId || 'xfyun-transcription',
            time: new Date().toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            timestamp: Date.now(),
            isTranscription: true,
            source: 'xfyun'
        };
        
        // 添加到消息列表
        if (typeof addMessage === 'function') {
            addMessage('transcription', transcriptionMessage.text, transcriptionMessage.author, transcriptionMessage.userId);
        } else if (typeof messages !== 'undefined') {
            messages.push(transcriptionMessage);
            if (typeof renderMessage === 'function') {
                renderMessage(transcriptionMessage);
            }
            if (typeof scrollToBottom === 'function') {
                scrollToBottom();
            }
            
            // 发送给其他用户
            if (isRealtimeEnabled && window.realtimeClient) {
                window.realtimeClient.sendMessage(transcriptionMessage);
            }
        }
        
        this.showToast('语音转录完成', 'success');
    }
    
    // 开始录音和转录
    async startRecording() {
        if (this.isRecording) {
            console.warn('已在录音中');
            return;
        }
        
        try {
            // 获取麦克风权限
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // 尝试使用AudioWorkletNode，如果不支持则降级到ScriptProcessorNode
            if (this.audioContext.audioWorklet && typeof this.audioContext.audioWorklet.addModule === 'function') {
                try {
                    // 创建AudioWorklet处理器
                    await this.setupAudioWorklet(source);
                } catch (error) {
                    console.warn('AudioWorklet不可用，降级到ScriptProcessorNode:', error);
                    this.setupScriptProcessor(source);
                }
            } else {
                console.warn('浏览器不支持AudioWorklet，使用ScriptProcessorNode');
                this.setupScriptProcessor(source);
            }
            
            // 连接到科大讯飞服务
            if (!this.isConnected) {
                await this.connect();
            }
            
            this.isRecording = true;
            this.frameId = 0;
            
            console.log('🎙️ 开始科大讯飞实时转录');
            this.showToast('开始科大讯飞实时转录', 'info');
            
            // 更新UI
            this.updateRecordingUI(true);
            
        } catch (error) {
            console.error('开始录音失败:', error);
            this.showToast('无法开始录音: ' + error.message, 'error');
        }
    }
    
    // 停止录音
    stopRecording() {
        if (!this.isRecording) {
            console.warn('当前未在录音');
            return;
        }
        
        try {
            this.isRecording = false;
            
            // 停止音频处理
            if (this.processor) {
                if (this.processor.port) {
                    // AudioWorkletNode
                    this.processor.port.onmessage = null;
                } else if (this.processor.onaudioprocess) {
                    // ScriptProcessorNode
                    this.processor.onaudioprocess = null;
                }
                this.processor.disconnect();
                this.processor = null;
            }
            
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
            
            // 发送结束信号
            if (this.websocket && this.isConnected) {
                const endMessage = {
                    action: 'stop'
                };
                this.websocket.send(JSON.stringify(endMessage));
            }
            
            console.log('⏹️ 科大讯飞实时转录已停止');
            this.showToast('实时转录已停止', 'info');
            
            // 更新UI
            this.updateRecordingUI(false);
            
        } catch (error) {
            console.error('停止录音失败:', error);
        }
    }
    
    // 发送音频数据
    sendAudioData(audioData) {
        if (!this.websocket || !this.isConnected) {
            return;
        }
        
        try {
            // 将Float32Array转换为Int16Array
            const pcmData = new Int16Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
            }
            
            // 转换为Base64
            const uint8Array = new Uint8Array(pcmData.buffer);
            const base64Audio = btoa(String.fromCharCode.apply(null, uint8Array));
            
            // 构建发送消息
            const message = {
                action: 'audio',
                data: {
                    audio: base64Audio,
                    encoding: 'raw',
                    sample_rate: 16000,
                    channels: 1,
                    bit_depth: 16,
                    frame_id: this.frameId++
                }
            };
            
            this.websocket.send(JSON.stringify(message));
            
        } catch (error) {
            console.error('发送音频数据失败:', error);
        }
    }
    
    // 更新录音UI
    updateRecordingUI(isRecording) {
        const startBtn = document.getElementById('xfyunStartBtn');
        const stopBtn = document.getElementById('xfyunStopBtn');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (startBtn && stopBtn) {
            if (isRecording) {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
            } else {
                startBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
            }
        }
        
        if (transcriptionStatus) {
            if (isRecording) {
                transcriptionStatus.innerHTML = '<i class="fas fa-circle text-red-500"></i> 科大讯飞实时转录中...';
                transcriptionStatus.style.color = '#ef4444';
            } else {
                transcriptionStatus.innerHTML = '<i class="fas fa-microphone-slash"></i> 科大讯飞转录已停止';
                transcriptionStatus.style.color = '#6b7280';
            }
        }
    }
    
    // 显示提示信息
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 切换录音状态
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    // 设置AudioWorklet处理器（现代方法）
    async setupAudioWorklet(source) {
        // 创建内联的AudioWorklet处理器
        const workletCode = `
            class XfyunAudioProcessor extends AudioWorkletProcessor {
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    if (input.length > 0) {
                        const inputData = input[0];
                        this.port.postMessage({
                            type: 'audioData',
                            data: inputData
                        });
                    }
                    return true;
                }
            }
            registerProcessor('xfyun-audio-processor', XfyunAudioProcessor);
        `;
        
        const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(workletBlob);
        
        await this.audioContext.audioWorklet.addModule(workletUrl);
        
        this.processor = new AudioWorkletNode(this.audioContext, 'xfyun-audio-processor');
        
        this.processor.port.onmessage = (event) => {
            if (event.data.type === 'audioData' && this.isRecording && this.isConnected) {
                this.sendAudioData(event.data.data);
            }
        };
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        // 清理URL
        URL.revokeObjectURL(workletUrl);
        
        console.log('✅ 使用AudioWorklet进行音频处理');
    }
    
    // 设置ScriptProcessor处理器（降级方法）
    setupScriptProcessor(source) {
        this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);
        
        this.processor.onaudioprocess = (event) => {
            if (this.isRecording && this.isConnected) {
                const inputData = event.inputBuffer.getChannelData(0);
                this.sendAudioData(inputData);
            }
        };
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        console.log('⚠️ 使用ScriptProcessorNode进行音频处理（已废弃）');
    }
    
    // 断开连接
    disconnect() {
        this.stopRecording();
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnected = false;
    }
}

// 创建全局科大讯飞转录客户端实例
window.xfyunTranscription = new XunfeiRealtimeTranscription();

// 暴露给全局使用的函数
function startXfyunTranscription() {
    if (!window.xfyunTranscription.isRecording) {
        window.xfyunTranscription.startRecording();
    }
}

function stopXfyunTranscription() {
    if (window.xfyunTranscription.isRecording) {
        window.xfyunTranscription.stopRecording();
    }
}

function toggleXfyunTranscription() {
    window.xfyunTranscription.toggleRecording();
}

function getXfyunTranscriptionStatus() {
    return {
        isRecording: window.xfyunTranscription.isRecording,
        isConnected: window.xfyunTranscription.isConnected
    };
}

console.log('✅ 科大讯飞实时语音转写模块已加载');