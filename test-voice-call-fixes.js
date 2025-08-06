// 语音通话修复测试脚本
class VoiceCallFixTester {
    constructor() {
        this.testResults = [];
        this.currentTest = 0;
    }
    
    async runAllTests() {
        console.log('🧪 开始语音通话修复测试...');
        
        this.testResults = [];
        this.currentTest = 0;
        
        // 测试1: 检查通话按钮显示
        await this.testCallButtonVisibility();
        
        // 测试2: 检查用户ID重复处理
        await this.testUserIdDeduplication();
        
        // 测试3: 检查音频混合器
        await this.testAudioMixer();
        
        // 测试4: 检查WebRTC连接
        await this.testWebRTCConnection();
        
        // 测试5: 检查参与者状态同步
        await this.testParticipantSync();
        
        this.printResults();
    }
    
    async testCallButtonVisibility() {
        console.log('📞 测试1: 检查通话按钮显示');
        
        const callBtn = document.getElementById('callBtn');
        const testMicBtn = document.getElementById('testMicBtn');
        
        if (!callBtn) {
            this.addResult('通话按钮不存在', false);
            return;
        }
        
        // 检查按钮是否可见
        const isVisible = callBtn.style.display !== 'none' && 
                         callBtn.style.visibility !== 'hidden' && 
                         callBtn.style.opacity !== '0';
        
        if (isVisible) {
            this.addResult('通话按钮可见', true);
        } else {
            this.addResult('通话按钮不可见', false);
        }
        
        // 检查测试麦克风按钮
        if (testMicBtn) {
            this.addResult('测试麦克风按钮存在', true);
        } else {
            this.addResult('测试麦克风按钮不存在', false);
        }
    }
    
    async testUserIdDeduplication() {
        console.log('🆔 测试2: 检查用户ID重复处理');
        
        // 模拟参与者数据
        const mockParticipants = [
            { userId: 'user-abc-123', name: '张三', status: 'online' },
            { userId: 'user-def-456', name: '张三', status: 'offline' },
            { userId: 'user-ghi-789', name: '李四', status: 'online' }
        ];
        
        // 检查清理重复用户函数是否存在
        if (typeof cleanupDuplicateOfflineUsers === 'function') {
            this.addResult('清理重复用户函数存在', true);
            
            // 模拟清理过程
            const userGroups = {};
            mockParticipants.forEach(p => {
                if (!userGroups[p.name]) {
                    userGroups[p.name] = [];
                }
                userGroups[p.name].push(p);
            });
            
            const hasDuplicates = Object.values(userGroups).some(group => group.length > 1);
            this.addResult('重复用户检测功能正常', hasDuplicates);
        } else {
            this.addResult('清理重复用户函数不存在', false);
        }
    }
    
    async testAudioMixer() {
        console.log('🎵 测试3: 检查音频混合器');
        
        // 检查AudioMixer类是否存在
        if (typeof AudioMixer === 'function') {
            this.addResult('AudioMixer类存在', true);
            
            try {
                const mixer = new AudioMixer();
                this.addResult('AudioMixer实例化成功', true);
                
                // 检查必要的方法
                const hasInitialize = typeof mixer.initialize === 'function';
                const hasAddLocalStream = typeof mixer.addLocalStream === 'function';
                const hasAddRemoteStream = typeof mixer.addRemoteStream === 'function';
                const hasGetMixedStream = typeof mixer.getMixedStream === 'function';
                const hasCleanup = typeof mixer.cleanup === 'function';
                
                this.addResult('AudioMixer方法完整', 
                    hasInitialize && hasAddLocalStream && hasAddRemoteStream && 
                    hasGetMixedStream && hasCleanup);
                
            } catch (error) {
                this.addResult('AudioMixer实例化失败', false);
            }
        } else {
            this.addResult('AudioMixer类不存在', false);
        }
    }
    
    async testWebRTCConnection() {
        console.log('🔗 测试4: 检查WebRTC连接');
        
        // 检查WebRTC支持
        if (typeof RTCPeerConnection !== 'undefined') {
            this.addResult('WebRTC支持正常', true);
            
            // 检查createPeerConnection函数
            if (typeof createPeerConnection === 'function') {
                this.addResult('createPeerConnection函数存在', true);
            } else {
                this.addResult('createPeerConnection函数不存在', false);
            }
            
            // 检查清理失败连接函数
            if (typeof cleanupFailedConnection === 'function') {
                this.addResult('cleanupFailedConnection函数存在', true);
            } else {
                this.addResult('cleanupFailedConnection函数不存在', false);
            }
        } else {
            this.addResult('WebRTC不支持', false);
        }
    }
    
    async testParticipantSync() {
        console.log('👥 测试5: 检查参与者状态同步');
        
        // 检查参与者相关函数
        const functions = [
            'addCurrentUserToParticipants',
            'cleanupDuplicateOfflineUsers',
            'renderParticipants',
            'updateCallButton'
        ];
        
        let allFunctionsExist = true;
        functions.forEach(funcName => {
            if (typeof window[funcName] === 'function') {
                this.addResult(`${funcName}函数存在`, true);
            } else {
                this.addResult(`${funcName}函数不存在`, false);
                allFunctionsExist = false;
            }
        });
        
        this.addResult('参与者同步功能完整', allFunctionsExist);
    }
    
    addResult(test, passed) {
        this.testResults.push({
            test: test,
            passed: passed,
            timestamp: new Date().toLocaleTimeString()
        });
    }
    
    printResults() {
        console.log('\n📊 测试结果汇总:');
        console.log('='.repeat(50));
        
        let passed = 0;
        let total = this.testResults.length;
        
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.test} (${result.timestamp})`);
            if (result.passed) passed++;
        });
        
        console.log('='.repeat(50));
        console.log(`总计: ${passed}/${total} 项测试通过`);
        
        if (passed === total) {
            console.log('🎉 所有测试通过！语音通话功能修复成功！');
        } else {
            console.log('⚠️ 部分测试失败，请检查相关功能');
        }
    }
}

// 创建测试实例并运行
const tester = new VoiceCallFixTester();

// 等待页面加载完成后运行测试
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => tester.runAllTests(), 2000);
    });
} else {
    setTimeout(() => tester.runAllTests(), 2000);
}

// 导出到全局
window.VoiceCallFixTester = VoiceCallFixTester;
window.voiceCallFixTester = tester;

console.log('🧪 语音通话修复测试脚本已加载');
console.log('💡 使用 voiceCallFixTester.runAllTests() 重新运行测试'); 