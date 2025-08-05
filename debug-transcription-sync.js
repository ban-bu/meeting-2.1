// 转录同步调试脚本
// 在浏览器控制台中运行此脚本来诊断转录同步问题

window.debugTranscriptionSync = function() {
    console.log('🔧 开始转录同步调试...');
    console.log('================================');
    
    // 1. 检查基本组件
    console.log('📋 基本组件检查:');
    console.log('- realtimeClient存在:', !!window.realtimeClient);
    console.log('- realtimeClient连接状态:', window.realtimeClient?.isConnected);
    console.log('- Socket连接状态:', window.realtimeClient?.socket?.connected);
    console.log('- xfyunClient存在:', !!window.xfyunOfficialRTASR);
    console.log('- roomId:', typeof roomId !== 'undefined' ? roomId : '未定义');
    console.log('- currentUserId:', typeof currentUserId !== 'undefined' ? currentUserId : '未定义');
    console.log('- currentUsername:', typeof currentUsername !== 'undefined' ? currentUsername : '未定义');
    
    // 2. 检查事件处理器
    console.log('\n📝 事件处理器检查:');
    console.log('- onTranscriptionResult存在:', !!window.realtimeClient?.onTranscriptionResult);
    console.log('- onTranscriptionStatusChange存在:', !!window.realtimeClient?.onTranscriptionStatusChange);
    console.log('- handleTranscriptionResult函数存在:', typeof handleTranscriptionResult === 'function');
    console.log('- displayTranscriptionResult函数存在:', typeof displayTranscriptionResult === 'function');
    
    // 3. 检查DOM元素
    console.log('\n🖼️ DOM元素检查:');
    const transcriptionHistory = document.getElementById('transcriptionHistory');
    console.log('- transcriptionHistory存在:', !!transcriptionHistory);
    const cumulativeDiv = document.getElementById('cumulativeTranscription');
    console.log('- cumulativeTranscription存在:', !!cumulativeDiv);
    
    // 4. 测试发送转录结果
    console.log('\n📡 测试发送转录结果:');
    if (window.realtimeClient && window.realtimeClient.isConnected) {
        const testData = {
            roomId: roomId,
            userId: currentUserId,
            username: currentUsername,
            result: '测试转录结果',
            isPartial: false,
            timestamp: new Date().toISOString()
        };
        
        console.log('发送测试数据:', testData);
        const result = window.realtimeClient.sendXfyunTranscriptionResult(testData);
        console.log('发送结果:', result);
    } else {
        console.log('❌ 无法测试发送 - 实时客户端未连接');
    }
    
    // 5. 检查服务器连接
    console.log('\n🌐 服务器连接检查:');
    if (window.realtimeClient && window.realtimeClient.socket) {
        console.log('- Socket ID:', window.realtimeClient.socket.id);
        console.log('- 传输方式:', window.realtimeClient.socket.io?.engine?.transport?.name);
        console.log('- 连接的房间:', Array.from(window.realtimeClient.socket.rooms || []));
    }
    
    console.log('\n================================');
    console.log('🔧 调试完成！');
};

// 监听转录相关事件
window.monitorTranscriptionEvents = function() {
    console.log('👁️ 开始监听转录事件...');
    
    // 监听Socket.IO事件
    if (window.realtimeClient && window.realtimeClient.socket) {
        const originalEmit = window.realtimeClient.socket.emit;
        window.realtimeClient.socket.emit = function(eventName, data) {
            if (eventName.includes('Transcription') || eventName.includes('transcription')) {
                console.log(`📤 发送事件: ${eventName}`, data);
            }
            return originalEmit.apply(this, arguments);
        };
        
        // 监听接收事件
        window.realtimeClient.socket.on('transcriptionResult', (data) => {
            console.log('📥 接收到 transcriptionResult 事件:', data);
        });
        
        window.realtimeClient.socket.on('transcriptionStatusChange', (data) => {
            console.log('📥 接收到 transcriptionStatusChange 事件:', data);
        });
        
        console.log('✅ 事件监听器已设置');
    } else {
        console.log('❌ 无法设置监听器 - Socket未连接');
    }
};

// 手动触发转录结果显示测试
window.testDisplayTranscriptionResult = function(testResult = '手动测试转录结果') {
    console.log('🧪 测试显示转录结果...');
    
    const testData = {
        type: 'xfyun',
        userId: currentUserId || 'test-user',
        username: currentUsername || '测试用户',
        result: testResult,
        isPartial: false,
        timestamp: new Date().toISOString(),
        roomId: roomId || 'test-room'
    };
    
    console.log('测试数据:', testData);
    
    if (typeof displayTranscriptionResult === 'function') {
        displayTranscriptionResult(testData);
        console.log('✅ 转录结果显示测试完成');
    } else {
        console.log('❌ displayTranscriptionResult函数不存在');
    }
};

console.log('🔧 转录同步调试工具已加载！');
console.log('使用方法:');
console.log('- debugTranscriptionSync() - 全面诊断');
console.log('- monitorTranscriptionEvents() - 监听事件');
console.log('- testDisplayTranscriptionResult() - 测试显示');