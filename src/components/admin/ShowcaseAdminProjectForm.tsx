"use client";

import { PhotoIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  createAdminShowcaseProject,
  searchShowcaseAdminOwners,
  updateAdminShowcaseProject,
} from "@/app/admin/(protected)/events/project-showcase/actions";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import { prepareImageUploadSource } from "@/lib/image-upload/client-transform";
import {
  IMAGE_SOURCE_ACCEPT,
  resolveImageTransformPolicy,
  validateImageUploadSource,
} from "@/lib/image-upload/policy";
import {
  SHOWCASE_ADMIN_STATUS_LABELS,
  SHOWCASE_TYPE_LABELS,
  SHOWCASE_TYPE_NOTES,
} from "@/lib/project-showcase/labels";
import {
  SHOWCASE_PROJECT_STATUSES,
  SHOWCASE_PROJECT_TYPES,
  type ShowcaseProjectType,
} from "@/lib/project-showcase/types";
import type { ShowcaseAdminMemberOption, ShowcaseAdminProject } from "@/lib/project-showcase/repository";
import {
  parseShowcaseAdminProjectSubmission,
  SHOWCASE_SERVICE_URL_HINTS,
} from "@/lib/project-showcase/validation";

const IMAGE_POLICY = resolveImageTransformPolicy("showcase-project", "image");
const VALIDATION_IMAGE_ID = "ad6e43a7-962f-4c54-89f3-4d2a13968356";
const INPUT_CLASS = "min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const ADMIN_PATH = "/admin/events/project-showcase";

type ShowcaseAdminProjectFormProps =
  | { mode: "create"; project?: undefined }
  | { mode: "edit"; project: ShowcaseAdminProject };

export default function ShowcaseAdminProjectForm({ mode, project }: ShowcaseAdminProjectFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [projectType, setProjectType] = useState<ShowcaseProjectType>(project?.projectType ?? "web");
  const [allowImmediateFeedback, setAllowImmediateFeedback] = useState(
    project?.allowImmediateFeedback ?? (projectType === "app" || projectType === "game"),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(project?.imageUrl ?? "");
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerMatches, setOwnerMatches] = useState<ShowcaseAdminMemberOption[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<ShowcaseAdminMemberOption | null>(null);
  const [ownerError, setOwnerError] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const urlHint = SHOWCASE_SERVICE_URL_HINTS[projectType];

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!cropSourceFile) {
      setCropSourceUrl("");
      return;
    }
    const url = URL.createObjectURL(cropSourceFile);
    setCropSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cropSourceFile]);

  useEffect(() => {
    if (!error) return;
    const target = errorField
      ? formRef.current?.querySelector<HTMLElement>(`[name="${errorField}"]`)
      : null;
    (target ?? formRef.current)?.focus();
    (target ?? formRef.current)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error, errorField]);

  function closeImageEditor() {
    setCropSourceFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleImageSelection(file: File | undefined) {
    if (!file) return;
    const validationMessage = validateImageUploadSource(file, IMAGE_POLICY);
    if (validationMessage) {
      setError(validationMessage);
      setErrorField("imageUploadId");
      closeImageEditor();
      return;
    }
    try {
      setError("");
      setCropSourceFile(await prepareImageUploadSource(file, IMAGE_POLICY));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "이미지를 편집할 수 없어요.");
      setErrorField("imageUploadId");
      closeImageEditor();
    }
  }

  async function findOwners() {
    setOwnerError("");
    setSelectedOwner(null);
    if (ownerQuery.trim().length < 2) {
      setOwnerError("이름을 두 글자 이상 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await searchShowcaseAdminOwners(ownerQuery);
      setOwnerMatches(result.ok ? result.owners : []);
      if (!result.ok) setOwnerError(result.message);
      else if (result.owners.length === 0) setOwnerError("일치하는 활성 회원을 찾지 못했어요.");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setErrorField(null);
    setMessage("");
    if (mode === "create" && !selectedOwner) {
      setError("출품자를 검색하고 선택해 주세요.");
      setErrorField("ownerMemberId");
      return;
    }

    const data = new FormData(event.currentTarget);
    const fields = {
      projectType,
      title: String(data.get("title") ?? ""),
      teamName: String(data.get("teamName") ?? ""),
      summary: String(data.get("summary") ?? ""),
      description: String(data.get("description") ?? ""),
      serviceUrl: String(data.get("serviceUrl") ?? ""),
      announcementConsent: mode === "edit" || data.get("announcementConsent") === "true",
      status: String(data.get("status") ?? ""),
      reviewNote: String(data.get("reviewNote") ?? ""),
      allowImmediateFeedback,
    };
    const parsed = parseShowcaseAdminProjectSubmission({
      ...fields,
      imageUploadId: imageFile ? VALIDATION_IMAGE_ID : null,
    }, { requireImage: mode === "create", requireConsent: mode === "create" });
    if (!parsed.success) {
      setError(parsed.message);
      setErrorField(parsed.field);
      return;
    }

    startTransition(async () => {
      try {
        const payload = new FormData();
        for (const [key, value] of Object.entries(fields)) payload.set(key, String(value));
        if (mode === "create" && selectedOwner) payload.set("ownerMemberId", selectedOwner.id);
        if (mode === "edit" && project) payload.set("projectId", project.id);
        if (imageFile) {
          setMessage("대표 이미지를 준비하고 있어요.");
          const prepared = await prepareImageUploadSource(imageFile, IMAGE_POLICY);
          const [uploaded] = await uploadImagesToStaging({
            purpose: "showcase-project",
            actorMode: "admin",
            uploads: [{ clientId: "showcase-admin-cover", role: "image", file: prepared }],
          });
          if (!uploaded?.uploadId) throw new Error("이미지 업로드 결과를 확인하지 못했어요.");
          payload.set("imageUploadId", uploaded.uploadId);
        }
        setMessage(mode === "create" ? "출품작을 등록하고 있어요." : "출품작을 수정하고 있어요.");
        const result = mode === "create"
          ? await createAdminShowcaseProject(payload)
          : await updateAdminShowcaseProject(payload);
        if (!result.ok) {
          setError(result.message);
          setErrorField("field" in result ? result.field : null);
          return;
        }
        setMessage(result.message);
        router.push(`${ADMIN_PATH}?status=${encodeURIComponent(fields.status)}`);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        setErrorField("imageUploadId");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-7 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      {mode === "create" ? (
        <section className="grid gap-3" aria-labelledby="showcase-owner-heading">
          <h2 id="showcase-owner-heading" className="text-sm font-semibold text-foreground">출품자 선택</h2>
          {selectedOwner ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold text-foreground">{selectedOwner.displayName} <span className="font-normal text-muted-foreground">({selectedOwner.id.slice(0, 8)})</span></p>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setSelectedOwner(null)}>다시 선택</Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="sr-only" htmlFor="showcase-admin-owner-search">회원 이름 검색</label>
                <input
                  id="showcase-admin-owner-search"
                  name="ownerSearch"
                  value={ownerQuery}
                  onChange={(event) => setOwnerQuery(event.target.value)}
                  maxLength={50}
                  className={INPUT_CLASS}
                  placeholder="회원 이름을 두 글자 이상 입력해 주세요"
                />
                <Button type="button" variant="secondary" disabled={pending} onClick={findOwners}>{pending ? "검색 중…" : "회원 검색"}</Button>
              </div>
              {ownerMatches.length ? (
                <ul className="grid gap-2" aria-label="검색된 회원">
                  {ownerMatches.map((owner) => (
                    <li key={owner.id}>
                      <button
                        type="button"
                        onClick={() => { setSelectedOwner(owner); setOwnerError(""); }}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="font-semibold text-foreground">{owner.displayName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{owner.id.slice(0, 8)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {ownerError ? <FormMessage variant="error">{ownerError}</FormMessage> : null}
            </>
          )}
        </section>
      ) : (
        <section className="grid gap-1 rounded-xl bg-surface-muted/50 p-3">
          <h2 className="text-sm font-semibold text-foreground">출품자</h2>
          <p className="text-sm text-muted-foreground">{project?.ownerDisplayName} · 회원 ID {project?.ownerMemberId.slice(0, 8)}</p>
          <p className="text-xs leading-5 text-muted-foreground">출품자 연결은 이 화면에서 변경할 수 없어요.</p>
        </section>
      )}

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold text-foreground">프로젝트 유형</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHOWCASE_PROJECT_TYPES.map((type) => (
            <label key={type} className={`cursor-pointer rounded-xl border p-3 text-center focus-within:ring-2 focus-within:ring-primary ${projectType === type ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
              <input className="sr-only" type="radio" name="projectTypeChoice" value={type} checked={projectType === type} onChange={() => {
                setProjectType(type);
                if (mode === "create") setAllowImmediateFeedback(type === "app" || type === "game");
              }} />
              <span className="block text-sm font-bold text-foreground">{SHOWCASE_TYPE_LABELS[type]}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{SHOWCASE_TYPE_NOTES[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4">
        <Field label="서비스 이름" name="title" maxLength={100} defaultValue={project?.title ?? ""} />
        <Field label="팀명 (선택)" name="teamName" maxLength={60} defaultValue={project?.teamName ?? ""} />
        <Field label="한 줄 소개" name="summary" maxLength={240} defaultValue={project?.summary ?? ""} />
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-admin-description">
          서비스 설명
          <textarea id="showcase-admin-description" name="description" maxLength={8000} rows={7} required defaultValue={project?.description ?? ""} className={`${INPUT_CLASS} py-3`} placeholder="주요 기능, 이용 방법, 만든 계기 등을 적어 주세요 (20자 이상)" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-admin-service-url">
          {urlHint.label}
          <input id="showcase-admin-service-url" name="serviceUrl" type="url" inputMode="url" maxLength={2048} required defaultValue={project?.serviceUrl ?? ""} className={INPUT_CLASS} placeholder={urlHint.placeholder} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-admin-status">
        출품 상태
        <select id="showcase-admin-status" name="status" defaultValue={project?.status ?? "pending"} className={INPUT_CLASS}>
          {SHOWCASE_PROJECT_STATUSES.map((status) => <option key={status} value={status}>{SHOWCASE_ADMIN_STATUS_LABELS[status]}</option>)}
        </select>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm leading-6 text-foreground">
        <input
          type="checkbox"
          name="allowImmediateFeedback"
          value="true"
          checked={allowImmediateFeedback}
          onChange={(event) => setAllowImmediateFeedback(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          링크 클릭 기록 후 바로 피드백 허용
          <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
            체험자가 체험 페이지의 외부 링크를 누르면 1분 대기 없이 피드백을 열어요. 앱 설치·다운로드 완료나 실제 사용 여부는 확인하지 않아요. 앱·게임은 기본으로 켜져 있고 프로젝트를 확인한 뒤 유형과 관계없이 바꿀 수 있어요.
          </span>
        </span>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-admin-review-note">
        검수 사유 <span className="text-xs font-normal text-muted-foreground">수정 요청·반려 시 필수, 출품자에게 보여요</span>
        <textarea id="showcase-admin-review-note" name="reviewNote" maxLength={2000} rows={3} defaultValue={project?.reviewNote ?? ""} className={`${INPUT_CLASS} py-3`} placeholder="판단 근거나 수정이 필요한 부분을 적어 주세요." />
      </label>

      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">대표 홍보 이미지</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">16:9 비율로 편집해 저장해요. 최대 10MB 이미지를 선택할 수 있어요.</p>
        </div>
        <label className="grid cursor-pointer gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted/40 p-3 text-center focus-within:ring-2 focus-within:ring-primary">
          <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="대표 이미지 미리보기" className="h-full w-full object-cover" />
            ) : <PhotoIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          </span>
          <span className="text-sm font-medium text-foreground">{imageFile?.name ?? (project ? "이미지 바꾸기" : "이미지 파일 선택")}</span>
          <input ref={imageInputRef} name="imageUploadId" type="file" accept={IMAGE_SOURCE_ACCEPT} className="sr-only" onChange={(event) => handleImageSelection(event.target.files?.[0])} aria-label="대표 홍보 이미지 선택" />
        </label>
      </div>

      {mode === "create" ? (
        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm leading-6 text-foreground">
          <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" name="announcementConsent" value="true" />
          <span>출품자가 당첨 시 이름 일부를 가려 공지하는 데 동의한 것을 확인했어요.</span>
        </label>
      ) : null}

      {error ? <div tabIndex={-1} aria-live="assertive"><FormMessage variant="error">{error}</FormMessage></div> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button href={ADMIN_PATH} variant="secondary" disabled={pending}>돌아가기</Button>
        <Button type="submit" disabled={pending}>{pending ? "저장 중…" : mode === "create" ? "출품작 등록" : "수정 사항 저장"}</Button>
      </div>
      <ImageCropDialog
        open={Boolean(cropSourceFile && cropSourceUrl)}
        aspectRatio={IMAGE_POLICY.aspectRatio}
        sourceUrl={cropSourceUrl}
        sourceFile={cropSourceFile ?? undefined}
        outputName="showcase-project.webp"
        outputWidth={IMAGE_POLICY.width}
        outputHeight={IMAGE_POLICY.height}
        zoomControl
        frameAspectRatio={IMAGE_POLICY.aspectRatio}
        policy={IMAGE_POLICY}
        onCancel={closeImageEditor}
        onApply={(croppedFile) => { setImageFile(croppedFile); closeImageEditor(); }}
      />
    </form>
  );
}

function Field({ label, name, maxLength, defaultValue }: { label: string; name: string; maxLength: number; defaultValue: string }) {
  const id = `showcase-admin-${name}`;
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor={id}>
      {label}
      <input id={id} name={name} maxLength={maxLength} required={name !== "teamName"} defaultValue={defaultValue} className={INPUT_CLASS} />
    </label>
  );
}
