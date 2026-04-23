import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import LoadingState from "../components/LoadingState";
import ProfileSetupModal from "../components/ProfileSetupModal";
import { withMinimumDelay } from "../utils/loading";
import { getProfileSetupStatus } from "../utils/profileSetup";
import "./Profile.css";

const TIMEZONES = [
  { value: "UTC-12:00", label: "(GMT-12:00) International Date Line West" },
  { value: "UTC-11:00", label: "(GMT-11:00) Midway Island, Samoa" },
  { value: "UTC-10:00", label: "(GMT-10:00) Hawaii" },
  { value: "UTC-08:00", label: "(GMT-08:00) Alaska" },
  { value: "UTC-07:00", label: "(GMT-07:00) Pacific Time (US & Canada)" },
  { value: "UTC-06:00", label: "(GMT-06:00) Mountain Time (US & Canada)" },
  { value: "UTC-05:00", label: "(GMT-05:00) Central Time (US & Canada)" },
  { value: "UTC-04:00", label: "(GMT-04:00) Eastern Time (US & Canada)" },
  { value: "UTC-03:00", label: "(GMT-03:00) Atlantic Time (Canada)" },
  { value: "UTC-02:30", label: "(GMT-02:30) Newfoundland" },
  { value: "UTC-03:00", label: "(GMT-03:00) Buenos Aires, Georgetown" },
  { value: "UTC-02:00", label: "(GMT-02:00) Mid-Atlantic" },
  { value: "UTC-01:00", label: "(GMT-01:00) Azores, Cape Verde Islands" },
  { value: "UTC+00:00", label: "(GMT+00:00) London, Dublin, Lisbon" },
  { value: "UTC+01:00", label: "(GMT+01:00) Paris, Berlin, Rome" },
  { value: "UTC+02:00", label: "(GMT+02:00) Athens, Cairo, Jerusalem" },
  { value: "UTC+03:00", label: "(GMT+03:00) Moscow, Baghdad, Riyadh" },
  { value: "UTC+03:30", label: "(GMT+03:30) Tehran" },
  { value: "UTC+04:00", label: "(GMT+04:00) Abu Dhabi, Muscat, Baku" },
  { value: "UTC+04:30", label: "(GMT+04:30) Kabul" },
  { value: "UTC+05:00", label: "(GMT+05:00) Islamabad, Karachi, Tashkent" },
  { value: "UTC+05:30", label: "(GMT+05:30) Mumbai, Kolkata, New Delhi" },
  { value: "UTC+05:45", label: "(GMT+05:45) Kathmandu" },
  { value: "UTC+06:00", label: "(GMT+06:00) Almaty, Dhaka, Colombo" },
  { value: "UTC+06:30", label: "(GMT+06:30) Yangon, Rangoon" },
  { value: "UTC+07:00", label: "(GMT+07:00) Bangkok, Hanoi, Jakarta" },
  { value: "UTC+08:00", label: "(GMT+08:00) Beijing, Hong Kong, Singapore" },
  { value: "UTC+09:00", label: "(GMT+09:00) Tokyo, Seoul, Osaka" },
  { value: "UTC+09:30", label: "(GMT+09:30) Adelaide, Darwin" },
  { value: "UTC+10:00", label: "(GMT+10:00) Sydney, Melbourne, Brisbane" },
  { value: "UTC+11:00", label: "(GMT+11:00) Solomon Islands, New Caledonia" },
  { value: "UTC+12:00", label: "(GMT+12:00) Auckland, Wellington, Fiji" },
  { value: "UTC+13:00", label: "(GMT+13:00) Nuku'alofa" },
];

const STATE_PROVINCE_OPTIONS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
];

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const HOURS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = ["00","15","30","45"];
const SKILL_CATEGORIES = [
  "Academic & Tutoring","Tech & Programming","Languages","Creative & Arts",
  "Career & Professional","Life Skills","Fitness & Wellness","Hobbies & Misc",
];
const SKILL_LEVELS = ["Novice", "Proficient", "Expert"];
const PROFILE_SETUP_STEPS = [
  {
    id: "basics",
    label: "Basics",
    sectionId: "profile-basics",
    title: "Add your account details",
    copy: "Add your name, email, city, state, and time zone.",
  },
  {
    id: "schedule",
    label: "Schedule",
    sectionId: "profile-schedule",
    title: "Set availability",
    copy: "Add at least one time window each week.",
  },
  {
    id: "teach",
    label: "Teach",
    sectionId: "profile-teach",
    title: "List what you can teach",
    copy: "List at least one skill you can teach.",
  },
  {
    id: "learn",
    label: "Learn",
    sectionId: "profile-learn",
    title: "List what you want to learn",
    copy: "List at least one skill you want help with.",
  },
  {
    id: "review",
    label: "Review",
    sectionId: "profile-review",
    title: "Review and save",
    copy: "Save once every required item is complete.",
  },
];

const PROFILE_SETUP_FIELD_LABELS = {
  name: "Name",
  email: "Email",
  location: "City",
  state: "State",
  "time zone": "Time zone",
  availability: "Availability",
  skills: "Skills you offer",
  "skills wanted": "Skills you want",
};

const REQUIRED_BASIC_FIELDS = new Set(["name", "email", "city", "state", "timeZone"]);

// Check whether a field should display a required marker.
function shouldShowRequiredStar(profile, setupRequired, fieldName) {
  if (setupRequired) {
    return true;
  }

  if (fieldName === "city") {
    return !isProfileSetupFieldComplete(profile, "location");
  }

  if (fieldName === "timeZone") {
    return !isProfileSetupFieldComplete(profile, "time zone");
  }

  return REQUIRED_BASIC_FIELDS.has(fieldName) ? !isProfileSetupFieldComplete(profile, fieldName) : false;
}

// Run required star render logic.
function RequiredStar({ show }) {
  if (!show) {
    return null;
  }

  return <span className="profile-required-star" aria-hidden="true">*</span>;
}

// Build analytics payload.
function buildAnalytics(swaps, currentUserId) {
  const mine = (swaps || []).filter((swap) => {
    const requesterId = swap.requester?._id || swap.requester;
    const recipientId = swap.recipient?._id || swap.recipient;
    return String(requesterId) === currentUserId || String(recipientId) === currentUserId;
  });

  const totalSwaps = mine.length;
  const completedSwaps = mine.filter((swap) => swap.status === "completed").length;
  const totalMilestones = mine.reduce(
    (sum, swap) => sum + (Array.isArray(swap.milestones) ? swap.milestones.length : 0),
    0
  );
  const completedMilestones = mine.reduce(
    (sum, swap) =>
      sum + (Array.isArray(swap.milestones)
        ? swap.milestones.filter((milestone) => milestone.completed).length
        : 0),
    0
  );
  const confirmedSwaps = mine.filter((swap) => swap.status === "confirmed").length;
  const confirmationsGiven = mine.reduce((sum, swap) => {
    const requesterId = String(swap.requester?._id || swap.requester || "");
    const isRequester = requesterId === currentUserId;
    return sum + (isRequester ? !!swap.requesterConfirmedAt : !!swap.recipientConfirmedAt);
  }, 0);
  const reviewsGiven = mine.reduce((sum, swap) => {
    const requesterId = String(swap.requester?._id || swap.requester || "");
    const isRequester = requesterId === currentUserId;
    return sum + (isRequester ? !!swap.reviews?.requesterReview : !!swap.reviews?.recipientReview);
  }, 0);

  return {
    totalSwaps,
    completedSwaps,
    totalMilestones,
    completedMilestones,
    confirmedSwaps,
    confirmationsGiven,
    reviewsGiven,
    completionRate: totalSwaps ? Math.round((completedSwaps / totalSwaps) * 100) : 0,
    milestoneRate: totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
  };
}

// Run section header logic.
function SectionHeader({ eyebrow, title, copy, required = false }) {
  return (
    <div className="profile-section__header">
      <div>
        <p className="profile-section__eyebrow">{eyebrow}</p>
        <h2 className="profile-section__title">
          {title}
          <RequiredStar show={required} />
        </h2>
      </div>
      <p className="profile-section__copy">{copy}</p>
    </div>
  );
}

// Run profile setup field completeness logic.
function isProfileSetupFieldComplete(profile, fieldName) {
  if (fieldName === "name" || fieldName === "email" || fieldName === "time zone") {
    const key = fieldName === "time zone" ? "timeZone" : fieldName;
    return typeof profile[key] === "string" && profile[key].trim().length > 0;
  }

  if (fieldName === "location") {
    return typeof profile.city === "string" && profile.city.trim().length > 0;
  }

  if (fieldName === "state") {
    return typeof profile.state === "string" && profile.state.trim().length > 0;
  }

  if (fieldName === "availability") {
    return Array.isArray(profile.availability) && profile.availability.length > 0;
  }

  if (fieldName === "skills") {
    return Array.isArray(profile.skills) && profile.skills.length > 0;
  }

  if (fieldName === "skills wanted") {
    return Array.isArray(profile.skillsWanted) && profile.skillsWanted.length > 0;
  }

  return false;
}

// Run profile setup progress logic.
function getProfileSetupProgress(profile) {
  const requiredFields = ["name", "email", "location", "state", "time zone", "availability", "skills", "skills wanted"];
  const completedCount = requiredFields.filter((field) => isProfileSetupFieldComplete(profile, field)).length;
  return {
    completedCount,
    totalCount: requiredFields.length,
    percent: Math.round((completedCount / requiredFields.length) * 100),
  };
}

// Run profile logic.
function Profile({ setupRequired = false, onProfileSaved, onRegisterLeaveGuard }) {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = String(currentUser.id || currentUser._id || "");
  const [profile, setProfile] = useState({
    name: "", email: "", city: "", state: "", phoneNumber: "", timeZone: "",
    swapMode: "either", availability: [], skills: [], skillsWanted: [], reliability: null,
  });
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [skillError, setSkillError] = useState("");
  const [pendingNavigationPath, setPendingNavigationPath] = useState("");
  const [newAvailability, setNewAvailability] = useState({
    selectedDays: [], startHour: "9", startMinute: "00", startPeriod: "AM",
    endHour: "5", endMinute: "00", endPeriod: "PM",
  });
  const [newSkill, setNewSkill] = useState({ skillName: "", category: "", level: "Novice" });
  const [newSkillWanted, setNewSkillWanted] = useState({ skillName: "", category: "", level: "Novice" });
  const [activeSetupStep, setActiveSetupStep] = useState(0);
  const [saveErrorFields, setSaveErrorFields] = useState([]);
  const basicsRef = React.useRef(null);
  const scheduleRef = React.useRef(null);
  const teachRef = React.useRef(null);
  const learnRef = React.useRef(null);
  const reviewRef = React.useRef(null);

  const setupProgress = useMemo(() => getProfileSetupProgress(profile), [profile]);
  const setupMissingFields = useMemo(() => getProfileSetupStatus(profile).missingFields, [profile]);
  const setupIsComplete = setupMissingFields.length === 0;
  const setupStepIndex = useMemo(() => {
    if (!setupRequired) {
      return 0;
    }

    if (!isProfileSetupFieldComplete(profile, "name") || !isProfileSetupFieldComplete(profile, "email") || !isProfileSetupFieldComplete(profile, "location") || !isProfileSetupFieldComplete(profile, "state") || !isProfileSetupFieldComplete(profile, "time zone")) {
      return 0;
    }

    if (!isProfileSetupFieldComplete(profile, "availability")) {
      return 1;
    }

    if (!isProfileSetupFieldComplete(profile, "skills")) {
      return 2;
    }

    if (!isProfileSetupFieldComplete(profile, "skills wanted")) {
      return 3;
    }

    return 4;
  }, [profile, setupRequired]);

  useEffect(() => {
    if (setupRequired) {
      setActiveSetupStep(setupStepIndex);
    }
  }, [setupRequired, setupStepIndex]);

  const sectionRefs = useMemo(() => ({
    basics: basicsRef,
    schedule: scheduleRef,
    teach: teachRef,
    learn: learnRef,
    review: reviewRef,
  }), []);

  // Run section focus logic.
  function focusSetupSection(stepId) {
    const step = PROFILE_SETUP_STEPS.find((entry) => entry.id === stepId);
    if (!step) return;
    setActiveSetupStep(PROFILE_SETUP_STEPS.findIndex((entry) => entry.id === stepId));
    sectionRefs[stepId]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Run missing fields summary logic.
  function getMissingFieldSummary(fields) {
    return fields.map((field) => PROFILE_SETUP_FIELD_LABELS[field] || field).join(", ");
  }

  const analytics = useMemo(() => buildAnalytics(swaps, currentUserId), [swaps, currentUserId]);

  const requestLeaveConfirmation = useCallback((nextPath) => {
    if (!setupRequired || !nextPath || nextPath === "/profile") return false;
    setPendingNavigationPath(nextPath);
    return true;
  }, [setupRequired]);

  useEffect(() => {
    onRegisterLeaveGuard?.(requestLeaveConfirmation);
    return () => onRegisterLeaveGuard?.(null);
  }, [onRegisterLeaveGuard, requestLeaveConfirmation]);

  useEffect(() => {
    if (!setupRequired) {
      setPendingNavigationPath("");
      return undefined;
    }
    // Handle before unload action.
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [setupRequired]);

  useEffect(() => {
    if (!setupRequired) return undefined;
    window.history.pushState({ profileSetupGuard: true }, "", window.location.href);
    // Handle pop state action.
    function handlePopState() {
      setPendingNavigationPath("__back__");
      window.history.pushState({ profileSetupGuard: true }, "", window.location.href);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setupRequired]);

  // Run time to minutes logic.
  function timeToMinutes(hour, minute, period) {
    let hours = parseInt(hour, 10);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + parseInt(minute, 10);
  }

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    setLoading(true);
    try {
      const data = await withMinimumDelay(async () => {
        const profileRes = await fetchWithAuth(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileRes.ok) throw new Error("Failed to fetch profile");
        const profilePayload = await profileRes.json();
        let swapsPayload = [];
        if (!setupRequired) {
          const swapsRes = await fetchWithAuth(`${API_URL}/api/swaps`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!swapsRes.ok) throw new Error("Failed to fetch swaps");
          swapsPayload = await swapsRes.json();
        }
        return { profilePayload, swapsPayload };
      });

      const userData = data.profilePayload;
      setSwaps(Array.isArray(data.swapsPayload) ? data.swapsPayload : []);
      setProfile({
        name: userData.name || "",
        email: userData.email || "",
        city: userData.city || "",
        state: userData.state || "",
        phoneNumber: userData.phoneNumber || "",
        timeZone: userData.timeZone || "",
        swapMode: userData.swapMode || "either",
        availability: (userData.availability || []).map((slot) => {
          const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/);
          return match ? { ...slot, startMin: timeToMinutes(match[1], match[2], match[3]) } : slot;
        }),
        skills: userData.skills || [],
        skillsWanted: userData.skillsWanted || [],
        reliability: userData.reliability || null,
      });
    } catch (err) {
      console.error(err);
      setMessage("Error loading profile");
    } finally {
      setLoading(false);
    }
  }, [navigate, setupRequired]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle change action.
  function handleChange(event) {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  // Handle availability change action.
  function handleAvailabilityChange(event) {
    const { name, value } = event.target;
    setNewAvailability((prev) => ({ ...prev, [name]: value }));
  }

  // Handle day toggle action.
  function handleDayToggle(day) {
    setNewAvailability((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((entry) => entry !== day)
        : [...prev.selectedDays, day],
    }));
  }

  // Handle skill change action.
  function handleSkillChange(event) {
    const { name, value } = event.target;
    setNewSkill((prev) => ({ ...prev, [name]: value }));
  }

  // Handle skill wanted change action.
  function handleSkillWantedChange(event) {
    const { name, value } = event.target;
    setNewSkillWanted((prev) => ({ ...prev, [name]: value }));
  }

  // Check whether time conflict .
  function hasTimeConflict(day, startMin, endMin) {
    return profile.availability.some((slot) => {
      if (slot.day !== day) return false;
      const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/);
      if (!match) return false;
      const slotStart = timeToMinutes(match[1], match[2], match[3]);
      const slotEnd = timeToMinutes(match[4], match[5], match[6]);
      return startMin < slotEnd && endMin > slotStart;
    });
  }

  // Run add availability logic.
  function addAvailability() {
    setAvailabilityError("");
    if (newAvailability.selectedDays.length === 0) {
      setAvailabilityError("Please select at least one day");
      return;
    }
    const startMin = timeToMinutes(newAvailability.startHour, newAvailability.startMinute, newAvailability.startPeriod);
    const endMin = timeToMinutes(newAvailability.endHour, newAvailability.endMinute, newAvailability.endPeriod);
    if (startMin >= endMin) {
      setAvailabilityError("End time must be after start time");
      return;
    }
    for (const day of newAvailability.selectedDays) {
      if (hasTimeConflict(day, startMin, endMin)) {
        setAvailabilityError(`That time overlaps with an existing slot on ${day}`);
        return;
      }
    }
    const timeRange = `${newAvailability.startHour}:${newAvailability.startMinute} ${newAvailability.startPeriod} - ${newAvailability.endHour}:${newAvailability.endMinute} ${newAvailability.endPeriod}`;
    const newSlots = newAvailability.selectedDays.map((day) => ({ day, timeRange, startMin }));
    setProfile((prev) => ({
      ...prev,
      availability: [...prev.availability, ...newSlots].sort((a, b) => {
        const dayCompare = DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day);
        return dayCompare !== 0 ? dayCompare : (a.startMin || 0) - (b.startMin || 0);
      }),
    }));
    setNewAvailability({
      selectedDays: [], startHour: "9", startMinute: "00", startPeriod: "AM",
      endHour: "5", endMinute: "00", endPeriod: "PM",
    });
  }

  // Run remove availability logic.
  function removeAvailability(index) {
    setProfile((prev) => ({
      ...prev,
      availability: prev.availability.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  // Run add skill logic.
  function addSkill() {
    setSkillError("");
    if (!newSkill.skillName.trim() || !newSkill.category) {
      setSkillError("Please enter a skill name and category");
      return;
    }
    setProfile((prev) => ({ ...prev, skills: [...prev.skills, { ...newSkill }] }));
    setNewSkill({ skillName: "", category: "", level: "Novice" });
  }

  // Run remove skill logic.
  function removeSkill(index) {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  // Run add skill wanted logic.
  function addSkillWanted() {
    setSkillError("");
    if (!newSkillWanted.skillName.trim() || !newSkillWanted.category) {
      setSkillError("Please enter a skill name and category");
      return;
    }
    setProfile((prev) => ({ ...prev, skillsWanted: [...prev.skillsWanted, { ...newSkillWanted }] }));
    setNewSkillWanted({ skillName: "", category: "", level: "Novice" });
  }

  // Run remove skill wanted logic.
  function removeSkillWanted(index) {
    setProfile((prev) => ({
      ...prev,
      skillsWanted: prev.skillsWanted.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  // Handle save action.
  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    setSaveErrorFields([]);
    if (!profile.name || !profile.email || !profile.city || !profile.state || !profile.timeZone) {
      const required = ["name", "email", "location", "state", "time zone"];
      const missing = required.filter((field) => !isProfileSetupFieldComplete(profile, field));
      setSaveErrorFields(missing);
      setMessage("Complete the required basics before saving.");
      return;
    }
    setSaving(true);
    const token = localStorage.getItem("token");
    try {
      const payload = {
        name: profile.name,
        email: profile.email,
        city: profile.city,
        state: profile.state,
        phoneNumber: profile.phoneNumber,
        timeZone: profile.timeZone,
        swapMode: profile.swapMode,
        availability: profile.availability.map(({ day, timeRange }) => ({ day, timeRange })),
        skills: profile.skills,
        skillsWanted: profile.skillsWanted,
      };
      const setupStatus = getProfileSetupStatus(payload);
      if (setupRequired && !setupStatus.isComplete) {
        setSaveErrorFields(setupStatus.missingFields);
        setMessage("Finish the required setup details before leaving this page.");
        setSaving(false);
        return;
      }
      const res = await fetchWithAuth(`${API_URL}/api/users/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update profile");
      setProfile((prev) => ({
        ...prev,
        name: data.name || "",
        email: data.email || "",
        city: data.city || "",
        state: data.state || "",
        phoneNumber: data.phoneNumber || "",
        timeZone: data.timeZone || "",
        swapMode: data.swapMode || prev.swapMode || "either",
        availability: (data.availability || []).map((slot) => {
          const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/);
          return match ? { ...slot, startMin: timeToMinutes(match[1], match[2], match[3]) } : slot;
        }),
        skills: data.skills || [],
        skillsWanted: data.skillsWanted || [],
        reliability: data.reliability || prev.reliability || null,
      }));
      onProfileSaved?.(data);
      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState message="Loading profile..." />;

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div>
          <p className="profile-kicker">Your account</p>
          <h1 className="profile-title">Profile</h1>
          <p className="profile-subtitle">Keep your setup current so matching and scheduling stay accurate.</p>
        </div>
      </header>

      {setupRequired && (
        <section className="profile-setup-banner" aria-label="Profile setup required">
          <p className="profile-setup-banner__eyebrow">Finish setup</p>
          <h2 className="profile-setup-banner__title">Finish your profile to unlock swapping.</h2>
          <p className="profile-setup-banner__description">
            Complete the required fields below to unlock swaps, chat, and your calendar.
          </p>
        </section>
      )}

      {message && (
        <div
          className={`profile-alert ${message.includes("success") ? "profile-alert--success" : "profile-alert--error"}`}
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {setupRequired && (
        <section className="profile-setup-guide" aria-label="Profile setup guide">
          <div className="profile-setup-guide__header">
            <div>
              <p className="profile-setup-guide__eyebrow">Setup guide</p>
              <h2 className="profile-setup-guide__title">Required profile items</h2>
            </div>
            <p className="profile-setup-guide__copy">
              Check off every item to unlock the rest of the site.
            </p>
          </div>

          <div className="profile-setup-progress" aria-label="Profile setup progress">
            <div className="profile-setup-progress__meta">
              <span>{setupProgress.completedCount}/{setupProgress.totalCount} required complete</span>
              <strong>{setupProgress.percent}%</strong>
            </div>
            <div className="profile-setup-progress__bar" aria-hidden="true">
              <span style={{ width: `${setupProgress.percent}%` }} />
            </div>
          </div>

          <div className="profile-setup-wizard">
            <div className="profile-setup-wizard__steps" role="tablist" aria-label="Profile setup steps">
              {PROFILE_SETUP_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={index === activeSetupStep}
                  className={`profile-setup-wizard__step ${index === activeSetupStep ? "profile-setup-wizard__step--active" : ""}`}
                  onClick={() => focusSetupSection(step.id)}
                >
                  <span className="profile-setup-wizard__step-index">{index + 1}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </div>

            <div className="profile-setup-wizard__panel">
              <h3>{PROFILE_SETUP_STEPS[activeSetupStep]?.title}</h3>
              <p>{PROFILE_SETUP_STEPS[activeSetupStep]?.copy}</p>
              <button
                type="button"
                className="profile-inline-button"
                onClick={() => focusSetupSection(PROFILE_SETUP_STEPS[activeSetupStep]?.id || "basics")}
              >
                Go to this section
              </button>
            </div>
          </div>

          <div className="profile-setup-checklist" aria-label="Required profile checklist">
            {[
              ["name", "Add your name"],
              ["email", "Add your email"],
              ["location", "Add your city"],
              ["state", "Add your state/province"],
              ["time zone", "Choose a time zone"],
              ["availability", "Add at least one availability slot"],
              ["skills", "List at least one skill you can teach"],
              ["skills wanted", "List at least one skill you want"],
            ].map(([fieldName, label]) => {
              const complete = isProfileSetupFieldComplete(profile, fieldName);
              return (
                <button
                  key={fieldName}
                  type="button"
                  className={`profile-setup-checklist__item ${complete ? "profile-setup-checklist__item--complete" : ""}`}
                  onClick={() => focusSetupSection(fieldName === "availability" ? "schedule" : fieldName === "skills" ? "teach" : fieldName === "skills wanted" ? "learn" : "basics")}
                >
                  <span className="profile-setup-checklist__status" aria-hidden="true">
                    {complete ? "✓" : "•"}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {saveErrorFields.length > 0 && (
        <section className="profile-error-summary" aria-label="Missing profile requirements">
          <h2 className="profile-error-summary__title">You still need to add:</h2>
          <p className="profile-error-summary__copy">{getMissingFieldSummary(saveErrorFields)}</p>
          <div className="profile-error-summary__actions">
            {saveErrorFields.includes("location") || saveErrorFields.includes("state") || saveErrorFields.includes("name") || saveErrorFields.includes("email") || saveErrorFields.includes("time zone") ? (
              <button type="button" className="profile-inline-button" onClick={() => focusSetupSection("basics")}>Go to basics</button>
            ) : null}
            {saveErrorFields.includes("availability") ? (
              <button type="button" className="profile-inline-button profile-inline-button--subtle" onClick={() => focusSetupSection("schedule")}>Go to availability</button>
            ) : null}
            {saveErrorFields.includes("skills") ? (
              <button type="button" className="profile-inline-button profile-inline-button--subtle" onClick={() => focusSetupSection("teach")}>Go to skills you offer</button>
            ) : null}
            {saveErrorFields.includes("skills wanted") ? (
              <button type="button" className="profile-inline-button profile-inline-button--subtle" onClick={() => focusSetupSection("learn")}>Go to skills you want</button>
            ) : null}
          </div>
        </section>
      )}

      <section className="profile-analytics" aria-label="Profile analytics">
        <div className="profile-analytics__header">
          <h2>Progress dashboard</h2>
          <span>
            {profile.reliability?.score === null || profile.reliability?.score === undefined
              ? "Reliability: New"
              : `Reliability: ${profile.reliability.score} (${profile.reliability.tier})`}
          </span>
        </div>
        <div className="profile-analytics__grid">
          <article className="analytics-card">
            <h3>Swap Completion</h3>
            <p className="analytics-card__value">{analytics.completionRate}%</p>
            <p className="analytics-card__meta">{analytics.completedSwaps}/{analytics.totalSwaps} completed</p>
          </article>
          <article className="analytics-card">
            <h3>Milestone Completion</h3>
            <p className="analytics-card__value">{analytics.milestoneRate}%</p>
            <p className="analytics-card__meta">{analytics.completedMilestones}/{analytics.totalMilestones} goals done</p>
          </article>
          <article className="analytics-card">
            <h3>Confirmations Given</h3>
            <p className="analytics-card__value">{analytics.confirmationsGiven}</p>
            <p className="analytics-card__meta">Active swaps: {analytics.confirmedSwaps}</p>
          </article>
          <article className="analytics-card">
            <h3>Ratings</h3>
            <p className="analytics-card__value">
              {profile.reliability?.averageRating ? `${profile.reliability.averageRating}/5` : "No ratings yet"}
            </p>
            <p className="analytics-card__meta">
              Received: {profile.reliability?.ratingsReceivedCount || 0} • Given: {analytics.reviewsGiven}
            </p>
          </article>
        </div>
      </section>

      <form onSubmit={handleSave} className="profile-form">
        <section className="profile-section" id="profile-basics" ref={basicsRef}>
          <SectionHeader
            eyebrow="Basics"
            title="Account details"
            copy="Add your name, email, city, state, and time zone."
            required={setupRequired}
          />
          <div className="profile-field-grid">
            <label className="profile-field">
              <span className="profile-field__label">
                Name <RequiredStar show={shouldShowRequiredStar(profile, setupRequired, "name")} />
              </span>
              <input name="name" placeholder="Your name" value={profile.name} onChange={handleChange} required />
            </label>
            <label className="profile-field">
              <span className="profile-field__label">
                Email <RequiredStar show={shouldShowRequiredStar(profile, setupRequired, "email")} />
              </span>
              <input name="email" type="email" placeholder="you@example.com" value={profile.email} onChange={handleChange} required />
            </label>
            <label className="profile-field">
              <span className="profile-field__label">
                City <RequiredStar show={shouldShowRequiredStar(profile, setupRequired, "city")} />
              </span>
              <input name="city" placeholder="City" value={profile.city} onChange={handleChange} required />
            </label>
            <label className="profile-field">
              <span className="profile-field__label">
                State <RequiredStar show={shouldShowRequiredStar(profile, setupRequired, "state")} />
              </span>
              <select name="state" value={profile.state} onChange={handleChange} required>
                <option value="">Select state/province</option>
                {STATE_PROVINCE_OPTIONS.map((stateCode) => (
                  <option key={stateCode} value={stateCode}>{stateCode}</option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              <span className="profile-field__label">Phone</span>
              <input name="phoneNumber" placeholder="Optional" value={profile.phoneNumber} onChange={handleChange} />
            </label>
            <label className="profile-field">
              <span className="profile-field__label">
                Time zone <RequiredStar show={shouldShowRequiredStar(profile, setupRequired, "timeZone")} />
              </span>
              <select name="timeZone" value={profile.timeZone} onChange={handleChange} required>
                <option value="">Select time zone</option>
                {TIMEZONES.map((tz) => (
                  <option key={`${tz.value}-${tz.label}`} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </label>
            <label className="profile-field profile-field--full">
              <span className="profile-field__label">Swap mode</span>
              <select name="swapMode" value={profile.swapMode} onChange={handleChange}>
                <option value="either">Open to either online or in-person</option>
                <option value="online">Online only</option>
                <option value="in-person">In-person only</option>
              </select>
            </label>
          </div>
        </section>

        <section className="profile-section" id="profile-schedule" ref={scheduleRef}>
          <SectionHeader
            eyebrow="Schedule"
            title="Availability"
            copy="Add at least one weekly time window."
            required={setupRequired || !isProfileSetupFieldComplete(profile, "availability")}
          />
          {profile.availability.length > 0 && (
            <div className="availability-list">
              {DAYS_OF_WEEK.map((day) => {
                const daySlots = profile.availability.filter((slot) => slot.day === day);
                if (daySlots.length === 0) return null;
                return (
                  <div key={day} className="availability-item">
                    <span className="availability-item__summary">
                      <strong>{day}:</strong> {daySlots.map((slot) => slot.timeRange).join(", ")}
                    </span>
                    <div className="availability-item__actions">
                      {daySlots.map((slot, index) => {
                        const actualIndex = profile.availability.findIndex((entry) => entry === slot);
                        return (
                          <button
                            key={`${day}-${index}`}
                            type="button"
                            className="profile-inline-button profile-inline-button--subtle"
                            onClick={() => removeAvailability(actualIndex)}
                          >
                            Remove
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="availability-input">
            <div className="profile-input-group">
              <strong className="profile-input-group__label">Select days</strong>
              <div className="profile-day-grid">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day} className="profile-day-option">
                    <input
                      type="checkbox"
                      checked={newAvailability.selectedDays.includes(day)}
                      onChange={() => handleDayToggle(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="profile-time-grid">
              <div className="profile-input-group">
                <strong className="profile-input-group__label">Start time</strong>
                <div className="profile-time-row">
                  <select name="startHour" value={newAvailability.startHour} onChange={handleAvailabilityChange}>
                    {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                  </select>
                  <span className="profile-time-separator">:</span>
                  <select name="startMinute" value={newAvailability.startMinute} onChange={handleAvailabilityChange}>
                    {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                  </select>
                  <select name="startPeriod" value={newAvailability.startPeriod} onChange={handleAvailabilityChange}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div className="profile-input-group">
                <strong className="profile-input-group__label">End time</strong>
                <div className="profile-time-row">
                  <select name="endHour" value={newAvailability.endHour} onChange={handleAvailabilityChange}>
                    {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                  </select>
                  <span className="profile-time-separator">:</span>
                  <select name="endMinute" value={newAvailability.endMinute} onChange={handleAvailabilityChange}>
                    {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                  </select>
                  <select name="endPeriod" value={newAvailability.endPeriod} onChange={handleAvailabilityChange}>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="button" className="profile-inline-button" onClick={addAvailability}>
              Add Availability
            </button>
          </div>
        </section>

        {availabilityError && (
          <div className="profile-alert profile-alert--error">Warning: {availabilityError}</div>
        )}

        <section className="profile-section" id="profile-teach" ref={teachRef}>
          <SectionHeader
            eyebrow="Teach"
            title="Skills you offer"
            copy="Add at least one skill you can teach."
            required={setupRequired || !isProfileSetupFieldComplete(profile, "skills")}
          />
          {profile.skills.length > 0 && (
            <div className="skills-list">
              {profile.skills.map((skill, index) => (
                <div key={`${skill.skillName}-${index}`} className="profile-skill-card">
                  <span className="profile-skill-card__text">
                    <strong>{skill.skillName}</strong> - {skill.category} ({skill.level})
                  </span>
                  <button
                    type="button"
                    className="profile-inline-button profile-inline-button--subtle"
                    onClick={() => removeSkill(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="skill-input">
            <div className="profile-input-group">
              <label className="profile-field">
                <span className="profile-field__label">Skill name</span>
                <input name="skillName" placeholder="Skill name" value={newSkill.skillName} onChange={handleSkillChange} />
              </label>
            </div>
            <div className="profile-field-grid">
              <label className="profile-field">
                <span className="profile-field__label">Category</span>
                <select name="category" value={newSkill.category} onChange={handleSkillChange}>
                  <option value="">Select category</option>
                  {SKILL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span className="profile-field__label">Level</span>
                <select name="level" value={newSkill.level} onChange={handleSkillChange}>
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="profile-inline-button" onClick={addSkill}>
              Add Skill
            </button>
          </div>
        </section>

        <section className="profile-section" id="profile-learn" ref={learnRef}>
          <SectionHeader
            eyebrow="Learn"
            title="Skills you want"
            copy="Add at least one skill you want help with."
            required={setupRequired || !isProfileSetupFieldComplete(profile, "skills wanted")}
          />
          {profile.skillsWanted.length > 0 && (
            <div className="skills-list">
              {profile.skillsWanted.map((skill, index) => (
                <div key={`${skill.skillName}-${index}`} className="profile-skill-card">
                  <span className="profile-skill-card__text">
                    <strong>{skill.skillName}</strong> - {skill.category} ({skill.level})
                  </span>
                  <button
                    type="button"
                    className="profile-inline-button profile-inline-button--subtle"
                    onClick={() => removeSkillWanted(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="skill-input">
            <div className="profile-input-group">
              <label className="profile-field">
                <span className="profile-field__label">Skill name</span>
                <input
                  name="skillName"
                  placeholder="Skill name"
                  value={newSkillWanted.skillName}
                  onChange={handleSkillWantedChange}
                />
              </label>
            </div>
            <div className="profile-field-grid">
              <label className="profile-field">
                <span className="profile-field__label">Category</span>
                <select name="category" value={newSkillWanted.category} onChange={handleSkillWantedChange}>
                  <option value="">Select category</option>
                  {SKILL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span className="profile-field__label">Level</span>
                <select name="level" value={newSkillWanted.level} onChange={handleSkillWantedChange}>
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="profile-inline-button" onClick={addSkillWanted}>
              Add Skill Wanted
            </button>
          </div>
        </section>

        {skillError && (
          <div className="profile-alert profile-alert--error">Warning: {skillError}</div>
        )}
        <div className="profile-form__footer" id="profile-review" ref={reviewRef}>
          <p className="profile-form__footer-copy">
            {setupRequired
              ? "Review the checklist above. Save when everything is complete."
              : "Keep this updated so people see the right availability and match info."}
          </p>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      <ProfileSetupModal
        open={Boolean(pendingNavigationPath)}
        title="Leave setup?"
        description="Your profile still isn't finished. Leave anyway?"
        primaryLabel="Leave anyway"
        secondaryLabel="Stay here"
        primaryVariant="danger"
        onPrimary={() => {
          const nextPath = pendingNavigationPath;
          setPendingNavigationPath("");
          if (nextPath === "__back__") {
            window.history.back();
            return;
          }
          if (nextPath) navigate(nextPath);
        }}
        onSecondary={() => setPendingNavigationPath("")}
        onClose={() => setPendingNavigationPath("")}
      />
    </div>
  );
}

export default Profile;
