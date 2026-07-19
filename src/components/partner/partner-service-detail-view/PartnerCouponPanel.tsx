"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type { AdCoupon } from "@/lib/repositories/ad-package-repository";

export default function PartnerCouponPanel({
  coupons,
  companyId,
  partnerId,
  createAction,
  uploadCodesAction,
}: {
  coupons: AdCoupon[];
  companyId: string;
  partnerId: string;
  createAction: (formData: FormData) => void | Promise<void>;
  uploadCodesAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">쿠폰 관리</h2>
          <p className="mt-1 text-sm text-muted-foreground">제휴처 상세에서 회원이 다운로드할 쿠폰을 직접 추가합니다.</p>
        </div>
        <Badge variant="primary">{coupons.length}개</Badge>
      </div>
      <form action={createAction} className="grid gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:grid-cols-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="partnerId" value={partnerId} />
        <Input name="title" placeholder="쿠폰 이름" required />
        <Input name="discountLabel" placeholder="혜택 (예: 10% 할인)" />
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          사용 시작일
          <Input name="startsAt" type="datetime-local" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          사용 종료일
          <Input name="endsAt" type="datetime-local" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          현장 확인 비밀번호
          <Input
            name="onsitePassword"
            type="text"
            inputMode="numeric"
            pattern="[0-9]+"
            autoComplete="off"
            placeholder="제휴처에서 사용할 숫자 비밀번호"
            required
          />
          <span className="text-xs font-normal text-muted-foreground">
            회원이 쿠폰을 사용할 때 제휴처가 확인할 숫자입니다. 길이 제한은 없습니다.
          </span>
        </label>
        <Input name="perMemberDailyIssueLimit" type="number" min={0} step={1} placeholder="회원별 일 발급 한도 (무제한)" />
        <Input name="perMemberWeeklyIssueLimit" type="number" min={0} step={1} placeholder="회원별 주 발급 한도 (무제한)" />
        <Input name="perMemberMonthlyIssueLimit" type="number" min={0} step={1} placeholder="회원별 월 발급 한도 (무제한)" />
        <input type="hidden" name="issuanceType" value="service" />
        <input type="hidden" name="redemptionType" value="onsite" />
        <input type="hidden" name="status" value="draft" />
        <Button type="submit" className="justify-center sm:col-span-2">쿠폰 추가</Button>
      </form>
      {coupons.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-2xl border border-border bg-surface-muted p-4">
              <p className="font-semibold text-foreground">{coupon.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{coupon.discountLabel || "혜택 미입력"}</p>
              <p className="mt-2 text-xs text-muted-foreground">사용 {coupon.usageStartsAt.slice(0, 10)} ~ {coupon.usageEndsAt.slice(0, 10)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                회원별 발급 · 일 {coupon.perMemberDailyIssueLimit ?? "무제한"} · 주 {coupon.perMemberWeeklyIssueLimit ?? "무제한"} · 월 {coupon.perMemberMonthlyIssueLimit ?? "무제한"}
              </p>
              {coupon.redemptionType === "onsite" ? (
                <p className="mt-1 text-xs font-medium text-primary">
                  {coupon.hasOnsitePassword ? "현장 확인 비밀번호 설정됨" : "현장 확인 비밀번호 미설정"}
                </p>
              ) : null}
              {coupon.issuanceType === "partner_code_pool" ? (
                <form action={uploadCodesAction} encType="multipart/form-data" className="mt-3 flex gap-2">
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="partnerId" value={partnerId} />
                  <input type="hidden" name="couponId" value={coupon.id} />
                  <input name="codePoolFile" type="file" accept=".xlsx" className="min-w-0 text-xs" required />
                  <Button type="submit" variant="secondary" className="shrink-0">코드 추가</Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
