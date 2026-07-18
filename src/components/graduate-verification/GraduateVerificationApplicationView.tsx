"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ImageCropDialog from "@/components/media/ImageCropDialog";
import {
  formatGraduateEmailCodeRemainingTime,
  getGraduateEmailCodeRemainingSeconds,
  GRADUATE_EMAIL_CODE_TTL_SECONDS,
} from "@/lib/graduate-verification-email-code";
import {
  clampGraduateEducationEnd,
  getGraduateCurrentYearMonth,
  getSsafyGenerationFromEducationStart,
  GRADUATE_CAMPUS_OPTIONS,
  MAX_GRADUATE_CERTIFICATE_BYTES,
  type GraduateVerificationRequestKind,
} from "@/lib/graduate-verification";
import {
  GRADUATE_PROFILE_PHOTO_ACCEPT,
  getGraduateProfilePhotoSourceError,
  getGraduateProfilePhotoSourceFormat,
  normalizeGraduateProfilePhotoSource,
} from "@/lib/graduate-profile-photo.client";

type ApplicationStep = "email" | "details" | "files" | "submitted";

type SignedUpload = {
  uploadId: string;
  signedUrl: string;
};

type ResubmissionTarget = "education_period" | "certificate" | "profile_image";

const RESUBMISSION_TARGET_LABELS: Record<ResubmissionTarget, string> = {
  education_period: "교육 기간",
  certificate: "교육이수증",
  profile_image: "본인 사진",
};

function getCurrentYear() {
  return new Date().getFullYear();
}

function getCertificateFileError(file: File) {
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return "교육이수증은 PDF 파일만 선택할 수 있습니다.";
  }
  if (file.size <= 0 || file.size > MAX_GRADUATE_CERTIFICATE_BYTES) {
    return "교육이수증은 10MB 이하만 선택할 수 있습니다.";
  }
  return null;
}

async function uploadSignedGraduateFile(input: {
  kind: "certificate" | "profile_image";
  file: File;
}) {
  const signResponse = await fetch("/api/graduate-verification/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind,
      contentType: input.file.type,
      size: input.file.size,
    }),
  });
  const signData = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok || !signData.upload) {
    throw new Error(signData.message ?? "업로드 준비에 실패했습니다.");
  }
  const upload = signData.upload as SignedUpload;
  const uploadResponse = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: {
      "content-type": input.file.type,
      "x-upsert": "false",
    },
    body: input.file,
  });
  if (!uploadResponse.ok) {
    throw new Error("파일 업로드에 실패했습니다.");
  }
  return upload.uploadId;
}

export default function GraduateVerificationApplicationView({
  requestKind = "graduate_signup",
}: {
  requestKind?: GraduateVerificationRequestKind;
}) {
  const certificateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSourceUrlRef = useRef<string | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const photoSelectionRequestIdRef = useRef(0);
  const [step, setStep] = useState<ApplicationStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [emailVerified, setEmailVerified] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [startYear, setStartYear] = useState(String(getCurrentYear()));
  const [startMonth, setStartMonth] = useState("1");
  const [endYear, setEndYear] = useState(String(getCurrentYear()));
  const [endMonth, setEndMonth] = useState("6");
  const [campus, setCampus] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [photoSelecting, setPhotoSelecting] = useState(false);
  const [sourcePhotoUrl, setSourcePhotoUrl] = useState("");
  const [resubmissionTargets, setResubmissionTargets] = useState<ResubmissionTarget[]>([]);
  const [resubmissionNote, setResubmissionNote] = useState<string | null>(null);
  const [existingRequestStatus, setExistingRequestStatus] = useState<
    "submitted" | "in_review" | null
  >(null);
  const [consented, setConsented] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success" | "info"; text: string } | null>(null);
  const currentYearMonth = useMemo(() => getGraduateCurrentYearMonth(), []);
  const isExistingMemberRecovery = requestKind === "existing_member_recovery";

  useEffect(() => () => {
    photoSelectionRequestIdRef.current += 1;
    if (photoSourceUrlRef.current) URL.revokeObjectURL(photoSourceUrlRef.current);
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
  }, []);

  useEffect(() => {
    if (!codeExpiresAt) return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [codeExpiresAt]);

  const inferredGeneration = useMemo(
    () => getSsafyGenerationFromEducationStart(Number(startYear), Number(startMonth)),
    [startMonth, startYear],
  );
  const isResubmission = resubmissionTargets.length > 0;
  const canEditEducationPeriod =
    !isResubmission || resubmissionTargets.includes("education_period");
  const requiresCertificate = !isResubmission || resubmissionTargets.includes("certificate");
  const requiresProfileImage = !isResubmission || resubmissionTargets.includes("profile_image");
  const codeRemainingSeconds = codeExpiresAt
    ? getGraduateEmailCodeRemainingSeconds(codeExpiresAt, now)
    : 0;
  const isCodeExpired = codeSent && codeRemainingSeconds === 0;
  const canSubmit =
    consented &&
    (!requiresCertificate || certificateFile !== null) &&
    (!requiresProfileImage || photoFile !== null) &&
    !photoSelecting &&
    !pending;

  const normalizeEducationYear = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return String(Math.min(Number(digits), currentYearMonth.year));
  };

  useEffect(() => {
    const startYearNumber = Number(startYear);
    const startMonthNumber = Number(startMonth);
    const endYearNumber = Number(endYear);
    const endMonthNumber = Number(endMonth);
    if (!Number.isInteger(startYearNumber) || !Number.isInteger(startMonthNumber)) return;

    const normalizedStartMonth =
      startYearNumber === currentYearMonth.year
        ? Math.min(startMonthNumber, currentYearMonth.month)
        : startMonthNumber;
    if (normalizedStartMonth !== startMonthNumber) {
      setStartMonth(String(normalizedStartMonth));
      return;
    }
    if (!Number.isInteger(endYearNumber) || !Number.isInteger(endMonthNumber)) return;

    const normalizedEnd = clampGraduateEducationEnd({
      startYear: startYearNumber,
      startMonth: normalizedStartMonth,
      endYear: endYearNumber,
      endMonth: endMonthNumber,
      currentYear: currentYearMonth.year,
      currentMonth: currentYearMonth.month,
    });
    if (normalizedEnd.year !== endYearNumber) setEndYear(String(normalizedEnd.year));
    if (normalizedEnd.month !== endMonthNumber) setEndMonth(String(normalizedEnd.month));
  }, [currentYearMonth, endMonth, endYear, startMonth, startYear]);

  const chooseCertificate = () => certificateInputRef.current?.click();
  const choosePhoto = () => photoInputRef.current?.click();

  async function requestCode() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/graduate-verification/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, requestKind }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "인증 코드를 보내지 못했습니다.");
      const expiresInSeconds =
        typeof data.expiresInSeconds === "number" && data.expiresInSeconds > 0
          ? data.expiresInSeconds
          : GRADUATE_EMAIL_CODE_TTL_SECONDS;
      setCodeSent(true);
      setCode("");
      setCodeExpiresAt(Date.now() + expiresInSeconds * 1_000);
      setNow(Date.now());
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "인증 코드를 보내지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/graduate-verification/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, requestKind }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "이메일 인증을 완료하지 못했습니다.");
      setEmailVerified(true);
      setStep("details");
      let currentResponse: Response | null = null;
      let request: {
        status?: unknown;
        resubmission_targets?: unknown;
        review_note?: unknown;
        legal_name?: unknown;
        education_start_year?: unknown;
        education_start_month?: unknown;
        education_end_year?: unknown;
        education_end_month?: unknown;
        campus?: unknown;
      } | null = null;
      try {
        currentResponse = await fetch("/api/graduate-verification/current", {
          cache: "no-store",
        });
        const currentData = await currentResponse.json().catch(() => ({}));
        request = currentData?.request ?? null;
      } catch {
        // Email verification remains valid even if the optional resubmission lookup is unavailable.
      }
      if (
        currentResponse?.ok &&
        request?.status === "needs_resubmission" &&
        Array.isArray(request.resubmission_targets)
      ) {
        const targets = request.resubmission_targets.filter(
          (value): value is ResubmissionTarget =>
            value === "education_period" ||
            value === "certificate" ||
            value === "profile_image",
        );
        setExistingRequestStatus(null);
        setResubmissionTargets(targets);
        setResubmissionNote(
          typeof request.review_note === "string" ? request.review_note : null,
        );
        setLegalName(typeof request.legal_name === "string" ? request.legal_name : "");
        setStartYear(
          typeof request.education_start_year === "number"
            ? String(request.education_start_year)
            : String(getCurrentYear()),
        );
        setStartMonth(
          typeof request.education_start_month === "number"
            ? String(request.education_start_month)
            : "1",
        );
        setEndYear(
          typeof request.education_end_year === "number"
            ? String(request.education_end_year)
            : String(getCurrentYear()),
        );
        setEndMonth(
          typeof request.education_end_month === "number"
            ? String(request.education_end_month)
            : "6",
        );
        setCampus(typeof request.campus === "string" ? request.campus : "");
        setMessage({
          tone: "info",
          text: `보완 요청이 있습니다: ${targets.map((target) => RESUBMISSION_TARGET_LABELS[target]).join(", ")}`,
        });
      } else if (request?.status === "submitted" || request?.status === "in_review") {
        setResubmissionTargets([]);
        setResubmissionNote(null);
        setExistingRequestStatus(request.status);
        setStep("submitted");
        setMessage({
          tone: "info",
          text:
            request.status === "in_review"
              ? "관리자가 수료생 인증을 검토하고 있습니다."
              : "수료생 인증 신청이 제출되어 검토를 기다리고 있습니다.",
        });
      } else {
        setResubmissionTargets([]);
        setResubmissionNote(null);
        setExistingRequestStatus(null);
        setMessage(null);
      }
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "이메일 인증을 완료하지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  function continueToFiles() {
    if (!legalName.trim() || !inferredGeneration || !campus) {
      setMessage({ tone: "danger", text: "이름, 캠퍼스, 교육 시작 연·월을 확인해 주세요." });
      return;
    }
    const start = Number(startYear) * 12 + Number(startMonth);
    const end = Number(endYear) * 12 + Number(endMonth);
    if (!Number.isInteger(end) || end < start) {
      setMessage({ tone: "danger", text: "교육 종료 연·월은 시작 연·월보다 빠를 수 없습니다." });
      return;
    }
    setMessage(null);
    setStep("files");
  }

  function handleCertificateChange(file: File | null) {
    if (!file) return;
    const error = getCertificateFileError(file);
    if (error) {
      setMessage({ tone: "danger", text: error });
      return;
    }
    setCertificateFile(file);
    setMessage(null);
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    const error = getGraduateProfilePhotoSourceError(file);
    if (error) {
      setMessage({ tone: "danger", text: error });
      return;
    }
    const requestId = photoSelectionRequestIdRef.current + 1;
    photoSelectionRequestIdRef.current = requestId;
    const isHeif = getGraduateProfilePhotoSourceFormat(file) === "heif";
    setPhotoSelecting(true);
    setMessage(
      isHeif
        ? {
            tone: "info",
            text: "HEIC/HEIF 사진을 기기에서 안전하게 변환하고 있습니다.",
          }
        : null,
    );
    try {
      const sourceFile = await normalizeGraduateProfilePhotoSource(file);
      if (photoSelectionRequestIdRef.current !== requestId) return;
      if (photoSourceUrlRef.current) URL.revokeObjectURL(photoSourceUrlRef.current);
      const sourceUrl = URL.createObjectURL(sourceFile);
      photoSourceUrlRef.current = sourceUrl;
      setSourcePhotoUrl(sourceUrl);
      setCropOpen(true);
      setMessage(null);
    } catch (nextError) {
      if (photoSelectionRequestIdRef.current !== requestId) return;
      setMessage({
        tone: "danger",
        text:
          nextError instanceof Error && nextError.message
            ? nextError.message
            : "사진 변환에 실패했습니다.",
      });
    } finally {
      if (photoSelectionRequestIdRef.current === requestId) {
        setPhotoSelecting(false);
      }
    }
  }

  function applyCroppedPhoto(file: File) {
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    photoPreviewUrlRef.current = previewUrl;
    setPhotoPreviewUrl(previewUrl);
    setPhotoFile(file);
    setCropOpen(false);
    setMessage(null);
  }

  async function submit() {
    if (
      (requiresCertificate && !certificateFile) ||
      (requiresProfileImage && !photoFile) ||
      !consented
    ) {
      setMessage({
        tone: "danger",
        text: "정보와 개인정보·사진 이용 동의를 모두 확인해 주세요.",
      });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const [certificateUploadId, profileImageUploadId] = await Promise.all([
        requiresCertificate && certificateFile
          ? uploadSignedGraduateFile({ kind: "certificate", file: certificateFile })
          : Promise.resolve(null),
        requiresProfileImage && photoFile
          ? uploadSignedGraduateFile({ kind: "profile_image", file: photoFile })
          : Promise.resolve(null),
      ]);
      const response = await fetch("/api/graduate-verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateUploadId,
          profileImageUploadId,
          email,
          legalName,
          educationStartYear: Number(startYear),
          educationStartMonth: Number(startMonth),
          educationEndYear: Number(endYear),
          educationEndMonth: Number(endMonth),
          campus,
          consented,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "수료생 인증 신청을 제출하지 못했습니다.");
      setStep("submitted");
      setResubmissionTargets([]);
      setResubmissionNote(null);
      setExistingRequestStatus("submitted");
      setMessage({ tone: "success", text: isResubmission ? "보완 제출을 완료했습니다. 관리자 재검토 후 이메일로 안내해 드립니다." : isExistingMemberRecovery ? "기존 회원 복구 신청을 제출했습니다. 관리자가 기존 회원을 명시적으로 연결한 뒤 이메일로 비밀번호 설정 안내를 보냅니다." : "수료생 인증 신청을 제출했습니다. 관리자 검토 후 이메일로 비밀번호 설정 안내를 보내드립니다." });
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "수료생 인증 신청을 제출하지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/graduate-verification/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? "수료생 인증 신청을 철회하지 못했습니다.");
      }
      setExistingRequestStatus(null);
      setEmailVerified(false);
      setCode("");
      setCodeSent(false);
      setStep("email");
      setMessage({ tone: "success", text: "수료생 인증 신청을 철회했습니다. 보관 중인 수료증과 사진은 삭제 절차를 진행합니다." });
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "수료생 인증 신청을 철회하지 못했습니다." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto min-w-0 max-w-2xl" data-testid="graduate-verification-application">
      <div className="space-y-2">
        <p className="ui-kicker">Graduate verification</p>
        <h1 className="text-ko-title text-2xl font-semibold text-foreground">{isExistingMemberRecovery ? "기존 회원 복구" : "수료생 인증"}</h1>
        <p className="ui-body text-muted-foreground">{isExistingMemberRecovery ? "기존 사이트 비밀번호를 모르는 회원은 이메일 인증, 교육이수증, 본인 사진을 제출해 주세요. 관리자가 기존 회원을 명시적으로 선택한 경우에만 이메일 로그인과 초기 비밀번호를 연결합니다." : "이메일 인증, 교육이수증, 본인 사진을 제출하면 관리자 검토 후 계정을 설정할 수 있습니다."}</p>
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-medium" aria-label="수료생 인증 단계">
        {["이메일 인증", "교육 정보", "파일 제출"].map((label, index) => {
          const activeIndex = step === "email" ? 0 : step === "details" ? 1 : 2;
          return <li key={label} className={index <= activeIndex ? "rounded-full bg-primary px-3 py-2 text-primary-foreground" : "rounded-full bg-surface-inset px-3 py-2 text-muted-foreground"}>{label}</li>;
        })}
      </ol>

      {message ? <InlineMessage className="mt-5" tone={message.tone} title={message.tone === "danger" ? undefined : message.tone === "success" ? "완료" : "안내"} description={message.text} /> : null}

      {step === "email" ? (
        <section className="mt-6 space-y-4" aria-labelledby="graduate-email-heading">
          <h2 id="graduate-email-heading" className="text-lg font-semibold">1. 이메일 인증</h2>
          <label className="grid gap-2 text-sm font-medium">이메일
            <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" disabled={emailVerified} />
          </label>
          {codeSent ? <label className="grid gap-2 text-sm font-medium">6자리 인증 코드
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" />
          </label> : null}
          {codeSent ? <p className={isCodeExpired ? "text-sm text-danger" : "text-sm text-muted-foreground"}>
            {isCodeExpired
              ? "인증 코드가 만료되었습니다. 다시 보내 주세요."
              : `인증 코드 만료까지 ${formatGraduateEmailCodeRemainingTime(codeRemainingSeconds)} 남음`}
          </p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant={codeSent ? "secondary" : "primary"} onClick={requestCode} loading={pending} loadingText="전송 중">{codeSent ? "인증 코드 다시 보내기" : "인증 코드 보내기"}</Button>
            {codeSent ? <Button onClick={verifyCode} disabled={isCodeExpired} loading={pending} loadingText="확인 중">이메일 인증하기</Button> : null}
          </div>
        </section>
      ) : null}

      {step === "details" ? (
        <section className="mt-6 space-y-4" aria-labelledby="graduate-details-heading">
          <h2 id="graduate-details-heading" className="text-lg font-semibold">2. 교육 정보</h2>
          <label className="grid gap-2 text-sm font-medium">이름<Input value={legalName} onChange={(event) => setLegalName(event.target.value)} maxLength={100} disabled={isResubmission} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="grid gap-2"><legend className="text-sm font-medium">교육 시작 연·월</legend><div className="grid grid-cols-2 gap-2"><Input inputMode="numeric" aria-label="교육 시작 연도" max={currentYearMonth.year} value={startYear} onChange={(event) => setStartYear(normalizeEducationYear(event.target.value))} disabled={!canEditEducationPeriod} /><Select aria-label="교육 시작 월" value={startMonth} onChange={(event) => setStartMonth(event.target.value)} disabled={!canEditEducationPeriod}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1} disabled={Number(startYear) === currentYearMonth.year && index + 1 > currentYearMonth.month}>{index + 1}월</option>)}</Select></div></fieldset>
            <fieldset className="grid gap-2"><legend className="text-sm font-medium">교육 종료 연·월</legend><div className="grid grid-cols-2 gap-2"><Input inputMode="numeric" aria-label="교육 종료 연도" max={currentYearMonth.year} value={endYear} onChange={(event) => setEndYear(normalizeEducationYear(event.target.value))} disabled={!canEditEducationPeriod} /><Select aria-label="교육 종료 월" value={endMonth} onChange={(event) => setEndMonth(event.target.value)} disabled={!canEditEducationPeriod}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1} disabled={Number(endYear) === currentYearMonth.year && index + 1 > currentYearMonth.month}>{index + 1}월</option>)}</Select></div></fieldset>
          </div>
          <label className="grid gap-2 text-sm font-medium">캠퍼스<Select aria-label="캠퍼스" value={campus} onChange={(event) => setCampus(event.target.value)} disabled={isResubmission}><option value="" disabled>캠퍼스를 선택해 주세요</option>{GRADUATE_CAMPUS_OPTIONS.map((option) => <option key={option} value={option}>{option} 캠퍼스</option>)}</Select></label>
          {isResubmission && !canEditEducationPeriod ? <p className="text-sm text-muted-foreground">기존 교육 정보는 유지됩니다. 교육 기간 보완 요청이 있을 때만 수정할 수 있습니다.</p> : null}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep("email")}>이전</Button><Button onClick={continueToFiles}>다음</Button></div>
        </section>
      ) : null}

      {step === "files" ? (
        <section className="mt-6 space-y-5" aria-labelledby="graduate-files-heading">
          <h2 id="graduate-files-heading" className="text-lg font-semibold">
            3. {isResubmission ? "보완 요청된 정보" : "교육이수증과 본인 사진"}
          </h2>
          {isResubmission ? (
            <InlineMessage
              tone="info"
              title="보완 요청"
              description={[
                resubmissionTargets.map((target) => RESUBMISSION_TARGET_LABELS[target]).join(", "),
                resubmissionNote,
              ].filter(Boolean).join(" · ")}
            />
          ) : null}
          <input ref={certificateInputRef} type="file" accept="application/pdf,.pdf" aria-label="교육이수증 PDF 파일 선택" className="sr-only" onChange={(event) => { handleCertificateChange(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          <input ref={photoInputRef} type="file" accept={GRADUATE_PROFILE_PHOTO_ACCEPT} aria-label="본인 사진 파일 선택" className="sr-only" onChange={(event) => { void handlePhotoChange(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          {requiresCertificate ? <div className="grid gap-3 rounded-card border border-border bg-surface-inset p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">교육이수증 PDF</p><p className="mt-1 text-sm text-muted-foreground">PDF(최대 10MB)</p>{certificateFile ? <p className="mt-2 text-sm font-medium text-success">선택됨: {certificateFile.name}</p> : null}</div><Button variant="secondary" onClick={chooseCertificate}>{certificateFile ? "파일 바꾸기" : "PDF 선택"}</Button></div> : null}
          {requiresProfileImage ? <div className="grid min-w-0 gap-3 rounded-card border border-border bg-surface-inset p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="font-semibold">1:1 본인 사진</p><p className="mt-1 text-ko-pretty text-sm text-muted-foreground">얼굴이 분명하게 보이는 사진(최대 5MB)</p></div><div className="flex shrink-0 items-center gap-3">{photoPreviewUrl ? <button type="button" className="rounded-[1rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => setPhotoPreviewOpen(true)} aria-label="선택한 본인 사진 크게 보기"><Image src={photoPreviewUrl} alt="선택한 본인 사진 미리보기" width={84} height={84} unoptimized className="h-[84px] w-[84px] rounded-[1rem] border border-border object-cover" /></button> : null}<Button variant="secondary" onClick={choosePhoto} loading={photoSelecting} loadingText="사진 변환 중" disabled={pending}>{photoFile ? "사진 바꾸기" : "사진 선택"}</Button></div></div> : null}
          <label className="flex items-center justify-center gap-3 rounded-card border border-border bg-surface-control p-4 text-sm"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="h-5 w-5 shrink-0 accent-primary" /><span>교육이수증과 본인 사진을 수료생 인증 검토 및 인증 카드·유효 QR 검증 화면 표시 목적으로 처리하는 데 동의합니다.</span></label>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setStep("details")}>이전</Button><Button onClick={submit} loading={pending} loadingText="제출 중" disabled={!canSubmit}>제출</Button></div>
        </section>
      ) : null}

      {step === "submitted" ? (
        <section className="mt-6 space-y-4">
          {existingRequestStatus === "submitted" ? (
            <div className="flex justify-end">
              <Button variant="danger" onClick={withdraw} loading={pending} loadingText="철회 중">
                신청 철회
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <ImageCropDialog
        open={cropOpen}
        title="본인 사진 자르기"
        subtitle="얼굴이 분명하게 보이도록 1:1 비율로 맞춰 주세요. 사진은 서버에서 다시 안전하게 변환됩니다."
        aspectRatio={1}
        sourceUrl={sourcePhotoUrl}
        outputName="graduate-profile.webp"
        outputWidth={640}
        outputHeight={640}
        accept={GRADUATE_PROFILE_PHOTO_ACCEPT}
        validateFile={getGraduateProfilePhotoSourceError}
        prepareFile={normalizeGraduateProfilePhotoSource}
        onCancel={() => setCropOpen(false)}
        onApply={applyCroppedPhoto}
      />
      {photoPreviewUrl && photoPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="선택한 본인 사진 확대"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setPhotoPreviewOpen(false)}
            aria-label="선택한 본인 사진 확대 닫기"
          />
          <button
            type="button"
            className="absolute right-6 top-6 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white"
            onClick={() => setPhotoPreviewOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="relative z-10 aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-overlay">
            <Image
              src={photoPreviewUrl}
              alt="선택한 본인 사진 확대"
              fill
              sizes="(max-width: 768px) 90vw, 448px"
              unoptimized
              className="object-contain"
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
