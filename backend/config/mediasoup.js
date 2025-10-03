const mediasoup = require('mediasoup');

// MediaSoup configuration
const config = {
    worker: {
        rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
        rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
            'rtx',
            'bwe',
            'score',
            'simulcast',
            'svc',
            'sctp'
        ]
    },
    router: {
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000
                }
            },
            {
                kind: 'video',
                mimeType: 'video/h264',
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '4d0032',
                    'level-asymmetry-allowed': 1,
                    'x-google-start-bitrate': 1000
                }
            }
        ]
    },
    webRtcTransport: {
        listenIps: [
            {
                ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1'
            }
        ],
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000
    }
};

// Storage for MediaSoup objects
const workers = [];
const routers = [];
let nextWorkerIdx = 0;

/**
 * Initialize MediaSoup workers
 */
const initializeMediaSoup = async () => {
    try {
        const numWorkers = require('os').cpus().length;
        console.log(`🔧 Creating ${numWorkers} MediaSoup workers...`);

        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker({
                rtcMinPort: config.worker.rtcMinPort,
                rtcMaxPort: config.worker.rtcMaxPort,
                logLevel: config.worker.logLevel,
                logTags: config.worker.logTags
            });

            worker.on('died', () => {
                console.error(`💀 MediaSoup worker ${i + 1} died. Attempting to restart...`);
                
                // Remove the dead worker from the array
                const workerIndex = workers.indexOf(worker);
                if (workerIndex > -1) {
                    workers.splice(workerIndex, 1);
                }
                
                // Attempt to create a replacement worker
                setTimeout(async () => {
                    try {
                        console.log(`🔄 Restarting MediaSoup worker ${i + 1}...`);
                        const newWorker = await mediasoup.createWorker({
                            rtcMinPort: config.worker.rtcMinPort,
                            rtcMaxPort: config.worker.rtcMaxPort,
                            logLevel: config.worker.logLevel,
                            logTags: config.worker.logTags
                        });
                        
                        // Add the same event handler to the new worker
                        newWorker.on('died', () => {
                            console.error(`💀 Replacement MediaSoup worker ${i + 1} died, exiting in 2 seconds...`);
                            setTimeout(() => process.exit(1), 2000);
                        });
                        
                        workers.push(newWorker);
                        console.log(`✅ MediaSoup worker ${i + 1} restarted successfully`);
                    } catch (restartError) {
                        console.error(`❌ Failed to restart MediaSoup worker ${i + 1}:`, restartError);
                        console.error('🚨 Critical: MediaSoup worker restart failed, exiting in 2 seconds...');
                        setTimeout(() => process.exit(1), 2000);
                    }
                }, 1000);
            });

            workers.push(worker);
            console.log(`✅ MediaSoup worker ${i + 1} created`);
        }

        console.log('✅ All MediaSoup workers created');
        return workers;
    } catch (error) {
        console.error('❌ Failed to initialize MediaSoup:', error);
        throw error;
    }
};

/**
 * Get next available worker
 */
const getNextWorker = () => {
    const worker = workers[nextWorkerIdx];
    if (++nextWorkerIdx === workers.length) {
        nextWorkerIdx = 0;
    }
    return worker;
};

/**
 * Create a router for a meeting room
 */
const createRouter = async () => {
    const worker = getNextWorker();
    const router = await worker.createRouter({
        mediaCodecs: config.router.mediaCodecs
    });
    routers.push(router);
    return router;
};

/**
 * Create WebRTC transport
 */
const createWebRtcTransport = async (router) => {
    const transport = await router.createWebRtcTransport({
        listenIps: config.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        maxIncomingBitrate: config.webRtcTransport.maxIncomingBitrate,
        initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate
    });

    return transport;
};

module.exports = {
    config,
    initializeMediaSoup,
    getNextWorker,
    createRouter,
    createWebRtcTransport,
    workers,
    routers
};