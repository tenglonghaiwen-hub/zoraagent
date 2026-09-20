// Read state is local to the current account; message IDs survive reloads.
export function createMessageReadState(storage, key) {
  let read = new Set();
  try { const value = JSON.parse(storage.getItem(key) || '[]'); if (Array.isArray(value)) read = new Set(value.map(String)); } catch {}
  const ids = messages => [...new Set(messages.filter(m => m?.id != null).map(m => String(m.id)))];
  return {
    count: messages => ids(messages).filter(id => !read.has(id)).length,
    markRead(messages) {
      for (const id of ids(messages)) read.add(id);
      try { storage.setItem(key, JSON.stringify([...read])); } catch {}
    }
  };
}
export const messageBadgeText = count => count > 99 ? '99+' : count > 1 ? String(count) : '';
