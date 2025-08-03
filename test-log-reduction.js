#!/usr/bin/env node

/**
 * 日志减少测试脚本
 * 用于验证语音通话日志优化效果
 */

const io = require('socket.io-client');

class LogReductionTester {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.testCount = 0;
        this.maxTests = 3;
        this.logMessages = [];
    }
    
    async testLogReduction() {
        console.log('🔍 开始日志减少测试...');
        console.log(`目标服务器: ${this.serverUrl}`);
        console.log(`测试次数: ${this.maxTests}`);
        console.log('=' * 50);
        
        // 捕获控制台输出
        const originalLog = console.log;
        console.log = (...args) => {
            const message = args.join(' ');
            this.logMessages.push(message);
            originalLog.apply(console, args);
        };
        
        for (let i = 0; i < this.maxTests; i++) {
            await this.testCallEndEvent(i + 1);
            await this.sleep(1000); // 1秒间隔
        }
        
        // 恢复原始console.log
        console.log = originalLog;
        
        console.log('\n✅ 日志减少测试完成');
        console.log(`总测试次数: ${this.testCount}`);
        
        // 分析日志
        this.analyzeLogMessages();
    }
    
    analyzeLogMessages() {
        console.log('\n📊 日志分析结果:');
        
        const voiceCallLogs = this.logMessages.filter(msg => 
            msg.includes('📞') && msg.includes('用户') && msg.includes('语音通话')
        );
        
        const endCallLogs = this.logMessages.filter(msg => 
            msg.includes('📞') && msg.includes('结束') && msg.includes('通话')
        );
        
        console.log(`总日志消息数: ${this.logMessages.length}`);
        console.log(`语音通话相关日志数: ${voiceCallLogs.length}`);
        console.log(`"结束通话"日志数: ${endCallLogs.length}`);
        
        if (endCallLogs.length > 0) {
            console.log('\n⚠️ 仍然有"结束通话"日志输出:');
            endCallLogs.forEach((log, index) => {
                console.log(`  ${index + 1}. ${log}`);
            });
        } else {
            console.log('\n✅ 没有发现"结束通话"日志，优化成功！');
        }
        
        if (voiceCallLogs.length > this.maxTests * 2) {
            console.log('\n⚠️ 语音通话日志数量仍然较多，可能需要进一步优化');
        } else {
            console.log('\n✅ 语音通话日志数量在合理范围内');
        }
    }
    
    async testCallEndEvent(testNumber) {
        return new Promise((resolve) => {
            console.log(`\n📞 测试 #${testNumber}: 模拟通话结束事件...`);
            
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
                
                // 加入房间
                this.socket.emit('joinRoom', {
                    roomId: 'test-room',
                    userId: `test-user-${testNumber}`,
                    username: `TestUser${testNumber}`
                });
                
                // 等待一下然后发送callEnd事件
                setTimeout(() => {
                    this.socket.emit('callEnd', {
                        roomId: 'test-room',
                        userId: `test-user-${testNumber}`
                    });
                    
                    console.log(`📞 发送callEnd事件 #${testNumber}`);
                    
                    // 延迟断开连接
                    setTimeout(() => {
                        this.socket.disconnect();
                        resolve();
                    }, 500);
                }, 500);
            });
            
            this.socket.on('connect_error', (error) => {
                const duration = Date.now() - startTime;
                console.log(`❌ 连接失败 #${testNumber} (耗时: ${duration}ms):`, error.message);
                resolve();
            });
            
            this.socket.on('error', (error) => {
                console.log(`⚠️ Socket错误 #${testNumber}:`, error.message);
            });
            
            // 监听callEnd事件
            this.socket.on('callEnd', (data) => {
                console.log(`📞 收到callEnd事件 #${testNumber}:`, data);
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
    const tester = new LogReductionTester(serverUrl);
    
    tester.testLogReduction().then(() => {
        console.log('\n🎯 测试完成！');
        console.log('如果仍然看到大量"用户结束语音通话"日志，请检查:');
        console.log('1. Railway环境变量LOG_LEVEL是否设置为"error"');
        console.log('2. 代码是否正确部署');
        console.log('3. 是否还有其他代码位置输出类似日志');
        process.exit(0);
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = LogReductionTester;