const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? false  // Allow same origin in production
      : "http://localhost:5173", // Your React dev server
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? false  // Allow same origin in production
    : "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Store connected users and their partnerships
const connectedUsers = new Map(); // socketId -> user info
const waitingQueue = new Set(); // users waiting for partners
const partnerships = new Map(); // socketId -> partnerId

// User class to manage user data
class User {
  constructor(socketId, socket) {
    this.socketId = socketId;
    this.socket = socket;
    this.partnerId = null;
    this.isWaiting = false;
    this.connectedAt = Date.now();
  }
}

// Helper function to generate unique user ID
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to find a random partner from waiting queue
function findRandomPartner(excludeSocketId) {
  const waitingUsers = Array.from(waitingQueue).filter(id => id !== excludeSocketId);
  if (waitingUsers.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * waitingUsers.length);
  return waitingUsers[randomIndex];
}

// Helper function to create a partnership
function createPartnership(user1SocketId, user2SocketId) {
  const user1 = connectedUsers.get(user1SocketId);
  const user2 = connectedUsers.get(user2SocketId);
  
  if (!user1 || !user2) return false;
  
  // Remove from waiting queue
  waitingQueue.delete(user1SocketId);
  waitingQueue.delete(user2SocketId);
  
  // Set up partnership
  user1.partnerId = user2SocketId;
  user2.partnerId = user1SocketId;
  user1.isWaiting = false;
  user2.isWaiting = false;
  
  partnerships.set(user1SocketId, user2SocketId);
  partnerships.set(user2SocketId, user1SocketId);
  
  // Notify both users
  user1.socket.emit('partner_found', {
    partnerId: generateUserId(),
    message: 'You are now connected to a stranger. Say hello!'
  });
  
  user2.socket.emit('partner_found', {
    partnerId: generateUserId(),
    message: 'You are now connected to a stranger. Say hello!'
  });
  
  console.log(`Partnership created: ${user1SocketId} <-> ${user2SocketId}`);
  return true;
}

// Helper function to break a partnership
function breakPartnership(socketId, reason = 'disconnected') {
  const partnerId = partnerships.get(socketId);
  if (!partnerId) return;
  
  const user = connectedUsers.get(socketId);
  const partner = connectedUsers.get(partnerId);
  
  // Clean up partnership data
  partnerships.delete(socketId);
  partnerships.delete(partnerId);
  
  if (user) {
    user.partnerId = null;
  }
  
  if (partner) {
    partner.partnerId = null;
    // Notify partner about disconnection
    partner.socket.emit('partner_disconnected', {
      message: `Stranger has ${reason}. Looking for a new partner...`
    });
    
    // Put partner back in waiting queue if they're still connected
    if (reason === 'disconnected') {
      partner.isWaiting = true;
      waitingQueue.add(partnerId);
      
      // Try to find a new partner immediately
      setTimeout(() => {
        const newPartnerId = findRandomPartner(partnerId);
        if (newPartnerId) {
          createPartnership(partnerId, newPartnerId);
        }
      }, 1000);
    }
  }
  
  console.log(`Partnership broken: ${socketId} <-> ${partnerId} (${reason})`);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Create new user
  const user = new User(socket.id, socket);
  connectedUsers.set(socket.id, user);
  
  // Send current online count
  io.emit('online_count', connectedUsers.size);
  
  // Handle user looking for partner
  socket.on('find_partner', () => {
    const user = connectedUsers.get(socket.id);
    if (!user || user.partnerId) return;
    
    console.log(`User ${socket.id} looking for partner`);
    
    // Try to find an existing partner
    const partnerId = findRandomPartner(socket.id);
    
    if (partnerId) {
      // Create partnership immediately
      createPartnership(socket.id, partnerId);
    } else {
      // Add to waiting queue
      user.isWaiting = true;
      waitingQueue.add(socket.id);
      socket.emit('waiting_for_partner');
      console.log(`User ${socket.id} added to waiting queue`);
    }
  });
  
  // Handle sending messages
  socket.on('send_message', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.partnerId) {
      socket.emit('error', { message: 'No partner connected' });
      return;
    }
    
    const partner = connectedUsers.get(user.partnerId);
    if (!partner) {
      socket.emit('error', { message: 'Partner not found' });
      return;
    }
    
    // Send message to partner
    const messageData = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
      text: data.text,
      sender: 'partner',
      timestamp: Date.now()
    };
    
    partner.socket.emit('message_received', messageData);
    console.log(`Message sent from ${socket.id} to ${user.partnerId}: ${data.text}`);
  });
  
  // Handle typing indicators
  socket.on('typing_start', () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.partnerId) {
      const partner = connectedUsers.get(user.partnerId);
      if (partner) {
        partner.socket.emit('partner_typing_start');
      }
    }
  });
  
  socket.on('typing_stop', () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.partnerId) {
      const partner = connectedUsers.get(user.partnerId);
      if (partner) {
        partner.socket.emit('partner_typing_stop');
      }
    }
  });
  
  // Handle next partner request
  socket.on('next_partner', () => {
    const user = connectedUsers.get(socket.id);
    if (!user || !user.partnerId) return;
    
    console.log(`User ${socket.id} requesting next partner`);
    
    // Break current partnership
    breakPartnership(socket.id, 'skipped to next partner');
    
    // Look for new partner
    setTimeout(() => {
      const newPartnerId = findRandomPartner(socket.id);
      if (newPartnerId) {
        createPartnership(socket.id, newPartnerId);
      } else {
        user.isWaiting = true;
        waitingQueue.add(socket.id);
        socket.emit('waiting_for_partner');
      }
    }, 500);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Break partnership if exists
    breakPartnership(socket.id, 'disconnected');
    
    // Remove from waiting queue
    waitingQueue.delete(socket.id);
    
    // Remove user
    connectedUsers.delete(socket.id);
    
    // Update online count
    io.emit('online_count', connectedUsers.size);
  });
  
  // Handle manual disconnect
  socket.on('disconnect_chat', () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.partnerId) {
      breakPartnership(socket.id, 'disconnected');
    }
    
    waitingQueue.delete(socket.id);
    user.isWaiting = false;
    socket.emit('disconnected');
  });
});

// REST API endpoints
app.get('/api/stats', (req, res) => {
  res.json({
    onlineUsers: connectedUsers.size,
    waitingUsers: waitingQueue.size,
    activeChats: partnerships.size / 2,
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'RandomChat Server is running!',
    onlineUsers: connectedUsers.size,
    activeChats: partnerships.size / 2
  });
});

// Deployment configuration
const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/dist")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "dist", "index.html"))
  );
} else {
  app.get("/api", (req, res) => {
    res.send("RandomChat API is running in development mode..");
  });
}

// Cleanup function to remove stale connections
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [socketId, user] of connectedUsers.entries()) {
    if (now - user.connectedAt > staleThreshold && !user.socket.connected) {
      console.log(`Cleaning up stale connection: ${socketId}`);
      breakPartnership(socketId, 'disconnected');
      waitingQueue.delete(socketId);
      connectedUsers.delete(socketId);
    }
  }
}, 60000); // Run every minute

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`RandomChat server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

module.exports = { app, server, io };