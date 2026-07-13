import Image from "next/image";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

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
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-card border border-border bg-surface-inset sm:w-28">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
        sizes="(max-width: 640px) 96px, 112px"
      />
    </div>
  );
}

export default function AdminProfilePhotoReviewQueue({
  replacements,
  currentPhotos,
  actions,
  replacementImageUrl = (imageId) =>
    `/api/admin/profile-photos/images/${encodeURIComponent(imageId)}`,
  currentPhotoUrl = (memberId) =>
    `/api/admin/profile-photos/current/${encodeURIComponent(memberId)}`,
}: {
  replacements: AdminProfilePhotoReplacement[];
  currentPhotos: AdminExistingProfilePhoto[];
  actions: QueueActions;
  replacementImageUrl?: (imageId: string) => string;
  currentPhotoUrl?: (memberId: string) => string;
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="profile-photo-replacement-heading">
        <div>
          <p className="ui-kicker">Photo replacement</p>
          <h2 id="profile-photo-replacement-heading" className="text-xl font-semibold">
            사진 변경 요청
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            요청 중에는 기존 승인 사진을 유지하며, 인증 카드와 QR 검증은 사용할 수 없습니다.
          </p>
        </div>

        {replacements.length === 0 ? (
          <EmptyState
            title="검토할 사진 변경 요청이 없습니다."
            description="회원이 새 본인 사진을 제출하면 이곳에 표시됩니다."
          />
        ) : (
          <div className="grid gap-4">
            {replacements.map((replacement) => {
              const member = replacement.member;
              if (!member) return null;
              return (
                <Card key={replacement.id} padding="md" className="min-w-0 space-y-4">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                    <PhotoPreview
                      src={replacementImageUrl(replacement.id)}
                      alt={`${formatMemberLabel(member)}이 제출한 새 본인 사진`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{formatMemberLabel(member)}</h3>
                        <Badge variant="warning">검토 대기</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        제출일 {new Date(replacement.created_at).toLocaleString("ko-KR")}
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        한 사람의 얼굴이 명확하게 보이고 인증 카드에 적합한지 검토해 주세요.
                      </p>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-3 border-t border-border pt-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
                    <form action={actions.approveReplacement}>
                      <input type="hidden" name="imageId" value={replacement.id} />
                      <Button type="submit">사진 승인</Button>
                    </form>
                    <form action={actions.rejectReplacement} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input type="hidden" name="imageId" value={replacement.id} />
                      <label className="sr-only" htmlFor={`replacement-reason-${replacement.id}`}>
                        반려 사유
                      </label>
                      <input
                        id={`replacement-reason-${replacement.id}`}
                        name="reason"
                        required
                        maxLength={500}
                        className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface px-3 text-sm"
                        placeholder="반려 사유를 입력해 주세요"
                      />
                      <Button variant="danger" type="submit">반려</Button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="profile-photo-current-heading">
        <div>
          <p className="ui-kicker">Current photo review</p>
          <h2 id="profile-photo-current-heading" className="text-xl font-semibold">
            기존 사진 점검
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            최근 변경된 승인 사진 50개를 확인합니다. 반려하면 회원은 새 사진이 승인될 때까지 인증 서비스를 이용할 수 없습니다.
          </p>
        </div>

        {currentPhotos.length === 0 ? (
          <EmptyState
            title="점검할 기존 사진이 없습니다."
            description="승인 상태이며 사진이 있는 회원이 표시됩니다."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currentPhotos.map((member) => (
              <Card key={member.id} padding="md" className="min-w-0 space-y-4">
                <div className="flex min-w-0 items-start gap-3">
                  <PhotoPreview
                    src={currentPhotoUrl(member.id)}
                    alt={`${formatMemberLabel(member)}의 현재 본인 사진`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{formatMemberLabel(member)}</h3>
                      <Badge variant="success">승인됨</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      변경일 {new Date(member.updated_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
                <form action={actions.rejectCurrentPhoto} className="grid min-w-0 gap-2">
                  <input type="hidden" name="memberId" value={member.id} />
                  <label className="sr-only" htmlFor={`current-photo-reason-${member.id}`}>
                    사진 반려 사유
                  </label>
                  <input
                    id={`current-photo-reason-${member.id}`}
                    name="reason"
                    required
                    maxLength={500}
                    className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface px-3 text-sm"
                    placeholder="사진 반려 사유"
                  />
                  <Button variant="danger" type="submit">사진 반려 및 인증 중지</Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
