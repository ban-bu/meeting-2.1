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
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `ws://localhost:3001/xfyun-proxy`;
        } else {
            return `${protocol}//${hostname}/xfyun-proxy`;
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
            this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);
            
            this.processor.onaudioprocess = (event) => {
                if (this.isRecording && this.isConnected) {
                    const inputData = event.inputBuffer.getChannelData(0);
                    this.sendAudioData(inputData);
                }
            };
            
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
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
        const recordBtn = document.getElementById('recordBtn') || document.getElementById('xfyunRecordBtn');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (recordBtn) {
            if (isRecording) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fas fa-stop"></i> 停止科大讯飞转录';
                recordBtn.style.background = '#ef4444';
            } else {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone"></i> 开始科大讯飞转录';
                recordBtn.style.background = '#10b981';
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