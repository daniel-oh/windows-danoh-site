"use client";
import { useCallback } from "react";

export function useServerPrograms() {
  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs");
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const saveProgram = useCallback(
    async (program: {
      id: string;
      name: string;
      prompt: string;
      code?: string;
      icon?: string | null;
    }) => {
      try {
        await fetch("/api/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(program),
        });
      } catch {
        /* silent */
      }
    },
    []
  );

  const deleteProgram = useCallback(async (id: string) => {
    try {
      await fetch("/api/programs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* silent */
    }
  }, []);

  return { fetchPrograms, saveProgram, deleteProgram };
}
