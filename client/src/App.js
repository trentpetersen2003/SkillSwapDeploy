// client/src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import ForYou from "./pages/ForYou";
import Browse from "./pages/Browse";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import "./App.css";

const initialForm = { name: "", username: "", email: "", password: "" };

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!form.email.trim() || !form.password.trim()) {
      setMessage("Email and password are required.");
      return;
    }
    if (mode === "register" && !form.name.trim()) {
      setMessage("Name is required to register.");
      return;
    }
    if (mode === "register" && !form.username.trim()) { 
      setMessage("Username is required to register."); 
      return; 
    }

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login"
        ? { email: form.email.trim(), password: form.password }
        : { 
            name: form.name.trim(),
            username: form.username.trim(),
            email: form.email.trim(), 
            password: form.password };

    try {
      console.log("Mode:", mode, "Endpoint:", endpoint, "Body:", body);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Request failed");
        return;
      }

      if (mode === "login") {
        onLogin(data.user, data.token);
        navigate("/foryou");
      } else {
        setMessage("Account created. You can log in now.");
        setMode("login");
      }

      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong. Try again.");
    }
  }

  return (
    <div className="App">
      <div className="card">
        <h1>SkillSwap</h1>
        <p className="subtitle">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit} className="form">
          {mode === "register" && (
            <>
            <input
              name="name"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
            />
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />
            </>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />
          <button type="submit">
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <div className="switcher">
          {mode === "login" ? (
            <button type="button" onClick={() => setMode("register")}>
              Need an account? Sign up
            </button>
          ) : (
            <button type="button" onClick={() => setMode("login")}>
              Have an account? Log in
            </button>
          )}
        </div>

        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogin(userData, userToken) {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("token", userToken);
    localStorage.setItem("user", JSON.stringify(userData));
  }

  function handleLogout() {
    setUser(null);
    setToken("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to="/foryou" replace /> : <LoginPage onLogin={handleLogin} />
          }
        />
        <Route
          path="/foryou"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <ForYou />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/browse"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <Browse />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/calendar"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <Calendar />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <Profile onLogout={handleLogout} />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;