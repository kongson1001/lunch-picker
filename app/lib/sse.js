const subscribers = new Map();
const encoder = new TextEncoder();

export function subscribe(channel, controller) {
  if (!subscribers.has(channel)) subscribers.set(channel, new Set());
  subscribers.get(channel).add(controller);
}

export function unsubscribe(channel, controller) {
  subscribers.get(channel)?.delete(controller);
}

export function notify(channel) {
  const subs = subscribers.get(channel);
  if (!subs) return;
  const msg = encoder.encode('data: update\n\n');
  const dead = [];
  for (const controller of subs) {
    try {
      controller.enqueue(msg);
    } catch {
      dead.push(controller);
    }
  }
  dead.forEach(c => subs.delete(c));
}
