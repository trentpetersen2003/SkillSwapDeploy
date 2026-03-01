export const MIN_LOADING_MS = 600;

export async function withMinimumDelay(taskOrPromise, minDuration = MIN_LOADING_MS) {
  const startTime = Date.now();

  try {
    const taskPromise =
      typeof taskOrPromise === "function" ? taskOrPromise() : taskOrPromise;
    return await taskPromise;
  } finally {
    const elapsed = Date.now() - startTime;
    const remaining = minDuration - elapsed;

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}
