import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  getContactDisplay,
  getInquiryAction,
  getMapLink,
  getReservationAction,
  normalizeReservationInquiry,
} from "./partner-links";

function PartnerLinksPreview() {
  const mapDirect = getMapLink("https://map.naver.com/p/entry/123", "서울 강남구", "역삼 제휴");
  const mapNationwide = getMapLink(undefined, "전국 매장", "역삼 제휴");
  const mapNone = getMapLink(undefined, "서울 강남구", "역삼 제휴");
  const instagramHandle = getContactDisplay("@ssafy.seoul");
  const instagramUrl = getContactDisplay("https://instagram.com/ssafy.official");
  const phone = getContactDisplay("010-1234-5678");
  const email = getContactDisplay("hello@example.com");
  const web = getContactDisplay("https://example.com");
  const invalidWeb = getContactDisplay("https://user:pass@example.com");
  const reservationPhone = getReservationAction("010-1234-5678");
  const reservationInstagram = getReservationAction("@ssafy.seoul");
  const reservationEmail = getReservationAction("hello@example.com");
  const inquiryKakao = getInquiryAction("https://pf.kakao.com/_abcd");
  const inquiryWeb = getInquiryAction("https://example.com/inquiry");
  const inquiryPhone = getInquiryAction("010-1234-5678");
  const inquiryEmail = getInquiryAction("hello@example.com");
  const inquiryNone = getInquiryAction("현장 방문");
  const normalizedMoved = normalizeReservationInquiry("", "https://booking.naver.com/booking/5");
  const normalizedKept = normalizeReservationInquiry(" https://reserve.kakao.com ", " @ssafy.seoul ");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>map-direct:{mapDirect}</div>
      <div>map-nationwide:{mapNationwide}</div>
      <div>map-none:{String(mapNone)}</div>
      <div>contact-instagram-handle:{JSON.stringify(instagramHandle)}</div>
      <div>contact-instagram-url:{JSON.stringify(instagramUrl)}</div>
      <div>contact-phone:{JSON.stringify(phone)}</div>
      <div>contact-email:{JSON.stringify(email)}</div>
      <div>contact-web:{JSON.stringify(web)}</div>
      <div>contact-invalid-web:{JSON.stringify(invalidWeb)}</div>
      <div>reservation-phone:{JSON.stringify(reservationPhone)}</div>
      <div>reservation-instagram:{JSON.stringify(reservationInstagram)}</div>
      <div>reservation-email:{JSON.stringify(reservationEmail)}</div>
      <div>inquiry-kakao:{JSON.stringify(inquiryKakao)}</div>
      <div>inquiry-web:{JSON.stringify(inquiryWeb)}</div>
      <div>inquiry-phone:{JSON.stringify(inquiryPhone)}</div>
      <div>inquiry-email:{JSON.stringify(inquiryEmail)}</div>
      <div>inquiry-none:{String(inquiryNone)}</div>
      <div>normalized-moved:{JSON.stringify(normalizedMoved)}</div>
      <div>normalized-kept:{JSON.stringify(normalizedKept)}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerLinks",
  component: PartnerLinksPreview,
} satisfies Meta<typeof PartnerLinksPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("map-direct:https://map.naver.com/p/entry/123")).toBeInTheDocument();
    await expect(
      canvas.getByText("map-nationwide:https://map.naver.com/p/search/%EC%97%AD%EC%82%BC%20%EC%A0%9C%ED%9C%B4"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("map-none:undefined")).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-instagram-handle:{"label":"@ssafy.seoul","href":"https://instagram.com/ssafy.seoul","type":"instagram"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-instagram-url:{"label":"@ssafy.official","href":"https://instagram.com/ssafy.official","type":"instagram"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-phone:{"label":"010-1234-5678","href":"tel:01012345678","type":"phone"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-email:{"label":"hello@example.com","href":"mailto:hello@example.com","type":"email"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-web:{"label":"https://example.com","href":"https://example.com/","type":"web"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'contact-invalid-web:{"label":"https://user:pass@example.com","href":"mailto:https://user:pass@example.com","type":"email"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('reservation-phone:{"label":"예약하기","href":"tel:01012345678"}'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'reservation-instagram:{"label":"예약하기","href":"https://instagram.com/ssafy.seoul"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'reservation-email:{"label":"예약하기","href":"mailto:hello@example.com"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'inquiry-kakao:{"label":"문의하기","href":"https://pf.kakao.com/_abcd"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'inquiry-web:{"label":"문의하기","href":"https://example.com/inquiry"}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('inquiry-phone:{"label":"문의하기","href":"tel:01012345678"}'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'inquiry-email:{"label":"문의하기","href":"mailto:hello@example.com"}',
      ),
    ).toBeInTheDocument();
    await expect(canvas.getByText("inquiry-none:null")).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'normalized-moved:{"reservationLink":"https://booking.naver.com/booking/5","inquiryLink":""}',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'normalized-kept:{"reservationLink":"https://reserve.kakao.com","inquiryLink":"@ssafy.seoul"}',
      ),
    ).toBeInTheDocument();
  },
};
