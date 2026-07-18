import CertificationView from "@/components/certification/CertificationView";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  DEFAULT_STUDENT_CARD_THEME,
  type CohortCardTheme,
} from "@/lib/cohort-card-themes";
import { mockPreviewCertificationMembers } from "@/lib/mock/member-preview";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";

type ThemeAction = (formData: FormData) => void | Promise<void>;

function getThemeValue(
  theme: CohortCardTheme | null,
  key: keyof Pick<
    CohortCardTheme,
    "backgroundFrom" | "backgroundVia" | "backgroundTo" | "accentColor"
  >,
) {
  return theme?.[key] ?? DEFAULT_STUDENT_CARD_THEME[key];
}

function ColorField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        type="color"
        name={name}
        defaultValue={value}
        className="h-11 w-full cursor-pointer rounded-[1rem] border border-border bg-surface-control p-1 shadow-flat"
        title={label}
      />
    </label>
  );
}

function ThemeSwatches({ theme }: { theme: CohortCardTheme }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        theme.backgroundFrom,
        theme.backgroundVia,
        theme.backgroundTo,
        theme.accentColor,
      ].map((color) => (
        <span
          key={color}
          className="inline-flex h-7 w-7 rounded-full border border-border shadow-flat"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

export function AdminCohortCardThemeManager({
  themes,
  suggestedYears,
  upsertAction,
  deleteAction,
  cohortYear,
  showCreateForm = true,
  anchorId,
}: {
  themes: readonly CohortCardTheme[];
  suggestedYears: readonly number[];
  upsertAction: ThemeAction;
  deleteAction: ThemeAction;
  cohortYear?: number;
  showCreateForm?: boolean;
  anchorId?: string;
}) {
  const themeYears = typeof cohortYear === "number"
    ? [cohortYear]
    : Array.from(
        new Set([...suggestedYears, ...themes.map((theme) => theme.cohortYear)]),
      ).sort((left, right) => right - left);
  const themeMap = new Map(themes.map((theme) => [theme.cohortYear, theme]));
  const createDefaultYear = suggestedYears.find((year) => !themeMap.has(year)) ?? themeYears[0] ?? 16;
  const generationLabel = typeof cohortYear === "number" ? formatSsafyYearLabel(cohortYear) : null;

  return (
    <Card id={anchorId ?? (generationLabel ? `card-theme-manager-${cohortYear}` : "card-theme-manager")} tone="elevated" className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          title={generationLabel ? `${generationLabel} 카드 색상` : "기수별 카드 색상"}
          description={generationLabel
            ? `${generationLabel} 인증 카드 색상을 관리합니다. 글자 대비는 카드 렌더러가 자동 보정합니다.`
            : "기수별 인증 카드 색상은 DB에 저장됩니다. 배경 3색과 강조색만 저장하고, 글자 대비는 카드 렌더러가 자동 보정합니다."}
        />
        <Badge variant="primary">DB 관리</Badge>
      </div>

      {showCreateForm ? (
        <form
          action={upsertAction}
          className="grid gap-3 rounded-2xl border border-border bg-surface-inset p-4 lg:grid-cols-[7rem_minmax(0,1fr)_repeat(4,minmax(5rem,6.5rem))_auto] lg:items-end"
        >
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            기수
            <Input
              type="number"
              name="cohortYear"
              min={1}
              max={99}
              defaultValue={createDefaultYear}
              readOnly={cohortYear !== undefined}
              required
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            표시 이름
            <Input name="displayName" placeholder="16기" />
          </label>
          <ColorField label="시작" name="backgroundFrom" value="#062a3a" />
          <ColorField label="중간" name="backgroundVia" value="#0f3b66" />
          <ColorField label="끝" name="backgroundTo" value="#111827" />
          <ColorField label="강조" name="accentColor" value="#38bdf8" />
          <SubmitButton pendingText="추가 중" className="w-full lg:w-auto">
            추가
          </SubmitButton>
        </form>
      ) : null}

      <div className="grid gap-3">
        {themeYears.map((year) => {
          const theme = themeMap.get(year) ?? null;
          const updateFormId = `cohort-card-theme-update-${year}`;
          const deleteFormId = `cohort-card-theme-delete-${year}`;

          return (
            <div
              key={year}
              className="grid gap-4 rounded-2xl border border-border bg-surface-muted p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {theme?.displayName ?? formatSsafyYearLabel(year)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {theme ? "저장된 DB 색상" : "저장 전 기본 fallback"}
                  </p>
                </div>
                {theme ? <ThemeSwatches theme={theme} /> : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_repeat(4,minmax(5rem,6.5rem))_auto_auto] lg:items-end">
                <form id={updateFormId} action={upsertAction} className="contents">
                  <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
                    기수
                    <Input
                      type="number"
                      name="cohortYear"
                      min={1}
                      max={99}
                      defaultValue={year}
                      readOnly={cohortYear !== undefined}
                      required
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
                    표시 이름
                    <Input
                      name="displayName"
                      defaultValue={theme?.displayName ?? formatSsafyYearLabel(year)}
                    />
                  </label>
                  <ColorField
                    label="시작"
                    name="backgroundFrom"
                    value={getThemeValue(theme, "backgroundFrom")}
                  />
                  <ColorField
                    label="중간"
                    name="backgroundVia"
                    value={getThemeValue(theme, "backgroundVia")}
                  />
                  <ColorField
                    label="끝"
                    name="backgroundTo"
                    value={getThemeValue(theme, "backgroundTo")}
                  />
                  <ColorField
                    label="강조"
                    name="accentColor"
                    value={getThemeValue(theme, "accentColor")}
                  />
                </form>
                <form id={deleteFormId} action={deleteAction}>
                  <input type="hidden" name="cohortYear" value={year} />
                </form>
                <SubmitButton
                  form={updateFormId}
                  variant="ghost"
                  pendingText="저장 중"
                  className="w-full lg:w-auto"
                >
                  저장
                </SubmitButton>
                <SubmitButton
                  form={deleteFormId}
                  variant="danger"
                  pendingText="삭제 중"
                  className="w-full lg:w-auto"
                >
                  삭제
                </SubmitButton>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AdminCertificationCardPreviewGrid({
  themes,
  initialTimestamp,
  generation,
  anchorId,
}: {
  themes: readonly CohortCardTheme[];
  initialTimestamp: string;
  generation?: number;
  anchorId?: string;
}) {
  const previews = [
    {
      key: "year16",
      title: "16기 카드 예시",
      description: "16기 교육생 인증 카드 표현",
      member: mockPreviewCertificationMembers.year16,
    },
    {
      key: "year15",
      title: "15기 카드 예시",
      description: "15기 교육생 인증 카드 표현",
      member: mockPreviewCertificationMembers.year15,
    },
    {
      key: "year14",
      title: "14기 수료생 카드 예시",
      description: "밝은 수료생 카드에서 텍스트 대비를 확인합니다.",
      member: mockPreviewCertificationMembers.year14,
    },
    {
      key: "staff",
      title: "운영진 카드 예시",
      description: "운영진 year=0 인증 카드 표현",
      member: mockPreviewCertificationMembers.staff,
    },
  ];
  const visiblePreviews = typeof generation === "number"
    ? previews.filter((preview) => preview.member.generation === generation)
    : previews;
  const generationLabel = typeof generation === "number" ? formatSsafyYearLabel(generation) : null;

  return (
    <Card id={anchorId ?? (generationLabel ? `card-preview-${generation}` : "card-preview")} tone="elevated" className="grid gap-5">
      <SectionHeading
        title={generationLabel ? `${generationLabel} 인증 카드 목업` : "인증 카드 목업"}
        description={generationLabel
          ? `${generationLabel} 카드 색상과 인증 정보를 실제 카드 컴포넌트로 확인합니다.`
          : "기수별 색상과 수료생 대비를 실제 카드 컴포넌트로 확인합니다."}
      />
      {visiblePreviews.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {visiblePreviews.map((preview) => (
          <div
            key={preview.key}
            className="grid gap-4 rounded-2xl border border-border bg-surface-muted p-4"
          >
            <SectionHeading
              title={preview.title}
              description={preview.description}
              size="section"
            />
            <CertificationView
              member={preview.member}
              initialTimestamp={initialTimestamp}
              disableTracking
              cohortCardThemes={themes}
            />
          </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-5 text-sm text-muted-foreground">
          {generationLabel} 카드 목업 데이터가 없습니다.
        </div>
      )}
    </Card>
  );
}
