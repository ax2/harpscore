const nextTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Coordinate read/modify/write operations over the same localStorage key. */
export async function withStorageWriteLock<T>(key: string, action: () => T): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(key, async () => {
      // Firefox can retain a localStorage snapshot for the current task.
      // Start fresh, then let writes leave that task before releasing the lock.
      await nextTask();
      try { return action(); }
      finally {
        // A failed restore may still have written its recovery snapshot.
        await nextTask();
      }
    });
  }
  // Older/insecure browsers have no simultaneous cross-tab guarantee.
  return action();
}
