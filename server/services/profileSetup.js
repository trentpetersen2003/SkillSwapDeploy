// Check whether text .
function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Check whether items .
function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

// Get incomplete profile fields data.
function getIncompleteProfileFields(user = {}) {
  const missing = [];

  if (!hasText(user.name)) missing.push("name");
  if (!hasText(user.email)) missing.push("email");
  if (!hasText(user.city)) missing.push("city");
  if (!hasText(user.state)) missing.push("state");
  if (!hasText(user.timeZone)) missing.push("time zone");
  if (!hasItems(user.availability)) missing.push("availability");
  if (!hasItems(user.skills)) missing.push("skills offered");
  if (!hasItems(user.skillsWanted)) missing.push("skills wanted");

  return missing;
}

// Check whether profile setup complete .
function isProfileSetupComplete(user = {}) {
  return getIncompleteProfileFields(user).length === 0;
}

module.exports = {
  isProfileSetupComplete,
  getIncompleteProfileFields,
};
