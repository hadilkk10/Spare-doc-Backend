import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import User from './models/User.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const sessionStore = new Map();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB error:", err));

// 🔐 Helper: Generate JWT tokens
function generateTokens(user) {
    const payload = { phone: user.phone };
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
}

// 1️⃣ Send OTP
app.post('/send-otp', async (req, res) => {
    let { phone } = req.body;

    // ✅ Normalize phone number by removing +91
    phone = phone.replace(/^\+91/, '');

    try {
        const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${phone}/AUTOGEN`);
        const sessionId = response.data.Details;

        // ✅ Store normalized phone number
        sessionStore.set(phone, sessionId);

        res.json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error("❌ Error sending OTP:", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// 4️⃣ Save or update user's name
app.post('/save-name', async (req, res) => {
    const { phone, name } = req.body;

    try {
        const user = await User.findOneAndUpdate(
            { phone },
            { $set: { name } },
            { new: true } 
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'Name updated successfully', user });
    } catch (err) {
        console.error('❌ Error saving name:', err.message);
        res.status(500).json({ error: 'Server error while updating name' });
    }
});


// 2️⃣ Verify OTP
app.post('/verify-otp', async (req, res) => {
    try {
        let { phone, otp } = req.body;

        // Strip +91 if present
        phone = phone.replace(/^\+91/, '');

        const sessionId = sessionStore.get(phone);

        console.log("📞 Phone for verification:", phone);
        console.log("📦 Session ID:", sessionId);
        console.log("🔢 OTP:", otp);

        if (!sessionId) {
            return res.status(400).json({ error: 'Session expired. Please request OTP again.' });
        }

        const response = await axios.get(
            `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`
        );

        console.log("🧾 2Factor response:", response.data);

        if (response.data.Status === 'Success' && response.data.Details === 'OTP Matched') {
            let user = await User.findOne({ phone });

            if (!user) {
                const newUser = new User({ phone });
                await newUser.save();

                const accessToken = jwt.sign({ phone }, process.env.JWT_SECRET, { expiresIn: '15m' });
                const refreshToken = jwt.sign({ phone }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

                newUser.refreshToken = refreshToken;
                await newUser.save();

                return res.status(200).json({
                    newUser: true,
                    accessToken,
                    refreshToken,
                    user: {
                        name: '',
                        phone,
                    },
                });
            }


            const accessToken = jwt.sign({ phone }, process.env.JWT_SECRET, { expiresIn: '15m' });
            const refreshToken = jwt.sign({ phone }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

            user.refreshToken = refreshToken;
            await user.save();

            return res.status(200).json({
                newUser: false,
                accessToken,
                refreshToken,
                user: {
                    name: user.name || '',
                    phone: user.phone,
                },
            });
        } else {
            return res.status(400).json({ error: response.data.Details || 'Invalid OTP' });
        }
    } catch (error) {
        console.error("❌ Error in /verify-otp:", error.message);
        return res.status(500).json({ error: 'Server error' });
    }
});


// 3️⃣ Register new user
app.post('/register-user', async (req, res) => {
    const { name, phone } = req.body;
    
    // ✅ Normalize the phone number (remove +91 if present)
    phone = phone.replace(/^\+91/, '');

    try {
        const newUser = await User.create({ name, phone });
        const tokens = generateTokens(newUser);
        newUser.refreshToken = tokens.refreshToken;
        await newUser.save();

        res.status(201).json({ success: true, user: newUser, ...tokens });
    } catch (err) {
        res.status(500).json({ error: 'User registration failed' });
    }
});

// 🔄 Refresh Token
app.post('/refresh-token', async (req, res) => {
    const { phone, refreshToken } = req.body;

    const user = await User.findOne({ phone });
    if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token' });
    }

    try {
        const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const newAccessToken = jwt.sign({ phone: payload.phone }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '15m',
        });

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(403).json({ error: 'Refresh token expired or invalid' });
    }
});

// 🔐 Protected route
app.get('/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token missing' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        res.json({ message: 'Access granted', phone: decoded.phone });
    } catch (err) {
        res.status(403).json({ error: 'Access token expired or invalid' });
    }
});

// 🚪 Logout
app.post('/logout', async (req, res) => {
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (user) {
        user.refreshToken = null;
        await user.save();
    }

    res.json({ message: 'Logged out successfully' });
});

// ✅ Start server (Only once!)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ SpareDoc backend running at http://localhost:${PORT}`);
});
