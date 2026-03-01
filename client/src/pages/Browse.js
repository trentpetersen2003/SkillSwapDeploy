// client/src/pages/Browse.js
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SwapRequestModal from "../components/SwapRequestModal";
import LoadingState from "../components/LoadingState";
import API_URL from "../config";
import { withMinimumDelay } from "../utils/loading";
import "./Browse.css";
import "../SwapRequestModal.css";

const SKILL_CATEGORIES = [
  "Academic & Tutoring",
  "Tech & Programming",
  "Languages",
  "Creative & Arts",
  "Career & Professional",
  "Life Skills",
  "Fitness & Wellness",
  "Hobbies & Misc",
];

function Browse() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedUserForSwap, setSelectedUserForSwap] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState("");

  const fetchUsers = useCallback(async (search = "", category = "") => {
    setLoading(true);
    setMessage("");
    setLoadError("");

    try {
      const data = await withMinimumDelay(async () => {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/");
          return [];
        }

        let url = API_URL + "/api/users";
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (category) params.append("category", category);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to fetch users");
        }

        return res.json();
      });

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setLoadError(err.message || "Error loading users");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleSearch(e) {
    e.preventDefault();
    fetchUsers(searchTerm.trim(), selectedCategory);
  }

  function handleCategoryChange(e) {
    const category = e.target.value;
    setSelectedCategory(category);
    fetchUsers(searchTerm.trim(), category);
  }

  function clearFilters() {
    setSearchTerm("");
    setSelectedCategory("");
    fetchUsers("", "");
  }

  function handleSwapRequest(user) {
    setSelectedUserForSwap(user);
  }

  function handleOpenChat(userId) {
    navigate(`/chat?userId=${userId}`);
  }

  function handleCloseModal() {
    setSelectedUserForSwap(null);
  }

  function handleSwapSuccess() {
    const name = selectedUserForSwap?.name || "that user";
    setMessage(`Swap request sent to ${name}!`);
    setSelectedUserForSwap(null);
  }

  async function handleBlockUser(user) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setMessage("");
    setBlockingUserId(user._id);

    try {
      await withMinimumDelay(async () => {
        const res = await fetch(API_URL + "/api/users/blocked", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId: user._id }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to block user");
        }
      });

      setUsers((prev) => prev.filter((existingUser) => existingUser._id !== user._id));
      setMessage(`Blocked @${user.username || "user"}.`);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Unable to block user.");
    } finally {
      setBlockingUserId("");
    }
  }

  if (loading) {
    return <LoadingState message="Loading users..." />;
  }

  if (loadError) {
    return (
      <LoadingState
        message={loadError}
        onRetry={() => fetchUsers(searchTerm.trim(), selectedCategory)}
      />
    );
  }

  return (
    <div className="browse-page">
      <div className="browse-header">
        <h1 className="browse-title">Browse Users</h1>
        <p className="browse-subtitle">
          Search and filter to find users with specific skills.
        </p>
      </div>

      <div className="browse-filters">
        <form onSubmit={handleSearch} className="browse-search-row">
          <input
            className="browse-input"
            type="text"
            placeholder="Search by name, username, or skill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="browse-btn-primary">
            Search
          </button>
        </form>

        <div className="browse-filter-row">
          <select
            className="browse-select"
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="">All Categories</option>
            {SKILL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {(searchTerm || selectedCategory) && (
            <button
              type="button"
              className="browse-btn-secondary"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {message && <div className="browse-message">{message}</div>}

      {users.length === 0 ? (
        <div className="browse-empty">No users found.</div>
      ) : (
        <div className="browse-results">
          {users.map((user) => {
            const offeredSkills =
              user.skills && user.skills.length
                ? user.skills
                    .map((s) => s?.skillName)
                    .filter(Boolean)
                    .join(", ")
                : "None";

            const wantedSkills =
              user.skillsWanted && user.skillsWanted.length
                ? user.skillsWanted
                    .map((s) => s?.skillName)
                    .filter(Boolean)
                    .join(", ")
                : "None";

            return (
              <div key={user._id} className="browse-card">
                <div className="browse-card-main">
                  <div className="browse-name">{user.name || "Unnamed User"}</div>
                  <div className="browse-username">
                    @{user.username || "unknown"}
                  </div>

                  <div className="browse-location">
                    <span>📍</span>
                    <span>
                      {user.locationVisibility === "hidden"
                        ? "Location hidden"
                        : user.city || "Location not set"}
                    </span>
                  </div>

                  {user.bio && <p className="browse-bio">{user.bio}</p>}

                  <div className="browse-skills">
                    <strong>Offering:</strong> {offeredSkills}
                  </div>
                  <div className="browse-skills">
                    <strong>Looking for:</strong> {wantedSkills}
                  </div>
                </div>

                <div className="browse-card-actions">
                  <button
                    type="button"
                    className="browse-request-btn"
                    onClick={() => handleSwapRequest(user)}
                    disabled={blockingUserId === user._id}
                  >
                    Request Swap
                  </button>
                  <button
                    type="button"
                    className="browse-request-btn browse-message-btn"
                    onClick={() => handleOpenChat(user._id)}
                  >
                    Message
                    className="browse-btn-secondary browse-block-btn"
                    onClick={() => handleBlockUser(user)}
                    disabled={Boolean(blockingUserId)}
                  >
                    {blockingUserId === user._id ? "Blocking..." : "Block User"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedUserForSwap && (
        <SwapRequestModal
          user={selectedUserForSwap}
          onClose={handleCloseModal}
          onSuccess={handleSwapSuccess}
        />
      )}
    </div>
  );
}

export default Browse;
