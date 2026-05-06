# Form Validation And Benefit Visibility Refactor

## GitHub Issue

- Issue: `#15` 폼 검증 일원화와 혜택 공개 범위 고도화
- Base branch: `dev`
- Work branches target `dev` and must link PRs with `Refs #15`.

## Goals

- Add matching FE/BE validation for core forms.
- Keep `visibility` as brand card/detail visibility only.
- Add a separate benefit visibility scope for hiding benefit-specific information.
- Rename and remodel `예약 링크` into a broader benefit-use action.

## Validation Policy

- A form rule must exist on both sides:
  - FE: prevents avoidable submits, shows field-level errors, focuses the first invalid field.
  - BE: rejects invalid input at route/action/API boundaries with safe errors.
- Prefer one shared helper/schema imported by both FE and BE.
- If sharing is impractical, keep equivalent rules in paired modules and test both.
- Shared error codes/messages should be reused across admin, partner, and public flows.
- Search/filter inputs are lower priority unless they mutate data or trigger expensive server work.

## Core Form Inventory

### Already Uses Shared Or Paired Validation

- Member login and password flows
  - FE helpers: `validateMmUsername`, password checks in auth forms.
  - BE helpers: API shared MM auth parsers and validation helpers.
- Signup flow
  - FE helpers under signup form controller/helpers.
  - BE MM signup routes reuse MM username and SSAFY year validation.
- Partner review form
  - FE and BE use `validateReviewDraftInput`.
- Admin partner create/edit form
  - Server parser validates required fields, URLs, dates, applies-to, campus slugs.
  - FE has campus slug submit blocking; remaining fields need standardized field-error UX.
- Partner portal approval request form
  - Server action validates required fields, date range, URLs, applies-to, campus slugs.
  - FE has campus slug submit blocking; remaining fields need standardized field-error UX.
- Suggest form
  - FE validates required fields, email, URL.
  - BE `/api/suggest` must be checked and aligned with the same rule set.

### Priority Backlog For PR 2

- Admin company manager
  - Add FE validation for company create/update fields and align with admin server parsers.
- Admin member manager
  - Align edit/delete/manual-add field validation with server action errors.
- Admin push manager
  - Align audience, title/body, URL, and channel-specific validation with push helpers.
- Partner immediate-change form
  - Align thumbnail/images/link/tag validation with immediate-change action.
- Admin partner form
  - Move required/name/category/location/date/link/applies-to validation into a reusable form validation helper.
- Partner approval request form
  - Reuse the same partner form validation helper where fields overlap.

## Benefit Visibility Design Notes

- Keep current `visibility` values and meaning:
  - `public`: brand card/detail page can be listed and opened.
  - `confidential`: brand visibility requires login.
  - `private`: brand is hidden outside admin/partner operations.
- Add a separate benefit visibility field, defaulting to `public`.
- Minimum benefit visibility values:
  - `public`: benefit information is visible wherever the brand is visible.
  - `eligible_only`: benefit information is visible only to logged-in users whose member role matches `appliesTo`.
- Mask these fields for non-eligible viewers:
  - `benefits`
  - `conditions`
  - benefit-use action/link/method
  - CTAs that reveal the benefit flow
- Mask copy:
  - logged out: `로그인 후 조회 가능합니다.`
  - logged in but not eligible: `적용 대상만 조회 가능합니다.`
- SEO metadata and structured data must not include masked benefit text.

## Benefit Use Action Design Notes

- UI label should use `혜택 이용` instead of `예약 링크`.
- Target model: a single action type plus optional link.
- Initial action types:
  - `certification`: route to the ssartnership certification page.
  - `external_link`: route to the stored external link.
  - `onsite`: show onsite-use guidance only.
  - `none`: no benefit-use CTA.
- Compatibility:
  - Existing `reservation_link` data should behave as `external_link`.
  - Existing inquiry/contact data remains inquiry/contact unless explicitly migrated later.
- Tracking should rename future events around benefit-use while preserving backward compatibility for old reservation metrics.

## Planned PRs

1. `docs/form-validation-policy`
   - Add this policy and inventory.
   - Update `AGENTS.md` and `ssartnership-patterns`.

2. `refactor/shared-form-validation`
   - Add shared partner/admin/public form validation helpers.
   - Apply to priority core forms.
   - Add focused tests for helper parity and invalid submit paths.

3. `feat/benefit-visibility-scope`
   - Add DB/schema/domain/repository/mock fields.
   - Apply masking to card, detail, SEO, admin, and partner portal views.
   - Add target-audience based visibility tests.

4. `refactor/benefit-use-action`
   - Add benefit-use action model and UI labels.
   - Preserve existing reservation link compatibility.
   - Add action generation and tracking tests.
