"use client";

import { useEffect, useState } from "react";

import { getDataSourceMode } from "@/lib/config/data-source";
import { readStudentProfileByUid } from "@/lib/firebase/firestore";
import { mockStudent } from "@/lib/mock/fixtures";
import type { Student } from "@/types/models";
import type { User } from "firebase/auth";
import studentsDataRaw from "@/lib/data/students.json";

const studentsData = studentsDataRaw as Record<string, string>;

export function useCurrentStudentProfile(user: User | null | undefined) {
  const uid = user?.uid;
  const email = user?.email;
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
        // Fallback: infer from students.json!
        let resolvedRouteId = "15"; // default route
        let inferredFullName = email?.split('@')[0] || "Student";
        
        let rollNoMatch = email?.split('@')[0].toLowerCase() || "";
        if (studentsData[rollNoMatch]) {
          resolvedRouteId = studentsData[rollNoMatch];
          inferredFullName = `Student (${rollNoMatch.toUpperCase()})`;
        } else if (email === "ramcharannarra8@gmail.com") {
          resolvedRouteId = "15";
          inferredFullName = "Ram Charan";
        }

        const fallbackStudent: Student = {
          id: `student-${uid}`,
          uid: uid,
          collegeId: "snist-01",
          fullName: inferredFullName,
          email: email || "",
          busId: resolvedRouteId, // Use the route number as the busId for trackerCandidates/busId
          routeId: `route-${resolvedRouteId}`,
          stopId: "stop-unknown",
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setStudent(fallbackStudent);
        setError(null); // Clear error since we handled it gracefully
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
  }, [mode, uid, email]);

  return {
    mode,
    isLoading,
    student,
    error,
  };
}
