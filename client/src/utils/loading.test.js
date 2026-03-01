import { withMinimumDelay } from "./loading";

describe("loading utility", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("enforces minimum duration for fast tasks", async () => {
    let resolved = false;
    const promise = withMinimumDelay(Promise.resolve("ok"), 600).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(599);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });

  test("does not add extra delay when task is already slow", async () => {
    let resolved = false;
    const slowTask = new Promise((resolve) => {
      setTimeout(() => resolve("done"), 1000);
    });

    const promise = withMinimumDelay(slowTask, 600).then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
