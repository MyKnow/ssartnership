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
  imageUploadId: "#showcase-project-image",
  announcementConsent: 'input[name="announcementConsent"]',
};

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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRegionRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError("");
    setErrorField(null);
    const formData = new FormData(submitEvent.currentTarget);
    const fields = {
      projectType,
      title: String(formData.get("title") ?? ""),
      teamName: String(formData.get("teamName") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      description: String(formData.get("description") ?? ""),
      serviceUrl: String(formData.get("serviceUrl") ?? ""),
      announcementConsent: formData.get("announcementConsent") === "true",
    };
    // Editing may keep the current image; a new project must choose one.
    const parsed = parseShowcaseProjectSubmission(
      { ...fields, imageUploadId: file ? VALIDATION_IMAGE_ID : null },
      { requireImage: mode === "create" },
    );
    if (!parsed.success) {
      showError(parsed.message, parsed.field);
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
        <label className="grid gap-2 text-sm font-semibold text-foreground" htmlFor="showcase-project-team">
          팀명 (선택)
          <input id="showcase-project-team" name="teamName" maxLength={60} defaultValue={project?.teamName ?? ""} {...fieldProps("teamName", "showcase-project-team-error")} />
          <FieldError id="showcase-project-team-error" message={fieldError("teamName")} />
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground">16:9 비율로 잘라 저장해요. 최대 10MB 이미지를 선택할 수 있어요.</p>
        </div>
        <label className={`grid cursor-pointer gap-3 overflow-hidden rounded-2xl border border-dashed p-4${fieldError("imageUploadId") ? " border-danger bg-danger/5" : " border-border bg-surface-muted/50"} text-center focus-within:ring-2 focus-within:ring-primary`}>
          <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-surface-muted">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="대표 이미지 미리보기" className="h-full w-full object-cover" />
            ) : (
              <PhotoIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
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

      <div className="grid gap-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">출품자: {ownerName}</p>
        <p className="leading-6">여러 프로젝트를 출품할 수 있어요. 승인된 프로젝트마다 추첨 기회가 1개씩 생기며, 경품은 한 사람당 1개예요.</p>
        <p className="leading-6">같은 프로젝트를 다른 사람이 이미 등록했다면 반려될 수 있어요. 당첨 안내는 회원 정보에 등록된 MM 또는 이메일로 보내 드려요.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 p-4">
        <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
          <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" name="announcementConsent" value="true" defaultChecked={mode === "edit"} />
          <span>(필수) 경품에 당첨되면 출품자 이름 일부를 가려(예: 정**) 공지하는 데 동의해요.</span>
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
        zoomControl
        frameAspectRatio={IMAGE_POLICY.aspectRatio}
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
