import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import type { PwaInstallPlatform } from "@/lib/pwa-install";
import { buildPwaInstallGuideHref } from "@/lib/pwa-install";
import androidChromeMenuImage from "../../assets/install-guides/android-chrome-menu.png";
import androidChromeToolbarImage from "../../assets/install-guides/android-chrome-toolbar.png";
import iosSafariAddConfirmationImage from "../../assets/install-guides/ios-safari-add-confirmation.png";
import iosSafariMenuImage from "../../assets/install-guides/ios-safari-menu.png";
import iosSafariShareActionsImage from "../../assets/install-guides/ios-safari-share-actions.png";
import iosSafariShareSheetImage from "../../assets/install-guides/ios-safari-share-sheet.png";
import iosSafariToolbarImage from "../../assets/install-guides/ios-safari-toolbar.png";

type GuideStep = {
  title: string;
  description: string;
  image?: {
    src: StaticImageData;
    alt: string;
    objectPosition: string;
  };
};

type GuideConfig = {
  eyebrow: string;
  label: string;
  title: string;
  description: string;
  steps: GuideStep[];
  checks: string[];
};

const guideConfig: Record<PwaInstallPlatform, GuideConfig> = {
  android: {
    eyebrow: "ANDROID",
    label: "Android",
    title: "Chrome 메뉴에서 앱을 설치해 주세요",
    description:
      "싸트너십을 홈 화면에 추가하면 브라우저 주소창 없이 앱처럼 빠르게 열 수 있습니다.",
    steps: [
      {
        title: "오른쪽 위 더보기 메뉴를 누르세요",
        description:
          "세로 점 3개 또는 ‘업데이트 가능’ 아이콘으로 표시된 브라우저 메뉴 버튼을 누릅니다.",
        image: {
          src: androidChromeToolbarImage,
          alt: "Android Chrome 오른쪽 위에 더보기 메뉴 버튼이 표시된 화면",
          objectPosition: "center top",
        },
      },
      {
        title: "앱 설치 또는 홈 화면에 추가를 선택하세요",
        description:
          "메뉴 아래쪽의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택합니다.",
        image: {
          src: androidChromeMenuImage,
          alt: "Android Chrome 더보기 메뉴에 홈 화면에 추가 항목이 표시된 화면",
          objectPosition: "right 78%",
        },
      },
      {
        title: "설치를 확인하세요",
        description:
          "Chrome 안내창에서 설치 또는 추가를 누르면 홈 화면에 아이콘이 만들어집니다.",
      },
    ],
    checks: [
      "브라우저에 따라 메뉴 이름이 ‘설치’로 짧게 표시될 수 있어요.",
      "설치 항목이 없다면 Chrome을 최신 버전으로 업데이트한 뒤 다시 확인해 주세요.",
    ],
  },
  ios: {
    eyebrow: "IPHONE · IPAD",
    label: "iPhone·iPad",
    title: "Safari 공유 메뉴에서 홈 화면에 추가해 주세요",
    description:
      "iOS와 iPadOS에서는 Safari의 공유 메뉴를 이용해야 싸트너십을 앱처럼 설치할 수 있습니다.",
    steps: [
      {
        title: "Safari 하단의 더보기를 누르세요",
        description:
          "최신 Safari에서는 주소창 오른쪽의 점 3개를 누릅니다. 공유 버튼이 바로 보이면 다음 단계로 이동하세요.",
        image: {
          src: iosSafariToolbarImage,
          alt: "iPhone Safari 하단 주소창 오른쪽에 더보기 버튼이 표시된 화면",
          objectPosition: "center bottom",
        },
      },
      {
        title: "메뉴에서 공유를 누르세요",
        description: "네모 위로 화살표가 올라가는 모양의 ‘공유’를 선택합니다.",
        image: {
          src: iosSafariMenuImage,
          alt: "iPhone Safari 더보기 메뉴에 공유 항목이 표시된 화면",
          objectPosition: "right 77%",
        },
      },
      {
        title: "공유 시트에서 더 보기를 누르세요",
        description:
          "공유할 앱 목록 아래 빠른 동작의 오른쪽 끝에 있는 ‘더 보기’를 눌러 전체 동작을 펼칩니다.",
        image: {
          src: iosSafariShareSheetImage,
          alt: "iPhone Safari 공유 시트의 빠른 동작에 더 보기 버튼이 표시된 화면",
          objectPosition: "center 76%",
        },
      },
      {
        title: "홈 화면에 추가를 선택하세요",
        description:
          "펼쳐진 동작 목록에서 ‘홈 화면에 추가’를 찾아 누릅니다.",
        image: {
          src: iosSafariShareActionsImage,
          alt: "iPhone Safari 공유 동작 목록에 홈 화면에 추가가 표시된 화면",
          objectPosition: "center 76%",
        },
      },
      {
        title: "이름을 확인하고 추가를 누르세요",
        description:
          "‘싸트너십’ 이름과 ssartnership.myknow.xyz 주소를 확인한 뒤 오른쪽 위 ‘추가’를 누릅니다.",
        image: {
          src: iosSafariAddConfirmationImage,
          alt: "iPhone 홈 화면에 추가 확인 화면에 싸트너십 이름과 운영 주소가 표시된 화면",
          objectPosition: "center 18%",
        },
      },
    ],
    checks: [
      "공유 시트의 빠른 동작이 접혀 있으면 ‘더 보기’를 먼저 눌러 주세요.",
      "Safari 버전과 iPad 화면에서는 공유 버튼이 화면 오른쪽 위에 바로 표시될 수 있어요.",
    ],
  },
  other: {
    eyebrow: "DESKTOP · OTHER",
    label: "기타 기기",
    title: "브라우저의 설치 메뉴를 확인해 주세요",
    description:
      "Chrome, Edge 등 설치를 지원하는 브라우저에서는 싸트너십을 별도 창으로 실행할 수 있습니다.",
    steps: [
      {
        title: "주소창의 설치 아이콘을 찾으세요",
        description:
          "주소창 오른쪽에 모니터나 아래 화살표 모양의 설치 아이콘이 있는지 확인합니다.",
      },
      {
        title: "아이콘이 없다면 브라우저 메뉴를 확인하세요",
        description:
          "Chrome·Edge 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’ 항목을 찾습니다.",
      },
      {
        title: "설치를 확인하고 새 앱을 여세요",
        description:
          "설치가 끝나면 바탕 화면이나 앱 목록에서 싸트너십을 실행합니다.",
      },
    ],
    checks: [
      "Safari 데스크톱처럼 설치 방식이 다른 브라우저에서는 메뉴 이름이 달라질 수 있어요.",
      "설치를 지원하지 않아도 지금처럼 웹사이트에서 모든 기능을 이용할 수 있습니다.",
    ],
  },
};

const platformOrder: PwaInstallPlatform[] = ["android", "ios", "other"];

function PlatformIcon({ platform }: { platform: PwaInstallPlatform }) {
  const className = "h-7 w-7";
  if (platform === "android") {
    return <DevicePhoneMobileIcon className={className} aria-hidden="true" />;
  }
  if (platform === "ios") {
    return <ShareIcon className={className} aria-hidden="true" />;
  }
  return <ComputerDesktopIcon className={className} aria-hidden="true" />;
}

function InstallStep({ step, index }: { step: GuideStep; index: number }) {
  return (
    <li
      className={`grid min-w-0 gap-4 rounded-card border border-border/80 bg-surface-inset p-4 sm:p-5 ${step.image ? "md:grid-cols-[minmax(0,1fr)_15rem] md:items-stretch" : ""}`}
    >
      <div className="flex min-w-0 gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-flat">
          {index + 1}
        </span>
        <div className="min-w-0 space-y-1.5 pt-1">
          <h3 className="text-base font-semibold text-foreground text-ko-title">
            {step.title}
          </h3>
          <p className="ui-body text-ko-pretty">{step.description}</p>
        </div>
      </div>

      {step.image ? (
        <div className="relative h-44 min-w-0 overflow-hidden rounded-[1rem] border border-border bg-surface-control shadow-flat md:h-full md:min-h-44">
          <Image
            src={step.image.src}
            alt={step.image.alt}
            fill
            sizes="(min-width: 768px) 240px, calc(100vw - 80px)"
            className="object-cover"
            style={{ objectPosition: step.image.objectPosition }}
          />
        </div>
      ) : null}
    </li>
  );
}

export default function PwaInstallGuideView({
  platform,
}: {
  platform: PwaInstallPlatform;
}) {
  const config = guideConfig[platform];
  const alternativePlatforms = platformOrder.filter(
    (item) => item !== platform,
  );

  return (
    <main>
      <Container className="pb-16 pt-8 sm:pt-10" size="wide">
        <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
          <ShellHeader
            eyebrow="APP INSTALL"
            title="싸트너십 앱 설치"
          />

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)] lg:items-start">
            <Card tone="elevated" padding="lg" className="space-y-6">
              <div className="flex min-w-0 flex-col items-start gap-4 border-b border-border/70 pb-5 sm:flex-row">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] border border-primary/15 bg-primary-soft text-primary shadow-flat">
                  <PlatformIcon platform={platform} />
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="ui-kicker">{config.eyebrow}</p>
                  <h2 className="ui-section-title text-ko-title text-balance">
                    {config.title}
                  </h2>
                  <p className="ui-body text-ko-pretty">{config.description}</p>
                </div>
              </div>

              <ol
                className="grid gap-3"
                aria-label={`${config.label} 앱 설치 순서`}
              >
                {config.steps.map((step, index) => (
                  <InstallStep key={step.title} step={step} index={index} />
                ))}
              </ol>
            </Card>

            <div className="grid min-w-0 gap-5">
              <Card tone="muted" padding="md" className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon
                    className="h-6 w-6 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <h2 className="text-lg font-semibold text-foreground">
                    설치가 안 될 때
                  </h2>
                </div>
                <ul className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  {config.checks.map((check) => (
                    <li key={check} className="flex gap-2.5 text-ko-pretty">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card padding="md" className="space-y-4">
                <div className="flex items-center gap-3">
                  <GlobeAltIcon
                    className="h-6 w-6 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      다른 기기 안내
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      기기가 다르게 감지됐다면 직접 선택해 주세요.
                    </p>
                  </div>
                </div>
                <nav className="grid gap-2" aria-label="다른 기기 설치 안내">
                  {alternativePlatforms.map((alternative) => (
                    <Link
                      key={alternative}
                      href={buildPwaInstallGuideHref(alternative)}
                      prefetch={false}
                      className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-[1rem] border border-border bg-surface-control px-4 py-2 text-sm font-semibold text-foreground transition-interactive hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      {guideConfig[alternative].label}
                      <ArrowRightIcon
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </nav>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
