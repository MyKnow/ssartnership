import { Suspense } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import Textarea from "@/components/ui/Textarea";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import DeferredImagePreview from "@/components/admin/DeferredImagePreview";

export type AdminProfilePhotoReplacement = {
  id: string;
  member_id: string;
  created_at: string;
  member: {
    id: string;
    display_name: string | null;
    year: number | null;
  } | null;
};

export type AdminExistingProfilePhoto = {
  id: string;
  display_name: string | null;
  year: number | null;
  updated_at: string;
};

type QueueActions = {
  approveReplacement: (formData: FormData) => Promise<void>;
  rejectReplacement: (formData: FormData) => Promise<void>;
  rejectCurrentPhoto: (formData: FormData) => Promise<void>;
};

type DeferredCurrentPhotoQueue = Promise<{
  currentPhotos: AdminExistingProfilePhoto[];
  queueLoadError: boolean;
}>;

function formatMemberLabel(member: {
  display_name: string | null;
  year: number | null;
}) {
  const name = member.display_name?.trim() || "이름 미입력";
  return member.year ? `${name} · ${member.year}기` : name;
}

function PhotoPreview({
  src,
  alt,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <DeferredImagePreview src={src} alt={alt} loading={loading} />
  );
}

function RejectionReasonField({
  id,
  title,
  description,
  placeholder,
  focusReasonTarget,
}: {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  focusReasonTarget?: string | null;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const isReasonInvalid = focusReasonTarget === id;
  const describedBy = isReasonInvalid ? `${helpId} ${errorId}` : helpId;

  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        반려 사유 입력
      </label>
      <Textarea
        id={id}
        name="reason"
        required
        maxLength={500}
        autoFocus={isReasonInvalid}
        aria-invalid={isReasonInvalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
      />
      <p id={helpId} className="text-xs leading-5 text-muted-foreground">
        반려 사유를 1~500자로 입력해 주세요. 개인정보나 내부 운영 메모는 적지
        마세요.
      </p>
      {isReasonInvalid ? (
        <p
          id={errorId}
          className="text-sm font-medium text-danger"
          role="alert"
        >
          반려 사유를 1~500자로 입력해 주세요.
        </p>
      ) : null}
    </fieldset>
  );
}

function CurrentPhotoSection({
  currentPhotos,
  actions,
  currentPhotoUrl,
  returnTo,
  focusReasonTarget,
  canUpdate,
}: {
  currentPhotos: AdminExistingProfilePhoto[];
  actions: QueueActions;
  currentPhotoUrl: (memberId: string) => string;
  returnTo: string;
  focusReasonTarget?: string | null;
  canUpdate: boolean;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="profile-photo-current-heading"
    >
      <div>
        <p className="ui-kicker">현재 사진</p>
        <h2
          id="profile-photo-current-heading"
          className="text-xl font-semibold"
        >
          기존 사진 점검
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          최근 변경된 승인 사진 50개를 확인합니다. 반려하면 회원은 새 사진이
          승인될 때까지 인증 서비스를 이용할 수 없습니다.
        </p>
        {!canUpdate ? (
          <Surface level="inset" className="mt-3 p-4">
            <p className="text-sm font-semibold text-foreground">
              조회 전용 권한
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              현재 승인 사진은 확인할 수 있지만, 사진 반려와 인증 중지는 프로필
              사진 운영 권한이 있는 관리자만 할 수 있습니다.
            </p>
          </Surface>
        ) : null}
      </div>

      {currentPhotos.length === 0 ? (
        <EmptyState
          title="점검할 기존 사진이 없습니다."
          description="승인 상태이며 사진이 있는 회원이 표시됩니다."
          action={
            <Button href="/admin/profile-photos" variant="secondary">
              큐 새로고침
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {currentPhotos.map((member) => (
            <Card key={member.id} padding="md" className="min-w-0 space-y-4">
              <div className="flex min-w-0 items-start gap-3">
                <PhotoPreview
                  src={currentPhotoUrl(member.id)}
                  alt={`${formatMemberLabel(member)}의 현재 본인 사진`}
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {formatMemberLabel(member)}
                    </h3>
                    <Badge variant="success">승인됨</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    변경일{" "}
                    {new Date(member.updated_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
              {canUpdate ? (
                <form
                  action={actions.rejectCurrentPhoto}
                  className="grid min-w-0 gap-2"
                >
                  <input type="hidden" name="memberId" value={member.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <RejectionReasonField
                    id={`current-photo-reason-${member.id}`}
                    title="기존 사진 반려"
                    description="인증 중지 사유를 회원이 이해할 수 있게 구체적으로 남겨 주세요."
                    placeholder="예: 사진에 여러 사람이 있어 본인 확인이 어렵습니다."
                    focusReasonTarget={focusReasonTarget}
                  />
                  <div>
                    <SubmitButton variant="danger" pendingText="처리 중">
                      사진 반려 및 인증 중지
                    </SubmitButton>
                  </div>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function CurrentPhotoSectionFallback() {
  return (
    <section
      className="space-y-4"
      aria-labelledby="profile-photo-current-heading"
    >
      <div>
        <p className="ui-kicker">현재 사진</p>
        <h2
          id="profile-photo-current-heading"
          className="text-xl font-semibold"
        >
          기존 사진 점검
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          최근 승인 사진 상태를 확인하는 중입니다.
        </p>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="rounded-card border border-border bg-surface-inset px-4 py-5 text-sm text-muted-foreground"
      >
        현재 승인 사진을 불러오는 중입니다.
      </div>
    </section>
  );
}

async function DeferredCurrentPhotoSection({
  currentPhotosPromise,
  actions,
  currentPhotoUrl,
  returnTo,
  focusReasonTarget,
  canUpdate,
}: {
  currentPhotosPromise: DeferredCurrentPhotoQueue;
  actions: QueueActions;
  currentPhotoUrl: (memberId: string) => string;
  returnTo: string;
  focusReasonTarget?: string | null;
  canUpdate: boolean;
}) {
  const { currentPhotos, queueLoadError } = await currentPhotosPromise;
  if (queueLoadError) {
    return (
      <section
        className="space-y-4"
        aria-labelledby="profile-photo-current-heading"
      >
        <div>
          <p className="ui-kicker">현재 사진</p>
          <h2
            id="profile-photo-current-heading"
            className="text-xl font-semibold"
          >
            기존 사진 점검
          </h2>
        </div>
        <AdminStatePanel
          kind="error"
          title="현재 승인 사진을 불러오지 못했습니다."
          description="사진 변경 요청은 먼저 확인할 수 있습니다. 잠시 후 다시 시도해 주세요."
          action={
            <Button href={returnTo} variant="secondary">
              다시 확인
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <CurrentPhotoSection
      currentPhotos={currentPhotos}
      actions={actions}
      currentPhotoUrl={currentPhotoUrl}
      returnTo={returnTo}
      focusReasonTarget={focusReasonTarget}
      canUpdate={canUpdate}
    />
  );
}

export default function AdminProfilePhotoReviewQueue({
  replacements,
  currentPhotos,
  currentPhotosPromise,
  actions,
  replacementImageUrl = (imageId) =>
    `/api/admin/profile-photos/images/${encodeURIComponent(imageId)}`,
  currentPhotoUrl = (memberId) =>
    `/api/admin/profile-photos/current/${encodeURIComponent(memberId)}`,
  feedback,
  returnTo = "/admin/profile-photos",
  loadError = false,
  focusReasonTarget,
  canUpdate = true,
  showPageHeader = true,
}: {
  replacements: AdminProfilePhotoReplacement[];
  currentPhotos?: AdminExistingProfilePhoto[];
  currentPhotosPromise?: DeferredCurrentPhotoQueue;
  actions: QueueActions;
  replacementImageUrl?: (imageId: string) => string;
  currentPhotoUrl?: (memberId: string) => string;
  feedback?: AdminReviewQueueFeedback | null;
  returnTo?: string;
  loadError?: boolean;
  focusReasonTarget?: string | null;
  canUpdate?: boolean;
  showPageHeader?: boolean;
}) {
  const resolvedCurrentPhotosPromise =
    currentPhotosPromise ??
    Promise.resolve({
      currentPhotos: currentPhotos ?? [],
      queueLoadError: false,
    });
  const currentPhotoCount = currentPhotos?.length;
  const totalReviewCount =
    currentPhotoCount === undefined
      ? "확인 중"
      : `${replacements.length + currentPhotoCount}건`;

  return (
    <div className="grid min-w-0 gap-8">
      <AdminReviewQueueHeader
        eyebrow="작업함"
        title="프로필 사진 검토"
        description="새 사진 교체 요청과 현재 승인 사진 점검을 분리해, 회원 인증에 영향을 주는 작업을 안전하게 처리합니다."
        actions={
          <Button href="#profile-photo-replacement-heading" variant="secondary">
            사진 변경 요청으로
          </Button>
        }
        metrics={[
          {
            label: "교체 요청",
            value: `${replacements.length}건`,
            hint: "새 사진 승인 대기",
          },
          {
            label: "현재 사진",
            value:
              currentPhotoCount === undefined
                ? "확인 중"
                : `${currentPhotoCount}건`,
            hint: "최근 승인 사진 점검",
          },
          {
            label: "검토 대상",
            value: totalReviewCount,
            hint: "현재 화면 기준",
          },
        ]}
        feedback={feedback}
        nextAction={{
          title: canUpdate
            ? replacements.length > 0
              ? "새 교체 사진부터 확인하세요."
              : "현재 승인 사진의 상태를 점검하세요."
            : "검토 큐와 사진 상태를 확인하세요.",
          description: canUpdate
            ? "새 사진을 승인하기 전에는 기존 사진이 유지됩니다. 반려 사유는 회원이 이해할 수 있도록 구체적으로 남겨 주세요."
            : "현재 계정은 사진 상태를 확인할 수 있지만 승인·반려는 할 수 없습니다.",
        }}
        showPageHeader={showPageHeader}
      />
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="프로필 사진 검토 큐를 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={
            <Button href={returnTo} variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : (
        <>
          <section
            className="space-y-4"
            aria-labelledby="profile-photo-replacement-heading"
          >
            <div>
              <p className="ui-kicker">사진 교체</p>
              <h2
                id="profile-photo-replacement-heading"
                className="text-xl font-semibold"
              >
                사진 변경 요청
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                요청 중에는 기존 승인 사진을 유지하며, 인증 카드와 QR 검증은
                사용할 수 없습니다.
              </p>
              {!canUpdate ? (
                <Surface level="inset" className="mt-3 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    조회 전용 권한
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    제출 사진과 검토 상태는 확인할 수 있지만 승인·반려는 할 수
                    없습니다.
                  </p>
                </Surface>
              ) : null}
            </div>

            {replacements.length === 0 ? (
              <EmptyState
                title="검토할 사진 변경 요청이 없습니다."
                description="회원이 새 본인 사진을 제출하면 이곳에 표시됩니다."
                action={
                  <Button href="/admin/profile-photos" variant="secondary">
                    큐 새로고침
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4">
                {replacements.map((replacement, index) => {
                  const member = replacement.member;
                  if (!member) return null;
                  return (
                    <Card
                      key={replacement.id}
                      padding="md"
                      className="min-w-0 space-y-4"
                    >
                      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                        <PhotoPreview
                          src={replacementImageUrl(replacement.id)}
                          alt={`${formatMemberLabel(member)}이 제출한 새 본인 사진`}
                          loading={index === 0 ? "eager" : "lazy"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">
                              {formatMemberLabel(member)}
                            </h3>
                            <Badge variant="warning">검토 대기</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            제출일{" "}
                            {new Date(replacement.created_at).toLocaleString(
                              "ko-KR",
                            )}
                          </p>
                          <p className="mt-3 text-sm text-muted-foreground">
                            한 사람의 얼굴이 명확하게 보이고 인증 카드에
                            적합한지 검토해 주세요.
                          </p>
                        </div>
                      </div>

                      {canUpdate ? (
                        <div className="grid min-w-0 gap-3 border-t border-border pt-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
                          <form action={actions.approveReplacement}>
                            <input
                              type="hidden"
                              name="imageId"
                              value={replacement.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={returnTo}
                            />
                            <SubmitButton pendingText="승인 중">
                              사진 승인
                            </SubmitButton>
                          </form>
                          <form
                            action={actions.rejectReplacement}
                            className="grid min-w-0 gap-3"
                          >
                            <input
                              type="hidden"
                              name="imageId"
                              value={replacement.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={returnTo}
                            />
                            <RejectionReasonField
                              id={`replacement-reason-${replacement.id}`}
                              title="사진 변경 요청 반려"
                              description="회원이 다시 제출할 수 있도록 사진에서 확인한 문제를 구체적으로 남겨 주세요."
                              placeholder="예: 얼굴이 흐리게 보여 본인 확인이 어렵습니다."
                              focusReasonTarget={focusReasonTarget}
                            />
                            <div>
                              <SubmitButton
                                variant="danger"
                                pendingText="반려 중"
                              >
                                사진 변경 요청 반려
                              </SubmitButton>
                            </div>
                          </form>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Suspense fallback={<CurrentPhotoSectionFallback />}>
            <DeferredCurrentPhotoSection
              currentPhotosPromise={resolvedCurrentPhotosPromise}
              actions={actions}
              currentPhotoUrl={currentPhotoUrl}
              returnTo={returnTo}
              focusReasonTarget={focusReasonTarget}
              canUpdate={canUpdate}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
