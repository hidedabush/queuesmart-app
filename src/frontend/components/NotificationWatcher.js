import { useEffect, useRef } from 'react';
import { useServices } from '../state/ServicesStore';
import { useToast } from './Toast';

// Shows a popup (the existing Toast) when a NEW notification arrives while the
// app is open. Notifications that already existed when the app loaded are not
// popped up again; they stay in the bell list. Only one popup shows at a time,
// so if several arrive together the most urgent one wins.
const PRIORITY = { called: 3, 'almost-up': 2, joined: 1 };

export default function NotificationWatcher() {
  const { notifications, notificationsLoaded } = useServices();
  const show = useToast();
  const seen = useRef(null);

  useEffect(() => {
    // Signed out: forget what was seen so the next account starts clean.
    if (!notificationsLoaded) {
      seen.current = null;
      return;
    }

    // First load: remember what is already there without popping it up.
    if (seen.current === null) {
      seen.current = new Set(notifications.map((item) => item.id));
      return;
    }

    const fresh = notifications.filter((item) => !item.read && !seen.current.has(item.id));
    fresh.forEach((item) => seen.current.add(item.id));
    if (fresh.length === 0) return;

    const top = fresh.reduce((best, item) =>
      (PRIORITY[item.type] ?? 0) > (PRIORITY[best.type] ?? 0) ? item : best
    );
    show(`${top.title}. ${top.message}`);
  }, [notifications, notificationsLoaded, show]);

  return null;
}