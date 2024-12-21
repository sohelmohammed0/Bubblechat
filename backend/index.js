const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const activeUsers = {};


const app = express();
app.use(cors());
app.use(express.json());

const users = [];

// User Registration
app.post('/api/signup', (req, res) => {
  const { email, password, username, phone } = req.body;

  if (!email || !password || !username || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existingUser = users.some((user) => user.email === email || user.phone === phone);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  users.push({ email, password, username, phone, status: 'offline' });
  res.status(201).json({ message: 'User registered successfully' });
});

// User Login
app.post('/api/login', (req, res) => {
  const { loginContact, loginPassword } = req.body;
  const user = users.find(
    (u) =>
      (u.email === loginContact || u.username === loginContact || u.phone === loginContact) &&
      u.password === loginPassword
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  user.status = 'online';
  res.json({ user });
});

// Setting up Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('A user connected.');

  socket.on('userConnected', (username) => {
    console.log(`${username} connected`);
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('sendMessage', (data) => {
    io.to(data.room).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected.');
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});

// Join chats
io.on('connection', (socket) => {
  console.log('A user connected.');

  // User connected
  socket.on('userConnected', (username) => {
    activeUsers[username] = { socketId: socket.id, lastSeen: 'Online' };
    console.log(`${username} connected.`);
  });

  // Join Room
  socket.on('joinRoom', ({ room, username }) => {
    socket.join(room);
    console.log(`${username} joined room ${room}`);
    io.to(room).emit('roomJoined', { room, username });
  });

  // Send Message
  socket.on('sendMessage', (data) => {
    io.to(data.room).emit('receiveMessage', data);
  });

  // User disconnected
  socket.on('disconnect', () => {
    const disconnectedUser = Object.keys(activeUsers).find(
      (user) => activeUsers[user].socketId === socket.id
    );

    if (disconnectedUser) {
      activeUsers[disconnectedUser].lastSeen = new Date().toLocaleString();
      console.log(`${disconnectedUser} disconnected.`);
    }
  });

  // Handle fetching last seen
  socket.on('getLastSeen', (username) => {
    const user = activeUsers[username];
    const lastSeen = user ? 'Online' : user?.lastSeen || 'Offline';
    socket.emit('lastSeen', { username, lastSeen });
  });
});

