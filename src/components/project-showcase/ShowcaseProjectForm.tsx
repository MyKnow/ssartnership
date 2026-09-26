"use client";

import { PhotoIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { submitShowcaseProject, updateShowcaseProject } from "@/app/(site)/events/project-showcase/actions";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import { prepareImageUploadSource } from "@/lib/image-upload/client-transform";
import {
  IMAGE_SOURCE_ACCEPT,
  resolveImageTransformPolicy,
  validateImageUploadSource,
} from "@/lib/image-upload/policy";
import { SHOWCASE_TYPE_LABELS, SHOWCASE_TYPE_NOTES } from "@/lib/project-showcase/labels";
import {
  SHOWCASE_PROJECT_TYPES,
  type ShowcaseOwnerProject,
  type ShowcaseProjectType,
} from "@/lib/project-showcase/types";
import {
  parseShowcaseProjectSubmission,
  SHOWCASE_MAX_TEAMMATES,
  SHOWCASE_SERVICE_URL_HINTS,
} from "@/lib/project-showcase/validation";

const IMAGE_POLICY = resolveImageTransformPolicy("showcase-project", "image");
/** Placeholder upload id so the shared schema can run before the real upload. */
const VALIDATION_IMAGE_ID = "ad6e43a7-962f-4c54-89f3-4d2a13968356";
const INPUT_CLASS = "min-h-12 min-w-0 rounded-xl border border-border bg-background px-4 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary";
const FIELD_SELECTORS: Record<string, string> = {
  projectType: 'input[name="projectTypeChoice"]',
  title: "#showcase-project-title",
  teamName: "#showcase-project-team",
  summary: "#showcase-project-summary",
  description: "#showcase-project-description",
  serviceUrl: "#showcase-project-url",
  ownerStudentNumber: "#showcase-project-owner-number",
  teammates: '[name="teammateName"]',
  imageUploadId: "#showcase-project-image",
  participantsConsent: 'input[name="participantsConsent"]',
  announcementConsent: 'input[name="announcementConsent"]',
};

type TeammateDraft = { id: number; name: string; studentNumber: string };

type ShowcaseProjectFormProps =
  | { mode: "create"; ownerName: string; project?: undefined }
  | { mode: "edit"; ownerName: string; project: ShowcaseOwnerProject };

export default function ShowcaseProjectForm({ mode, ownerName, project }: ShowcaseProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projectType, setProjectType] = useState<ShowcaseProjectType>(project?.projectType ?? "web");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(project?.imageUrl ?? "");
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState("");
  const [teammates, setTeammates] = useState<TeammateDraft[]>(() => (project?.participants ?? [])
    .filter((participant) => !participant.isOwner)
    .map((participant, index) => ({ id: index, name: participant.name, studentNumber: participant.studentNumber })));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRegionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const nextTeammateIdRef = useRef(teammates.length);
  const ownerStudentNumber = project?.participants.find((participant) => participant.isOwner)?.studentNumber ?? "";
  const urlHint = SHOWCASE_SERVICE_URL_HINTS[projectType];
  const fieldError = (field: string) => (error && errorField === field ? error : "");

  function fieldProps(field: string, errorId: string, extraClass = "") {
    const invalid = Boolean(fieldError(field));
    return {
      className: [INPUT_CLASS, extraClass, invalid ? "border-danger bg-danger/5" : ""].filter(Boolean).join(" "),
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? errorId : undefined,
    };
  }

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
    // errorField is either a schema field name or a direct `#id` selector for a specific row input.
    const selector = errorField?.startsWith("#") ? errorField : errorField ? FIELD_SELECTORS[errorField] : null;
    const target = (selector ? formRef.current?.querySelector<HTMLElement>(selector) : null) ?? errorRegionRef.current;
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error, errorField]);

  function showError(nextMessage: string, field: string | null) {
    setMessage("");
    setError(nextMessage);
    setErrorField(field);
  }

  function closeImageEditor() {
    setCropSourceFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleImageSelection(source: File | undefined) {
    if (!source) return;
    const fileError = validateImageUploadSource(source, IMAGE_POLICY);
    if (fileError) {
      showError(fileError, "imageUploadId");
      closeImageEditor();
      return;
    }
    try {
      setError("");
      setCropSourceFile(await prepareImageUploadSource(source, IMAGE_POLICY));
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "이미지를 편집할 수 없어요.", "imageUploadId");
      closeImageEditor();
    }
  }

  function updateTeammate(id: number, field: "name" | "studentNumber", value: string) {
    setTeammates((current) => current.map((teammate) => (teammate.id === id ? { ...teammate, [field]: value } : teammate)));
  }

  function addTeammate() {
    if (teammates.length >= SHOWCASE_MAX_TEAMMATES) return;
    const id = nextTeammateIdRef.current;
    nextTeammateIdRef.current += 1;
    setTeammates((current) => [...current, { id, name: "", studentNumber: "" }]);
  }

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    setErrorField(null);
    const formData = new FormData(submitEvent.currentTarget);
    const teammateRows = teammates.map(({ name, studentNumber }) => ({ name, studentNumber }));
    const fields = {
      projectType,
      title: String(formData.get("title") ?? ""),
      teamName: String(formData.get("teamName") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      description: String(formData.get("description") ?? ""),
      serviceUrl: String(formData.get("serviceUrl") ?? ""),
      ownerStudentNumber: String(formData.get("ownerStudentNumber") ?? ""),
      teammates: teammateRows,
      participantsConsent: formData.get("participantsConsent") === "true",
      announcementConsent: formData.get("announcementConsent") === "true",
    };
    // Editing may keep the current image; a new project must choose one.
    const parsed = parseShowcaseProjectSubmission(
      { ...fields, imageUploadId: file ? VALIDATION_IMAGE_ID : null },
      { requireImage: mode === "create" },
    );
    if (!parsed.success) {
      const [, index, key] = parsed.path ?? [];
      const teammate = typeof index === "number" ? teammates[index] : undefined;
      const teammateSelector = parsed.field === "teammates" && teammate
        ? `#showcase-teammate-${key === "studentNumber" ? "number" : "name"}-${teammate.id}`
        : null;
      showError(parsed.message, teammateSelector ?? parsed.field);
      return;
    }
    if (file) {
      const fileError = validateImageUploadSource(file, IMAGE_POLICY);
      if (fileError) {
        showError(fileError, "imageUploadId");
        return;
      }
    }

    startTransition(async () => {
      try {
        const payload = new FormData();
        for (const [key, value] of Object.entries(fields)) {
          payload.set(key, typeof value === "string" ? value : typeof value === "boolean" ? String(value) : JSON.stringify(value));
        }
        if (project) payload.set("projectId", project.id);
        if (file) {
          setMessage("이미지를 준비하고 있어요.");
          try {
            const prepared = await prepareImageUploadSource(file, IMAGE_POLICY);
            const [uploaded] = await uploadImagesToStaging({
              purpose: "showcase-project",
              actorMode: "member",
              uploads: [{ clientId: "showcase-cover", role: "image", file: prepared }],
            });
            if (!uploaded?.uploadId) throw new Error("이미지 업로드 결과를 확인하지 못했어요.");
            payload.set("imageUploadId", uploaded.uploadId);
          } catch (caught) {
            const detail = caught instanceof Error && caught.message ? ` ${caught.message}` : "";
            showError(`대표 홍보 이미지를 올리지 못했어요. 입력한 내용은 그대로 있어요.${detail}`, "imageUploadId");
            return;
          }
        }
        setMessage(mode === "create" ? "출품 내용을 제출하고 있어요." : "수정한 내용을 제출하고 있어요.");
        const result = mode === "create" ? await submitShowcaseProject(payload) : await updateShowcaseProject(payload);
        if (!result.ok) {
          showError(result.message, result.field ?? null);
          return;
        }
        setMessage(result.message);
        router.push(`/events/project-showcase/my/projects/${encodeURIComponent(result.projectId)}`);
        router.refresh();
      } catch (caught) {
        showError(caught instanceof Error ? caught.message : "제출하지 못했어요. 잠시 후 다시 시도해 주세요.", null);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-8" noValidate>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold text-foreground">프로젝트 유형</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHOWCASE_PROJECT_TYPES.map((type) => (
            <label
              key={type}
              className={`cursor-pointer rounded-2xl border p-3 text-center transition-colors focus-within:ring-2 focus-within:ring-primary ${projectType === type ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
            >
              <input
                className="sr-only"
                type="radio"
                name="projectTypeChoice"
                value={type}
                checked={projectType === type}
                onChange={() => setProjectType(type)}
              />
              <span className="block text-sm font-bold text-foreground">{SHOWCASE_TYPE_LABELS[type]}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{SHOWCASE_TYPE_NOTES[type]}</span>
            </label>
          ))}
        </div>
        <FieldError id="showcase-project-type-error" message={fieldError("projectType")} />
      </fieldset>

      <div className="grid gap-5">
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-title">
          서비스 이름
          <input id="showcase-project-title" name="title" maxLength={100} defaultValue={project?.title} {...fieldProps("title", "showcase-project-title-error")} placeholder="서비스 이름을 입력해 주세요" />
          <FieldError id="showcase-project-title-error" message={fieldError("title")} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-summary">
          한 줄 소개
          <input id="showcase-project-summary" name="summary" maxLength={240} defaultValue={project?.summary} {...fieldProps("summary", "showcase-project-summary-error")} placeholder="어떤 문제를 해결하는 서비스인지 알려 주세요" />
          <FieldError id="showcase-project-summary-error" message={fieldError("summary")} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-description">
          서비스 설명
          <textarea
            id="showcase-project-description"
            name="description"
            maxLength={8000}
            rows={7}
            defaultValue={project?.description}
            {...fieldProps("description", "showcase-project-description-error", "py-3")}
            placeholder="주요 기능, 이용 방법, 만든 계기 등을 적어 주세요 (20자 이상)"
          />
          <FieldError id="showcase-project-description-error" message={fieldError("description")} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-url">
          {urlHint.label}
          <input
            id="showcase-project-url"
            name="serviceUrl"
            type="url"
            inputMode="url"
            maxLength={2048}
            defaultValue={project?.serviceUrl}
            {...fieldProps("serviceUrl", "showcase-project-url-error")}
            placeholder={urlHint.placeholder}
          />
          <FieldError id="showcase-project-url-error" message={fieldError("serviceUrl")} />
          <span className="text-xs font-normal leading-5 text-muted-foreground">
            배포·운영 중인 서비스 주소를 입력해 주세요. 서비스에 별도 코드를 넣을 필요는 없어요.
          </span>
        </label>
      </div>

      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">대표 홍보 이미지</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">4:3 비율로 잘라 저장해요. 최대 10MB 이미지를 선택할 수 있어요.</p>
        </div>
        <label className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed p-5${fieldError("imageUploadId") ? " border-danger bg-danger/5" : " border-border bg-surface-muted/50"} text-center focus-within:ring-2 focus-within:ring-primary`}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="대표 이미지 미리보기" className="aspect-[4/3] max-h-64 w-full rounded-xl object-cover" />
          ) : (
            <PhotoIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-foreground">
            {file?.name ?? (project ? "이미지 바꾸기" : "이미지 파일 선택")}
          </span>
          <input
            ref={imageInputRef}
            id="showcase-project-image"
            type="file"
            accept={IMAGE_SOURCE_ACCEPT}
            className="sr-only"
            onChange={(changeEvent) => handleImageSelection(changeEvent.target.files?.[0])}
            aria-label="대표 홍보 이미지 선택"
            aria-invalid={Boolean(fieldError("imageUploadId")) || undefined}
            aria-describedby={fieldError("imageUploadId") ? "showcase-project-image-error" : undefined}
          />
        </label>
        <FieldError id="showcase-project-image-error" message={fieldError("imageUploadId")} />
      </div>

      <fieldset className="grid min-w-0 gap-4">
        <legend className="mb-1 text-sm font-semibold text-foreground">참여자</legend>
        <div className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4 sm:grid-cols-2">
          <div className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            대표자 이름
            <p className="flex min-h-12 items-center rounded-xl border border-border bg-surface px-4 text-base font-normal text-muted-foreground">{ownerName}</p>
          </div>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground" htmlFor="showcase-project-owner-number">
            대표자 학번
            <input
              id="showcase-project-owner-number"
              name="ownerStudentNumber"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              defaultValue={ownerStudentNumber}
              {...fieldProps("ownerStudentNumber", "showcase-project-owner-number-error")}
              placeholder="숫자 7자리"
            />
            <FieldError id="showcase-project-owner-number-error" message={fieldError("ownerStudentNumber")} />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-team">
          팀명 <span className="text-xs font-normal text-muted-foreground">팀으로 출품하면 필수</span>
          <input id="showcase-project-team" name="teamName" maxLength={60} defaultValue={project?.teamName ?? ""} {...fieldProps("teamName", "showcase-project-team-error")} placeholder="개인 출품이면 비워 두세요" />
          <FieldError id="showcase-project-team-error" message={fieldError("teamName")} />
        </label>

        {teammates.length > 0 ? (
          <div className="grid min-w-0 gap-3">
            {teammates.map((teammate, index) => (
              <div key={teammate.id} className="grid min-w-0 gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground" htmlFor={`showcase-teammate-name-${teammate.id}`}>
                  팀원 {index + 1} 이름
                  <input
                    id={`showcase-teammate-name-${teammate.id}`}
                    name="teammateName"
                    maxLength={80}
                    value={teammate.name}
                    onChange={(changeEvent) => updateTeammate(teammate.id, "name", changeEvent.target.value)}
                    {...fieldProps(`#showcase-teammate-name-${teammate.id}`, `showcase-teammate-name-${teammate.id}-error`)}
                  />
                  <FieldError id={`showcase-teammate-name-${teammate.id}-error`} message={fieldError(`#showcase-teammate-name-${teammate.id}`)} />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground" htmlFor={`showcase-teammate-number-${teammate.id}`}>
                  팀원 {index + 1} 학번
                  <input
                    id={`showcase-teammate-number-${teammate.id}`}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={7}
                    value={teammate.studentNumber}
                    onChange={(changeEvent) => updateTeammate(teammate.id, "studentNumber", changeEvent.target.value)}
                    {...fieldProps(`#showcase-teammate-number-${teammate.id}`, `showcase-teammate-number-${teammate.id}-error`)}
                    placeholder="숫자 7자리"
                  />
                  <FieldError id={`showcase-teammate-number-${teammate.id}-error`} message={fieldError(`#showcase-teammate-number-${teammate.id}`)} />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTeammates((current) => current.filter((item) => item.id !== teammate.id))}
                  ariaLabel={`팀원 ${index + 1} 삭제`}
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={addTeammate} disabled={teammates.length >= SHOWCASE_MAX_TEAMMATES}>
            팀원 추가
          </Button>
          <span className="text-xs text-muted-foreground">대표자 포함 {teammates.length + 1}명 · 최대 {SHOWCASE_MAX_TEAMMATES + 1}명</span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          참가자 1명은 프로젝트 1개에만 참여할 수 있어요. 이름과 학번은 운영진 확인과 당첨 안내에만 쓰고 공개하지 않아요.
        </p>
      </fieldset>

      <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4">
        <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
          <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" name="participantsConsent" value="true" defaultChecked={mode === "edit"} />
          <span>(필수) 팀원에게 이름·학번을 이벤트 운영에 사용한다는 점을 안내했고 동의를 받았어요.</span>
        </label>
        <FieldError id="showcase-participantsConsent-error" message={fieldError("participantsConsent")} />
        <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
          <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" name="announcementConsent" value="true" defaultChecked={mode === "edit"} />
          <span>(필수) 경품에 당첨되면 대표자 이름·학번 일부를 가려(예: 정** · 15****43) 공지하는 데 동의해요.</span>
        </label>
        <FieldError id="showcase-announcementConsent-error" message={fieldError("announcementConsent")} />
      </div>

      {error ? (
        <div ref={errorRegionRef} tabIndex={-1} aria-live="assertive">
          <FormMessage variant="error">{error}</FormMessage>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isPending}>돌아가기</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "제출 중…" : mode === "create" ? "출품하기" : "수정해서 다시 제출"}
        </Button>
      </div>
      <ImageCropDialog
        open={Boolean(cropSourceFile && cropSourceUrl)}
        aspectRatio={IMAGE_POLICY.aspectRatio}
        sourceUrl={cropSourceUrl}
        sourceFile={cropSourceFile ?? undefined}
        outputName="showcase-project.webp"
        outputWidth={IMAGE_POLICY.width}
        outputHeight={IMAGE_POLICY.height}
        policy={IMAGE_POLICY}
        onCancel={closeImageEditor}
        onApply={(croppedFile) => {
          setFile(croppedFile);
          closeImageEditor();
        }}
      />
    </form>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  if (!message) return null;
  return <span id={id} className="text-xs font-medium leading-5 text-danger">{message}</span>;
}
