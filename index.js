const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const NodeCache = require('node-cache');
const { Mutex } = require('async-mutex');
const crypto = require('crypto');
const { saveCreds } = require('./mongo');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const app = express();
const port = 3000;
let session;
const msgRetryCounterCache = new NodeCache();
const mutex = new Mutex();
const logger = pino({ level: 'silent' });
const childLogger = logger.child({ level: 'silent', name: 'XAstral' });
app.use(express.static(path.join(__dirname, 'pages')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

async function connector(Num, res) {
    const sessionId = `Naxor~${crypto.randomBytes(8).toString('hex')}`;
    const { state, saveCreds } = await useMultiFileAuthState(
        "./mongo",
        childLogger
    );
    session = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, childLogger)
        },
        printQRInTerminal: false,
        logger: childLogger,
        browser: Browsers.macOS("Safari"),
        markOnlineOnConnect: true,
        msgRetryCounterCache
    });
    if (!session.authState.creds.registered) {
        await delay(1500);
        Num = Num.replace(/[^0-9]/g, '');
        const code = await session.requestPairingCode(Num);
        if (!res.headersSent) {
            res.send({ code: code?.match(/.{1,4}/g)?.join('-') });
        }
    }

    session.ev.on('creds.update', async () => {
        await saveCreds();
    });
    session.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            childLogger.info('Connected successfully');
            await delay(5000);
            await session.sendMessage(session.user.id, { text: "*X Astral*:\nDont share_ur_session ID" });
            childLogger.info('[Session] Session online');
            await session.sendMessage(session.user.id, { text: `${sessionId}` });
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            childLogger.error(`Connection closed. Reason: ${reason}`);
            reconn(reason);
        }
    });
}

function reconn(reason) {
    if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
        childLogger.warn('Connection lost, reconnecting...');
        connector();
    } else {
        childLogger.error(`Disconnected! Reason: ${reason}`);
        session.end();
    }
}

app.get('/pair', async (req, res) => {
    const Num = req.query.code;
    if (!Num) {
        return res.status(418).json({ message: 'Phone number is required' });
    }
    const release = await mutex.acquire();
    try {
        await connector(Num, res);
    } catch (error) {
        childLogger.error(error);
        res.status(500).json({ error: 'Server Error' });
    } finally {
        release();
    }
});

app.listen(port, () => {
    childLogger.info(`PORT: ${port}`);
});

    
