## SSARTNERSHIP
SSAFY 15기(서울 캠퍼스) 구성원을 위한 제휴 업체 정보를 모아 보여주는 웹 서비스입니다.  
카테고리별로 제휴 업체를 조회하고, 상세 페이지에서 혜택/조건/연락처/이미지를 확인할 수 있습니다.  
관리자는 Admin 페이지에서 제휴 업체와 카테고리를 관리할 수 있습니다.

## 주요 기능
- 카테고리별 제휴 업체 조회, 검색, 정렬(현재 제휴 우선/등록순/종료일 마감순)
- 제휴 기간 외 카드 비활성화 표시
- 파트너 상세 페이지(혜택/이용 조건/태그/이미지 캐러셀)
- 제안하기 폼(이메일 발송)
- Admin 로그인 및 CRUD 관리
- 다크모드 지원
- Vercel Analytics / Speed Insights 연동

## 기술 스택
- Next.js 16 (App Router)
- React 19
- Supabase (DB)
- Tailwind CSS
- Vercel (배포/분석)

## 로컬 실행
```bash
npm install
npm run dev
```

## 환경 변수
`.env` 파일을 생성하고 `.env.example`을 참고하여 설정하세요.

```env
# Admin credentials
ADMIN_ID=admin
ADMIN_PASSWORD=change-me
ADMIN_SESSION_SECRET=replace-with-long-random-string

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Naver SMTP (제안 메일 발송)
NAVER_SMTP_USER=your-naver-id@naver.com
NAVER_SMTP_PASS=your-naver-smtp-password
SUGGEST_NOTIFY_EMAIL=your-naver-id@naver.com

# Site URL (SEO)
NEXT_PUBLIC_SITE_URL=https://your-deployment-url.com
```

## 배포
- Vercel을 기준으로 설정되었습니다.
- Vercel 환경 변수에 `.env` 내용을 동일하게 등록하세요.

## 릴리즈(태그 포함)
```bash
npm run release -- patch
```

## 관리자 기능
- `/admin/login`에서 로그인 후 `/admin`에서 관리
- 카테고리/파트너 CRUD
- 이미지 URL 추가/정렬/삭제

## 라이선스
CC BY-NC 4.0 (비상업적 목적에 한해 사용 가능)
