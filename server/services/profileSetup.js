function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function isProfileSetupComplete(user = {}) {
  return (
    hasText(user.name) &&
    hasText(user.email) &&
    hasText(user.city) &&
    hasText(user.state) &&
    hasText(user.timeZone) &&
    hasItems(user.availability) &&
    hasItems(user.skills) &&
    hasItems(user.skillsWanted)
  );
}

module.exports = {
  isProfileSetupComplete,
};
