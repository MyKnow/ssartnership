export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface/90 py-6 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="font-medium text-foreground">
          SSAFY 15기 서울 캠퍼스 제휴
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            className="font-semibold text-foreground hover:opacity-80"
            href="https://github.com/MyKnow"
            target="_blank"
            rel="noreferrer"
          >
            Github: MyKnow
          </a>
          <a
            className="font-semibold text-foreground hover:opacity-80"
            href="mailto:myknow00@naver.com"
          >
            Bug Report: myknow00@naver.com
          </a>
        </div>
      </div>
    </footer>
  );
}
