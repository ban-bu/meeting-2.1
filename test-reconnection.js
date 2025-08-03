#!/usr/bin/env node

/**
 * 重连测试脚本
 * 用于测试客户端重连逻辑的优化效果
 */

const io = require('socket.io-client');

class ReconnectionTester {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.connectionCount = 0;
        this.maxConnections = 10;
        this.connectionDelay = 3000; // 3秒间隔
    }
    
    async testReconnection() {
        console.log('🔍 开始重连测试...');
        console.log(`目标服务器: ${this.serverUrl}`);
        console.log(`最大连接数: ${this.maxConnections}`);
        console.log(`连接间隔: ${this.connectionDelay}ms`);
        console.log('=' * 50);
        
        for (let i = 0; i < this.maxConnections; i++) {
            await this.createConnection(i + 1);
            await this.sleep(this.connectionDelay);
        }
        
        console.log('\n✅ 重连测试完成');
        console.log(`总连接次数: ${this.connectionCount}`);
    }
    
    async createConnection(attemptNumber) {
        return new Promise((resolve) => {
            console.log(`\n📡 尝试连接 #${attemptNumber}...`);
            
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: false
            });
            
            const startTime = Date.now();
            
            this.socket.on('connect', () => {
                const duration = Date.now() - startTime;
                console.log(`✅ 连接成功 #${attemptNumber} (耗时: ${duration}ms)`);
                this.connectionCount++;
                
                // 发送测试消息
                this.socket.emit('joinRoom', {
                    roomId: 'test-room',
                    userId: `test-user-${attemptNumber}`,
                    username: `TestUser${attemptNumber}`
                });
                
                // 延迟断开连接
                setTimeout(() => {
                    this.socket.disconnect();
                    resolve();
                }, 1000);
            });
            
            this.socket.on('connect_error', (error) => {
                const duration = Date.now() - startTime;
                console.log(`❌ 连接失败 #${attemptNumber} (耗时: ${duration}ms):`, error.message);
                resolve();
            });
            
            this.socket.on('error', (error) => {
                console.log(`⚠️ Socket错误 #${attemptNumber}:`, error.message);
            });
            
            // 设置超时
            setTimeout(() => {
                if (this.socket && !this.socket.connected) {
                    console.log(`⏰ 连接超时 #${attemptNumber}`);
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
    const tester = new ReconnectionTester(serverUrl);
    
    tester.testReconnection().then(() => {
        console.log('\n🎯 测试完成，检查服务器日志以验证速率限制情况');
        process.exit(0);
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = ReconnectionTester; 