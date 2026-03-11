export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-6 text-sm text-slate-600 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
        <p className="font-medium text-slate-700 dark:text-slate-200">
          SSAFY 15기 서울 캠퍼스 제휴
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            className="font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200"
            href="https://github.com/MyKnow"
            target="_blank"
            rel="noreferrer"
          >
            Github: MyKnow
          </a>
          <a
            className="font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200"
            href="mailto:myknow00@naver.com"
          >
            Bug Report: myknow00@naver.com
          </a>
        </div>
      </div>
    </footer>
  );
}
