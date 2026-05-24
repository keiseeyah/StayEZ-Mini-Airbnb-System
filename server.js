// Load environment variables FIRST — before anything else
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

// ─── Initialize Express App ───────────────────────────────────────────────────
const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ─── Serve Frontend Static Files from /public ────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Connection ──────────────────────────────────────────────────────
const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI; 

mongoose
    .connect(dbURI)
    .then(() => console.log('✅  MongoDB connected successfully'))
    .catch((err) => {
        console.error('❌  MongoDB connection error:', err.message);
    });

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/bookings', require('./routes/bookings'));

// ─── Catch-all: serve index.html for any unmatched non-API route ─────────────
// Note: Express 5 requires named parameters — use /{*path} syntax
app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ message: 'API endpoint not found' });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀  Server is running on http://localhost:${PORT}`);
});
