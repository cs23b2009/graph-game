// Enhanced server.js with debugging for MongoDB connection issues

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
      ? "https://graph-game-frontend.onrender.com" 
      : ["http://localhost:3001", "http://localhost:3000"], // Allow both ports
  })
);
app.use(express.json());

// Enhanced MongoDB Connection with better error handling
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/graph_season_game",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;

// Enhanced connection event handlers
db.on("error", (error) => {
  console.error("❌ MongoDB connection error:", error);
});

db.once("open", function () {
  console.log("✅ Connected to MongoDB successfully");
  console.log("📍 Database:", db.name);
  console.log("🔗 Host:", db.host);
  console.log("🔌 Port:", db.port);
});

db.on("disconnected", () => {
  console.log("⚠️  MongoDB disconnected");
});

db.on("reconnected", () => {
  console.log("🔄 MongoDB reconnected");
});

// User Schema (unchanged)
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

// Score Schema (unchanged)
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
      default: [3, 6, 4, 2, 5, 8, 1, 7, 9],
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
const Score = mongoose.model("Score", scoreSchema);

// Enhanced JWT middleware with better error handling
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("🔐 Auth header:", authHeader);
  console.log("🎟️  Token:", token ? "Present" : "Missing");

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your-secret-key",
    (err, user) => {
      if (err) {
        console.error("❌ JWT verification error:", err.message);
        return res.status(403).json({ error: "Invalid token" });
      }
      console.log("✅ JWT verified for user:", user.userId);
      req.user = user;
      next();
    }
  );
};

// Routes

// User Registration (unchanged but with logging)
app.post("/api/auth/register", async (req, res) => {
  try {
    console.log("📝 Registration attempt:", req.body);
    
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    if (name.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Name must be at least 2 characters long" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log("❌ User already exists:", email);
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
    });

    await user.save();
    console.log("✅ User created:", user._id);

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
    console.error("❌ Registration error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enhanced Login with logging
app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("🔑 Login attempt:", req.body);
    
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user._id);

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
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ENHANCED Submit Score with extensive debugging
app.post("/api/scores", authenticateToken, async (req, res) => {
  try {
    console.log("🎯 Score submission started");
    console.log("👤 User ID:", req.user.userId);
    console.log("📊 Request body:", req.body);
    
    const { moves } = req.body;

    if (!moves || moves < 1) {
      console.log("❌ Invalid moves value:", moves);
      return res.status(400).json({ error: "Valid moves count is required" });
    }

    console.log("🔍 Looking for existing score for user:", req.user.userId);
    
    // Check if user exists first
    const user = await User.findById(req.user.userId);
    if (!user) {
      console.log("❌ User not found in database:", req.user.userId);
      return res.status(404).json({ error: "User not found" });
    }
    console.log("✅ User verified:", user.name);

    // Check existing score
    const existingScore = await Score.findOne({ userId: req.user.userId });
    console.log("🔍 Existing score found:", existingScore ? 
      `${existingScore.moves} moves` : "No existing score");

    if (existingScore) {
      if (moves < existingScore.moves) {
        console.log("🎉 New best score! Updating...");
        console.log(`📈 Old: ${existingScore.moves} → New: ${moves}`);
        
        existingScore.moves = moves;
        existingScore.completedAt = new Date();
        
        const savedScore = await existingScore.save();
        console.log("✅ Score updated successfully:", savedScore);

        res.json({
          message: "New best score updated!",
          score: {
            moves: savedScore.moves,
            completedAt: savedScore.completedAt,
            improved: true,
          },
        });
      } else {
        console.log("📊 Score not improved");
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
      console.log("🆕 Creating new score record...");
      
      const score = new Score({
        userId: req.user.userId,
        moves: moves,
      });

      console.log("💾 Saving new score:", score);
      const savedScore = await score.save();
      console.log("✅ New score saved successfully:", savedScore);

      res.status(201).json({
        message: "Score submitted successfully!",
        score: {
          moves: savedScore.moves,
          completedAt: savedScore.completedAt,
          improved: true,
        },
      });
    }
  } catch (error) {
    console.error("❌ Score submission error:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced Leaderboard with logging
app.get("/api/leaderboard", async (req, res) => {
  try {
    console.log("🏆 Leaderboard request");
    
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    console.log(`📄 Pagination: page ${page}, limit ${limit}, skip ${skip}`);

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
          moves: 1,
          completedAt: 1,
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

    console.log(`🏆 Found ${leaderboard.length} leaderboard entries`);

    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: skip + index + 1,
      name: entry.user.name,
      email: entry.user.email,
      moves: entry.moves,
      completedAt: entry.completedAt,
      date: entry.completedAt.toISOString().split("T")[0],
    }));

    const totalScores = await Score.countDocuments();
    console.log(`📊 Total scores in database: ${totalScores}`);

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
    console.error("❌ Leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enhanced User Score endpoint
app.get("/api/user/score", authenticateToken, async (req, res) => {
  try {
    console.log("🔍 Getting user score for:", req.user.userId);
    
    const score = await Score.findOne({ userId: req.user.userId });

    if (!score) {
      console.log("❌ No score found for user");
      return res.json({ hasScore: false });
    }

    console.log("✅ Score found:", score.moves, "moves");

    const betterScores = await Score.countDocuments({
      $or: [
        { moves: { $lt: score.moves } },
        { moves: score.moves, completedAt: { $lt: score.completedAt } },
      ],
    });

    const rank = betterScores + 1;
    console.log("🏆 User rank:", rank);

    res.json({
      hasScore: true,
      score: {
        moves: score.moves,
        completedAt: score.completedAt,
        rank: rank,
      },
    });
  } catch (error) {
    console.error("❌ User score error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Debug endpoint to check database status
app.get("/api/debug", authenticateToken, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const scoreCount = await Score.countDocuments();
    const userScores = await Score.find({ userId: req.user.userId });
    
    res.json({
      database: {
        connected: mongoose.connection.readyState === 1,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      },
      collections: {
        users: userCount,
        scores: scoreCount,
      },
      currentUser: {
        id: req.user.userId,
        scores: userScores,
      },
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Game Statistics (unchanged)
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

// Health Check (unchanged)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  console.log("❌ Route not found:", req.method, req.url);
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5009;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Using default'}`);
  console.log(`🗄️  MongoDB URI: ${process.env.MONGODB_URI || 'Using default'}`);
});

module.exports = app;
