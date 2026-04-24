'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultPresenceSnapshot, TaskPresenceSnapshot } from './task-chat';

type PresenceRole = 'user' | 'volunteer';

type PresenceResponse = {
  presence?: TaskPresenceSnapshot;
};

const HEARTBEAT_MS = 10000;
const POLL_MS = 3000;

export function useTaskPresence({
  taskId,
  role,
  enabled = true,
}: {
  taskId: string;
  role: PresenceRole;
  enabled?: boolean;
}) {
  const [presenceState, setPresenceState] = useState<{ taskId: string; snapshot: TaskPresenceSnapshot }>(() => ({
    taskId: '',
    snapshot: defaultPresenceSnapshot(),
  }));
  const typingRef = useRef(false);
  const lastTypingSentRef = useRef<boolean | null>(null);

  const loadPresence = useCallback(async () => {
    if (!taskId || !enabled) return;

    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/presence`, { cache: 'no-store' });
    const data = (await response.json()) as PresenceResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load participant status.');
    }

    setPresenceState({
      taskId,
      snapshot: data.presence ?? defaultPresenceSnapshot(),
    });
  }, [enabled, taskId]);

  const postHeartbeat = useCallback(
    async (typing: boolean, force = false) => {
      if (!taskId || !enabled) return;

      if (!force && lastTypingSentRef.current === typing) {
        return;
      }

      lastTypingSentRef.current = typing;

      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, typing }),
      });
      const data = (await response.json()) as PresenceResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update participant status.');
      }

      setPresenceState({
        taskId,
        snapshot: data.presence ?? defaultPresenceSnapshot(),
      });
    },
    [enabled, role, taskId]
  );

  useEffect(() => {
    lastTypingSentRef.current = null;
    typingRef.current = false;

    if (!taskId || !enabled) {
      return;
    }

    let cancelled = false;

    const syncHeartbeat = async (typing: boolean, force = false) => {
      try {
        await postHeartbeat(typing, force);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    const syncPresence = async () => {
      try {
        await loadPresence();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void syncHeartbeat(false, true);
    void syncPresence();

    const heartbeatInterval = window.setInterval(() => {
      void syncHeartbeat(typingRef.current, true);
    }, HEARTBEAT_MS);

    const pollInterval = window.setInterval(() => {
      void syncPresence();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatInterval);
      window.clearInterval(pollInterval);
      if (typingRef.current) {
        void postHeartbeat(false, true);
      }
    };
  }, [enabled, loadPresence, postHeartbeat, taskId]);

  const setTyping = useCallback(
    (typing: boolean) => {
      typingRef.current = typing;
      void postHeartbeat(typing);
    },
    [postHeartbeat]
  );

  const presence = enabled && presenceState.taskId === taskId
    ? presenceState.snapshot
    : defaultPresenceSnapshot();

  return {
    presence,
    selfPresence: presence[role],
    peerPresence: presence[role === 'user' ? 'volunteer' : 'user'],
    setTyping,
    refreshPresence: loadPresence,
  };
}
