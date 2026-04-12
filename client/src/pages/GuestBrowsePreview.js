import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import { BlockingLoader } from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "./GuestBrowsePreview.css";

const fallbackGuestProfiles = [
  {
    name: "Aisha R.",
    offers: "Python fundamentals, SQL basics",
    wants: "Public speaking, UX writing",
    mode: "Online or in-person",
    location: "Denver, CO",
  },
  {
    name: "Mateo S.",
    offers: "Calculus tutoring, study planning",
    wants: "React project feedback",
    mode: "Online",
    location: "Seattle, WA",
  },
  {
    name: "Priya K.",
    offers: "Figma wireframes, brand mockups",
    wants: "Data visualization",
    mode: "In-person",
    location: "Austin, TX",
  },
];

// Get swap mode label data.
function getSwapModeLabel(value) {
  if (value === "online") return "Online";
  if (value === "in-person") return "In person";
  return "Online or in-person";
}

// Run guest profile mapper logic.
function mapGuestProfile(profile) {
  const offers = Array.isArray(profile.offers) ? profile.offers.join(", ") : profile.offers;
  const wants = Array.isArray(profile.wants) ? profile.wants.join(", ") : profile.wants;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const locationVisibility = profile.locationVisibility || "visible";
  const showLocation = locationVisibility !== "hidden";

  return {
    id: profile.id || profile.username || profile.name,
    name: profile.name || "SkillSwap member",
    offers: offers || "No offers listed yet",
    wants: wants || "No learning goals listed yet",
    mode: profile.mode || getSwapModeLabel(profile.swapMode),
    showLocation,
    location: profile.location || location || "Location not set",
  };
}

function GuestBrowsePreview() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(() => fallbackGuestProfiles.map(mapGuestProfile));
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [loadingRoute, setLoadingRoute] = useState("");

  useEffect(() => {
    let active = true;

    // Run load preview profiles logic.
    async function loadPreviewProfiles() {
      try {
        const response = await fetch(`${API_URL}/api/users/public-preview`);
        const payload = await response.json().catch(() => []);

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error("Preview endpoint unavailable");
        }

        if (!active) {
          return;
        }

        if (payload.length > 0) {
          setProfiles(payload.map(mapGuestProfile));
          setLoadingError("");
        }
      } catch (_error) {
        if (!active) {
          return;
        }

        setLoadingError("Showing example cards while live preview loads.");
        setProfiles(fallbackGuestProfiles.map(mapGuestProfile));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPreviewProfiles();

    return () => {
      active = false;
    };
  }, []);

  // Handle route navigation action.
  async function handleNavigate(path) {
    if (loadingRoute) {
      return;
    }

    setLoadingRoute(path);
    try {
      await withMinimumDelay(Promise.resolve(), 420);
      navigate(path);
    } finally {
      setLoadingRoute("");
    }
  }

  return (
    <main className="guest-preview-page">
      {loadingRoute && <BlockingLoader message="Opening page..." />}
      <section className="guest-preview-shell">
        <header className="guest-preview-topbar">
          <button
            type="button"
            className="guest-preview-home"
            onClick={() => handleNavigate("/")}
            disabled={Boolean(loadingRoute)}
          >
            SkillSwap
          </button>
          <div className="guest-preview-auth-actions">
            <button
              type="button"
              className="guest-preview-link"
              onClick={() => handleNavigate("/login")}
              disabled={Boolean(loadingRoute)}
            >
              Log in
            </button>
            <button
              type="button"
              className="guest-preview-link guest-preview-link--primary"
              onClick={() => handleNavigate("/login?mode=register")}
              disabled={Boolean(loadingRoute)}
            >
              Sign up
            </button>
          </div>
        </header>

        <div className="guest-preview-copy">
          <h1>Guest preview</h1>
          <p>
            Explore the kind of people and swap opportunities waiting in SkillSwap. Create an
            account to message and request swaps.
          </p>
          {loading && <p className="guest-preview-status">Loading live preview cards...</p>}
          {!loading && loadingError && <p className="guest-preview-status">{loadingError}</p>}
        </div>

        <section className="guest-preview-grid" aria-label="Sample swap partners">
          {profiles.map((profile) => (
            <article key={profile.id} className="guest-preview-card">
              <h2>{profile.name}</h2>
              <p><strong>Offers:</strong> {profile.offers}</p>
              <p><strong>Wants:</strong> {profile.wants}</p>
              <p><strong>Swap mode:</strong> {profile.mode}</p>
              {profile.showLocation && <p><strong>Location:</strong> {profile.location}</p>}
              <button
                type="button"
                className="guest-preview-card-cta"
                onClick={() => handleNavigate("/login?mode=register")}
                disabled={Boolean(loadingRoute)}
              >
                Start swapping
              </button>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

export default GuestBrowsePreview;
