#!/usr/bin/env node

/**
 * 语音通话日志测试脚本
 * 用于测试语音通话相关日志的优化效果
 */

const io = require('socket.io-client');

class VoiceCallTester {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.testCount = 0;
        this.maxTests = 5;
    }
    
    async testVoiceCallLogs() {
        console.log('📞 开始语音通话日志测试...');
        console.log(`目标服务器: ${this.serverUrl}`);
        console.log(`测试次数: ${this.maxTests}`);
        console.log('=' * 50);
        
        for (let i = 0; i < this.maxTests; i++) {
            await this.testCallEndEvent(i + 1);
            await this.sleep(2000); // 2秒间隔
        }
        
        console.log('\n✅ 语音通话日志测试完成');
        console.log(`总测试次数: ${this.testCount}`);
    }
    
    async testCallEndEvent(testNumber) {
        return new Promise((resolve) => {
            console.log(`\n📞 测试语音通话结束事件 #${testNumber}...`);
            
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: false
            });
            
            const startTime = Date.now();
            
            this.socket.on('connect', () => {
                const duration = Date.now() - startTime;
                console.log(`✅ 连接成功 #${testNumber} (耗时: ${duration}ms)`);
                this.testCount++;
                
                // 模拟发送callEnd事件
                this.socket.emit('callEnd', {
                    roomId: 'test-room',
                    userId: `test-user-${testNumber}`
                });
                
                console.log(`📞 发送callEnd事件 #${testNumber}`);
                
                // 延迟断开连接
                setTimeout(() => {
                    this.socket.disconnect();
                    resolve();
                }, 1000);
            });
            
            this.socket.on('connect_error', (error) => {
                const duration = Date.now() - startTime;
                console.log(`❌ 连接失败 #${testNumber} (耗时: ${duration}ms):`, error.message);
                resolve();
            });
            
            this.socket.on('error', (error) => {
                console.log(`⚠️ Socket错误 #${testNumber}:`, error.message);
            });
            
            // 设置超时
            setTimeout(() => {
                if (this.socket && !this.socket.connected) {
                    console.log(`⏰ 连接超时 #${testNumber}`);
                    this.socket.disconnect();
                    resolve();
                }
            }, 15000);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用示例
if (require.main === module) {
    const serverUrl = process.argv[2] || 'http://localhost:3001';
    const tester = new VoiceCallTester(serverUrl);
    
    tester.testVoiceCallLogs().then(() => {
        console.log('\n🎯 测试完成，检查服务器日志以验证语音通话日志优化情况');
        console.log('预期结果: 语音通话相关日志应该减少，不再出现重复的"用户结束语音通话"消息');
        process.exit(0);
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = VoiceCallTester; 