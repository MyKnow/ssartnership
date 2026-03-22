import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { BUG_REPORT_EMAIL } from "@/lib/site";
import { isBlocked, recordAttempt, SUGGEST_RATE_LIMIT } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmpty(value: unknown) {
  return !value || String(value).trim().length === 0;
}

function isValidEmail(value?: string | null) {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    if (await isBlocked(identifier, SUGGEST_RATE_LIMIT)) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    const payload = (await request.json()) as {
      companyName?: string;
      businessArea?: string;
      partnershipConditions?: string;
      contactName?: string;
      contactRole?: string;
      contactEmail?: string;
      companyUrl?: string;
      summary?: string;
    };

    if (
      isEmpty(payload.companyName) ||
      isEmpty(payload.businessArea) ||
      isEmpty(payload.partnershipConditions) ||
      isEmpty(payload.contactName) ||
      isEmpty(payload.contactRole) ||
      isEmpty(payload.contactEmail)
    ) {
      return NextResponse.json(
        { message: "필수 항목이 누락되었습니다." },
        { status: 400 },
      );
    }

    if (!isValidEmail(payload.contactEmail)) {
      return NextResponse.json(
        { message: "이메일 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    await recordAttempt(identifier, false, SUGGEST_RATE_LIMIT);

    const smtpUser = process.env.NAVER_SMTP_USER;
    const smtpPass = process.env.NAVER_SMTP_PASS;
    const recipient = process.env.SUGGEST_NOTIFY_EMAIL ?? BUG_REPORT_EMAIL;

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        { message: "메일 설정이 누락되었습니다." },
        { status: 400 },
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.naver.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const subject = `[SSARTNERSHIP] 제휴 제안 접수 안내`;
    const safeCompanyName = toHtml(payload.companyName ?? "");
    const safeBusiness = toHtml(payload.businessArea ?? "");
    const safeConditions = toHtml(payload.partnershipConditions ?? "");
    const safeContactName = toHtml(payload.contactName ?? "");
    const safeContactRole = toHtml(payload.contactRole ?? "");
    const safeContactEmail = toHtml(payload.contactEmail ?? "");
    const safeCompanyUrl = toHtml(payload.companyUrl ?? "-");

    const bodyText =
      payload.summary ??
      [
        `업체명: ${payload.companyName ?? ""}`,
        `업체분야 소개: ${payload.businessArea ?? ""}`,
        `제안 제휴 조건: ${payload.partnershipConditions ?? ""}`,
        `담당자 이름: ${payload.contactName ?? ""}`,
        `담당자 직위: ${payload.contactRole ?? ""}`,
        `담당자 이메일: ${payload.contactEmail ?? ""}`,
        `회사 사이트 URL: ${payload.companyUrl ?? "-"}`,
      ].join("\n");

    const bodyHtml = `\n      <div style=\"font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;\">\n        <h2 style=\"margin: 0 0 12px;\">제휴 제안을 접수했습니다.</h2>\n        <p style=\"margin: 0 0 16px; color: #334155;\">\n          안녕하세요 ${safeContactName} ${safeContactRole}님,\n          SSARTNERSHIP 파트너십 제안을 보내주셔서 감사합니다.\n          보내주신 내용을 아래와 같이 정리해 전달드립니다.\n        </p>\n        <div style=\"border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc;\">\n          <p style=\"margin: 0 0 8px;\"><strong>업체명</strong><br />${safeCompanyName}</p>\n          <p style=\"margin: 0 0 8px;\"><strong>업체분야 소개</strong><br />${safeBusiness}</p>\n          <p style=\"margin: 0 0 8px;\"><strong>제안 제휴 조건</strong><br />${safeConditions}</p>\n          <p style=\"margin: 0 0 8px;\"><strong>담당자</strong><br />${safeContactName} ${safeContactRole}</p>\n          <p style=\"margin: 0 0 8px;\"><strong>담당자 이메일</strong><br />${safeContactEmail}</p>\n          <p style=\"margin: 0;\"><strong>회사 사이트</strong><br />${safeCompanyUrl}</p>\n        </div>\n        <p style=\"margin: 16px 0 0; color: #334155;\">\n          담당자가 확인 후 안내드리겠습니다. 추가로 전달하실 내용이 있으면\n          이 메일에 회신해 주세요.\n        </p>\n        <p style=\"margin: 20px 0 0; color: #64748b; font-size: 12px;\">\n          SSARTNERSHIP · SSAFY 15기 서울 캠퍼스\n        </p>\n      </div>\n    `;

    await transporter.sendMail({
      from: `SSARTNERSHIP <${smtpUser}>`,
      to: payload.contactEmail,
      bcc: recipient,
      replyTo: payload.contactEmail,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("suggest email error", error);
    return NextResponse.json(
      { message: "메일 전송에 실패했습니다." },
      { status: 500 },
    );
  }
}
