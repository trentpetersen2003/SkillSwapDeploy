// client/src/components/SwapRequestModal.js
import React, { useState, useEffect } from "react";

function SwapRequestModal({ user, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    skillOffered: "",
    skillWanted: "",
    scheduledDate: "",
    scheduledTime: "",
    duration: "60",
    location: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUserSkills, setCurrentUserSkills] = useState([]);

  useEffect(() => {
    // Load current user's skills
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        // Fetch full profile to get skills
        fetchCurrentUserProfile();
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, []);

  async function fetchCurrentUserProfile() {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/users/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUserSkills(data.skills || []);
      }
    } catch (err) {
      console.error("Error fetching current user profile:", err);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (
      !formData.skillOffered ||
      !formData.skillWanted ||
      !formData.scheduledDate ||
      !formData.scheduledTime
    ) {
      setError("Please fill in all required fields");
      return;
    }

    // Combine date and time
    const scheduledDateTime = `${formData.scheduledDate}T${formData.scheduledTime}`;

    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId: user._id,
          skillOffered: formData.skillOffered,
          skillWanted: formData.skillWanted,
          scheduledDate: scheduledDateTime,
          duration: parseInt(formData.duration),
          location: formData.location,
          notes: formData.notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send swap request");
      }

      const data = await res.json();
      onSuccess(data);
    } catch (err) {
      console.error("Error sending swap request:", err);
      setError(err.message || "Failed to send swap request");
    } finally {
      setLoading(false);
    }
  }

  // Get user's skills they want to learn
  const recipientSkills =
    user.skills && user.skills.length > 0
      ? user.skills.map((s) => s.skillName || s).filter(Boolean)
      : [];

  // Get what user wants to learn (what we can offer)
  const recipientWants =
    user.skillsWanted && user.skillsWanted.length > 0
      ? user.skillsWanted.map((s) => s.skillName || s).filter(Boolean)
      : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Swap with {user.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="swap-request-form">
          <div className="form-group">
            <label htmlFor="skillOffered">
              Skill You'll Teach <span className="required">*</span>
            </label>
            <select
              id="skillOffered"
              name="skillOffered"
              value={formData.skillOffered}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill...</option>
              {currentUserSkills.map((skill, idx) => (
                <option key={idx} value={skill.skillName}>
                  {skill.skillName}
                </option>
              ))}
            </select>
            {currentUserSkills.length === 0 && (
              <p className="form-hint">
                Add skills to your profile to offer them in swaps
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="skillWanted">
              Skill You Want to Learn <span className="required">*</span>
            </label>
            <select
              id="skillWanted"
              name="skillWanted"
              value={formData.skillWanted}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill...</option>
              {recipientSkills.map((skill, idx) => (
                <option key={idx} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            {recipientSkills.length === 0 && (
              <p className="form-hint">
                This user hasn't listed any skills yet
              </p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="scheduledDate">
                Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="scheduledDate"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="scheduledTime">
                Time <span className="required">*</span>
              </label>
              <input
                type="time"
                id="scheduledTime"
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Duration (minutes)</label>
            <select
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
            >
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location/Meeting Link</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Zoom, Coffee Shop, etc."
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional information..."
              rows="3"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || currentUserSkills.length === 0 || recipientSkills.length === 0}
            >
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SwapRequestModal;
