
/**
 * BACKEND SERVER
 * Run with: node server/server.js
 * Dependencies: npm install express socket.io livekit-server-sdk cors
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { AccessToken } = require('livekit-server-sdk');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- LIVEKIT CONFIG (Get these from LiveKit Cloud or self-hosted) ---
const LIVEKIT_API_KEY = "devkey";
const LIVEKIT_API_SECRET = "secret";
const LIVEKIT_URL = "ws://localhost:7880";

// --- ROOM MANAGEMENT ---
const roomCounts = {}; // roomId -> number of users

app.get('/api/join', (req, res) => {
    const { room, userId } = req.query;
    if (!room || !userId) return res.status(400).json({ error: "Missing params" });

    // Determine Count
    const count = roomCounts[room] || 0;

    // DECISION LOGIC: > 5 users = LiveKit, else P2P
    if (count > 5) {
        // Generate LiveKit Token
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: userId,
        });
        at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });
        const token = at.toJwt();

        res.json({
            mode: 'livekit',
            url: LIVEKIT_URL,
            token: token
        });
    } else {
        // Return P2P Config
        res.json({
            mode: 'p2p',
            signalingUrl: 'http://localhost:3000'
        });
    }
});

// --- SOCKET.IO SIGNALING (P2P) ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
        
        // Track count
        if (!roomCounts[roomId]) roomCounts[roomId] = 0;
        roomCounts[roomId]++;

        // Disconnect handler specific to this socket in this room
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
            roomCounts[roomId]--;
        });
    });

    // Signaling
    socket.on('offer', (userId, offer) => {
        // In a real app, you'd map userId to socketId. Broadcasting for simplicity/mesh demo.
        socket.broadcast.emit('offer', userId, offer); 
    });
    socket.on('answer', (userId, answer) => {
        socket.broadcast.emit('answer', userId, answer);
    });
    socket.on('ice-candidate', (userId, candidate) => {
        socket.broadcast.emit('ice-candidate', userId, candidate);
    });

    // Data
    socket.on('player-update', (roomId, data) => {
        socket.to(roomId).emit('player-update', data.id, data); // Relay
    });
    socket.on('reaction', (roomId, emoji) => {
        // user socket.id as simple ID for demo, usually use userId
        socket.to(roomId).emit('reaction', socket.id, emoji);
    });
});

server.listen(3000, () => {
    console.log('Signaling/Token Server running on port 3000');
});
