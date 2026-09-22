import { useCallback, useEffect, useRef, useState } from "react";
import { getChoerodonSyncPreview } from "./api";
import { taskboardStorage } from "./storage";
import type { ChoerodonSyncPreview } from "./types";

interface UseChoerodonSyncWatcherOptions {
  projectId: string | null;
  enabled: boolean;
  dialogOpen?: boolean;
}

function parseStoredFilter(key: string): string[] | null {
  const stored = taskboardStorage.getItem(key);
  if (stored === null) return null;
  if (stored === "all") return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [stored];
  } catch {
    return [stored];
  }
}

function getSeenIds(projectId: string): Set<string> {
  const stored = taskboardStorage.getItem(`taskboard.choerodon-sync-seen.${projectId}`);
  if (!stored) return new Set();
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function useChoerodonSyncWatcher({
  projectId,
  enabled,
  dialogOpen = false,
}: UseChoerodonSyncWatcherOptions) {
  const [hasNewIssues, setHasNewIssues] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const latestMatchingIdsRef = useRef<string[]>([]);
  const lastCheckTimeRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  const check = useCallback(async () => {
    if (!projectId || !enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const preview: ChoerodonSyncPreview = await getChoerodonSyncPreview(projectId);
      const filterStorageKey = `taskboard.choerodon-sync-filters.${projectId}`;
      const groupFilter = parseStoredFilter(`${filterStorageKey}.group`);
      const typeFilter = parseStoredFilter(`${filterStorageKey}.type`) ?? [];
      const assigneeFilter = parseStoredFilter(`${filterStorageKey}.assignee`) ?? [];

      const activeGroupFilter = groupFilter ?? (
        preview.groups.find((group) => group.name === "待开发")
          ? [preview.groups.find((group) => group.name === "待开发")!.id]
          : []
      );

      const matchingUnsynced = preview.issues.filter((issue) => (
        issue.localTaskId === null
        && (!activeGroupFilter.length || activeGroupFilter.includes(issue.groupId))
        && (!typeFilter.length || typeFilter.includes(issue.type))
        && (!assigneeFilter.length || assigneeFilter.includes(issue.assignee.id))
      ));

      const matchingIds = matchingUnsynced.map((issue) => issue.id);
      latestMatchingIdsRef.current = matchingIds;

      const seenIds = getSeenIds(projectId);
      const unseenIssues = matchingUnsynced.filter((issue) => !seenIds.has(issue.id));

      if (unseenIssues.length > 0 && !dialogOpen) {
        setHasNewIssues(true);
        setNewCount(unseenIssues.length);
      } else {
        setHasNewIssues(false);
        setNewCount(0);
      }
      lastCheckTimeRef.current = Date.now();
    } catch {
      // Silent catch: network drops or token expiration shouldn't interrupt active work
    } finally {
      inFlightRef.current = false;
    }
  }, [projectId, enabled, dialogOpen]);

  const markAsSeen = useCallback(() => {
    if (!projectId) return;
    const currentSeen = getSeenIds(projectId);
    for (const id of latestMatchingIdsRef.current) {
      currentSeen.add(id);
    }
    taskboardStorage.setItem(
      `taskboard.choerodon-sync-seen.${projectId}`,
      JSON.stringify([...currentSeen].slice(-500)),
    );
    setHasNewIssues(false);
    setNewCount(0);
  }, [projectId]);

  useEffect(() => {
    if (!enabled || !projectId) {
      setHasNewIssues(false);
      setNewCount(0);
      latestMatchingIdsRef.current = [];
      return;
    }

    void check();

    const intervalTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void check();
      }
    }, 5 * 60_000);

    const handleFocus = () => {
      if (Date.now() - lastCheckTimeRef.current >= 1_000) {
        void check();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheckTimeRef.current >= 1_000) {
        void check();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, projectId, check]);

  useEffect(() => {
    if (dialogOpen) {
      markAsSeen();
    }
  }, [dialogOpen, markAsSeen]);

  return {
    hasNewIssues,
    newCount,
    markAsSeen,
    refresh: check,
  };
}
