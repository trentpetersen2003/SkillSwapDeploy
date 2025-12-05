import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function ForYouPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadUsers() {
      const token = localStorage.getItem("token");
      if (!token) {
        // not logged in → send back to login
        navigate("/login");
        return;
      }

      try {
        const res = await fetch("/api/for-you", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage(data.message || "Failed to load users");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error("Error loading users:", err);
        setMessage("Something went wrong loading users.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [navigate]);

  function handleSwapClick(user) {
    // no real functionality yet – PoC only
    console.log("Swap clicked for:", user.name, user._id);
  }

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading users...</div>;
  }

return (
  <div className="for-you">
    <h1 className="for-you__title">For You</h1>
    <p className="for-you__subtitle">
      People you can potentially swap skills with.
    </p>

    {message && <p className="for-you__message">{message}</p>}

    {users.length === 0 ? (
      <p className="for-you__empty">
        No other users yet. Try inviting friends.
      </p>
    ) : (
      <div className="for-you__list">
        {users.map((user) => (
          <div key={user._id} className="for-you__card">
            <div>
              <div className="for-you__name">{user.name}</div>
              <div className="for-you__email">{user.email}</div>
            </div>
            <button
              type="button"
              className="for-you__swap-btn"
              onClick={() => console.log("Swap clicked for", user.name)}
            >
              Swap
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

}

export default ForYouPage;
