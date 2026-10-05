"use client";

import { renderEmailBody } from "@/lib/email-content";
import type {
  NotificationTemplateBodyFormat,
  NotificationTemplateVariable,
} from "@/lib/notification-templates/catalog";
import {
  NOTIFICATION_TEMPLATE_SAMPLE_ERROR,
  renderNotificationTemplateSample,
} from "@/lib/notification-templates/sample";

/**
 * 이메일 템플릿 HTML 미리보기. Markdown 변환·HTML 정리 라이브러리가 커서
 * 관리자 템플릿 편집기는 이메일 채널 편집기를 열 때만 이 컴포넌트를 불러온다.
 */
export default function AdminEmailPreview({
  bodyTemplate,
  bodyFormat,
  variables,
}: {
  bodyTemplate: string;
  bodyFormat: NotificationTemplateBodyFormat;
  variables: readonly NotificationTemplateVariable[];
}) {
  const sampleBody = renderNotificationTemplateSample(bodyTemplate, variables);
  let preview: ReturnType<typeof renderEmailBody> | null = null;
  if (sampleBody !== null) {
    try {
      preview = renderEmailBody(sampleBody, bodyFormat);
    } catch {
      preview = null;
    }
  }

  if (!preview) {
    return (
      <p className="whitespace-pre-wrap">
        <span className="font-semibold text-foreground">내용:</span>{" "}
        {sampleBody ?? NOTIFICATION_TEMPLATE_SAMPLE_ERROR}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="font-semibold text-foreground">이메일 HTML 미리보기</p>
      <div
        className="min-w-0 overflow-x-auto rounded-xl border border-border bg-white p-3 text-slate-900 [&_a]:text-blue-700 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: preview.html }}
      />
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          일반 텍스트 fallback:
        </span>{" "}
        {preview.text}
      </p>
    </div>
  );
}
