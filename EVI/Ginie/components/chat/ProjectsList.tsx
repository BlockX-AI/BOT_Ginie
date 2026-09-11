"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
type Project = { id: string; title: string; created_at: string };
import { FolderOpen, Clock, ExternalLink, Loader2, Download, Trash2 } from "lucide-react";

interface ProjectsListProps {
  trigger?: React.ReactNode;
}

export function ProjectsList({ trigger }: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<{ created_at?: string; job_id?: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const res = await api.listUserJobsCached({ limit: 20 });
      if (res?.jobs && Array.isArray(res.jobs)) {
        const mapped = res.jobs.map((j: any) => ({ id: j.job_id, title: j.title || j.filename || j.job_id, created_at: j.created_at }));
        setProjects(mapped);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.warn('Failed to load jobs', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoading(true);
    try {
      const res = await api.listUserJobsCached({ limit: 20, cursorCreatedAt: nextCursor.created_at, cursorId: nextCursor.job_id });
      if (res?.jobs && Array.isArray(res.jobs)) {
        const mapped = res.jobs.map((j: any) => ({ id: j.job_id, title: j.title || j.filename || j.job_id, created_at: j.created_at }));
        setProjects((p) => [...p, ...mapped]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.warn('Failed to load more jobs', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    setIsOpen(false);
    router.push(`/chat/${projectId}`);
  };

  const handleExport = async (jobId: string, title?: string) => {
    try {
      const res = await api.exportUserJob(jobId);
      const data = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || jobId).replace(/[^a-z0-9-_\.]/gi, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Export failed', e);
      alert('Failed to export job');
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    try {
      await api.deleteUserJob(jobId);
      setProjects((p) => p.filter((x) => x.id !== jobId));
    } catch (e) {
      console.warn('Delete failed', e);
      alert('Failed to delete job');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <FolderOpen size={16} />
            <span>My Projects</span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="h-full w-[400px] sm:w-[540px] text-white bg-[#0a0a0a] border-white/10">
        <SheetHeader>
          <SheetTitle className="text-white text-xl">My Projects</SheetTitle>
          <SheetDescription className="text-white/60">
            View and manage all your projects
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No projects yet</p>
              <p className="text-white/30 text-xs mt-1">
                Start a new chat to create your first project
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-80px)] overflow-y-auto pr-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className="w-full text-left p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm truncate mb-1">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Clock size={12} />
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                      <button title="Open" onClick={() => handleProjectClick(project.id)} className="p-1 rounded-md hover:bg-white/6 text-white/60">
                        <ExternalLink size={14} />
                      </button>
                      <button title="Export" onClick={() => handleExport(project.id, project.title)} className="p-1 rounded-md hover:bg-white/6 text-white/60">
                        <Download size={14} />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(project.id)} className="p-1 rounded-md hover:bg-red-600 text-white/60">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </button>
              ))}
              {nextCursor && (
                <div className="py-4 text-center">
                  <button onClick={loadMore} className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/10 text-sm">
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
