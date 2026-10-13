"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../../lib/product/types";
export function useProduct() {
  const [state, setState] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [configured, setConfigured] = useState(true),
    [lastSync, setLastSync] = useState<Date | null>(null);
  const inFlight = useRef(false),
    mutating = useRef(false),
    generation = useRef(0);
  const reload = useCallback(async (quiet = false) => {
    if ((inFlight.current && quiet) || mutating.current) return;
    inFlight.current = true;
    const g = generation.current;
    try {
      const res = await fetch("/api/product", { cache: "no-store" });
      const data = (await res.json()) as Snapshot & { error?: string };
      if (g !== generation.current) return;
      if (res.status === 401) {
        setState(null);
        return;
      }
      if (!res.ok) {
        if (res.status === 503 && data.error?.includes("operator"))
          setConfigured(false);
        throw Error(data.error || "Couldn’t sync your account.");
      }
      setState(data);
      setConfigured(true);
      setLastSync(new Date());
      if (!quiet) setError("");
    } catch (e) {
      if (g === generation.current)
        setError(
          e instanceof Error ? e.message : "Connection lost. Please retry.",
        );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload(true);
    }, 8000);
    const focus = () => void reload(true);
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [reload]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const command = async (
    action: string,
    data: Record<string, unknown>,
    message = "Saved",
  ) => {
    if (mutating.current) return false;
    mutating.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const next = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) {
        if (res.status === 401) setState(null);
        throw Error(next.error || "Couldn’t save this change.");
      }
      setState(next);
      setLastSync(new Date());
      if (message) setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection lost. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
      mutating.current = false;
    }
  };
  const auth = async (data: Record<string, unknown>) => {
    generation.current++;
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await res.json()) as {
      error?: string;
      verify?: boolean;
      message?: string;
      ok?: boolean;
    };
    if (!res.ok) throw Error(result.error || "Couldn’t complete this request.");
    return result;
  };
  const logout = async () => {
    setBusy(true);
    try {
      await auth({ action: "logout" });
      setState(null);
      setNotice("You’re logged out.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t log out.");
    } finally {
      setBusy(false);
    }
  };
  return {
    state,
    loading,
    recovery,
    setRecovery,
    busy,
    error,
    setError,
    notice,
    setNotice,
    configured,
    reload,
    command,
    auth,
    logout,
    lastSync,
  };
}
export type Product = ReturnType<typeof useProduct>;
