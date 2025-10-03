const { Server } = require('socket.io');

/**
 * Initialize Socket.IO server
 */
const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    console.log('✅ Socket.IO server initialized');
    return io;
};

module.exports = {
    initializeSocket
};