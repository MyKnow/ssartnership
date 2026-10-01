import Link from "next/link";
import { SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import type { ShowcaseProject } from "@/lib/project-showcase/types";

export default function ShowcaseProjectCard({
  project,
  completed = false,
  previewMode = false,
}: {
  project: ShowcaseProject;
  /** The viewer already left feedback (a valid experience) on this project. */
  completed?: boolean;
  /** Links to the local-only detail flow from the admin experience preview. */
  previewMode?: boolean;
}) {
  const content = (
    <>
      <div className="relative aspect-video overflow-hidden bg-surface-muted">
        {/* Project covers live in a public Storage bucket rather than next/image remote patterns. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.imageUrl}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${previewMode ? "" : "transition-transform duration-300 group-hover:scale-[1.02]"}`}
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-900">
          {SHOWCASE_TYPE_LABELS[project.projectType]}
        </span>
        {!previewMode && completed ? (
          <span className="absolute right-3 top-3 rounded-full bg-success px-3 py-1 text-xs font-bold text-white">체험 완료</span>
        ) : null}
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        <div className="grid gap-1.5">
          <h3 className="line-clamp-1 text-lg font-bold text-foreground">{project.title}</h3>
          {project.teamName ? <p className="text-xs font-medium text-muted-foreground">{project.teamName}</p> : null}
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{project.summary}</p>
        </div>
        <span className="text-sm font-semibold text-primary">
          {previewMode ? "상세 체험 흐름 미리보기" : "자세히 보기"} <span aria-hidden="true">→</span>
        </span>
      </div>
    </>
  );

  return (
    <article className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ${previewMode ? "" : "group transition-shadow hover:shadow-md"}`}>
      <Link
        href={previewMode
          ? `/events/project-showcase/projects/${encodeURIComponent(project.id)}?preview=experience`
          : `/events/project-showcase/projects/${encodeURIComponent(project.id)}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {content}
      </Link>
    </article>
  );
}
