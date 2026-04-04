/**
 * API utility that detects authentication failures and auto-logs out.
 * Use this instead of direct fetch calls for authenticated endpoints.
 */

export async function fetchWithAuth(url, options = {}) {
  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      handleAuthFailure();
      throw new Error("Authentication failed. You have been logged out.");
    }

    if (response.status === 404) {
      const payload = await response
        .clone()
        .json()
        .catch(() => null);

      if (payload?.message && /user not found/i.test(payload.message)) {
        handleAuthFailure();
        throw new Error("Your account session is no longer valid. Please log in again.");
      }
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
