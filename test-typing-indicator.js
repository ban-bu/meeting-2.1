#!/usr/bin/env node

/**
 * 输入状态侦测测试脚本
 * 用于测试输入状态优化的效果
 */

const io = require('socket.io-client');

class TypingIndicatorTester {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.testCount = 0;
        this.maxTests = 5;
        this.typingEvents = [];
    }
    
    async testTypingIndicator() {
        console.log('⌨️ 开始输入状态侦测测试...');
        console.log(`目标服务器: ${this.serverUrl}`);
        console.log(`测试次数: ${this.maxTests}`);
        console.log('=' * 50);
        
        for (let i = 0; i < this.maxTests; i++) {
            await this.testTypingEvent(i + 1);
            await this.sleep(2000); // 2秒间隔
        }
        
        console.log('\n✅ 输入状态侦测测试完成');
        console.log(`总测试次数: ${this.testCount}`);
        
        // 分析结果
        this.analyzeTypingEvents();
    }
    
    analyzeTypingEvents() {
        console.log('\n📊 输入状态分析结果:');
        
        const startEvents = this.typingEvents.filter(event => event.type === 'start');
        const stopEvents = this.typingEvents.filter(event => event.type === 'stop');
        
        console.log(`开始输入事件数: ${startEvents.length}`);
        console.log(`停止输入事件数: ${stopEvents.length}`);
        
        // 检查是否有过于频繁的事件
        const frequentEvents = this.typingEvents.filter((event, index) => {
            if (index === 0) return false;
            const prevEvent = this.typingEvents[index - 1];
            return event.type === prevEvent.type && 
                   (event.timestamp - prevEvent.timestamp) < 1000; // 1秒内重复事件
        });
        
        if (frequentEvents.length > 0) {
            console.log(`\n⚠️ 发现 ${frequentEvents.length} 个过于频繁的事件:`);
            frequentEvents.forEach((event, index) => {
                console.log(`  ${index + 1}. ${event.type} at ${new Date(event.timestamp).toLocaleTimeString()}`);
            });
        } else {
            console.log('\n✅ 没有发现过于频繁的输入状态事件');
        }
        
        // 检查事件间隔
        const intervals = [];
        for (let i = 1; i < this.typingEvents.length; i++) {
            const interval = this.typingEvents[i].timestamp - this.typingEvents[i-1].timestamp;
            intervals.push(interval);
        }
        
        if (intervals.length > 0) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            console.log(`\n📈 平均事件间隔: ${Math.round(avgInterval)}ms`);
            
            const shortIntervals = intervals.filter(interval => interval < 500);
            if (shortIntervals.length > 0) {
                console.log(`⚠️ 发现 ${shortIntervals.length} 个间隔小于500ms的事件`);
            } else {
                console.log('✅ 所有事件间隔都在合理范围内');
            }
        }
    }
    
    async testTypingEvent(testNumber) {
        return new Promise((resolve) => {
            console.log(`\n⌨️ 测试 #${testNumber}: 模拟输入状态变化...`);
            
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
                
                // 模拟输入状态变化
                setTimeout(() => {
                    // 开始输入
                    this.socket.emit('typing', {
                        roomId: 'test-room',
                        userId: `test-user-${testNumber}`,
                        username: `TestUser${testNumber}`,
                        isTyping: true
                    });
                    
                    this.typingEvents.push({
                        type: 'start',
                        timestamp: Date.now(),
                        testNumber
                    });
                    
                    console.log(`⌨️ 发送开始输入事件 #${testNumber}`);
                    
                    // 2秒后停止输入
                    setTimeout(() => {
                        this.socket.emit('typing', {
                            roomId: 'test-room',
                            userId: `test-user-${testNumber}`,
                            username: `TestUser${testNumber}`,
                            isTyping: false
                        });
                        
                        this.typingEvents.push({
                            type: 'stop',
                            timestamp: Date.now(),
                            testNumber
                        });
                        
                        console.log(`⌨️ 发送停止输入事件 #${testNumber}`);
                        
                        // 延迟断开连接
                        setTimeout(() => {
                            this.socket.disconnect();
                            resolve();
                        }, 500);
                    }, 2000);
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
            
            // 监听输入状态事件
            this.socket.on('userTyping', (data) => {
                console.log(`⌨️ 收到输入状态事件 #${testNumber}:`, data);
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
    const tester = new TypingIndicatorTester(serverUrl);
    
    tester.testTypingIndicator().then(() => {
        console.log('\n🎯 测试完成！');
        console.log('优化效果检查:');
        console.log('1. 输入状态变化是否平滑，无闪烁');
        console.log('2. 输入法状态变化是否被正确处理');
        console.log('3. 事件频率是否在合理范围内');
        process.exit(0);
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = TypingIndicatorTester; 