// server.js - Main Express Server
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? "https://your-frontend-app-name.onrender.com" 
      : "http://localhost:3001",
  })
);
app.use(express.json());

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI ,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function (email) {
          // Validate IIITDM email format: 2 letters + 2 digits + 1 letter + 4 digits
          const pattern = /^[a-zA-Z]{2}\d{2}[a-zA-Z]{1}\d{4}@iiitdm\.ac\.in$/;
          return pattern.test(email);
        },
        message: "Email must match IIITDM format: cs23b2007@iiitdm.ac.in",
      },
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Score Schema
const scoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    moves: {
      type: Number,
      required: true,
      min: 1,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    gameConfiguration: {
      type: [Number],
      default: [3, 6, 4, 2, 5, 8, 1, 7, 9], // Starting grid
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
const Score = mongoose.model("Score", scoreSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET ,
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    }
  );
};

// Routes

// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate input
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    if (name.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Name must be at least 2 characters long" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// User Login (if needed)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit Score
app.post("/api/scores", authenticateToken, async (req, res) => {
  try {
    const { moves } = req.body;

    if (!moves || moves < 1) {
      return res.status(400).json({ error: "Valid moves count is required" });
    }

    // Check if user already has a score, update if better
    const existingScore = await Score.findOne({ userId: req.user.userId });

    if (existingScore) {
      // Only update if new score is better (fewer moves)
      if (moves < existingScore.moves) {
        existingScore.moves = moves;
        existingScore.completedAt = new Date();
        await existingScore.save();

        res.json({
          message: "New best score updated!",
          score: {
            moves: existingScore.moves,
            completedAt: existingScore.completedAt,
            improved: true,
          },
        });
      } else {
        res.json({
          message: "Score submitted, but not your best",
          score: {
            moves: existingScore.moves,
            completedAt: existingScore.completedAt,
            improved: false,
          },
        });
      }
    } else {
      // Create new score
      const score = new Score({
        userId: req.user.userId,
        moves,
      });

      await score.save();

      res.status(201).json({
        message: "Score submitted successfully!",
        score: {
          moves: score.moves,
          completedAt: score.completedAt,
          improved: true,
        },
      });
    }
  } catch (error) {
    console.error("Score submission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const leaderboard = await Score.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $sort: {
          moves: 1, // Sort by moves ascending (fewer moves = better rank)
          completedAt: 1, // If tied, earlier completion wins
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          moves: 1,
          completedAt: 1,
          "user.name": 1,
          "user.email": 1,
        },
      },
    ]);

    // Add rank numbers
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: skip + index + 1,
      name: entry.user.name,
      email: entry.user.email,
      moves: entry.moves,
      completedAt: entry.completedAt,
      date: entry.completedAt.toISOString().split("T")[0],
    }));

    const totalScores = await Score.countDocuments();

    res.json({
      leaderboard: rankedLeaderboard,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalScores / limit),
        totalScores,
        hasNext: page * limit < totalScores,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get User's Best Score
app.get("/api/user/score", authenticateToken, async (req, res) => {
  try {
    const score = await Score.findOne({ userId: req.user.userId });

    if (!score) {
      return res.json({ hasScore: false });
    }

    // Get user's rank
    const betterScores = await Score.countDocuments({
      $or: [
        { moves: { $lt: score.moves } },
        { moves: score.moves, completedAt: { $lt: score.completedAt } },
      ],
    });

    res.json({
      hasScore: true,
      score: {
        moves: score.moves,
        completedAt: score.completedAt,
        rank: betterScores + 1,
      },
    });
  } catch (error) {
    console.error("User score error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Game Statistics
app.get("/api/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalScores = await Score.countDocuments();

    const stats = await Score.aggregate([
      {
        $group: {
          _id: null,
          averageMoves: { $avg: "$moves" },
          minMoves: { $min: "$moves" },
          maxMoves: { $max: "$moves" },
        },
      },
    ]);

    const gameStats = stats[0] || { averageMoves: 0, minMoves: 0, maxMoves: 0 };

    res.json({
      totalUsers,
      totalScores,
      averageMoves: Math.round(gameStats.averageMoves * 10) / 10,
      bestScore: gameStats.minMoves,
      worstScore: gameStats.maxMoves,
      completionRate:
        totalUsers > 0 ? Math.round((totalScores / totalUsers) * 100) : 0,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5009;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

// ===========================
// package.json
// ===========================
/*
{
  "name": "graph-season-game-backend",
  "version": "1.0.0",
  "description": "Backend API for Graph Season Game",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "seed": "node scripts/seedData.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.4",
    "supertest": "^6.3.3"
  },
  "keywords": ["game", "puzzle", "leaderboard", "mern", "mongodb"],
  "author": "Your Name",
  "license": "MIT"
}
*/

// ===========================
// .env (Environment Variables)
// ===========================
/*
# Database
MONGODB_URI=mongodb://localhost:27017/graph_season_game
# For production: mongodb+srv://username:password@cluster.mongodb.net/graph_season_game

# JWT Secret (use a strong random string in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Settings (optional)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
*/

// ===========================
// scripts/seedData.js - Sample Data Seeder
// ===========================
/*
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/graph_season_game');

// Import models (you'll need to adjust paths)
const User = require('../models/User'); // If you split models into separate files
const Score = require('../models/Score');

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Score.deleteMany({});

    // Create sample users
    const users = [
      { name: 'Alice Kumar', email: 'cs22b1001@iiitdm.ac.in' },
      { name: 'Bob Sharma', email: 'me21a2002@iiitdm.ac.in' },
      { name: 'Carol Singh', email: 'ec23b3003@iiitdm.ac.in' },
      { name: 'David Patel', email: 'cs22a4004@iiitdm.ac.in' },
      { name: 'Eva Reddy', email: 'me23c5005@iiitdm.ac.in' }
    ];

    const createdUsers = await User.insertMany(users);

    // Create sample scores
    const scores = [
      { userId: createdUsers[0]._id, moves: 12 },
      { userId: createdUsers[1]._id, moves: 15 },
      { userId: createdUsers[2]._id, moves: 18 },
      { userId: createdUsers[3]._id, moves: 20 },
      { userId: createdUsers[4]._id, moves: 22 }
    ];

    await Score.insertMany(scores);

    console.log('Sample data seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
*/

// ===========================
// API Documentation
// ===========================
/*
# Graph Season Game API Documentation

## Base URL
`http://localhost:5000/api`

## Authentication
Most endpoints require a JWT token in the Authorization header:
`Authorization: Bearer <token>`

## Endpoints

### POST /auth/register
Register a new user
Body: { name: string, email: string }
Returns: { user, token }

### POST /auth/login
Login existing user
Body: { email: string }
Returns: { user, token }

### POST /scores
Submit game score (requires auth)
Body: { moves: number }
Returns: { message, score }

### GET /leaderboard
Get leaderboard (public)
Query params: limit (default: 50), page (default: 1)
Returns: { leaderboard, pagination }

### GET /user/score
Get user's best score (requires auth)
Returns: { hasScore, score?, rank? }

### GET /stats
Get game statistics (public)
Returns: { totalUsers, totalScores, averageMoves, etc. }

### GET /health
Health check endpoint
Returns: { status, timestamp, uptime }
*/
