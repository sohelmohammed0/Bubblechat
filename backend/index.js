const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const users = [];

app.post('/api/signup', (req, res) => {
  const { email, password, username, phone } = req.body;

  if (!email || !password || !username || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (users.find((user) => user.email === email || user.phone === phone)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  users.push({ email, password, username, phone });
  res.status(201).json({ message: 'User registered successfully' });
});

app.post('/api/login', (req, res) => {
  const { loginContact, loginPassword } = req.body;

  const user = users.find(
    (user) =>
      (user.email === loginContact || user.username === loginContact || user.phone === loginContact) &&
      user.password === loginPassword
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  res.json({ user });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('sendMessage', (data) => {
    io.emit('receiveMessage', data);
  });
});

server.listen(5000, () => console.log('Server running on http://localhost:5000'));
