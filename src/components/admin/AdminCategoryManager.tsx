import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import type { AdminCategory } from "@/components/admin/partner-manager/types";

type FormAction = (formData: FormData) => void | Promise<void>;

function CategoryFields({ category }: { category?: AdminCategory }) {
  return (
    <>
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
        카테고리 키
        <Input
          name="key"
          defaultValue={category?.key}
          placeholder="category-key"
          required
        />
      </label>
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
        라벨
        <Input
          name="label"
          defaultValue={category?.label}
          placeholder="라벨"
          required
        />
      </label>
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
        설명
        <Input
          name="description"
          defaultValue={category?.description ?? ""}
          placeholder="사용자에게 보이는 분류 설명"
        />
      </label>
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
        색상
        <input
          type="color"
          name="color"
          defaultValue={category?.color ?? "#0f172a"}
          className="h-12 w-full cursor-pointer rounded-2xl border border-border bg-surface-control p-1"
          title="카테고리 색상"
        />
      </label>
    </>
  );
}

export default function AdminCategoryManager({
  categories,
  createAction,
  updateAction,
  canCreate,
  canUpdate,
  usageCountById = {},
}: {
  categories: AdminCategory[];
  createAction: FormAction;
  updateAction: FormAction;
  canCreate: boolean;
  canUpdate: boolean;
  usageCountById?: Record<string, number>;
}) {
  return (
    <section className="grid min-w-0 gap-4">
      {canCreate ? (
        <Surface level="elevated" padding="lg" className="grid min-w-0 gap-5">
          <AdminSectionHeading
            title="카테고리 추가"
            description="키는 소문자 영문·숫자 조합으로 만들고 사용자 라벨을 함께 입력합니다."
          />
          <form
            action={createAction}
            className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_6rem_auto] xl:items-end"
          >
            <CategoryFields />
            <SubmitButton pendingText="추가 중" className="w-full">
              추가
            </SubmitButton>
          </form>
        </Surface>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          title="등록된 카테고리가 없습니다."
          description="제휴처를 분류할 첫 카테고리를 추가해 주세요."
        />
      ) : (
        <div className="grid min-w-0 gap-3">
          {categories.map((category) => {
            const updateFormId = `category-update-${category.id}`;
            const usageCount = usageCountById[category.id] ?? 0;

            return (
              <Surface
                key={category.id}
                level="inset"
                padding="md"
                className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
              >
                {canUpdate ? (
                  <form
                    id={updateFormId}
                    action={updateAction}
                    className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_6rem]"
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <CategoryFields category={category} />
                  </form>
                ) : (
                  <div className="grid min-w-0 gap-1">
                    <p className="truncate font-semibold text-foreground">
                      {category.label}
                    </p>
                    <p className="text-token truncate text-sm text-muted-foreground">
                      {category.key}
                    </p>
                    <p className="text-ko-pretty line-clamp-2 text-sm text-muted-foreground">
                      {category.description || "설명 없음"}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <span className="basis-full text-right text-xs text-muted-foreground">
                    {usageCount > 0
                      ? `제휴처 ${usageCount.toLocaleString("ko-KR")}곳에서 사용 중`
                      : "연결된 제휴처 없음"}
                  </span>
                  {canUpdate ? (
                    <SubmitButton
                      form={updateFormId}
                      variant="ghost"
                      pendingText="수정 중"
                    >
                      수정
                    </SubmitButton>
                  ) : null}
                  <span
                    className="inline-flex min-h-10 items-center rounded-[0.95rem] border border-border bg-surface-control px-4 text-sm font-semibold text-muted-foreground"
                    title="FK 보호 정책을 적용하는 후속 마이그레이션 전까지 삭제를 지원하지 않습니다."
                  >
                    삭제 잠금
                  </span>
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
