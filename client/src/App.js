import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import NavBar from "./components/NavBar";
import ProfileSetupModal from "./components/ProfileSetupModal";
import ForYou from "./pages/ForYou";
import Browse from "./pages/Browse";
import Calendar from "./pages/Calendar";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import API_URL from "./config";
import fetchWithAuth from "./utils/api";
import LoadingState, { InlineLoading } from "./components/LoadingState";
import { withMinimumDelay } from "./utils/loading";
import {
  getProfileSetupPromptStorageKey,
  getProfileSetupStatus,
} from "./utils/profileSetup";
import "./App.css";

const initialForm = { name: "", username: "", email: "", password: "" };
const genericForgotPasswordMessage =
  "If an account exists for that email, a password reset link has been sent.";
const restrictedRouteConfig = {
  "/foryou": "open For You",
  "/chat": "open chat",
  "/calendar": "open your swaps",
};
const completeSetupModalCopy = {
  title: "Finish your profile first",
  description: "You can't use that yet. Finish your profile setup first.",
  primaryLabel: "Go to setup",
  secondaryLabel: "Maybe later",
};

function getDefaultProfileSetupState() {
  return {
    loading: false,
    isComplete: true,
    missingFields: [],
  };
}

function isRestrictedRoute(pathname = "") {
  return Object.prototype.hasOwnProperty.call(restrictedRouteConfig, pathname);
}

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
            password: form.password,
          };

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
        const nextPath = await onLogin(data.user, data.token);
        navigate(nextPath || "/foryou");
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

function AppShell({
  user,
  profileSetup,
  showSetupPrompt,
  blockedAction,
  onDismissSetupPrompt,
  onOpenSetup,
  onCloseBlockedAction,
  onProfileSaved,
  onLogout,
  onRequireProfileSetup,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileComplete = profileSetup.isComplete;
  const [leaveGuard, setLeaveGuard] = useState(null);
  const goToSetup = useCallback(() => {
    onOpenSetup();
    navigate("/profile?setup=1");
  }, [navigate, onOpenSetup]);

  const handleAppNavigation = useCallback((nextPath) => {
    if (typeof leaveGuard === "function" && leaveGuard(nextPath)) {
      return;
    }

    navigate(nextPath);
  }, [leaveGuard, navigate]);

  const handleRegisterLeaveGuard = useCallback((guard) => {
    setLeaveGuard(() => guard);
  }, []);

  useEffect(() => {
    if (!user || profileSetup.loading || isProfileComplete || !isRestrictedRoute(location.pathname)) {
      return;
    }

    onRequireProfileSetup(restrictedRouteConfig[location.pathname] || "use that");
    navigate("/browse", { replace: true });
  }, [
    user,
    profileSetup.loading,
    isProfileComplete,
    location.pathname,
    navigate,
    onRequireProfileSetup,
  ]);

  const navbar = (
    <NavBar
      onLogout={onLogout}
      isProfileComplete={isProfileComplete}
      onRequireProfileSetup={onRequireProfileSetup}
      onBeforeNavigate={handleAppNavigation}
    />
  );

  return (
    <>
      <Routes>
        <Route
          path="/foryou"
          element={isProfileComplete ? <>{navbar}<ForYou /></> : <Navigate to="/browse" replace />}
        />
        <Route
          path="/browse"
          element={
            <>
              {navbar}
              <Browse
                isProfileComplete={isProfileComplete}
                onOpenSetup={goToSetup}
              />
            </>
          }
        />
        <Route
          path="/chat"
          element={isProfileComplete ? <>{navbar}<Chat /></> : <Navigate to="/browse" replace />}
        />
        <Route
          path="/calendar"
          element={isProfileComplete ? <>{navbar}<Calendar /></> : <Navigate to="/browse" replace />}
        />
        <Route
          path="/profile"
          element={
            <>
              {navbar}
              <Profile
                onLogout={onLogout}
                setupRequired={!isProfileComplete}
                missingSetupFields={profileSetup.missingFields}
                onProfileSaved={onProfileSaved}
                onRegisterLeaveGuard={handleRegisterLeaveGuard}
              />
            </>
          }
        />
        <Route
          path="/settings"
          element={
            <>
              {navbar}
              <Settings
                onLogout={onLogout}
                setupRequired={!isProfileComplete}
              />
            </>
          }
        />
      </Routes>

      <ProfileSetupModal
        open={showSetupPrompt}
        title="Set up your profile"
        description="Finish your profile before you start swapping."
        hint="Add your time zone, availability, and skills when you're ready."
        primaryLabel="Finish setup"
        secondaryLabel="Skip for now"
        onPrimary={goToSetup}
        onSecondary={onDismissSetupPrompt}
      />

      <ProfileSetupModal
        open={Boolean(blockedAction)}
        title={blockedAction?.title || completeSetupModalCopy.title}
        description={blockedAction?.description || completeSetupModalCopy.description}
        primaryLabel={blockedAction?.primaryLabel || completeSetupModalCopy.primaryLabel}
        secondaryLabel={blockedAction?.secondaryLabel || completeSetupModalCopy.secondaryLabel}
        onPrimary={goToSetup}
        onSecondary={onCloseBlockedAction}
        onClose={onCloseBlockedAction}
      />
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [profileSetup, setProfileSetup] = useState(() => ({
    ...getDefaultProfileSetupState(),
    loading: true,
  }));
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [blockedAction, setBlockedAction] = useState(null);

  const updateStoredUser = useCallback((nextUser) => {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }, []);

  const refreshProfileSetup = useCallback(async (token, nextUser = null) => {
    if (!token) {
      const defaultState = getDefaultProfileSetupState();
      setProfileSetup(defaultState);
      return defaultState;
    }

    setProfileSetup((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetchWithAuth(`${API_URL}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.message || "Failed to load profile");
      }

      const nextStatus = {
        loading: false,
        ...getProfileSetupStatus(payload),
      };

      setProfileSetup(nextStatus);

      const baseUser = nextUser;
      if (baseUser) {
        const syncedUser = {
          ...baseUser,
          name: payload.name || baseUser.name || "",
          email: payload.email || baseUser.email || "",
          profileSetupComplete: nextStatus.isComplete,
        };
        updateStoredUser(syncedUser);
      }

      const userId = String(payload._id || nextUser?.id || nextUser?._id || "");
      if (nextStatus.isComplete && userId) {
        localStorage.removeItem(getProfileSetupPromptStorageKey(userId));
      }

      return nextStatus;
    } catch (err) {
      console.error("Error loading profile setup status:", err);
      const fallbackState = getDefaultProfileSetupState();
      setProfileSetup(fallbackState);
      return fallbackState;
    }
  }, [updateStoredUser]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const savedToken = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (!savedToken || !savedUser) {
        if (isMounted) {
          setProfileSetup(getDefaultProfileSetupState());
          setAuthChecking(false);
        }
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        if (!isMounted) {
          return;
        }

        setUser(parsedUser);
        await withMinimumDelay(() => refreshProfileSetup(savedToken, parsedUser));
      } catch (err) {
        console.error("Unable to restore saved session", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (isMounted) {
          setUser(null);
          setProfileSetup(getDefaultProfileSetupState());
        }
      } finally {
        if (isMounted) {
          setAuthChecking(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [refreshProfileSetup]);

  useEffect(() => {
    if (!user || profileSetup.loading || profileSetup.isComplete) {
      setShowSetupPrompt(false);
      return;
    }

    const userId = String(user.id || user._id || "");
    const hasDismissedPrompt = localStorage.getItem(
      getProfileSetupPromptStorageKey(userId)
    ) === "true";

    setShowSetupPrompt(!hasDismissedPrompt);
  }, [user, profileSetup.loading, profileSetup.isComplete]);

  const handleLogin = useCallback(async (userData, userToken) => {
    localStorage.setItem("token", userToken);
    updateStoredUser(userData);
    const nextStatus = await refreshProfileSetup(userToken, userData);
    return nextStatus.isComplete ? "/foryou" : "/browse";
  }, [refreshProfileSetup, updateStoredUser]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setProfileSetup(getDefaultProfileSetupState());
    setShowSetupPrompt(false);
    setBlockedAction(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  const handleDismissSetupPrompt = useCallback(() => {
    const userId = String(user?.id || user?._id || "");
    if (userId) {
      localStorage.setItem(getProfileSetupPromptStorageKey(userId), "true");
    }
    setShowSetupPrompt(false);
  }, [user]);

  const handleOpenSetup = useCallback(() => {
    const userId = String(user?.id || user?._id || "");
    if (userId) {
      localStorage.removeItem(getProfileSetupPromptStorageKey(userId));
    }
    setShowSetupPrompt(false);
    setBlockedAction(null);
  }, [user]);

  const handleRequireProfileSetup = useCallback((actionLabel = "do that") => {
    setBlockedAction({
      title: "Finish your profile first",
      description: `You can't ${actionLabel} yet. Finish your profile setup first.`,
      primaryLabel: "Go to setup",
      secondaryLabel: "Maybe later",
    });
  }, []);

  const handleProfileSaved = useCallback((savedProfile) => {
    const nextStatus = {
      loading: false,
      ...getProfileSetupStatus(savedProfile),
    };
    setProfileSetup(nextStatus);

    if (user) {
      const userId = String(user.id || user._id || "");
      if (nextStatus.isComplete && userId) {
        localStorage.removeItem(getProfileSetupPromptStorageKey(userId));
      }

      updateStoredUser({
        ...user,
        name: savedProfile.name || user.name || "",
        email: savedProfile.email || user.email || "",
        profileSetupComplete: nextStatus.isComplete,
      });
    }
  }, [updateStoredUser, user]);

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
          path="*"
          element={
            user ? (
              <AppShell
                user={user}
                profileSetup={profileSetup}
                showSetupPrompt={showSetupPrompt}
                blockedAction={blockedAction}
                onDismissSetupPrompt={handleDismissSetupPrompt}
                onOpenSetup={handleOpenSetup}
                onCloseBlockedAction={() => setBlockedAction(null)}
                onProfileSaved={handleProfileSaved}
                onLogout={handleLogout}
                onRequireProfileSetup={handleRequireProfileSetup}
              />
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
