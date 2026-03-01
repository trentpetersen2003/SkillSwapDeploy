// client/src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import NavBar from "./components/NavBar";
import ForYou from "./pages/ForYou";
import Browse from "./pages/Browse";
import Calendar from "./pages/Calendar";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import API_URL from "./config";
import LoadingState, { InlineLoading } from "./components/LoadingState";
import { withMinimumDelay } from "./utils/loading";
import "./App.css";

const initialForm = { name: "", username: "", email: "", password: "" };
const genericForgotPasswordMessage =
  "If an account exists for that email, a password reset link has been sent.";

function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "success") {
      setMessage("Password reset successful. You can now log in.");
    }
  }, [location.search]);

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
        <img
          className="brand-logo"
          src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
          alt="SkillSwap logo"
        />
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
            <>
              <button type="button" onClick={() => setMode("register")} disabled={submitting}>
                Need an account? Sign up
              </button>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                disabled={submitting}
              >
                Forgot password?
              </button>
            </>
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

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) {
      return;
    }

    if (!email.trim()) {
      setMessage("Email is required.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const { res, data } = await withMinimumDelay(async () => {
        const request = await fetch(`${API_URL}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const payload = await request.json();
        return { res: request, data: payload };
      });

      if (!res.ok) {
        setMessage(data.message || "Request failed");
        return;
      }

      setMessage(data.message || genericForgotPasswordMessage);
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
        <h1>Forgot Password</h1>
        <p className="subtitle">Enter your email and we&apos;ll send a reset link.</p>

        <form onSubmit={handleSubmit} className="form">
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <div className="switcher">
          <button type="button" onClick={() => navigate("/")} disabled={submitting}>
            Back to login
          </button>
        </div>

        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) {
      return;
    }

    setMessage("");

    if (!token) {
      setMessage("Invalid reset link.");
      return;
    }

    if (!password || !confirmPassword) {
      setMessage("Both password fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { res, data } = await withMinimumDelay(async () => {
        const request = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            password,
            confirmPassword,
          }),
        });
        const payload = await request.json();
        return { res: request, data: payload };
      });

      if (!res.ok) {
        setMessage(data.message || "Request failed");
        return;
      }

      navigate("/?reset=success", { replace: true });
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
        <h1>Reset Password</h1>
        <p className="subtitle">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="form">
          <input
            name="password"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        <div className="switcher">
          <button type="button" onClick={() => navigate("/")} disabled={submitting}>
            Back to login
          </button>
        </div>

        {message && <div className="message">{message}</div>}
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
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to="/foryou" replace /> : <LoginPage onLogin={handleLogin} />
          }
        />
        <Route
          path="/forgot-password"
          element={user ? <Navigate to="/foryou" replace /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password/:token"
          element={user ? <Navigate to="/foryou" replace /> : <ResetPasswordPage />}
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
          path="/chat"
          element={
            user ? (
              <>
                <NavBar onLogout={handleLogout} />
                <Chat />
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
