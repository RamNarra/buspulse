"use client";

import { useEffect, useState } from "react";

import { getDataSourceMode } from "@/lib/config/data-source";
import { readStudentProfileByUid } from "@/lib/firebase/firestore";
import { mockStudent } from "@/lib/mock/fixtures";
import type { Student } from "@/types/models";

export function useCurrentStudentProfile(uid: string | null | undefined) {
  const mode = getDataSourceMode();
  const [isLoading, setIsLoading] = useState(mode === "live");
  const [student, setStudent] = useState<Student | null>(
    mode === "mock" ? mockStudent : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (mode === "mock") {
        if (isMounted) {
          setStudent(mockStudent);
          setIsLoading(false);
        }
        return;
      }

      if (!uid) {
        if (isMounted) {
          setStudent(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      const result = await readStudentProfileByUid(uid);
      if (!isMounted) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setStudent(null);
        setIsLoading(false);
        return;
      }

      setStudent(result.student);
      setError(null);
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [mode, uid]);

  return {
    mode,
    isLoading,
    student,
    error,
  };
}
