import { useCallback, useState } from "react";

const COMMENTS_KEY = "np-comments";
const FOLLOWS_KEY = "np-follows";

function readAll(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function writeAll(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* noop */ }
}

/** Comments are namespaced by target type + id, e.g. "event:5". */
export function useComments(scope) {
  const [comments, setComments] = useState(() => readAll(COMMENTS_KEY)[scope] || []);

  const addComment = useCallback((user, text) => {
    const all = readAll(COMMENTS_KEY);
    const list = all[scope] || [];
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorEmail: user.email,
      authorName: user.name,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [...list, entry];
    all[scope] = next;
    writeAll(COMMENTS_KEY, all);
    setComments(next);
  }, [scope]);

  const deleteComment = useCallback((id) => {
    const all = readAll(COMMENTS_KEY);
    const next = (all[scope] || []).filter(c => c.id !== id);
    all[scope] = next;
    writeAll(COMMENTS_KEY, all);
    setComments(next);
  }, [scope]);

  return { comments, addComment, deleteComment };
}

export function getCommentCount(scope) {
  return (readAll(COMMENTS_KEY)[scope] || []).length;
}

export function useFollow(userEmail, kind, id) {
  const [following, setFollowing] = useState(() => {
    if (!userEmail) return false;
    const all = readAll(FOLLOWS_KEY);
    const mine = all[userEmail]?.[kind] || [];
    return mine.includes(id);
  });

  const toggle = useCallback(() => {
    if (!userEmail) return;
    const all = readAll(FOLLOWS_KEY);
    const mine = all[userEmail] || {};
    const list = mine[kind] || [];
    const isFollowing = list.includes(id);
    mine[kind] = isFollowing ? list.filter(x => x !== id) : [...list, id];
    all[userEmail] = mine;
    writeAll(FOLLOWS_KEY, all);
    setFollowing(!isFollowing);
  }, [userEmail, kind, id]);

  return { following, toggle };
}

export function getFollowsForUser(userEmail) {
  if (!userEmail) return { event: [], topic: [], mp: [] };
  const all = readAll(FOLLOWS_KEY);
  return { event: [], topic: [], mp: [], ...(all[userEmail] || {}) };
}

export function getAllCommentsByUser(userEmail) {
  const all = readAll(COMMENTS_KEY);
  const out = [];
  for (const scope of Object.keys(all)) {
    for (const c of all[scope]) {
      if (c.authorEmail === userEmail) out.push({ ...c, scope });
    }
  }
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
