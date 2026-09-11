"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface UseUnsavedChangesOptions {
  message?: string;
  enabled?: boolean;
}

export function useUnsavedChanges(
  isDirty: boolean,
  options: UseUnsavedChangesOptions = {}
) {
  const {
    message = "You have unsaved changes. Are you sure you want to leave?",
    enabled = true,
  } = options;

  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Handle browser back/forward and tab close
  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, enabled, message]);

  // Confirm navigation
  const confirmNavigation = useCallback(() => {
    setShowWarning(false);
    if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, router]);

  // Cancel navigation
  const cancelNavigation = useCallback(() => {
    setShowWarning(false);
    setPendingNavigation(null);
  }, []);

  // Safe navigation that checks for unsaved changes
  const safeNavigate = useCallback(
    (path: string) => {
      if (enabled && isDirty) {
        setPendingNavigation(path);
        setShowWarning(true);
        return false;
      }
      router.push(path);
      return true;
    },
    [enabled, isDirty, router]
  );

  return {
    showWarning,
    confirmNavigation,
    cancelNavigation,
    safeNavigate,
    setShowWarning,
  };
}

// Unsaved Changes Warning Modal Component
export function UnsavedChangesModal({
  show,
  onConfirm,
  onCancel,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Unsaved Changes
          </h2>
          <p className="text-white/60 text-sm mb-6">{message}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onConfirm}
              className="px-6 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Leave Without Saving
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              Stay on Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default useUnsavedChanges;
