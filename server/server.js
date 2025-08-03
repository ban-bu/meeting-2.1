const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const fileUpload = require('express-fileupload');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// 速率限制器 - 调整为更宽松的设置，适应Railway环境
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'middleware',
    points: 5000, // 允许的请求次数 - 进一步增加到5000
    duration: 900, // 15分钟
    blockDuration: 120, // 被阻止后2分钟才能重试
});

// 日志控制 - 减少不必要的日志输出
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

const logger = {
    info: (message) => {
        if (logLevel === 'info' || logLevel === 'debug') {
            console.log(`[INFO] ${message}`);
        }
    },
    warn: (message) => {
        if (logLevel === 'warn' || logLevel === 'info' || logLevel === 'debug') {
            console.warn(`[WARN] ${message}`);
        }
    },
    error: (message) => {
        console.error(`[ERROR] ${message}`);
    },
    debug: (message) => {
        if (logLevel === 'debug') {
            console.log(`[DEBUG] ${message}`);
        }
    }
};

// 中间件配置
app.use(helmet({
    contentSecurityPolicy: false // 允许内联脚本，适配前端需求
}));
app.use(compression());

// 动态CORS配置，支持Railway部署
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'https://*.railway.app',
    'https://*.up.railway.app'
];

app.use(cors({
    origin: (origin, callback) => {
        // 允许没有origin的请求（如移动应用）
        if (!origin) return callback(null, true);
        
        // 如果设置为*，允许所有来源
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        
        // 检查是否在允许列表中
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
                const regex = new RegExp(allowedOrigin.replace(/\*/g, '.*'));
                return regex.test(origin);
            }
            return allowedOrigin === origin;
        });
        
        if (isAllowed || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logger.warn('CORS blocked origin: ' + origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 文件上传中间件
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// 静态文件服务 - 为Railway部署提供前端文件
app.use(express.static('./', {
    index: 'index.html',
    setHeaders: (res, path) => {
        // 设置缓存头
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天
        }
    }
}));

// Socket.IO配置
const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            // 允许没有origin的请求
            if (!origin) return callback(null, true);
            
            const isAllowed = allowedOrigins.some(allowedOrigin => {
                if (allowedOrigin.includes('*')) {
                    const regex = new RegExp(allowedOrigin.replace('*', '.*'));
                    return regex.test(origin);
                }
                return allowedOrigin === origin;
            });
            
            if (isAllowed || process.env.NODE_ENV === 'development') {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    maxHttpBufferSize: 1e7, // 10MB
    transports: ['websocket', 'polling'], // 支持多种传输方式
    allowEIO3: true // 向后兼容
});

// MongoDB连接
const connectDB = async () => {
    try {
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
            logger.info('MongoDB 连接成功');
        } else {
            logger.info('未配置数据库，使用内存存储');
        }
    } catch (error) {
        logger.error('MongoDB 连接失败: ' + error.message);
        logger.info('降级到内存存储模式');
    }
};

// 数据模型
const messageSchema = new mongoose.Schema({
    roomId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    text: String,
    author: { type: String, required: true },
    userId: { type: String, required: true },
    time: { type: String, required: true },
    file: {
        name: String,
        size: String,
        type: String,
        url: String
    },
    originalFile: String,
    isAIQuestion: { type: Boolean, default: false }, // AI问题标记
    originUserId: String, // AI回复的触发用户ID
    timestamp: { type: Date, default: Date.now, expires: '30d' } // 30天后自动删除
});

const participantSchema = new mongoose.Schema({
    roomId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, default: 'online' },
    joinTime: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    socketId: String
});

const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    participantCount: { type: Number, default: 0 },
    creatorId: { type: String, required: true }, // 房间创建者ID
    creatorName: { type: String, required: true }, // 房间创建者姓名
    settings: {
        maxParticipants: { type: Number, default: 50 },
        allowFileUpload: { type: Boolean, default: true },
        aiEnabled: { type: Boolean, default: true }
    }
});

// 创建索引以提高查询性能
messageSchema.index({ roomId: 1, timestamp: -1 });
participantSchema.index({ roomId: 1, userId: 1 }, { unique: true });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Participant = mongoose.models.Participant || mongoose.model('Participant', participantSchema);
const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);

// 内存存储（数据库不可用时的降级方案）
const memoryStorage = {
    rooms: new Map(), // roomId -> { messages: [], participants: Map(), roomInfo: {} }
    
    getRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                messages: [],
                participants: new Map(),
                roomInfo: null // 房间信息（包含创建者）
            });
        }
        return this.rooms.get(roomId);
    },
    
    setRoomInfo(roomId, roomInfo) {
        const room = this.getRoom(roomId);
        room.roomInfo = roomInfo;
    },
    
    getRoomInfo(roomId) {
        const room = this.getRoom(roomId);
        return room.roomInfo;
    },
    
    addMessage(roomId, message) {
        const room = this.getRoom(roomId);
        room.messages.push(message);
        // 限制消息数量，避免内存溢出
        if (room.messages.length > 1000) {
            room.messages = room.messages.slice(-800);
        }
        return message;
    },
    
    getMessages(roomId, limit = 50) {
        const room = this.getRoom(roomId);
        return room.messages.slice(-limit);
    },
    
    addParticipant(roomId, participant) {
        const room = this.getRoom(roomId);
        room.participants.set(participant.userId, participant);
        return participant;
    },
    
    updateParticipant(roomId, userId, updates) {
        const room = this.getRoom(roomId);
        const participant = room.participants.get(userId);
        if (participant) {
            Object.assign(participant, updates);
        }
        return participant;
    },
    
    removeParticipant(roomId, userId) {
        const room = this.getRoom(roomId);
        return room.participants.delete(userId);
    },
    
    getParticipants(roomId) {
        const room = this.getRoom(roomId);
        return Array.from(room.participants.values());
    },
    
    findParticipantBySocketId(socketId) {
        for (const [roomId, room] of this.rooms) {
            for (const [userId, participant] of room.participants) {
                if (participant.socketId === socketId) {
                    return { ...participant, roomId };
                }
            }
        }
        return null;
    }
};

// 数据访问层
const dataService = {
    async saveMessage(messageData) {
        try {
            if (mongoose.connection.readyState === 1) {
                const message = new Message(messageData);
                await message.save();
                return message.toObject();
            } else {
                return memoryStorage.addMessage(messageData.roomId, messageData);
            }
        } catch (error) {
            logger.error('保存消息失败: ' + error.message);
            return memoryStorage.addMessage(messageData.roomId, messageData);
        }
    },
    
    async getMessages(roomId, limit = 50) {
        try {
            if (mongoose.connection.readyState === 1) {
                const messages = await Message
                    .find({ roomId })
                    .sort({ timestamp: -1 })
                    .limit(limit)
                    .lean();
                return messages.reverse();
            } else {
                return memoryStorage.getMessages(roomId, limit);
            }
        } catch (error) {
            logger.error('获取消息失败: ' + error.message);
            return memoryStorage.getMessages(roomId, limit);
        }
    },
    
    async saveParticipant(participantData) {
        try {
            if (mongoose.connection.readyState === 1) {
                const participant = await Participant.findOneAndUpdate(
                    { roomId: participantData.roomId, userId: participantData.userId },
                    participantData,
                    { upsert: true, new: true }
                );
                return participant.toObject();
            } else {
                return memoryStorage.addParticipant(participantData.roomId, participantData);
            }
        } catch (error) {
            logger.error('保存参与者失败: ' + error.message);
            return memoryStorage.addParticipant(participantData.roomId, participantData);
        }
    },
    
    async updateParticipant(roomId, userId, updates) {
        try {
            if (mongoose.connection.readyState === 1) {
                const participant = await Participant.findOneAndUpdate(
                    { roomId, userId },
                    { ...updates, lastSeen: new Date() },
                    { new: true }
                );
                return participant?.toObject();
            } else {
                return memoryStorage.updateParticipant(roomId, userId, { ...updates, lastSeen: new Date() });
            }
        } catch (error) {
            logger.error('更新参与者失败: ' + error.message);
            return memoryStorage.updateParticipant(roomId, userId, { ...updates, lastSeen: new Date() });
        }
    },
    
    async getParticipants(roomId) {
        try {
            if (mongoose.connection.readyState === 1) {
                const participants = await Participant
                    .find({ roomId })
                    .sort({ joinTime: 1 })
                    .lean();
                return participants;
            } else {
                return memoryStorage.getParticipants(roomId);
            }
        } catch (error) {
            logger.error('获取参与者失败: ' + error.message);
            return memoryStorage.getParticipants(roomId);
        }
    },
    
    async findParticipantBySocketId(socketId) {
        try {
            if (mongoose.connection.readyState === 1) {
                const participant = await Participant.findOne({ socketId }).lean();
                return participant;
            } else {
                return memoryStorage.findParticipantBySocketId(socketId);
            }
        } catch (error) {
            logger.error('查找参与者失败: ' + error.message);
            return memoryStorage.findParticipantBySocketId(socketId);
        }
    },
    
    async removeParticipant(roomId, userId) {
        try {
            if (mongoose.connection.readyState === 1) {
                await Participant.deleteOne({ roomId, userId });
            } else {
                memoryStorage.removeParticipant(roomId, userId);
            }
        } catch (error) {
            logger.error('删除参与者失败: ' + error.message);
            memoryStorage.removeParticipant(roomId, userId);
        }
    }
};

// Socket.IO事件处理
io.on('connection', (socket) => {
    logger.info('新用户连接: ' + socket.id);
    
    // 速率限制中间件
    socket.use(async (packet, next) => {
        try {
            await rateLimiter.consume(socket.handshake.address);
            next();
        } catch (rejRes) {
            logger.warn(`⚠️ 速率限制触发: ${socket.handshake.address}, 剩余时间: ${Math.round(rejRes.msBeforeNext / 1000)}秒`);
            socket.emit('error', `请求频率过高，请${Math.round(rejRes.msBeforeNext / 1000)}秒后重试`);
            socket.disconnect();
        }
    });
    
    // 加入房间
    socket.on('joinRoom', async (data) => {
        try {
            const { roomId, userId, username } = data;
            
            if (!roomId || !userId || !username) {
                socket.emit('error', '缺少必要参数');
                return;
            }
            
            // 离开之前的房间
            const rooms = Array.from(socket.rooms);
            rooms.forEach(room => {
                if (room !== socket.id) {
                    socket.leave(room);
                }
            });
            
            // 加入新房间
            socket.join(roomId);
            
            // 保存用户信息到socket对象，用于后续查找
            socket.userId = userId;
            socket.username = username;
            socket.roomId = roomId;
            
            // 检查是否已有相同用户名但不同socketId的用户，将其标记为离线
            const existingParticipants = await dataService.getParticipants(roomId);
            const sameNameUsers = existingParticipants.filter(p => p.name === username && p.userId !== userId);
            
            // 将同名但不同ID的用户标记为离线
            for (const sameNameUser of sameNameUsers) {
                await dataService.updateParticipant(roomId, sameNameUser.userId, {
                    status: 'offline',
                    socketId: null
                });
            }
            
            // 检查房间是否已存在，确定是否是创建者
            let isCreator = false;
            let existingRoom = null;
            
            try {
                if (mongoose.connection.readyState === 1) {
                    existingRoom = await Room.findOne({ roomId });
                } else {
                    // 内存存储模式
                    existingRoom = memoryStorage.getRoomInfo(roomId);
                }
            } catch (error) {
                logger.error('查询房间信息失败: ' + error.message);
            }
            
            if (!existingRoom) {
                // 房间不存在，当前用户是创建者
                isCreator = true;
                const newRoomInfo = {
                    roomId,
                    creatorId: userId,
                    creatorName: username,
                    createdAt: new Date(),
                    lastActivity: new Date()
                };
                
                try {
                    if (mongoose.connection.readyState === 1) {
                        await Room.create(newRoomInfo);
                        existingRoom = newRoomInfo;
                    } else {
                        // 内存存储模式
                        memoryStorage.setRoomInfo(roomId, newRoomInfo);
                        existingRoom = newRoomInfo;
                    }
                    logger.info(`🏠 房间 ${roomId} 创建，创建者: ${username} (${userId})`);
                } catch (error) {
                    logger.error('创建房间记录失败: ' + error.message);
                }
            } else {
                // 房间已存在，检查当前用户是否是原创建者
                isCreator = existingRoom.creatorId === userId;
                if (isCreator) {
                    logger.info(`🔄 创建者 ${username} (${userId}) 重新加入房间 ${roomId}`);
                } else {
                    logger.info(`👥 用户 ${username} (${userId}) 加入房间 ${roomId}，创建者: ${existingRoom.creatorName} (${existingRoom.creatorId})`);
                }
                
                // 更新房间活动时间
                try {
                    if (mongoose.connection.readyState === 1) {
                        await Room.updateOne({ roomId }, { lastActivity: new Date() });
                    } else {
                        // 内存存储模式，更新房间信息
                        existingRoom.lastActivity = new Date();
                    }
                } catch (error) {
                    logger.error('更新房间活动时间失败: ' + error.message);
                }
            }
            
            // 保存参与者信息
            const participantData = {
                roomId,
                userId,
                name: username,
                status: 'online',
                joinTime: new Date(),
                lastSeen: new Date(),
                socketId: socket.id
            };
            
            const participant = await dataService.saveParticipant(participantData);
            
            // 获取房间历史消息和参与者
            const [messages, participants] = await Promise.all([
                dataService.getMessages(roomId, 50),
                dataService.getParticipants(roomId)
            ]);
            
            // 发送房间数据给用户（使用已获取的房间信息）
            socket.emit('roomData', {
                messages,
                participants: participants.map(p => ({
                    ...p,
                    status: p.socketId ? 'online' : 'offline'
                })),
                roomInfo: existingRoom ? {
                    creatorId: existingRoom.creatorId,
                    creatorName: existingRoom.creatorName,
                    createdAt: existingRoom.createdAt
                } : (isCreator ? {
                    creatorId: userId,
                    creatorName: username,
                    createdAt: new Date()
                } : null),
                isCreator
            });
            
            // 通知房间其他用户新用户加入
            socket.to(roomId).emit('userJoined', participant);
            
            // 更新参与者列表
            const updatedParticipants = await dataService.getParticipants(roomId);
            io.to(roomId).emit('participantsUpdate', updatedParticipants);
            
            logger.info(`用户 ${username} 加入房间 ${roomId}`);
            
        } catch (error) {
            logger.error('用户加入房间失败: ' + error.message);
            socket.emit('error', '加入房间失败，请重试');
        }
    });
    
    // 发送消息
    socket.on('sendMessage', async (messageData) => {
        try {
            const { roomId, type, text, author, userId, file, isAIQuestion, originUserId } = messageData;
            
            if (!roomId || !author || !userId) {
                socket.emit('error', '消息格式错误');
                return;
            }
            
            const message = {
                roomId,
                type: type || 'user',
                text: text || '',
                author,
                userId,
                time: messageData.time || new Date().toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
                file: file || null,
                isAIQuestion: isAIQuestion || false, // 保留isAIQuestion属性
                originUserId: originUserId || null, // 保留originUserId属性
            };
            
            // 保存消息
            const savedMessage = await dataService.saveMessage(message);
            
            // 广播消息到房间所有用户
            io.to(roomId).emit('newMessage', savedMessage);
            
            // 更新参与者最后活跃时间
            await dataService.updateParticipant(roomId, userId, { lastSeen: new Date() });
            
            logger.info(`房间 ${roomId} 收到新消息: ${message.text?.substring(0, 50) + '...'}`);
            
        } catch (error) {
            logger.error('发送消息失败: ' + error.message);
            socket.emit('error', '发送消息失败，请重试');
        }
    });
    
    // 用户正在输入
    socket.on('typing', (data) => {
        socket.to(data.roomId).emit('userTyping', {
            userId: data.userId,
            username: data.username,
            isTyping: data.isTyping
        });
    });
    
    // 用户离开
    socket.on('leaveRoom', async (data) => {
        try {
            const { roomId, userId } = data;
            
            socket.leave(roomId);
            
            // 更新用户状态为离线
            await dataService.updateParticipant(roomId, userId, { 
                status: 'offline',
                socketId: null 
            });
            
            // 通知房间其他用户
            socket.to(roomId).emit('userLeft', { userId });
            
            // 更新参与者列表
            const participants = await dataService.getParticipants(roomId);
            io.to(roomId).emit('participantsUpdate', participants);
            
        } catch (error) {
            logger.error('用户离开房间失败: ' + error.message);
        }
    });
    
    // 断开连接
    socket.on('disconnect', async () => {
        try {
            logger.info('用户断开连接: ' + socket.id);
            
            // 查找该socket对应的参与者并更新状态
            const participant = await dataService.findParticipantBySocketId(socket.id);
            if (participant) {
                await dataService.updateParticipant(
                    participant.roomId, 
                    participant.userId, 
                    { status: 'offline', socketId: null }
                );
                
                // 通知房间其他用户
                socket.to(participant.roomId).emit('userLeft', { userId: participant.userId });
                
                // 更新参与者列表
                const participants = await dataService.getParticipants(participant.roomId);
                io.to(participant.roomId).emit('participantsUpdate', participants);
            }
        } catch (error) {
            logger.error('处理断开连接失败: ' + error.message);
        }
    });
    
    // 结束会议（仅创建者可操作）
    socket.on('endMeeting', async (data) => {
        try {
            const { roomId, userId } = data;
            
            if (!roomId || !userId) {
                socket.emit('error', '缺少必要参数');
                return;
            }
            
            // 验证是否是房间创建者
            let isCreator = false;
            if (mongoose.connection.readyState === 1) {
                const room = await Room.findOne({ roomId });
                isCreator = room && room.creatorId === userId;
            } else {
                // 内存存储模式下，检查房间信息中的创建者
                const roomInfo = memoryStorage.getRoomInfo(roomId);
                isCreator = roomInfo && roomInfo.creatorId === userId;
            }
            
            if (!isCreator) {
                socket.emit('error', '只有会议创建者可以结束会议');
                return;
            }
            
            // 清理房间数据
            let deletedMessages = 0;
            let deletedParticipants = 0;
            
            if (mongoose.connection.readyState === 1) {
                // MongoDB环境：删除数据库中的数据
                const messageResult = await Message.deleteMany({ roomId });
                const participantResult = await Participant.deleteMany({ roomId });
                await Room.deleteOne({ roomId });
                
                deletedMessages = messageResult.deletedCount;
                deletedParticipants = participantResult.deletedCount;
            } else {
                // 内存存储环境：清理内存数据
                if (memoryStorage.rooms.has(roomId)) {
                    const room = memoryStorage.rooms.get(roomId);
                    deletedMessages = room.messages.length;
                    deletedParticipants = room.participants.size;
                    memoryStorage.rooms.delete(roomId);
                }
            }
            
            logger.info(`🏁 会议 ${roomId} 已结束: 清理了 ${deletedMessages} 条消息, ${deletedParticipants} 个参与者`);
            
            // 通知房间所有用户会议已结束
            io.to(roomId).emit('meetingEnded', {
                message: '会议已被创建者结束，房间数据已清理',
                deletedMessages,
                deletedParticipants
            });
            
            // 让所有用户离开房间
            const roomSockets = await io.in(roomId).fetchSockets();
            for (const roomSocket of roomSockets) {
                roomSocket.leave(roomId);
            }
            
            socket.emit('endMeetingSuccess', {
                message: '会议已成功结束',
                deletedMessages,
                deletedParticipants
            });
            
        } catch (error) {
            logger.error('结束会议失败: ' + error.message);
            socket.emit('error', '结束会议失败: ' + error.message);
        }
    });
    
    // 语音通话事件处理
    socket.on('callInvite', (data) => {
        const { roomId, callerId, callerName } = data;
        logger.debug(`📞 收到通话邀请事件: ${JSON.stringify(data)}`);
        logger.debug(`📞 房间ID: ${roomId}, 发起者: ${callerName} (${callerId})`);
        
        // 检查房间内有多少用户
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
            logger.debug(`📞 房间 ${roomId} 中有 ${room.size} 个用户`);
        } else {
            logger.debug(`📞 房间 ${roomId} 不存在`);
        }
        
        // 广播给房间内除发起者外的所有用户
        socket.to(roomId).emit('callInvite', {
            roomId,
            callerId,
            callerName
        });
        logger.debug(`📞 用户 ${callerName} 发起语音通话邀请`);
    });
    
    socket.on('callAccept', (data) => {
        const { roomId, userId, userName } = data;
        // 广播给房间内除接受者外的所有用户
        io.to(roomId).emit('callAccept', {
            roomId,
            userId,
            userName
        });
        logger.debug(`📞 用户 ${userName} 接受语音通话`);
    });
    
    socket.on('callReject', (data) => {
        const { roomId, userId, reason } = data;
        // 广播给房间内除拒绝者外的所有用户
        io.to(roomId).emit('callReject', {
            roomId,
            userId,
            reason
        });
        logger.debug(`📞 用户拒绝语音通话，原因: ${reason || '用户拒绝'}`);
    });
    
    socket.on('callEnd', (data) => {
        const { roomId, userId } = data;
        // 广播给房间内除结束者外的所有用户
        io.to(roomId).emit('callEnd', {
            roomId,
            userId
        });
        // 临时注释掉这个日志以减少输出
        // logger.debug(`📞 用户 ${userId} 结束语音通话`);
    });
    
    socket.on('callOffer', (data) => {
        const { roomId, targetUserId, offer, fromUserId } = data;
        // 找到目标用户的socket并发送offer
        const targetSocket = findSocketByUserId(targetUserId);
        if (targetSocket) {
            targetSocket.emit('callOffer', {
                roomId,
                targetUserId,
                offer,
                fromUserId
            });
            logger.debug(`📞 转发WebRTC offer 从 ${fromUserId} 到 ${targetUserId}`);
        } else {
            logger.debug(`⚠️ 未找到目标用户 ${targetUserId} 的socket连接`);
        }
    });
    
    socket.on('callAnswer', (data) => {
        const { roomId, targetUserId, answer, fromUserId } = data;
        // 找到目标用户的socket并发送answer
        const targetSocket = findSocketByUserId(targetUserId);
        if (targetSocket) {
            targetSocket.emit('callAnswer', {
                roomId,
                targetUserId,
                answer,
                fromUserId
            });
            logger.debug(`📞 转发WebRTC answer 从 ${fromUserId} 到 ${targetUserId}`);
        } else {
            logger.debug(`⚠️ 未找到目标用户 ${targetUserId} 的socket连接`);
        }
    });
    
    socket.on('iceCandidate', (data) => {
        const { roomId, targetUserId, candidate, fromUserId } = data;
        // 找到目标用户的socket并发送ICE候选
        const targetSocket = findSocketByUserId(targetUserId);
        if (targetSocket) {
            targetSocket.emit('iceCandidate', {
                roomId,
                targetUserId,
                candidate,
                fromUserId
            });
            logger.debug(`📞 转发ICE候选 从 ${fromUserId} 到 ${targetUserId}`);
        } else {
            logger.debug(`⚠️ 未找到目标用户 ${targetUserId} 的socket连接`);
        }
    });
});

// API路由
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Railway健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'vibe-meeting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

app.get('/api/rooms/:roomId/messages', async (req, res) => {
    try {
        const { roomId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const messages = await dataService.getMessages(roomId, limit);
        res.json({ messages });
    } catch (error) {
        logger.error('获取消息失败: ' + error.message);
        res.status(500).json({ error: '获取消息失败' });
    }
});

app.get('/api/rooms/:roomId/participants', async (req, res) => {
    try {
        const { roomId } = req.params;
        const participants = await dataService.getParticipants(roomId);
        res.json({ participants });
    } catch (error) {
        logger.error('获取参与者失败: ' + error.message);
        res.status(500).json({ error: '获取参与者失败' });
    }
});

// 转录服务代理端点
app.get('/api/transcription/health', async (req, res) => {
    try {
        const transcriptionServiceUrl = process.env.TRANSCRIPTION_SERVICE_URL || 'http://localhost:8000';
        const response = await fetch(`${transcriptionServiceUrl}/health`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        logger.error('转录服务健康检查失败: ' + error.message);
        res.status(500).json({ 
            error: '转录服务不可用',
            status: 'error',
            whisper_model: 'not_available',
            mongodb: 'unknown',
            redis: 'unknown'
        });
    }
});

app.post('/api/transcription/audio', async (req, res) => {
    try {
        const transcriptionServiceUrl = process.env.TRANSCRIPTION_SERVICE_URL || 'http://localhost:8000';
        
        // 转发请求到Python转录服务
        const formData = new FormData();
        if (req.files && req.files.audio_file) {
            formData.append('audio_file', req.files.audio_file.data, req.files.audio_file.name);
        }
        
        const response = await fetch(`${transcriptionServiceUrl}/transcribe/audio`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // 如果转录成功，保存到数据库
        if (result.success && result.text) {
            const transcriptionRecord = {
                roomId: req.body.roomId || 'unknown',
                text: result.text,
                language: result.language || 'zh',
                timestamp: new Date(),
                type: 'upload',
                userId: req.body.userId || 'anonymous'
            };
            
            // 保存转录记录
            if (mongoose.connection.readyState === 1) {
                await new Message({
                    ...transcriptionRecord,
                    type: 'transcription',
                    author: '语音转录',
                    time: new Date().toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                }).save();
            }
        }
        
        res.json(result);
    } catch (error) {
        logger.error('转录代理失败: ' + error.message);
        res.status(500).json({ 
            success: false, 
            error: '转录服务暂时不可用',
            text: '',
            language: 'zh'
        });
    }
});

// 错误处理
app.use((err, req, res, next) => {
    logger.error('服务器错误: ' + err.message);
    res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// 辅助函数：根据用户ID找到socket连接
function findSocketByUserId(userId) {
    // 遍历所有socket连接，找到匹配的用户ID
    const sockets = io.sockets.sockets;
    logger.debug(`🔍 查找用户 ${userId} 的socket连接，当前连接数: ${sockets.size}`);
    
    for (const [socketId, socket] of sockets) {
        logger.debug(`🔍 检查socket ${socketId}: userId=${socket.userId}, username=${socket.username}`);
        if (socket.userId === userId) {
            logger.debug(`✅ 找到用户 ${userId} 的socket连接: ${socketId}`);
            return socket;
        }
    }
    
    logger.warn(`⚠️ 未找到用户 ${userId} 的socket连接`);
    return null;
}

// 定期清理离线用户（每5分钟）
setInterval(async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            await Participant.updateMany(
                { 
                    lastSeen: { $lt: fiveMinutesAgo },
                    status: 'online'
                },
                { status: 'offline', socketId: null }
            );
        }
    } catch (error) {
        logger.error('清理离线用户失败: ' + error.message);
    }
}, 5 * 60 * 1000);

// Railway环境检测和静态文件路由
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/../index.html');
});

// 启动服务器
const PORT = process.env.PORT || 3001;

const startServer = async () => {
    await connectDB();
    
    server.listen(PORT, () => {
        logger.info(`🚀 Vibe Meeting 服务器运行在端口 ${PORT}`);
        logger.info(`📡 Socket.IO 服务已启动`);
        logger.info(`💾 数据库状态: ${mongoose.connection.readyState === 1 ? '已连接' : '使用内存存储'}`);
        logger.info(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer().catch(console.error);

// 优雅关闭
process.on('SIGTERM', async () => {
    logger.info('收到SIGTERM信号，正在关闭服务器...');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('收到SIGINT信号，正在关闭服务器...');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});