/**
 * 科大讯飞实时语音转写 - 基于官方SDK实现
 * 使用科大讯飞官方JavaScript SDK
 */

class XfyunOfficialRTASR {
    constructor() {
        this.isRecording = false;
        this.isConnected = false;
        this.websocket = null;
        this.recorder = null;
        this.btnStatus = "UNDEFINED"; // "UNDEFINED" "CONNECTING" "OPEN" "CLOSING" "CLOSED"
        this.resultText = "";
        this.resultTextTemp = "";
        
        // 科大讯飞配置 - 需要用户提供
        this.APPID = "84959f16";
        this.API_KEY = "065eee5163baa4692717b923323e6853";
        
        console.log('🏭 科大讯飞官方RTASR服务初始化');
        
        this.initRecorder();
    }

    // 初始化录音器
    initRecorder() {
        if (typeof RecorderManager === 'undefined') {
            console.error('❌ RecorderManager未找到，请确保已加载科大讯飞SDK');
            this.showToast('科大讯飞SDK未正确加载', 'error');
            return;
        }

        try {
            // 初始化录音管理器，processorPath是processor文件的路径
            this.recorder = new RecorderManager(".");
            
            this.recorder.onStart = () => {
                console.log('🎙️ 录音器启动成功');
                this.changeBtnStatus("OPEN");
            };

            this.recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }) => {
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    // 发送音频数据到科大讯飞
                    this.websocket.send(new Int8Array(frameBuffer));
                    
                    if (isLastFrame) {
                        // 发送结束标志
                        this.websocket.send('{"end": true}');
                        this.changeBtnStatus("CLOSING");
                    }
                }
            };

            this.recorder.onStop = () => {
                console.log('🛑 录音器已停止');
                this.isRecording = false;
                this.updateRecordingUI(false);
            };

            console.log('✅ 录音器初始化成功');
        } catch (error) {
            console.error('❌ 录音器初始化失败:', error);
            this.showToast('录音器初始化失败', 'error');
        }
    }

    // 获取WebSocket连接URL（包含签名认证）
    getWebSocketUrl() {
        if (!this.APPID || !this.API_KEY) {
            throw new Error('缺少必要的API密钥配置');
        }

        // 科大讯飞实时语音转写接口地址
        const url = "wss://rtasr.xfyun.cn/v1/ws";
        const appId = this.APPID;
        const secretKey = this.API_KEY;
        const ts = Math.floor(new Date().getTime() / 1000);
        
        // 生成签名
        const signa = hex_md5(appId + ts);
        const signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
        const signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(signatureSha));
        
        const wsUrl = `${url}?appid=${appId}&ts=${ts}&signa=${signature}`;
        console.log('🔗 科大讯飞WebSocket URL:', wsUrl);
        
        return wsUrl;
    }

    // 连接到科大讯飞服务
    async connect() {
        try {
            const websocketUrl = this.getWebSocketUrl();
            
            console.log('🔄 正在连接科大讯飞实时语音转写服务...');
            this.changeBtnStatus("CONNECTING");

            // 创建WebSocket连接
            if ("WebSocket" in window) {
                this.websocket = new WebSocket(websocketUrl);
            } else if ("MozWebSocket" in window) {
                this.websocket = new MozWebSocket(websocketUrl);
            } else {
                throw new Error('浏览器不支持WebSocket');
            }

            // 设置WebSocket事件处理
            this.websocket.onopen = (e) => {
                console.log('✅ 科大讯飞WebSocket连接成功');
                this.isConnected = true;
                
                // 连接成功后开始录音
                this.startRecording();
            };

            this.websocket.onmessage = (e) => {
                this.handleMessage(e.data);
            };

            this.websocket.onerror = (e) => {
                console.error('❌ 科大讯飞WebSocket连接错误:', e);
                this.handleError(e);
            };

            this.websocket.onclose = (e) => {
                console.log('🔌 科大讯飞WebSocket连接已关闭');
                this.isConnected = false;
                this.stopRecording();
                this.changeBtnStatus("CLOSED");
            };

        } catch (error) {
            console.error('❌ 连接科大讯飞服务失败:', error);
            this.showToast(`连接失败: ${error.message}`, 'error');
            this.changeBtnStatus("CLOSED");
        }
    }

    // 处理科大讯飞返回的消息
    handleMessage(data) {
        try {
            const jsonData = JSON.parse(data);
            console.log('📨 收到科大讯飞消息:', jsonData);

            if (jsonData.action == "started") {
                // 握手成功
                console.log('🤝 握手成功');
                this.showToast('科大讯飞服务连接成功', 'success');
                
            } else if (jsonData.action == "result") {
                // 转写结果
                const resultData = JSON.parse(jsonData.data);
                console.log('📝 转写结果:', resultData);
                
                this.processTranscriptionResult(resultData);
                
            } else if (jsonData.action == "error") {
                // 连接发生错误
                console.error('❌ 科大讯飞服务错误:', jsonData);
                this.showToast(`科大讯飞错误: ${jsonData.desc}`, 'error');
            }
        } catch (error) {
            console.error('❌ 处理消息失败:', error);
        }
    }

    // 处理转写结果
    processTranscriptionResult(data) {
        let resultTextTemp = "";
        
        // 解析科大讯飞的结果格式
        if (data.cn && data.cn.st && data.cn.st.rt) {
            data.cn.st.rt.forEach((sentence) => {
                sentence.ws.forEach((word) => {
                    word.cw.forEach((char) => {
                        resultTextTemp += char.w;
                    });
                });
            });
        }

        if (data.cn.st.type == 0) {
            // 最终识别结果
            this.resultText += resultTextTemp;
            this.resultTextTemp = "";
            console.log('✅ 最终结果:', resultTextTemp);
        } else {
            // 临时结果
            this.resultTextTemp = resultTextTemp;
            console.log('🔄 临时结果:', resultTextTemp);
        }

        // 更新显示
        this.updateTranscriptDisplay(this.resultText + this.resultTextTemp);
    }

    // 开始录音
    async startRecording() {
        if (!this.recorder) {
            console.error('❌ 录音器未初始化');
            this.showToast('录音器未初始化', 'error');
            return;
        }

        if (this.isRecording) {
            console.warn('⚠️ 已在录音中');
            return;
        }

        try {
            console.log('🎙️ 开始录音...');
            this.isRecording = true;
            
            // 清空之前的结果
            this.resultText = "";
            this.resultTextTemp = "";
            this.updateTranscriptDisplay("");
            
            // 开始录音，设置参数
            this.recorder.start({
                sampleRate: 16000,  // 采样率16kHz
                frameSize: 1280,    // 帧大小
            });
            
            this.updateRecordingUI(true);
            this.showToast('开始科大讯飞实时转录', 'success');
            
        } catch (error) {
            console.error('❌ 开始录音失败:', error);
            this.showToast(`录音失败: ${error.message}`, 'error');
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    // 停止录音
    stopRecording() {
        if (!this.isRecording || !this.recorder) {
            console.warn('❌ 未在录音中或录音器不可用');
            return;
        }

        console.log('🛑 停止录音...');
        
        try {
            this.recorder.stop();
        } catch (error) {
            console.error('❌ 停止录音失败:', error);
        }
        
        this.isRecording = false;
        this.disconnect();
    }

    // 切换录音状态
    toggleRecording() {
        if (this.btnStatus === "UNDEFINED" || this.btnStatus === "CLOSED") {
            this.connect();
        } else if (this.btnStatus === "CONNECTING" || this.btnStatus === "OPEN") {
            this.stopRecording();
        }
    }

    // 断开连接
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        this.changeBtnStatus("CLOSED");
    }

    // 改变按钮状态
    changeBtnStatus(status) {
        this.btnStatus = status;
        
        const startBtn = document.getElementById('xfyunStartBtn');
        const stopBtn = document.getElementById('xfyunStopBtn');
        
        if (startBtn && stopBtn) {
            switch (status) {
                case "CONNECTING":
                    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 连接中...';
                    startBtn.disabled = true;
                    stopBtn.style.display = 'none';
                    break;
                case "OPEN":
                    startBtn.style.display = 'none';
                    stopBtn.style.display = 'inline-flex';
                    stopBtn.innerHTML = '<i class="fas fa-stop"></i> 停止科大讯飞转录';
                    stopBtn.disabled = false;
                    break;
                case "CLOSING":
                    stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 停止中...';
                    stopBtn.disabled = true;
                    break;
                case "CLOSED":
                default:
                    startBtn.style.display = 'inline-flex';
                    startBtn.innerHTML = '<i class="fas fa-microphone"></i> 科大讯飞转录';
                    startBtn.disabled = false;
                    stopBtn.style.display = 'none';
                    break;
            }
        }
        
        this.updateRecordingUI(status === "OPEN");
    }

    // 更新录音UI
    updateRecordingUI(isRecording) {
        const transcriptionStatus = document.getElementById('transcriptionStatus');
        
        if (transcriptionStatus) {
            if (isRecording) {
                transcriptionStatus.innerHTML = '<i class="fas fa-circle text-red-500"></i> 科大讯飞实时转录中...';
                transcriptionStatus.style.display = 'block';
            } else {
                transcriptionStatus.style.display = 'none';
            }
        }
    }

    // 更新转录文本显示
    updateTranscriptDisplay(text) {
        // 更新实时转录结果显示区域
        const realtimeResults = document.getElementById('realtime-results');
        if (realtimeResults) {
            // 创建一个新的转录段落
            const transcriptItem = document.createElement('div');
            transcriptItem.className = 'transcript-item xfyun-result';
            transcriptItem.innerHTML = `
                <div class="transcript-header">
                    <span class="service-name">科大讯飞</span>
                    <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                </div>
                <div class="transcript-text">${text}</div>
            `;
            
            // 移除之前的科大讯飞结果，只保留最新的
            const existingXfyunResults = realtimeResults.querySelectorAll('.xfyun-result');
            existingXfyunResults.forEach(result => result.remove());
            
            // 添加新结果
            if (text.trim()) {
                realtimeResults.appendChild(transcriptItem);
                realtimeResults.scrollTop = realtimeResults.scrollHeight;
            }
        }
    }

    // 处理错误
    handleError(error) {
        console.error('❌ 科大讯飞服务错误:', error);
        this.showToast('科大讯飞服务连接错误', 'error');
        this.stopRecording();
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        console.log(`📢 ${message}`);
        
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            font-size: 14px;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // 检查SDK和依赖
    checkDependencies() {
        const dependencies = [
            'RecorderManager',
            'hex_md5',
            'CryptoJSNew',
            'CryptoJS'
        ];
        
        const missing = dependencies.filter(dep => typeof window[dep] === 'undefined');
        
        if (missing.length > 0) {
            console.error('❌ 缺少依赖:', missing);
            return false;
        }
        
        console.log('✅ 所有依赖已加载');
        return true;
    }

    // 获取状态信息
    getStatus() {
        return {
            isRecording: this.isRecording,
            isConnected: this.isConnected,
            btnStatus: this.btnStatus,
            hasApiKeys: !!(this.APPID && this.API_KEY),
            dependenciesLoaded: this.checkDependencies()
        };
    }
}

// 全局实例
if (typeof window !== 'undefined') {
    // 等待所有依赖加载完成后初始化
    window.addEventListener('load', () => {
        window.xfyunOfficialRTASR = new XfyunOfficialRTASR();
        
        // 暴露给全局使用的函数
        window.startXfyunTranscription = function() {
            if (window.xfyunOfficialRTASR.btnStatus === "UNDEFINED" || window.xfyunOfficialRTASR.btnStatus === "CLOSED") {
                window.xfyunOfficialRTASR.connect();
            }
        };

        window.stopXfyunTranscription = function() {
            if (window.xfyunOfficialRTASR.btnStatus === "CONNECTING" || window.xfyunOfficialRTASR.btnStatus === "OPEN") {
                window.xfyunOfficialRTASR.stopRecording();
            }
        };

        window.toggleXfyunTranscription = function() {
            window.xfyunOfficialRTASR.toggleRecording();
        };

        window.getXfyunTranscriptionStatus = function() {
            return window.xfyunOfficialRTASR.getStatus();
        };

        window.debugXfyunConnection = function() {
            console.log('🔧 科大讯飞官方RTASR连接调试信息:');
            const status = window.xfyunOfficialRTASR.getStatus();
            console.log('- 状态:', status);
            console.log('- 录音器:', window.xfyunOfficialRTASR.recorder);
            console.log('- WebSocket:', window.xfyunOfficialRTASR.websocket);
            
            return status;
        };

        console.log('🏭 科大讯飞官方RTASR模块已加载');
        console.log('💡 使用 debugXfyunConnection() 查看详细信息');
    });
}

// 导出类（用于模块化环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XfyunOfficialRTASR;
}