const queues = new Map();

/**
 * Process messages from the same phone in order without blocking other users.
 * Each task runs only after the previous task for that phone has settled.
 */
export function enqueuePhoneMessage(phone, task) {
  const key = String(phone || "desconocido");
  const previous = queues.get(key) || Promise.resolve();

  const current = previous.catch(() => {}).then(task);
  const tracked = current.finally(() => {
    if (queues.get(key) === tracked) {
      queues.delete(key);
    }
  });

  queues.set(key, tracked);
  return tracked;
}

export function clearPhoneMessageQueues() {
  queues.clear();
}
