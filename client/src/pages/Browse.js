// client/src/pages/Browse.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SwapRequestModal from "../components/SwapRequestModal";
import LoadingState from "../components/LoadingState";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
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

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SWAP_MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "in-person", label: "In Person" },
  { value: "either", label: "Open to Either" },
];

const INITIAL_FILTERS = {
  search: "",
  categories: [],
  location: "",
  minRating: "",
  availabilityDays: [],
  swapModes: [],
};

const RELAX_FILTER_PRIORITY = [
  "minRating",
  "availabilityDays",
  "swapModes",
  "location",
  "categories",
  "search",
];

function getReliabilityToneClass(score) {
  if (score === null || score === undefined) {
    return "browse-reliability--new";
  }
  if (score >= 85) return "browse-reliability--high";
  if (score >= 70) return "browse-reliability--good";
  if (score >= 50) return "browse-reliability--building";
  return "browse-reliability--low";
}

function getBrowseMatchToneClass(score) {
  if (score === null || score === undefined) {
    return "browse-match--unknown";
  }
  if (score >= 80) return "browse-match--excellent";
  if (score >= 65) return "browse-match--strong";
  if (score >= 45) return "browse-match--moderate";
  return "browse-match--weak";
}

function getSwapModeLabel(value) {
  if (value === "online") return "Online";
  if (value === "in-person") return "In Person";
  return "Open to Either";
}

function getFilterRelaxLabel(key, filters) {
  if (key === "minRating") return `Lower minimum rating (${filters.minRating}+)`;
  if (key === "availabilityDays") return "Remove selected days";
  if (key === "swapModes") return "Broaden swap mode";
  if (key === "location") return `Widen location (${filters.location})`;
  if (key === "categories") return "Remove selected categories";
  if (key === "search") return `Clear search (${filters.search})`;
  return "Relax filter";
}

function normalizeSwapMode(value) {
  if (value === "online" || value === "in-person" || value === "either") {
    return value;
  }
  return "either";
}

function isSwapModeCompatible(selectedSwapMode, candidateSwapMode) {
  const normalizedCandidate = normalizeSwapMode(candidateSwapMode);
  if (!Array.isArray(selectedSwapMode) || selectedSwapMode.length === 0) return true;

  return selectedSwapMode.some((mode) => {
    if (mode === "online") return ["online", "either"].includes(normalizedCandidate);
    if (mode === "in-person") return ["in-person", "either"].includes(normalizedCandidate);
    return normalizedCandidate === "either";
  });
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.search ||
      filters.categories.length > 0 ||
      filters.location ||
      filters.minRating ||
      filters.availabilityDays.length > 0 ||
      filters.swapModes.length > 0
  );
}

function scoreClosestMatch(candidate, filters) {
  let score = 0;
  const reasons = [];

  if (filters.minRating) {
    const threshold = Number(filters.minRating);
    const candidateRating = Number(candidate.reliability?.averageRating || 0);
    if (candidateRating >= threshold) {
      score += 3;
      reasons.push(`Meets rating ${filters.minRating}+`);
    } else if (candidateRating > 0) {
      const diff = threshold - candidateRating;
      const partialScore = Math.max(0, 2 - diff);
      score += partialScore;
      reasons.push(`Close rating: ${candidateRating.toFixed(1)}/5`);
    }
  }

  if (filters.availabilityDays.length > 0) {
    const hasDay = Array.isArray(candidate.availability)
      ? candidate.availability.some((slot) => filters.availabilityDays.includes(slot?.day))
      : false;
    if (hasDay) {
      score += 3;
      reasons.push("Matches selected availability day(s)");
    }
  }

  if (filters.swapModes.length > 0 && isSwapModeCompatible(filters.swapModes, candidate.swapMode)) {
    score += 2;
    reasons.push(`Swap mode: ${getSwapModeLabel(candidate.swapMode)}`);
  }

  if (filters.location) {
    const normalizedLocation = filters.location.toLowerCase();
    const candidateCity = String(candidate.city || "").toLowerCase();
    if (candidateCity.includes(normalizedLocation)) {
      score += 2;
      reasons.push(`Location: ${candidate.city}`);
    }
  }

  if (filters.categories.length > 0) {
    const categories = [
      ...(Array.isArray(candidate.skills) ? candidate.skills : []),
      ...(Array.isArray(candidate.skillsWanted) ? candidate.skillsWanted : []),
    ].map((skill) => skill?.category).filter(Boolean);
    if (filters.categories.some((category) => categories.includes(category))) {
      score += 2;
      reasons.push("Matches selected category");
    }
  }

  if (filters.search) {
    const normalizedSearch = filters.search.toLowerCase();
    const textBlob = [
      candidate.name,
      candidate.username,
      ...(Array.isArray(candidate.skills) ? candidate.skills.map((skill) => skill?.skillName) : []),
      ...(Array.isArray(candidate.skillsWanted)
        ? candidate.skillsWanted.map((skill) => skill?.skillName)
        : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (textBlob.includes(normalizedSearch)) {
      score += 2;
      reasons.push("Search term matches profile");
    }
  }

  return {
    score,
    reasons,
  };
}

function buildFilterCounts(candidates) {
  const categoryCounts = {};
  const availabilityCounts = {};

  SKILL_CATEGORIES.forEach((category) => {
    categoryCounts[category] = 0;
  });
  DAYS_OF_WEEK.forEach((day) => {
    availabilityCounts[day] = 0;
  });

  let onlineCount = 0;
  let inPersonCount = 0;
  let eitherCount = 0;

  candidates.forEach((candidate) => {
    const uniqueCategories = new Set(
      [
        ...(Array.isArray(candidate.skills) ? candidate.skills : []),
        ...(Array.isArray(candidate.skillsWanted) ? candidate.skillsWanted : []),
      ]
        .map((skill) => skill?.category)
        .filter(Boolean)
    );
    uniqueCategories.forEach((category) => {
      if (categoryCounts[category] !== undefined) {
        categoryCounts[category] += 1;
      }
    });

    const uniqueDays = new Set(
      (Array.isArray(candidate.availability) ? candidate.availability : [])
        .map((slot) => slot?.day)
        .filter(Boolean)
    );
    uniqueDays.forEach((day) => {
      if (availabilityCounts[day] !== undefined) {
        availabilityCounts[day] += 1;
      }
    });

    const normalizedSwapMode = normalizeSwapMode(candidate.swapMode);
    if (["online", "either"].includes(normalizedSwapMode)) {
      onlineCount += 1;
    }
    if (["in-person", "either"].includes(normalizedSwapMode)) {
      inPersonCount += 1;
    }
    if (normalizedSwapMode === "either") {
      eitherCount += 1;
    }
  });

  return {
    categories: categoryCounts,
    availabilityDays: availabilityCounts,
    swapModes: {
      online: onlineCount,
      "in-person": inPersonCount,
      either: eitherCount,
    },
  };
}

function getNearestRatingTick(value) {
  const numericValue = Number(value || 0);
  const ticks = [0, 1, 2, 3, 4, 5];

  return ticks.reduce((closest, tick) => {
    const currentDistance = Math.abs(tick - numericValue);
    const closestDistance = Math.abs(closest - numericValue);
    return currentDistance < closestDistance ? tick : closest;
  }, 0);
}

function normalizeFilterDraft(filters) {
  return {
    ...filters,
    search: (filters.search || "").trim(),
    location: (filters.location || "").trim(),
  };
}

function hasFilterValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value);
}

function getComparableFilters(filters) {
  return {
    ...filters,
    categories: [...filters.categories].sort(),
    availabilityDays: [...filters.availabilityDays].sort(),
    swapModes: [...filters.swapModes].sort(),
  };
}

function Browse() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedUserForSwap, setSelectedUserForSwap] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState("");
  const [messageAction, setMessageAction] = useState(null);
  const [closestMatches, setClosestMatches] = useState([]);
  const [filterCounts, setFilterCounts] = useState({
    categories: {},
    availabilityDays: {},
    swapModes: {},
  });
  const requestVersionRef = useRef(0);

  const hasPendingFilterChanges =
    JSON.stringify(getComparableFilters(normalizeFilterDraft(filters))) !==
    JSON.stringify(getComparableFilters(appliedFilters));

  const runUsersQuery = useCallback(async (nextFilters = INITIAL_FILTERS) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return [];
    }

    let url = API_URL + "/api/users";
    const params = new URLSearchParams();
    if (nextFilters.search) params.append("search", nextFilters.search);
    nextFilters.categories.forEach((category) => params.append("category", category));
    if (nextFilters.location) params.append("location", nextFilters.location);
    if (nextFilters.minRating) params.append("minRating", nextFilters.minRating);
    nextFilters.availabilityDays.forEach((day) => params.append("availabilityDay", day));
    nextFilters.swapModes.forEach((mode) => params.append("swapMode", mode));
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetchWithAuth(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.message || "Failed to fetch users");
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, [navigate]);

  const fetchUsers = useCallback(async (nextFilters = INITIAL_FILTERS) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setLoading(true);
    setMessage("");
    setLoadError("");

    try {
      const data = await withMinimumDelay(async () => runUsersQuery(nextFilters));

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setUsers(data);

      const countBaseFilters = {
        ...INITIAL_FILTERS,
        search: nextFilters.search,
        location: nextFilters.location,
      };
      const countBaseUsers = await runUsersQuery(countBaseFilters);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setFilterCounts(buildFilterCounts(countBaseUsers));

      if (data.length > 0 || !hasActiveFilters(nextFilters)) {
        setClosestMatches([]);
      } else {
        let fallbackPool = [];
        for (const filterKey of RELAX_FILTER_PRIORITY) {
          if (!hasFilterValue(nextFilters[filterKey])) {
            continue;
          }
          const relaxedFilters = {
            ...nextFilters,
            [filterKey]: Array.isArray(nextFilters[filterKey]) ? [] : "",
          };
          fallbackPool = await runUsersQuery(relaxedFilters);
          if (fallbackPool.length > 0) {
            break;
          }
        }

        if (fallbackPool.length === 0) {
          setClosestMatches([]);
        } else {
          const rankedClosest = fallbackPool
            .map((candidate) => {
              const match = scoreClosestMatch(candidate, nextFilters);
              return {
                ...candidate,
                closestScore: match.score,
                closestReasons: match.reasons,
              };
            })
            .filter((candidate) => candidate.closestScore > 0)
            .sort((a, b) => {
              if (b.closestScore !== a.closestScore) {
                return b.closestScore - a.closestScore;
              }
              return (b.matchScore || 0) - (a.matchScore || 0);
            })
            .slice(0, 3);

          setClosestMatches(rankedClosest);
        }
      }
    } catch (err) {
      console.error(err);
      setUsers([]);
      setClosestMatches([]);
      setFilterCounts({
        categories: {},
        availabilityDays: {},
        swapModes: {},
      });
      setLoadError(err.message || "Error loading users");
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [runUsersQuery]);

  const applyDraftFilters = useCallback((nextDraftFilters, { closePanel = false } = {}) => {
    const nextApplied = normalizeFilterDraft(nextDraftFilters);
    setFilters(nextApplied);
    setAppliedFilters(nextApplied);
    if (closePanel) {
      setIsFilterPanelOpen(false);
    }
    fetchUsers(nextApplied);
  }, [fetchUsers]);

  useEffect(() => {
    fetchUsers(INITIAL_FILTERS);
  }, [fetchUsers]);

  function handleSearch(e) {
    e.preventDefault();
    applyDraftFilters(filters);
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleRatingSliderChange(e) {
    const sliderValue = e.target.value;
    const nextMinRating = sliderValue === "0" ? "" : sliderValue;
    setFilters((prev) => ({ ...prev, minRating: nextMinRating }));
  }

  function handleChecklistToggle(filterKey, value) {
    setFilters((prev) => {
      const currentValues = Array.isArray(prev[filterKey]) ? prev[filterKey] : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];
      const nextFilters = {
        ...prev,
        [filterKey]: nextValues,
      };
      return nextFilters;
    });
  }

  function handleOpenFilterPanel() {
    setFilters(appliedFilters);
    setIsFilterPanelOpen(true);
  }

  function handleToggleFilterPanel() {
    if (isFilterPanelOpen) {
      // Treat toggle-close the same as cancel to avoid hidden unsaved draft state.
      handleCancelFilterChanges();
      return;
    }
    handleOpenFilterPanel();
  }

  function handleCancelFilterChanges() {
    setFilters(appliedFilters);
    setIsFilterPanelOpen(false);
  }

  function handleApplyFilterChanges() {
    applyDraftFilters(filters, { closePanel: true });
  }

  function handleResetFilterDraft() {
    setFilters(INITIAL_FILTERS);
  }

  function removeSingleFilter(key, value = null) {
    const nextFilters = { ...filters };
    if (Array.isArray(nextFilters[key])) {
      nextFilters[key] = value === null
        ? []
        : nextFilters[key].filter((entry) => entry !== value);
    } else {
      nextFilters[key] = "";
    }

    setFilters(nextFilters);
    const nextApplied = {
      ...appliedFilters,
      [key]: nextFilters[key],
    };
    applyDraftFilters(nextApplied);
  }

  function clearFilters() {
    applyDraftFilters(INITIAL_FILTERS);
  }

  function handleManageBlockedUsers() {
    navigate("/settings#blocked-users");
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
    setMessageAction(null);
    setBlockingUserId(user._id);

    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/blocked", {
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
      setMessageAction({
        type: "undo",
        label: "Undo block",
        userId: user._id,
        username: user.username || "user",
      });
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Unable to block user.");
      if (/already blocked|blocked user/i.test(err.message || "")) {
        setMessageAction({
          type: "manage",
          label: "Manage blocked users",
        });
      }
    } finally {
      setBlockingUserId("");
    }
  }

  async function handleUndoBlock() {
    const token = localStorage.getItem("token");
    if (!token || !messageAction?.userId) {
      return;
    }

    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/users/blocked/${messageAction.userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to unblock user");
      }

      setMessage(`Unblocked @${messageAction.username}.`);
      setMessageAction({
        type: "manage",
        label: "Manage blocked users",
      });
      fetchUsers(appliedFilters);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Unable to unblock user.");
      setMessageAction({
        type: "manage",
        label: "Manage blocked users",
      });
    }
  }

  if (loading) {
    return <LoadingState message="Loading users..." />;
  }

  if (loadError) {
    return (
      <LoadingState
        message={loadError}
        onRetry={() => fetchUsers(appliedFilters)}
      />
    );
  }

  const activeFilterChips = [
    appliedFilters.search ? { key: "search", label: `Search: ${appliedFilters.search}` } : null,
    appliedFilters.location ? { key: "location", label: `Location: ${appliedFilters.location}` } : null,
    appliedFilters.minRating ? { key: "minRating", label: `Rating: ${appliedFilters.minRating}+` } : null,
    ...appliedFilters.categories.map((category) => ({
      key: "categories",
      value: category,
      label: `Category: ${category}`,
    })),
    ...appliedFilters.availabilityDays.map((day) => ({
      key: "availabilityDays",
      value: day,
      label: `Availability: ${day}`,
    })),
    ...appliedFilters.swapModes.map((mode) => ({
      key: "swapModes",
      value: mode,
      label: `Swap mode: ${getSwapModeLabel(mode)}`,
    })),
  ].filter(Boolean);

  const suggestedRelaxFilters = RELAX_FILTER_PRIORITY
    .filter((key) => hasFilterValue(appliedFilters[key]))
    .slice(0, 2);

  const activeRatingTick = getNearestRatingTick(filters.minRating || "0");

  return (
    <div className="browse-page">
      <div className="browse-header">
        <div className="browse-header-row">
          <div>
            <h1 className="browse-title">Browse Users</h1>
            <p className="browse-subtitle">
              Search and filter to find users with specific skills.
            </p>
          </div>
          <button
            type="button"
            className="browse-manage-blocked"
            onClick={handleManageBlockedUsers}
          >
            Blocked users
          </button>
        </div>
      </div>

      <div className="browse-filters">
        <form onSubmit={handleSearch} className="browse-search-row">
          <input
            className="browse-input"
            name="search"
            type="text"
            placeholder="Search by name, username, or skill..."
            value={filters.search}
            onChange={handleFilterChange}
          />
          <input
            className="browse-input"
            name="location"
            type="text"
            placeholder="Filter by location..."
            value={filters.location}
            onChange={handleFilterChange}
          />
          <button
            type="button"
            className={`browse-btn-secondary browse-filters-toggle${hasPendingFilterChanges ? " browse-filters-toggle--unsaved" : ""}`}
            onClick={handleToggleFilterPanel}
          >
            Filters ({activeFilterChips.length}){hasPendingFilterChanges ? " • Unsaved" : ""}
          </button>
          <button type="submit" className="browse-btn-primary">
            Search Now
          </button>
        </form>

        {isFilterPanelOpen && (
          <div className="browse-filter-panel" role="dialog" aria-label="Filter options">
            <details className="browse-filter-section" open>
              <summary>Categories</summary>
              <div className="browse-checklist-options browse-checklist-options--two-col browse-checklist-options--full">
                {SKILL_CATEGORIES.map((category) => (
                  <label key={category} className="browse-checklist-option">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={() => handleChecklistToggle("categories", category)}
                    />
                    <span>{category}</span>
                    <span className="browse-checklist-count">{filterCounts.categories[category] || 0}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className="browse-filter-section" open>
              <summary>Minimum Rating</summary>
              <div className="browse-rating-slider">
                <div className="browse-rating-slider-head">
                  <span>Minimum Rating</span>
                  <strong>{filters.minRating ? `${filters.minRating}+` : "Any"}</strong>
                </div>
                <div className="browse-rating-slider-track">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={filters.minRating || "0"}
                    onChange={handleRatingSliderChange}
                  />
                  <div className="browse-rating-slider-scale">
                    <span className={activeRatingTick === 0 ? "is-active" : ""}>Any</span>
                    <span className={activeRatingTick === 1 ? "is-active" : ""}>1</span>
                    <span className={activeRatingTick === 2 ? "is-active" : ""}>2</span>
                    <span className={activeRatingTick === 3 ? "is-active" : ""}>3</span>
                    <span className={activeRatingTick === 4 ? "is-active" : ""}>4</span>
                    <span className={activeRatingTick === 5 ? "is-active" : ""}>5.0</span>
                  </div>
                </div>
              </div>
            </details>

            <details className="browse-filter-section" open>
              <summary>Availability Days</summary>
              <div className="browse-checklist-options browse-checklist-options--two-col">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day} className="browse-checklist-option">
                    <input
                      type="checkbox"
                      checked={filters.availabilityDays.includes(day)}
                      onChange={() => handleChecklistToggle("availabilityDays", day)}
                    />
                    <span>{day}</span>
                    <span className="browse-checklist-count">{filterCounts.availabilityDays[day] || 0}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className="browse-filter-section" open>
              <summary>Swap Modes</summary>
              <div className="browse-checklist-options">
                {SWAP_MODE_OPTIONS.map((modeOption) => (
                  <label key={modeOption.value} className="browse-checklist-option">
                    <input
                      type="checkbox"
                      checked={filters.swapModes.includes(modeOption.value)}
                      onChange={() => handleChecklistToggle("swapModes", modeOption.value)}
                    />
                    <span>{modeOption.label}</span>
                    <span className="browse-checklist-count">{filterCounts.swapModes[modeOption.value] || 0}</span>
                  </label>
                ))}
              </div>
            </details>

            <div className="browse-filter-actions">
              <button
                type="button"
                className="browse-btn-secondary"
                onClick={handleCancelFilterChanges}
              >
                Cancel
              </button>
              <button
                type="button"
                className="browse-btn-secondary"
                onClick={handleResetFilterDraft}
                disabled={!hasActiveFilters(filters)}
              >
                Reset Draft
              </button>
              <button
                type="button"
                className="browse-btn-primary"
                onClick={handleApplyFilterChanges}
                disabled={!hasPendingFilterChanges}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {activeFilterChips.length > 0 && (
          <div className="browse-active-filters" role="list" aria-label="Active filters">
            {activeFilterChips.map((chip) => (
              <button
                key={`${chip.key}-${chip.value || chip.label}`}
                type="button"
                className="browse-filter-chip"
                onClick={() => removeSingleFilter(chip.key, chip.value || null)}
              >
                {chip.label} <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="browse-result-count">{users.length} user{users.length === 1 ? "" : "s"} found</div>

      {message && (
        <div className="browse-message">
          <span>{message}</span>
          {messageAction && (
            <button
              type="button"
              className="browse-message-action"
              onClick={messageAction.type === "undo" ? handleUndoBlock : handleManageBlockedUsers}
            >
              {messageAction.label}
            </button>
          )}
        </div>
      )}

      {users.length === 0 ? (
        <div className="browse-empty">
          <p className="browse-empty-title">No users found for these filters.</p>
          {activeFilterChips.length > 0 ? (
            <div className="browse-empty-actions">
              {suggestedRelaxFilters.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="browse-btn-secondary"
                  onClick={() => removeSingleFilter(key)}
                >
                  {getFilterRelaxLabel(key, appliedFilters)}
                </button>
              ))}
              <button
                type="button"
                className="browse-btn-secondary"
                onClick={clearFilters}
              >
                Reset All Filters
              </button>
            </div>
          ) : null}

          {closestMatches.length > 0 ? (
            <div className="browse-closest-wrap">
              <p className="browse-closest-title">Closest matches you might like</p>
              <div className="browse-closest-list">
                {closestMatches.map((candidate) => (
                  <article key={candidate._id} className="browse-closest-card">
                    <div className="browse-closest-name">
                      {candidate.name || "Unnamed User"} @{candidate.username || "unknown"}
                    </div>
                    {candidate.closestReasons?.length > 0 ? (
                      <p className="browse-closest-reason">{candidate.closestReasons.slice(0, 2).join(" • ")}</p>
                    ) : null}
                    <div className="browse-closest-actions">
                      <button
                        type="button"
                        className="browse-request-btn"
                        onClick={() => handleSwapRequest(candidate)}
                      >
                        Request Swap
                      </button>
                      <button
                        type="button"
                        className="browse-request-btn browse-message-btn"
                        onClick={() => handleOpenChat(candidate._id)}
                      >
                        Message
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
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

                  <div className={`browse-reliability ${getReliabilityToneClass(user.reliability?.score)}`}>
                    <strong>{user.reliability?.tier || "New"}</strong>
                    <span>
                      {user.reliability?.score === null || user.reliability?.score === undefined
                        ? "No completed swaps yet"
                        : `Score ${user.reliability.score} • ${user.reliability.completedSwaps}/${user.reliability.totalSwaps} completed`}
                    </span>
                    {user.reliability?.averageRating ? (
                      <span>{`Avg rating ${user.reliability.averageRating}/5 (${user.reliability.ratingsReceivedCount})`}</span>
                    ) : null}
                  </div>

                  <div className={`browse-match ${getBrowseMatchToneClass(user.matchScore)}`}>
                    <strong>
                      {user.matchScore === null || user.matchScore === undefined
                        ? "Match pending"
                        : `Match ${user.matchScore}%`}
                    </strong>
                    {Array.isArray(user.matchReasons) && user.matchReasons.length > 0 ? (
                      <span>{user.matchReasons[0]}</span>
                    ) : (
                      <span>Add teach/learn skills to improve ranking</span>
                    )}
                  </div>

                  <div className="browse-location">
                    <span>📍</span>
                    <span>
                      {user.locationVisibility === "hidden"
                        ? "Location hidden"
                        : user.city || "Location not set"}
                    </span>
                  </div>

                  <div className="browse-location">
                    <span>↔</span>
                    <span>{getSwapModeLabel(user.swapMode)}</span>
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
                    disabled={Boolean(blockingUserId)}
                  >
                    Message
                  </button>

                  <button
                    type="button"
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
