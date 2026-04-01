import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import API_URL from "../config";
import LoadingState, { Spinner } from "../components/LoadingState";
import fetchWithAuth from "../utils/api";
import { withMinimumDelay } from "../utils/loading";
import "./Chat.css";

const VISIBILITY_RESUME_DEBOUNCE_MS = 250;
const THREAD_POLLING_INTERVAL_MS = 3000;
const THREAD_LOADING_MIN_DELAY_MS = 300;
const THREAD_LOADING_SHOW_DELAY_MS = 180;
const USER_SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;
const THREAD_PAGE_SIZE = 30;
const STICKY_SCROLL_THRESHOLD_PX = 80;
const RECENT_PREVIEW_MAX_CHARS = 80;
const MESSAGE_MAX_LENGTH = 2000;
const MESSAGE_COUNTDOWN_THRESHOLD = 200;
const COMPOSER_MIN_HEIGHT_PX = 40;
const COMPOSER_MAX_HEIGHT_PX = 132;
const CHAT_DRAFTS_STORAGE_KEY = "chat-drafts-by-user";
const MUTED_CONVERSATIONS_STORAGE_KEY = "chat-muted-conversations";
const RECENT_SEARCHES_STORAGE_KEY = "chat-recent-searches";
const RECENT_SEARCHES_MAX = 6;

function isNearBottom(element) {
  if (!element) {
    return false;
  }

  const distanceFromBottom =
    element.scrollHeight - (element.scrollTop + element.clientHeight);
  return distanceFromBottom <= STICKY_SCROLL_THRESHOLD_PX;
}

function scrollToBottom(element) {
  if (!element) {
    return;
  }

  element.scrollTop = element.scrollHeight;
}

function mergeMessages(existingMessages, incomingMessages) {
  const byId = new Map();

  existingMessages.forEach((message) => {
    byId.set(String(message._id), message);
  });

  incomingMessages.forEach((message) => {
    byId.set(String(message._id), message);
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function formatTimestamp(dateString) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTimestamp(dateString) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function parseJsonStorageValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedText(text, query) {
  if (!query) {
    return text;
  }

  const escapedQuery = escapeRegExp(query);
  const expression = new RegExp(`(${escapedQuery})`, "ig");
  const parts = String(text).split(expression);

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();
    if (!isMatch) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    }

    return (
      <mark key={`${part}-${index}`} className="chat-search__match">
        {part}
      </mark>
    );
  });
}

function truncatePreviewText(text, maxLength = RECENT_PREVIEW_MAX_CHARS) {
  const normalized = String(text || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function Chat() {
  const [allUsers, setAllUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [composerText, setComposerText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState(false);
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    const stored = parseJsonStorageValue(RECENT_SEARCHES_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  });
  const [draftsByUserId, setDraftsByUserId] = useState(() => {
    const stored = parseJsonStorageValue(CHAT_DRAFTS_STORAGE_KEY, {});
    return stored && typeof stored === "object" ? stored : {};
  });
  const [mutedConversationIds, setMutedConversationIds] = useState(() => {
    const stored = parseJsonStorageValue(MUTED_CONVERSATIONS_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored.map((id) => String(id)) : [];
  });
  const location = useLocation();
  const messagesContainerRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const pendingScrollToBottomRef = useRef(false);
  const pendingRestoreScrollRef = useRef(null);
  const hasWarnedHistoryFallbackRef = useRef(false);
  const threadLoadingDelayTimeoutRef = useRef(null);

  const token = localStorage.getItem("token");
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );
  const currentUserId = String(currentUser.id || currentUser._id || "");

  useEffect(() => {
    return () => {
      if (threadLoadingDelayTimeoutRef.current) {
        clearTimeout(threadLoadingDelayTimeoutRef.current);
        threadLoadingDelayTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_DRAFTS_STORAGE_KEY, JSON.stringify(draftsByUserId));
  }, [draftsByUserId]);

  useEffect(() => {
    localStorage.setItem(
      MUTED_CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(mutedConversationIds)
    );
  }, [mutedConversationIds]);

  useEffect(() => {
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setThread([]);
      setHasMoreOlderMessages(false);
      setLoadingOlderMessages(false);
      setNewMessagesBelowCount(0);
      setComposerText("");
      return;
    }
    setNewMessagesBelowCount(0);
    setComposerText(draftsByUserId[selectedUserId] || "");
    fetchThread(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }
    setComposerText(draftsByUserId[selectedUserId] || "");
  }, [draftsByUserId, selectedUserId]);

  useEffect(() => {
    resizeComposerTextarea();
  }, [composerText, selectedUserId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    if (pendingRestoreScrollRef.current) {
      const { previousScrollTop, previousScrollHeight } = pendingRestoreScrollRef.current;
      const heightDelta = container.scrollHeight - previousScrollHeight;
      container.scrollTop = previousScrollTop + Math.max(heightDelta, 0);
      pendingRestoreScrollRef.current = null;
      return;
    }

    if (pendingScrollToBottomRef.current) {
      scrollToBottom(container);
      pendingScrollToBottomRef.current = false;
      setNewMessagesBelowCount(0);
    }
  }, [thread]);

  function handleMessagesScroll() {
    if (isNearBottom(messagesContainerRef.current)) {
      setNewMessagesBelowCount(0);
    }
  }

  function handleJumpToLatest() {
    scrollToBottom(messagesContainerRef.current);
    setNewMessagesBelowCount(0);
  }

  function resizeComposerTextarea() {
    const element = composerTextareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";

    const nextHeight = Math.min(
      Math.max(element.scrollHeight, COMPOSER_MIN_HEIGHT_PX),
      COMPOSER_MAX_HEIGHT_PX
    );

    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    async function searchUsers() {
      if (!token) {
        return;
      }

      if (!debouncedSearchTerm) {
        setSearchResults([]);
        setSearchError("");
        setSearchLoading(false);
        return;
      }

      if (debouncedSearchTerm.length < MIN_SEARCH_LENGTH) {
        setSearchResults([]);
        setSearchError("");
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      setSearchError("");

      try {
        const encodedSearch = encodeURIComponent(debouncedSearchTerm);
        const res = await fetchWithAuth(`${API_URL}/api/users?search=${encodedSearch}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          throw new Error(data.message || "Failed to search users");
        }

        const users = Array.isArray(data)
          ? data.filter((user) => String(user._id) !== currentUserId)
          : [];

        setSearchResults(users);

        if (users.length > 0) {
          setAllUsers((prev) => {
            const map = new Map(prev.map((user) => [String(user._id), user]));
            users.forEach((user) => {
              map.set(String(user._id), user);
            });
            return Array.from(map.values());
          });
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchError(error.message || "Failed to search users");
      } finally {
        setSearchLoading(false);
      }
    }

    searchUsers();
  }, [token, debouncedSearchTerm, currentUserId]);

  useEffect(() => {
    setHighlightedSearchIndex(-1);
  }, [searchResults, searchTerm]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    let intervalId = null;
    let visibilityTimeoutId = null;

    function startPolling() {
      if (intervalId !== null) {
        return;
      }

      intervalId = setInterval(() => {
        fetchThread(selectedUserId, {
          showLoading: false,
          refreshConversation: false,
          resetThread: false,
        });
      }, THREAD_POLLING_INTERVAL_MS);
    }

    function stopPolling() {
      if (intervalId === null) {
        return;
      }

      clearInterval(intervalId);
      intervalId = null;
    }

    function clearVisibilityTimeout() {
      if (visibilityTimeoutId === null) {
        return;
      }

      clearTimeout(visibilityTimeoutId);
      visibilityTimeoutId = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        clearVisibilityTimeout();
        stopPolling();
        return;
      }

      clearVisibilityTimeout();
      visibilityTimeoutId = setTimeout(() => {
        visibilityTimeoutId = null;
        fetchThread(selectedUserId, {
          showLoading: false,
          refreshConversation: false,
          resetThread: false,
        });
        startPolling();
      }, VISIBILITY_RESUME_DEBOUNCE_MS);
    }

    if (document.visibilityState !== "hidden") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearVisibilityTimeout();
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function fetchInitialData() {
    if (!token) {
      setLoadError("Please log in");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const [usersRes, conversationsRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetchWithAuth(`${API_URL}/api/messages/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const usersData = await usersRes.json().catch(() => []);
      const conversationsData = await conversationsRes.json().catch(() => []);

      if (!usersRes.ok) {
        throw new Error(usersData.message || "Failed to load users");
      }
      if (!conversationsRes.ok) {
        throw new Error(conversationsData.message || "Failed to load conversations");
      }

      const otherUsers = Array.isArray(usersData)
        ? usersData.filter((user) => user._id !== currentUserId)
        : [];
      const params = new URLSearchParams(location.search);
      const requestedUserId = params.get("userId");

      setAllUsers(otherUsers);
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);

      if (
        requestedUserId &&
        otherUsers.some((user) => user._id === requestedUserId)
      ) {
        setSelectedUserId(requestedUserId);
      }
    } catch (error) {
      console.error("Error loading chat data:", error);
      setLoadError(error.message || "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  async function fetchThread(
    userId,
    { showLoading = true, refreshConversation = true, resetThread = true } = {}
  ) {
    if (!token) {
      return;
    }

    setMessageError("");

    if (showLoading) {
      startThreadLoadingIndicator();
    }

    try {
      const fetchLegacyThread = async () => {
        const legacyRes = await fetchWithAuth(`${API_URL}/api/messages/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const legacyData = await legacyRes.json().catch(() => []);

        if (!legacyRes.ok) {
          throw new Error(legacyData.message || "Failed to load messages");
        }

        return {
          messages: Array.isArray(legacyData) ? legacyData : [],
          hasMore: false,
        };
      };

      const requestPage = async (beforeMessageId = "") => {
        const query = new URLSearchParams({ limit: String(THREAD_PAGE_SIZE) });
        if (beforeMessageId) {
          query.set("beforeMessageId", beforeMessageId);
        }

        const res = await fetchWithAuth(
          `${API_URL}/api/messages/${userId}/history?${query.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const resData = await res.json().catch(() => ({}));

        if (res.status === 404) {
          // Compatibility fallback for environments still running legacy server routes.
          if (!hasWarnedHistoryFallbackRef.current) {
            hasWarnedHistoryFallbackRef.current = true;
            console.warn(
              "Chat history endpoint not found; falling back to legacy /api/messages/:userId route. Consider updating/restarting the server to enable paginated history."
            );
          }
          return fetchLegacyThread();
        }

        if (!res.ok) {
          throw new Error(resData.message || "Failed to load messages");
        }

        const messages = Array.isArray(resData?.messages) ? resData.messages : [];
        const hasMore = Boolean(resData?.hasMoreOlder);

        return { messages, hasMore };
      };

      let pageData;

      if (showLoading) {
        pageData = await withMinimumDelay(
          () => requestPage(),
          THREAD_LOADING_MIN_DELAY_MS
        );
      } else {
        pageData = await requestPage();
      }

      if (resetThread) {
        pendingScrollToBottomRef.current = true;
        setNewMessagesBelowCount(0);
        setThread(pageData.messages);
      } else {
        const shouldStickToBottom = isNearBottom(messagesContainerRef.current);
        pendingScrollToBottomRef.current = shouldStickToBottom;
        setThread((previous) => {
          const previousIds = new Set(previous.map((message) => String(message._id)));
          const freshMessagesCount = pageData.messages.reduce((count, message) => {
            return previousIds.has(String(message._id)) ? count : count + 1;
          }, 0);

          if (!shouldStickToBottom && freshMessagesCount > 0) {
            setNewMessagesBelowCount((count) => count + freshMessagesCount);
          }

          return mergeMessages(previous, pageData.messages);
        });
      }

      setHasMoreOlderMessages(pageData.hasMore);

      if (refreshConversation) {
        refreshConversations();
      }
    } catch (error) {
      console.error("Error loading message thread:", error);
      setMessageError(error.message || "Failed to load messages");
    } finally {
      if (showLoading) {
        stopThreadLoadingIndicator();
      }
    }
  }

  function startThreadLoadingIndicator() {
    if (threadLoadingDelayTimeoutRef.current) {
      clearTimeout(threadLoadingDelayTimeoutRef.current);
      threadLoadingDelayTimeoutRef.current = null;
    }

    threadLoadingDelayTimeoutRef.current = setTimeout(() => {
      threadLoadingDelayTimeoutRef.current = null;
      setThreadLoading(true);
    }, THREAD_LOADING_SHOW_DELAY_MS);
  }

  function stopThreadLoadingIndicator() {
    if (threadLoadingDelayTimeoutRef.current) {
      clearTimeout(threadLoadingDelayTimeoutRef.current);
      threadLoadingDelayTimeoutRef.current = null;
      return;
    }

    setThreadLoading(false);
  }

  async function handleLoadOlderMessages() {
    if (!token || !selectedUserId || loadingOlderMessages || !hasMoreOlderMessages) {
      return;
    }

    const oldestMessageId = thread[0]?._id;
    if (!oldestMessageId) {
      return;
    }

    setLoadingOlderMessages(true);
    setMessageError("");

    const container = messagesContainerRef.current;
    if (container) {
      pendingRestoreScrollRef.current = {
        previousScrollTop: container.scrollTop,
        previousScrollHeight: container.scrollHeight,
      };
    }

    try {
      const query = new URLSearchParams({
        limit: String(THREAD_PAGE_SIZE),
        beforeMessageId: String(oldestMessageId),
      });

      const res = await fetchWithAuth(
        `${API_URL}/api/messages/${selectedUserId}/history?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to load older messages");
      }

      const olderMessages = Array.isArray(data?.messages) ? data.messages : [];
      setThread((previous) => mergeMessages(previous, olderMessages));
      setHasMoreOlderMessages(Boolean(data?.hasMoreOlder));
    } catch (error) {
      console.error("Error loading older messages:", error);
      pendingRestoreScrollRef.current = null;
      setMessageError(error.message || "Failed to load older messages");
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function refreshConversations() {
    if (!token) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/api/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  }

  function commitRecentSearch(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return;
    }

    setRecentSearches((previous) => {
      const deduped = previous.filter(
        (item) => item.toLowerCase() !== normalized.toLowerCase()
      );
      return [normalized, ...deduped].slice(0, RECENT_SEARCHES_MAX);
    });
  }

  function handleSearchResultSelection(user) {
    if (!user?._id) {
      return;
    }

    setSelectedUserId(String(user._id));
    commitRecentSearch(user.username || user.name || "");
  }

  function handleSearchKeyDown(event) {
    if (searchResults.length === 0) {
      if (event.key === "Enter" && exactUsernameMatch) {
        event.preventDefault();
        handleSearchResultSelection(exactUsernameMatch);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedSearchIndex((previous) => {
        const next = previous + 1;
        return next >= searchResults.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedSearchIndex((previous) => {
        if (previous <= 0) {
          return searchResults.length - 1;
        }
        return previous - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      if (highlightedSearchIndex >= 0 && highlightedSearchIndex < searchResults.length) {
        event.preventDefault();
        handleSearchResultSelection(searchResults[highlightedSearchIndex]);
        return;
      }

      if (exactUsernameMatch) {
        event.preventDefault();
        handleSearchResultSelection(exactUsernameMatch);
      }
    }
  }

  function handleComposerChange(event) {
    const nextValue = event.target.value;
    setComposerText(nextValue);

    if (!selectedUserId) {
      return;
    }

    setDraftsByUserId((previous) => ({
      ...previous,
      [selectedUserId]: nextValue,
    }));
  }

  function handleComposerKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSendMessage(event);
  }

  function toggleConversationMuted(userId) {
    const normalized = String(userId);
    setMutedConversationIds((previous) => {
      if (previous.includes(normalized)) {
        return previous.filter((id) => id !== normalized);
      }
      return [...previous, normalized];
    });
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!token || !selectedUserId || isSendingMessage) {
      return;
    }

    const text = composerText.trim();
    if (!text) {
      return;
    }

    setMessageError("");

    const temporaryMessageId = `temp-${Date.now()}`;
    const temporaryMessage = {
      _id: temporaryMessageId,
      sender: currentUserId,
      recipient: selectedUserId,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    pendingScrollToBottomRef.current = true;
    setThread((prev) => [...prev, temporaryMessage]);
    setComposerText("");
    setIsSendingMessage(true);

    setDraftsByUserId((previous) => {
      const next = { ...previous };
      delete next[selectedUserId];
      return next;
    });

    try {
      const res = await fetchWithAuth(`${API_URL}/api/messages/${selectedUserId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      setThread((prev) =>
        prev.map((message) =>
          message._id === temporaryMessageId ? data : message
        )
      );
      refreshConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      setThread((prev) =>
        prev.filter((message) => message._id !== temporaryMessageId)
      );
      setComposerText(text);
      setDraftsByUserId((previous) => ({
        ...previous,
        [selectedUserId]: text,
      }));
      setMessageError(error.message || "Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  }

  const usersById = useMemo(() => {
    const map = new Map();
    allUsers.forEach((user) => {
      map.set(String(user._id), user);
    });
    conversations.forEach((conversation) => {
      if (conversation?.user?._id) {
        map.set(String(conversation.user._id), conversation.user);
      }
    });
    searchResults.forEach((user) => {
      map.set(String(user._id), user);
    });
    return map;
  }, [allUsers, conversations, searchResults]);

  const selectedUser = usersById.get(String(selectedUserId)) || null;

  const recentConversations = useMemo(() => {
    const list = Array.isArray(conversations) ? [...conversations] : [];
    list.sort(
      (a, b) =>
        new Date(b?.lastMessage?.createdAt || 0).getTime() -
        new Date(a?.lastMessage?.createdAt || 0).getTime()
    );
    return unreadOnlyFilter
      ? list.filter((conversation) => {
          const userId = String(conversation?.user?._id || "");
          const isMuted = mutedConversationIds.includes(userId);
          return Number(conversation?.unreadCount || 0) > 0 && !isMuted;
        })
      : list;
  }, [conversations, unreadOnlyFilter, mutedConversationIds]);

  const conversationByUserId = useMemo(() => {
    const map = new Map();
    conversations.forEach((conversation) => {
      if (conversation?.user?._id) {
        map.set(String(conversation.user._id), conversation);
      }
    });
    return map;
  }, [conversations]);

  const searchTermNormalized = searchTerm.trim().replace(/^@/, "").toLowerCase();

  const exactUsernameMatch = useMemo(() => {
    if (!searchTermNormalized || searchTermNormalized.length < MIN_SEARCH_LENGTH) {
      return null;
    }

    return (
      searchResults.find(
        (user) => String(user.username || "").toLowerCase() === searchTermNormalized
      ) || null
    );
  }, [searchResults, searchTermNormalized]);

  const shouldShowRecentSearches = isSearchFocused && searchTerm.trim().length === 0;

  const composerRemainingCharacters = MESSAGE_MAX_LENGTH - composerText.length;
  const shouldShowComposerCountdown =
    composerText.length > 0 && composerRemainingCharacters <= MESSAGE_COUNTDOWN_THRESHOLD;

  const shouldShowSearchResults = searchTerm.trim().length > 0;

  if (loading) {
    return <LoadingState message="Loading chat..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={fetchInitialData} />;
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <h2 className="chat-sidebar__title">Conversations</h2>
        <div className="chat-search">
          <label htmlFor="chat-user-search" className="chat-search__label">
            Search users
          </label>
          <input
            id="chat-user-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => {
                setIsSearchFocused(false);
              }, 100);
            }}
            placeholder="Search by name or username"
            className="chat-search__input"
            aria-label="Search users to start a conversation"
          />
        </div>

        {shouldShowRecentSearches && recentSearches.length > 0 && (
          <div className="chat-sidebar-section chat-sidebar-section--compact">
            <h3 className="chat-sidebar__subtitle">Recent searches</h3>
            <div className="chat-recent-searches">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="chat-recent-searches__item"
                  onClick={() => setSearchTerm(term)}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {shouldShowSearchResults && (
          <div className="chat-sidebar-section" aria-live="polite">
            <h3 className="chat-sidebar__subtitle">Search results</h3>
            {exactUsernameMatch && (
              <div className="chat-start-card">
                <p>
                  Start or continue chat with <strong>@{exactUsernameMatch.username}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => handleSearchResultSelection(exactUsernameMatch)}
                >
                  {conversationByUserId.has(String(exactUsernameMatch._id))
                    ? "Open existing chat"
                    : "Start new chat"}
                </button>
              </div>
            )}
            {searchTerm.trim().length < MIN_SEARCH_LENGTH ? (
              <p className="chat-sidebar__empty">
                Type at least {MIN_SEARCH_LENGTH} characters to search.
              </p>
            ) : searchLoading ? (
              <p className="chat-sidebar__empty">Searching users...</p>
            ) : searchError ? (
              <p className="chat-error chat-error--sidebar">{searchError}</p>
            ) : searchResults.length === 0 ? (
              <p className="chat-sidebar__empty">No users found for that search.</p>
            ) : (
              <div className="chat-user-list" role="list">
                {searchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    className={`chat-user-item ${
                      selectedUserId === user._id ? "active" : ""
                    } ${
                      highlightedSearchIndex >= 0 &&
                      searchResults[highlightedSearchIndex]?._id === user._id
                        ? "keyboard-active"
                        : ""
                    }`}
                    onClick={() => handleSearchResultSelection(user)}
                    aria-label={`Open chat with ${user.name}`}
                  >
                    <span className="chat-user-item__name">
                      {renderHighlightedText(user.name, searchTerm.trim())}
                    </span>
                    <span className="chat-user-item__username">
                      @{renderHighlightedText(user.username, searchTermNormalized)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="chat-sidebar-section">
          <div className="chat-sidebar__header-row">
            <h3 className="chat-sidebar__subtitle">Recent conversations</h3>
            <button
              type="button"
              className={`chat-filter-toggle ${unreadOnlyFilter ? "active" : ""}`}
              onClick={() => setUnreadOnlyFilter((previous) => !previous)}
            >
              Unread only
            </button>
          </div>
          {recentConversations.length === 0 ? (
            <p className="chat-sidebar__empty">
              {unreadOnlyFilter
                ? "No unread conversations right now."
                : "No recent conversations yet."}
            </p>
          ) : (
            <div className="chat-user-list" role="list">
              {recentConversations.map((conversation) => {
                const user = conversation?.user;
                if (!user?._id) {
                  return null;
                }

                const userId = String(user._id);
                const unreadCount = Number(conversation?.unreadCount || 0);
                const isMuted = mutedConversationIds.includes(userId);
                return (
                  <div key={user._id} className="chat-user-item-wrap">
                    <button
                      type="button"
                      className={`chat-user-item ${
                        selectedUserId === user._id ? "active" : ""
                      }`}
                      onClick={() => setSelectedUserId(userId)}
                      aria-label={`Open recent conversation with ${user.name}`}
                    >
                      <span className="chat-user-item__name">{user.name}</span>
                      <span className="chat-user-item__username">@{user.username}</span>
                      {conversation?.lastMessage?.createdAt && (
                        <span className="chat-user-item__time">
                          {formatRelativeTimestamp(conversation.lastMessage.createdAt)}
                        </span>
                      )}
                      {conversation?.lastMessage?.text && (
                        <span
                          className="chat-user-item__preview"
                          title={conversation.lastMessage.text}
                        >
                          {truncatePreviewText(conversation.lastMessage.text)}
                        </span>
                      )}
                      {!isMuted && unreadCount > 0 && (
                        <span className="chat-user-item__unread">{unreadCount}</span>
                      )}
                      {isMuted && <span className="chat-user-item__muted-icon">Muted</span>}
                    </button>
                    <button
                      type="button"
                      className="chat-user-item__mute-toggle"
                      onClick={() => toggleConversationMuted(userId)}
                    >
                      {isMuted ? "Unmute" : "Mute"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="chat-thread">
        {selectedUser ? (
          <>
            <header className="chat-thread__header">
              <h1>Chat with {selectedUser.name}</h1>
              <p>@{selectedUser.username}</p>
            </header>

            <div
              className="chat-messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {!threadLoading && hasMoreOlderMessages && (
                <div className="chat-messages__load-older">
                  <button
                    type="button"
                    className="chat-messages__load-older-button"
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlderMessages}
                  >
                    {loadingOlderMessages ? "Loading older messages..." : "Load older messages"}
                  </button>
                </div>
              )}
              <div
                className={`chat-messages__jump-latest-wrap ${
                  newMessagesBelowCount > 0 ? "is-visible" : ""
                }`}
                aria-hidden={newMessagesBelowCount === 0}
              >
                <button
                  type="button"
                  className="chat-messages__jump-latest-button"
                  onClick={handleJumpToLatest}
                  disabled={newMessagesBelowCount === 0}
                  tabIndex={newMessagesBelowCount > 0 ? 0 : -1}
                >
                  {newMessagesBelowCount > 0
                    ? `${newMessagesBelowCount} new message${
                        newMessagesBelowCount === 1 ? "" : "s"
                      } below`
                    : " "}
                </button>
              </div>
              {threadLoading && (
                <div className="chat-messages__loading-overlay" data-testid="thread-loading">
                  <Spinner />
                  <span className="chat-messages__loading-text">Loading messages...</span>
                </div>
              )}
              {!threadLoading && (
                thread.length === 0 ? (
                  <p className="chat-messages__empty">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  thread.map((message) => {
                    const isMine =
                      String(message.sender?._id || message.sender) === currentUserId;
                    return (
                      <div
                        key={message._id}
                        className={`chat-bubble ${isMine ? "mine" : "theirs"} ${
                          message.pending ? "pending" : ""
                        }`}
                      >
                        <p>{message.text}</p>
                        <span>{formatTimestamp(message.createdAt)}</span>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <form className="chat-composer" onSubmit={handleSendMessage}>
              <textarea
                ref={composerTextareaRef}
                placeholder="Type a message..."
                value={composerText}
                onChange={handleComposerChange}
                onKeyDown={handleComposerKeyDown}
                maxLength={MESSAGE_MAX_LENGTH}
                rows={1}
              />
              <button
                type="submit"
                className="chat-composer__send-icon"
                aria-label={isSendingMessage ? "Sending message" : "Send message"}
                disabled={!composerText.trim() || isSendingMessage}
              >
                {isSendingMessage ? "..." : "↑"}
              </button>
            </form>
            {shouldShowComposerCountdown && (
              <p className="chat-composer__countdown">
                {composerRemainingCharacters} characters left
              </p>
            )}
            {messageError && <p className="chat-error">{messageError}</p>}
          </>
        ) : (
          <div className="chat-thread__empty">
            <p>Click on a chat to start or continue a conversation.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Chat;
