const GUEST_CHAT_KEY = "guest_chat_session_id";

const createGuestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest_${crypto.randomUUID()}`;
  }

  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getGuestSessionId = () => {
  const current = localStorage.getItem(GUEST_CHAT_KEY);

  if (current) return current;

  const next = createGuestId();
  localStorage.setItem(GUEST_CHAT_KEY, next);
  return next;
};

export const clearGuestSessionId = () => {
  localStorage.removeItem(GUEST_CHAT_KEY);
};