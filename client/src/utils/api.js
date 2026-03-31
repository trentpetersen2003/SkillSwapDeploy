/**
 * API utility that detects authentication failures and auto-logs out.
 * Use this instead of direct fetch calls for authenticated endpoints.
 */

export async function fetchWithAuth(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
      handleAuthFailure();
      throw new Error("Authentication failed. You have been logged out.");
    }

    return response;
  } catch (error) {
    throw error;
  }
}

function handleAuthFailure() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export default fetchWithAuth;
