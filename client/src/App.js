// client/src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import ForYou from "./pages/ForYou";
import Browse from "./pages/Browse";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import API_URL from "./config";
import LoadingState, { InlineLoading } from "./components/LoadingState";
import { withMinimumDelay } from "./utils/loading";
import "./App.css";

const initialForm = { name: "", username: "", email: "", password: "" };

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) {
      return;
    }

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

    setSubmitting(true);
    try {
      const { res, data } = await withMinimumDelay(async () => {
        const request = await fetch(API_URL + endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await request.json();
        return { res: request, data: payload };
      });

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
    } finally {
      setSubmitting(false);
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
              disabled={submitting}
            />
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              disabled={submitting}
            />
            </>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            disabled={submitting}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Log in"
                : "Sign up"}
          </button>
        </form>

        <div className="switcher">
          {mode === "login" ? (
            <button type="button" onClick={() => setMode("register")} disabled={submitting}>
              Need an account? Sign up
            </button>
          ) : (
            <button type="button" onClick={() => setMode("login")} disabled={submitting}>
              Have an account? Log in
            </button>
          )}
        </div>

        {submitting ? (
          <div className="message">
            <InlineLoading
              message={mode === "login" ? "Logging in..." : "Creating your account..."}
            />
          </div>
        ) : (
          message && <div className="message">{message}</div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      await withMinimumDelay(async () => {
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (!isMounted) {
          return;
        }

        if (savedToken && savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (err) {
            console.error("Unable to parse saved user", err);
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
        }
      });

      if (isMounted) {
        setAuthChecking(false);
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleLogin(userData, userToken) {
    setUser(userData);
    localStorage.setItem("token", userToken);
    localStorage.setItem("user", JSON.stringify(userData));
  }


  function handleLogout() {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  if (authChecking) {
    return <LoadingState message="Checking session..." />;
  }

  return (
    <Router basename="/VectorForge">
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
        <Route
          path="/settings"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <Settings onLogout={handleLogout} />
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