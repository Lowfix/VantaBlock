import { useCallback, useSyncExternalStore } from "react";
import { subscribeLiveConsole, getLiveConsoleSnapshot, sendLiveCommand, EMPTY_SNAPSHOT } from "./liveConsoleStore";
import type { LiveResourceStats } from "./liveConsoleStore";

export type { LiveResourceStats };

export interface LiveConsole {
  lines: string[];
  connected: boolean;
  sendCommand: (command: string) => void;
  stats: LiveResourceStats | null;
}

export function useLiveConsole(identifier: string | null): LiveConsole {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!identifier) return () => {};
      return subscribeLiveConsole(identifier, onChange);
    },
    [identifier]
  );

  const getSnapshot = useCallback(() => {
    if (!identifier) return EMPTY_SNAPSHOT;
    return getLiveConsoleSnapshot(identifier);
  }, [identifier]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const sendCommand = useCallback(
    (command: string) => {
      if (identifier) sendLiveCommand(identifier, command);
    },
    [identifier]
  );

  return { lines: snapshot.lines, connected: snapshot.connected, stats: snapshot.stats, sendCommand };
}
