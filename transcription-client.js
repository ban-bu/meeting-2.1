// AI语音转录客户端
// 集成到现有的app.js中，提供语音转录功能

class TranscriptionClient {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.websocket = null;
        this.transcriptionServiceUrl = this.getTranscriptionServiceUrl();
        this.isConnected = false;
        this.currentRoomId = null;
        this.recordingStartTime = null;
        
        // 录音配置
        this.recordingConfig = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 16000
        };
        
        // 初始化
        this.init();
    }
    
    getTranscriptionServiceUrl() {
        // 根据部署环境自动检测转录服务地址
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        } else if (hostname.includes('railway.app')) {
            // Railway环境 - 假设转录服务部署在不同端口或子域名
            return `${protocol}//${hostname.replace('app', 'transcription')}`;
        } else {
            // 从localStorage获取配置的转录服务地址
            return localStorage.getItem('transcription_service_url') || `${protocol}//${hostname}:8000`;
        }
    }
    
    async init() {
        try {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('浏览器不支持录音功能');
                return;
            }
            
            // 测试转录服务连接
            await this.testConnection();
            
            console.log('✅ 语音转录客户端初始化完成');
        } catch (error) {
            console.error('语音转录客户端初始化失败:', error);
        }
    }
    
    async testConnection() {
        try {
            const response = await fetch(`${this.transcriptionServiceUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'ok') {
                console.log('✅ 转录服务连接正常');
                this.isConnected = true;
                return true;
            } else {
                throw new Error('转录服务不可用');
            }
        } catch (error) {
            console.warn('⚠️ 转录服务连接失败:', error);
            this.isConnected = false;
            return false;
        }
    }
    
    async startRecording(roomId) {
        if (this.isRecording) {
            console.warn('已在录音中');
            return;
        }
        
        try {
            this.currentRoomId = roomId;
            
            // 获取麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                }
            });
            
            // 创建媒体录制器
            this.mediaRecorder = new MediaRecorder(stream, this.recordingConfig);
            this.audioChunks = [];
            
            // 录音事件处理
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                await this.processRecording();
            };
            
            // 开始录音
            this.mediaRecorder.start(1000); // 每秒收集一次数据
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            // 建立WebSocket连接进行实时转录
            if (this.isConnected) {
                await this.connectWebSocket(roomId);
            }
            
            console.log('🎙️ 开始录音和转录');
            this.showToast('开始语音转录', 'info');
            
            // 更新UI
            this.updateRecordingUI(true);
            
        } catch (error) {
            console.error('开始录音失败:', error);
            this.showToast('无法开始录音: ' + error.message, 'error');
        }
    }
    
    async stopRecording() {
        if (!this.isRecording) {
            console.warn('当前未在录音');
            return;
        }
        
        try {
            // 停止录音
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            
            // 停止媒体流
            if (this.mediaRecorder && this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            
            // 关闭WebSocket连接
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }
            
            this.isRecording = false;
            const duration = this.recordingStartTime ? 
                Math.round((Date.now() - this.recordingStartTime) / 1000) : 0;
            
            console.log(`🎙️ 录音结束，时长: ${duration}秒`);
            this.showToast(`录音结束，时长: ${duration}秒`, 'success');
            
            // 更新UI
            this.updateRecordingUI(false);
            
        } catch (error) {
            console.error('停止录音失败:', error);
            this.showToast('停止录音失败: ' + error.message, 'error');
        }
    }
    
    async connectWebSocket(roomId) {
        try {
            const wsUrl = this.transcriptionServiceUrl.replace('http', 'ws') + `/ws/transcribe/${roomId}`;
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ 转录WebSocket连接建立');
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleTranscriptionResult(data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('转录WebSocket错误:', error);
            };
            
            this.websocket.onclose = () => {
                console.log('转录WebSocket连接关闭');
            };
            
        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }
    
    async processRecording() {
        if (this.audioChunks.length === 0) {
            console.warn('没有录音数据');
            return;
        }
        
        try {
            // 合并音频数据
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // 如果没有WebSocket连接，使用HTTP API转录
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
                await this.transcribeAudioFile(audioBlob);
            }
            
        } catch (error) {
            console.error('处理录音失败:', error);
            this.showToast('处理录音失败: ' + error.message, 'error');
        }
    }
    
    async transcribeAudioFile(audioBlob) {
        try {
            this.showToast('正在转录语音...', 'info');
            
            // 准备表单数据
            const formData = new FormData();
            formData.append('audio_file', audioBlob, 'recording.webm');
            
            // 发送转录请求
            const response = await fetch(`${this.transcriptionServiceUrl}/transcribe/audio`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`转录请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.text) {
                // 显示转录结果
                this.handleTranscriptionResult({
                    type: 'transcription',
                    text: result.text,
                    language: result.language,
                    timestamp: Date.now() / 1000
                });
            } else {
                throw new Error('转录返回空结果');
            }
            
        } catch (error) {
            console.error('转录失败:', error);
            this.showToast('语音转录失败: ' + error.message, 'error');
        }
    }
    
    handleTranscriptionResult(data) {
        if (!data.text || data.text.trim() === '') {
            return;
        }
        
        console.log('📝 转录结果:', data.text);
        
        // 创建转录消息
        const transcriptionMessage = {
            type: 'transcription',
            text: `🎙️ [语音转录] ${data.text}`,
            author: currentUsername || '语音转录',
            userId: currentUserId || 'transcription-system',
            time: new Date().toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            timestamp: Date.now(),
            isTranscription: true,
            language: data.language || 'zh'
        };
        
        // 添加到消息列表
        if (typeof addMessage === 'function') {
            addMessage('transcription', transcriptionMessage.text, transcriptionMessage.author, transcriptionMessage.userId);
        } else {
            // 兼容现有消息系统
            messages.push(transcriptionMessage);
            renderMessage(transcriptionMessage);
            scrollToBottom();
            
            // 发送给其他用户
            if (isRealtimeEnabled && window.realtimeClient) {
                window.realtimeClient.sendMessage(transcriptionMessage);
            }
        }
        
        this.showToast('语音转录完成', 'success');
    }
    
    updateRecordingUI(isRecording) {
        const recordBtn = document.getElementById('recordBtn');
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (recordBtn) {
            if (isRecording) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fas fa-stop"></i> 停止录音';
                recordBtn.style.background = '#ef4444';
            } else {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone"></i> 开始转录';
                recordBtn.style.background = '#10b981';
            }
        }
        
        if (transcriptionStatus) {
            if (isRecording) {
                transcriptionStatus.innerHTML = '<i class="fas fa-circle text-red-500"></i> 正在录音转录...';
                transcriptionStatus.style.color = '#ef4444';
            } else {
                transcriptionStatus.innerHTML = '<i class="fas fa-microphone-slash"></i> 转录已停止';
                transcriptionStatus.style.color = '#6b7280';
            }
        }
    }
    
    showToast(message, type = 'info') {
        // 使用现有的toast系统
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
            if (roomId && currentUsername) {
                this.startRecording(roomId);
            } else {
                this.showToast('请先加入房间', 'warning');
            }
        }
    }
    
    // 获取录音状态
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            isConnected: this.isConnected,
            duration: this.recordingStartTime ? 
                Math.round((Date.now() - this.recordingStartTime) / 1000) : 0
        };
    }
}

// 创建全局转录客户端实例
window.transcriptionClient = new TranscriptionClient();

// 暴露给全局使用的函数
function toggleTranscription() {
    window.transcriptionClient.toggleRecording();
}

function getTranscriptionStatus() {
    return window.transcriptionClient.getRecordingStatus();
}