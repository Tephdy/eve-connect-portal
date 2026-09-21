"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "apartment-portal-sidebar-state-v2";

type SidebarState = {
  openGroups: string[];
};

const DEFAULT_STATE: SidebarState = {
  openGroups: ["Overview"],
};

function read(): SidebarState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SidebarState>;
    return {
      openGroups: Array.isArray(parsed.openGroups)
        ? parsed.openGroups
        : DEFAULT_STATE.openGroups,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function write(state: SidebarState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(read());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) write(state);
  }, [state, mounted]);

  const toggleGroup = useCallback((label: string) => {
    setState((s) => {
      const set = new Set(s.openGroups);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      return { ...s, openGroups: Array.from(set) };
    });
  }, []);

  const openGroup = useCallback((label: string) => {
    setState((s) => {
      if (s.openGroups.includes(label)) return s;
      return { ...s, openGroups: [...s.openGroups, label] };
    });
  }, []);

  return {
    openGroups: state.openGroups,
    toggleGroup,
    openGroup,
    mounted,
  };
}
