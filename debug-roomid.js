// 调试房间ID获取的测试脚本
// 在浏览器控制台中运行此脚本来测试房间ID获取功能

console.log('=== 房间ID调试信息 ===');

// 1. 检查全局变量
console.log('1. 全局变量:');
console.log('  window.roomId:', window.roomId);
console.log('  roomId (如果存在):', typeof roomId !== 'undefined' ? roomId : '未定义');

// 2. 检查URL参数
console.log('2. URL参数:');
const urlParams = new URLSearchParams(window.location.search);
const urlRoomId = urlParams.get('room');
console.log('  URL中的room参数:', urlRoomId);

// 3. 检查DOM元素
console.log('3. DOM元素:');
const roomIdElement = document.getElementById('roomId');
if (roomIdElement) {
    const textContent = roomIdElement.textContent || roomIdElement.innerText;
    console.log('  roomId元素内容:', textContent);
    const match = textContent.match(/房间: (.+)/);
    console.log('  提取的房间ID:', match ? match[1] : '未匹配');
} else {
    console.log('  roomId元素不存在');
}

// 4. 检查realtime client
console.log('4. Realtime Client:');
if (window.realtimeClient) {
    console.log('  realtimeClient存在');
    console.log('  realtimeClient.currentRoomId:', window.realtimeClient.currentRoomId);
} else {
    console.log('  realtimeClient不存在');
}

// 5. 检查转录客户端
console.log('5. 转录客户端:');
if (window.transcriptionClient) {
    console.log('  transcriptionClient存在');
    console.log('  transcriptionClient.currentRoomId:', window.transcriptionClient.currentRoomId);
    
    // 测试getCurrentRoomId方法
    if (typeof window.transcriptionClient.getCurrentRoomId === 'function') {
        const roomId = window.transcriptionClient.getCurrentRoomId();
        console.log('  getCurrentRoomId()返回:', roomId);
    } else {
        console.log('  getCurrentRoomId方法不存在');
    }
} else {
    console.log('  transcriptionClient不存在');
}

// 6. 测试转录功能
console.log('6. 转录功能测试:');
if (window.transcriptionClient) {
    console.log('  isStreamingMode:', window.transcriptionClient.isStreamingMode);
    console.log('  isRecording:', window.transcriptionClient.isRecording);
    
    // 尝试获取房间ID
    try {
        const roomId = window.transcriptionClient.getCurrentRoomId();
        if (roomId) {
            console.log('  ✅ 房间ID获取成功:', roomId);
        } else {
            console.log('  ❌ 房间ID获取失败');
        }
    } catch (error) {
        console.log('  ❌ 房间ID获取出错:', error.message);
    }
}

console.log('=== 调试完成 ===');

// 提供手动测试函数
window.testTranscription = function() {
    console.log('开始手动测试转录功能...');
    if (window.transcriptionClient && typeof window.transcriptionClient.toggleRecording === 'function') {
        try {
            window.transcriptionClient.toggleRecording();
            console.log('✅ toggleRecording调用成功');
        } catch (error) {
            console.error('❌ toggleRecording调用失败:', error);
        }
    } else {
        console.error('❌ 转录客户端或toggleRecording方法不存在');
    }
};

console.log('💡 提示: 运行 testTranscription() 来手动测试转录功能');