const REQUIRED_SETUP_FIELDS = [
  "name",
  "email",
  "city",
  "state",
  "timeZone",
  "availability",
  "skills",
  "skillsWanted",
];

export const PROFILE_SETUP_REQUIRED_PATH = "/profile";

// Check whether non empty string .
function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Check whether filled items .
function hasFilledItems(value) {
  return Array.isArray(value) && value.length > 0;
}

export function getIncompleteProfileSetupFields(profile = {}) {
  const missingFields = [];

  if (!hasNonEmptyString(profile.name)) {
    missingFields.push("name");
  }

  if (!hasNonEmptyString(profile.email)) {
    missingFields.push("email");
  }

  if (!hasNonEmptyString(profile.city)) {
    missingFields.push("location");
  }

  if (!hasNonEmptyString(profile.state)) {
    missingFields.push("state");
  }

  if (!hasNonEmptyString(profile.timeZone)) {
    missingFields.push("time zone");
  }

  if (!hasFilledItems(profile.availability)) {
    missingFields.push("availability");
  }

  if (!hasFilledItems(profile.skills)) {
    missingFields.push("skills");
  }

  if (!hasFilledItems(profile.skillsWanted)) {
    missingFields.push("skills wanted");
  }

  return missingFields;
}

export function getProfileSetupStatus(profile = {}) {
  const missingFields = getIncompleteProfileSetupFields(profile);

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    requiredFields: [...REQUIRED_SETUP_FIELDS],
  };
}

export function getProfileSetupPromptStorageKey(userId) {
  return `profileSetupPromptDismissed:${userId || "anonymous"}`;
}
