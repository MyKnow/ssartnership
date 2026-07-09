import assert from "node:assert/strict";
import { describe, it } from "node:test";

const branchModulePromise = import("../src/lib/partner-branch-registration.ts");
const registrationModulePromise = import("../src/lib/partner-registration.ts");

describe("partner branch registration", () => {
  it("accepts branch rows without external branch codes and infers campus from address", async () => {
    const { normalizePartnerBranchRows } = await branchModulePromise;

    const branches = normalizePartnerBranchRows(
      [
        {
          benefitGroupLabel: "기본 혜택",
          branchName: "역삼본점",
          address: "서울 강남구 테헤란로 212",
          branchCode: "",
          branchType: "직영",
        },
        {
          benefitGroupLabel: "기본 혜택",
          branchName: "",
          address: "서울 강남구 강남대로 382",
          branchType: "가맹",
        },
      ],
      {
        companyName: "카페 싸피",
        brandName: "카페 싸피",
        defaultBenefitGroupKey: "default",
        defaultBranchType: "direct",
      },
    );

    assert.equal(branches.errors.length, 0);
    assert.equal(branches.branches.length, 2);
    assert.equal(branches.branches[0]?.branchCode, null);
    assert.equal(branches.branches[0]?.branchKey.startsWith("auto-"), true);
    assert.deepEqual(branches.branches[0]?.campusSlugs, ["seoul"]);
    assert.equal(branches.branches[1]?.branchName, "서울 강남구 강남대로 382");
    assert.equal(branches.branches[1]?.branchType, "franchise");
  });

  it("parses pasted branch lists with minimum columns", async () => {
    const { parsePartnerBranchListText } = await branchModulePromise;

    const parsed = parsePartnerBranchListText(
      [
        "기본 혜택\t역삼본점\t서울 강남구 테헤란로 212",
        "기본 혜택\t\t서울 강남구 논현로 508\t\t가맹",
      ].join("\n"),
      {
        companyName: "카페 싸피",
        brandName: "카페 싸피",
        defaultBenefitGroupKey: "default",
        defaultBranchType: "direct",
      },
    );

    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.branches.length, 2);
    assert.equal(parsed.branches[0]?.benefitGroupKey, "default");
    assert.equal(parsed.branches[1]?.branchName, "서울 강남구 논현로 508");
    assert.equal(parsed.branches[1]?.branchType, "franchise");
  });

  it("requires branch lists only for multi-branch offline scopes", async () => {
    const { validatePartnerRegistrationInput } = await registrationModulePromise;

    const baseInput = {
      serviceMode: "offline",
      benefitActionType: "onsite",
      registrationMode: "full_new",
      branchScopeType: "selected_direct_branches",
      branchScopeNote: "",
      brandName: "카페 싸피",
      categoryLabel: "카페",
      location: "서울 강남구 테헤란로 212",
      benefits: "아메리카노 10% 할인",
      conditions: "싸트너십 인증",
      companyName: "카페 싸피",
      contactName: "김싸피",
      contactEmail: "partner@cafessafy.example",
      branchListText: "",
    };

    const missingBranches = validatePartnerRegistrationInput(baseInput);
    assert.equal(
      missingBranches.fieldErrors.branchListText,
      "선택 지점 또는 다수 지점 범위는 적용 지점 목록을 입력하거나 XLSX로 업로드해 주세요.",
    );

    const withBranches = validatePartnerRegistrationInput({
      ...baseInput,
      branchListText: "기본 혜택\t역삼본점\t서울 강남구 테헤란로 212",
    });
    assert.equal(withBranches.fieldErrors.branchListText, undefined);
    assert.equal(withBranches.values.parsedBranches.length, 1);
    assert.deepEqual(withBranches.values.parsedBranches[0]?.campusSlugs, [
      "seoul",
    ]);

    const online = validatePartnerRegistrationInput({
      ...baseInput,
      serviceMode: "online",
      branchScopeType: "online",
      location: "",
      siteLink: "https://cafessafy.example.com",
      branchListText: "",
    });
    assert.equal(online.fieldErrors.branchListText, undefined);
    assert.equal(online.values.parsedBranches.length, 0);
  });
});
