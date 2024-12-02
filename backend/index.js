const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Default route
app.get('/', (req, res) => {
    res.send('Backend is working!');
});

// Test API route
app.get('/api/ping', (req, res) => {
    res.json({ message: 'Pong!' });
});

// Temporary in-memory user store for demonstration
const users = [];

// Signup endpoint
app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if the user already exists
    const userExists = users.find(user => user.email === email);
    if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
    }

    // Add new user
    users.push({ username, email, password }); // Note: Use a database and hash passwords in real apps
    res.status(201).json({ message: 'User registered successfully' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Find the user
    const user = users.find(user => user.email === email && user.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ message: 'Login successful', user });
});

// Create an HTTP server
const server = http.createServer(app);

// Integrate Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// WebSocket logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for messages
    socket.on('sendMessage', (data) => {
        console.log('Message received from client:', data);  // Debugging line

        // Broadcast the message to all connected clients
        io.emit('receiveMessage', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
