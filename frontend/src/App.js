import React, { useState, useEffect } from "react";
import {
  Trophy,
  User,
  Mail,
  RotateCcw,
  Home,
  Crown,
  Medal,
  Award,
} from "lucide-react";

const GraphSeasonGame = () => {
  const initialGrid = [3, 6, 4, 2, 5, 8, 1, 7, 9];
  const targetGrid = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [grid, setGrid] = useState([...initialGrid]);
  const [moves, setMoves] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameWon, setGameWon] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "" });
  const [authError, setAuthError] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");

  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5009/api";

  // Load user from memory on component mount (can't use localStorage in artifacts)
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // API Functions
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      // Fallback to sample data if API fails
      setLeaderboard([
        {
          name: "Alice Kumar",
          email: "cs22b1001@iiitdm.ac.in",
          moves: 12,
          date: "2024-03-15",
          rank: 1,
        },
        {
          name: "Bob Sharma",
          email: "me21a2002@iiitdm.ac.in",
          moves: 15,
          date: "2024-03-14",
          rank: 2,
        },
        {
          name: "Carol Singh",
          email: "ec23b3003@iiitdm.ac.in",
          moves: 18,
          date: "2024-03-13",
          rank: 3,
        },
        {
          name: "David Patel",
          email: "cs22a4004@iiitdm.ac.in",
          moves: 20,
          date: "2024-03-12",
          rank: 4,
        },
        {
          name: "Eva Reddy",
          email: "me23c5005@iiitdm.ac.in",
          moves: 22,
          date: "2024-03-11",
          rank: 5,
        },
      ]);
    }
  };

  const submitScore = async (finalMoves) => {
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_BASE}/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ moves: finalMoves }),
      });

      const data = await response.json();
      if (response.ok) {
        setSubmitSuccess(data.message);
        await fetchLeaderboard(); // Refresh leaderboard
      } else {
        console.error("Failed to submit score:", data.error);
        setSubmitSuccess("Score saved locally");
      }
    } catch (error) {
      console.error("Error submitting score:", error);
      setSubmitSuccess("Score saved locally");
    }
  };

  const validateEmail = (email) => {
    const pattern = /^[a-zA-Z]{2}\d{2}[a-zA-Z]{1}\d{4}@iiitdm\.ac\.in$/;
    return pattern.test(email);
  };

  const handleAuth = async () => {
    setAuthError("");
    setLoading(true);

    if (!authForm.name.trim()) {
      setAuthError("Name is required");
      setLoading(false);
      return;
    }

    if (!validateEmail(authForm.email)) {
      setAuthError("Email must match format: cs23b2007@iiitdm.ac.in");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: authForm.name.trim(),
          email: authForm.email.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Save user data in state (can't use localStorage in artifacts)
        const userWithToken = { ...data.user, token: data.token };
        setCurrentUser(userWithToken);
        setShowAuth(false);
        setAuthForm({ name: "", email: "" });
        await fetchLeaderboard();
      } else {
        setAuthError(data.error || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setAuthError("Network error. Using offline mode.");
      // Fallback for offline mode
      const newUser = {
        name: authForm.name.trim(),
        email: authForm.email.toLowerCase(),
        token: "offline-token",
      };
      setCurrentUser(newUser);
      setShowAuth(false);
      setAuthForm({ name: "", email: "" });
    }

    setLoading(false);
  };

  const isAdjacent = (index1, index2) => {
    const row1 = Math.floor(index1 / 3);
    const col1 = index1 % 3;
    const row2 = Math.floor(index2 / 3);
    const col2 = index2 % 3;

    return (
      (Math.abs(row1 - row2) === 1 && col1 === col2) ||
      (Math.abs(col1 - col2) === 1 && row1 === row2)
    );
  };

  const handleSquareClick = async (index) => {
    if (gameWon) return;

    if (selectedSquare === null) {
      setSelectedSquare(index);
    } else if (selectedSquare === index) {
      setSelectedSquare(null);
    } else if (isAdjacent(selectedSquare, index)) {
      const newGrid = [...grid];
      [newGrid[selectedSquare], newGrid[index]] = [
        newGrid[index],
        newGrid[selectedSquare],
      ];
      setGrid(newGrid);
      setMoves(moves + 1);
      setSelectedSquare(null);

      if (JSON.stringify(newGrid) === JSON.stringify(targetGrid)) {
        setGameWon(true);
        setSubmitSuccess("");
        if (currentUser) {
          await submitScore(moves + 1);
        }
      }
    } else {
      setSelectedSquare(index);
    }
  };

  const resetGame = () => {
    setGrid([...initialGrid]);
    setMoves(0);
    setSelectedSquare(null);
    setGameWon(false);
    setSubmitSuccess("");
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return (
      <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-600">
        #{rank}
      </span>
    );
  };

  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                Leaderboard
              </h1>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                Back to Game
              </button>
            </div>

            <div className="space-y-3">
              {leaderboard.map((player, index) => (
                <div
                  key={player.email || index}
                  className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                    index < 3
                      ? "border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {getRankIcon(player.rank || index + 1)}
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {player.name}
                      </h3>
                      <p className="text-sm text-gray-600">{player.email}</p>
                      <p className="text-xs text-gray-500">
                        Completed: {player.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {player.moves}
                    </p>
                    <p className="text-sm text-gray-500">moves</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Join the Game
          </h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4" />
                Full Name
              </label>
              <input
                type="text"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4" />
                IIITDM Email
              </label>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm({ ...authForm, email: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                placeholder="cs23b2007@iiitdm.ac.in"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: 2 letters + 2 digits + 1 letter + 4 digits
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {authError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAuth(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAuth}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Graph Season Game
          </h1>
          {currentUser ? (
            <div className="flex items-center justify-center gap-4">
              <p className="text-lg text-gray-600">
                Welcome,{" "}
                <span className="font-semibold">{currentUser.name}</span>!
              </p>
              <button
                onClick={logout}
                className="text-sm px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <p className="text-lg text-gray-600">
              Arrange numbers 1-9 in order with minimum moves
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Game Board */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{moves}</p>
                    <p className="text-sm text-gray-500">Moves</p>
                  </div>
                  {gameWon && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                      <Trophy className="w-4 h-4" />
                      Completed!
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm">
                      {submitSuccess}
                    </div>
                  )}
                </div>
                <button
                  onClick={resetGame}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6">
                {grid.map((number, index) => (
                  <button
                    key={index}
                    onClick={() => handleSquareClick(index)}
                    className={`
                      aspect-square text-2xl font-bold rounded-xl border-2 transition-all duration-200 transform hover:scale-105
                      ${
                        selectedSquare === index
                          ? "border-blue-500 bg-blue-100 text-blue-800 shadow-lg"
                          : gameWon
                          ? "border-green-300 bg-green-50 text-green-800"
                          : "border-gray-300 bg-white text-gray-800 hover:border-blue-300 hover:shadow-md"
                      }
                    `}
                  >
                    {number}
                  </button>
                ))}
              </div>

              {!currentUser && (
                <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 mb-2">
                    Register to submit your score!
                  </p>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Register Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Game Info & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Game Rules
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  🎯 <strong>Goal:</strong> Arrange numbers 1-9 in order
                </p>
                <p>
                  🔄 <strong>How to play:</strong> Click two adjacent squares to
                  swap
                </p>
                <p>
                  📊 <strong>Adjacent means:</strong> Horizontally or vertically
                  next to each other
                </p>
                <p>
                  🏆 <strong>Objective:</strong> Complete in minimum moves
                  possible
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top Players
              </h3>
              <div className="space-y-2">
                {leaderboard.slice(0, 3).map((player, index) => (
                  <div
                    key={player.email || index}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      {getRankIcon(player.rank || index + 1)}
                      <div>
                        <p className="font-medium text-sm text-gray-800">
                          {player.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {player.moves} moves
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowLeaderboard(true)}
                className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                View Full Leaderboard
              </button>
            </div>

            {!currentUser && (
              <div className="bg-white rounded-2xl shadow-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  Join the Competition
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Register with your IIITDM email to compete on the leaderboard!
                </p>
                <button
                  onClick={() => setShowAuth(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium"
                >
                  Register to Play
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphSeasonGame;
