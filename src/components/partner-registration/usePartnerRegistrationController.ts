"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  branchRowHasValue,
  parseInitialBranchEditorRows,
  serializeBranchRows,
  type BranchEditorRow,
} from "@/components/partner-branches/PartnerBranchListEditor";
import {
  getPartnerRegistrationStepErrors,
  getPartnerRegistrationStepIndex,
  PARTNER_REGISTRATION_STEPS,
  type PartnerRegistrationStepId,
} from "./registration-steps";
import type { AdminPartnerFileBenefitActionType } from "@/lib/admin-partner-file-import";
import {
  COUPON_ONLY_BENEFIT_TEXT,
  COUPON_ONLY_CONDITION_TEXT,
  getBenefitListingMode,
  type BenefitListingMode,
} from "@/lib/partner-coupon-only";
import {
  inferPartnerBranchScopeType,
  isMultiBranchScopeType,
  normalizePartnerBranchScopeType,
  type PartnerBranchScopeType,
} from "@/lib/partner-branch-registration";
import {
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  PARTNER_REGISTRATION_FIELD_ORDER,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  validatePartnerRegistrationInput,
  type PartnerRegistrationActionState,
  type PartnerRegistrationFieldErrors,
  type PartnerRegistrationFieldName,
  type PartnerRegistrationFormState,
} from "@/lib/partner-registration";
import type { PartnerServiceMode } from "@/lib/partner-service-mode";

type BranchEntryMode = "single" | "multi";

export type PartnerRegistrationWebAction = (
  previousState: PartnerRegistrationActionState,
  formData: FormData,
) => Promise<PartnerRegistrationActionState>;

export type PartnerRegistrationBrandProfile = {
  id: string;
  name: string;
  categoryLabel?: string | null;
  detailDescription?: string | null;
  inquiryLink?: string | null;
  brandPhone?: string | null;
};

function isBenefitActionType(
  value: string,
): value is AdminPartnerFileBenefitActionType {
  return PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.some(
    (option) => option.value === value,
  );
}

function getInitialServiceMode(
  initialValues?: Partial<PartnerRegistrationFormState>,
) {
  return initialValues?.serviceMode === "online" ? "online" : "offline";
}

function getInitialBenefitActionType(
  initialValues?: Partial<PartnerRegistrationFormState>,
) {
  return initialValues?.benefitActionType &&
    isBenefitActionType(initialValues.benefitActionType)
    ? initialValues.benefitActionType
    : "external_link";
}

function getInitialBranchEntryMode(
  initialValues: Partial<PartnerRegistrationFormState> | undefined,
  serviceMode: PartnerServiceMode,
): BranchEntryMode {
  if (serviceMode === "online") {
    return "single";
  }
  const initialScopeType = normalizePartnerBranchScopeType(
    initialValues?.branchScopeType,
    serviceMode,
  );
  return isMultiBranchScopeType(initialScopeType) ||
    Boolean(initialValues?.branchListText?.trim())
    ? "multi"
    : "single";
}

function getMultiBranchFallbackScopeType(
  initialValues: Partial<PartnerRegistrationFormState> | undefined,
  serviceMode: PartnerServiceMode,
): PartnerBranchScopeType {
  const initialScopeType = normalizePartnerBranchScopeType(
    initialValues?.branchScopeType,
    serviceMode,
  );
  return isMultiBranchScopeType(initialScopeType)
    ? initialScopeType
    : "selected_direct_branches";
}

function scrollToElement(element?: HTMLElement | null) {
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  window.requestAnimationFrame(() => {
    element.focus({ preventScroll: true });
  });
}

export function usePartnerRegistrationController({
  webAction,
  initialWebState = PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  initialValues,
  brandProfiles,
}: {
  webAction: PartnerRegistrationWebAction;
  initialWebState?: PartnerRegistrationActionState;
  initialValues?: Partial<PartnerRegistrationFormState>;
  brandProfiles: PartnerRegistrationBrandProfile[];
}) {
  const [activeStep, setActiveStep] =
    useState<PartnerRegistrationStepId>("brand");
  const [registrationMode, setRegistrationMode] = useState(
    initialValues?.registrationMode ?? "full_new",
  );
  const [serviceMode, setServiceMode] = useState<PartnerServiceMode>(() =>
    getInitialServiceMode(initialValues),
  );
  const [branchEntryMode, setBranchEntryMode] = useState<BranchEntryMode>(() =>
    getInitialBranchEntryMode(
      initialValues,
      getInitialServiceMode(initialValues),
    ),
  );
  const [benefitActionType, setBenefitActionType] =
    useState<AdminPartnerFileBenefitActionType>(() =>
      getInitialBenefitActionType(initialValues),
    );
  const [benefitListingMode, setBenefitListingMode] =
    useState<BenefitListingMode>(() =>
      getBenefitListingMode({
        benefits: initialValues?.benefits,
        conditions: initialValues?.conditions,
      }),
    );
  const [branchRows, setBranchRows] = useState<BranchEditorRow[]>(() =>
    parseInitialBranchEditorRows(initialValues?.branchListText),
  );
  const [webState, webFormAction] = useActionState(
    webAction,
    initialWebState,
  );
  const [clientFieldErrors, setClientFieldErrors] =
    useState<PartnerRegistrationFieldErrors>({});
  const fieldRefs = useRef<
    Partial<Record<PartnerRegistrationFieldName, HTMLElement | null>>
  >({});
  const formRef = useRef<HTMLFormElement | null>(null);
  const fieldErrors = useMemo(
    () => ({ ...clientFieldErrors, ...(webState.fieldErrors ?? {}) }),
    [clientFieldErrors, webState.fieldErrors],
  );
  const effectiveBenefitActionType = benefitActionType;
  const activeBranchRows = useMemo(
    () => (branchEntryMode === "multi" ? branchRows : []),
    [branchEntryMode, branchRows],
  );
  const branchListText = useMemo(
    () => (branchEntryMode === "multi" ? serializeBranchRows(branchRows) : ""),
    [branchEntryMode, branchRows],
  );
  const inferredBranchScopeType = useMemo(() => {
    if (serviceMode === "online") {
      return "online";
    }
    if (branchEntryMode === "single") {
      return "single_location";
    }
    return inferPartnerBranchScopeType({
      serviceMode,
      branches: activeBranchRows.filter(branchRowHasValue),
      fallback: getMultiBranchFallbackScopeType(initialValues, serviceMode),
    });
  }, [activeBranchRows, branchEntryMode, initialValues, serviceMode]);
  const currentStepIndex = getPartnerRegistrationStepIndex(activeStep);
  const isLastStep =
    currentStepIndex === PARTNER_REGISTRATION_STEPS.length - 1;

  useEffect(() => {
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => fieldErrors[fieldName],
    );
    if (firstInvalid) {
      scrollToElement(fieldRefs.current[firstInvalid]);
    }
  }, [fieldErrors]);

  function focusFirstStepError(errors: PartnerRegistrationFieldErrors) {
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => errors[fieldName],
    );
    if (firstInvalid) {
      scrollToElement(fieldRefs.current[firstInvalid]);
    }
  }

  function validateCurrentStep() {
    if (!formRef.current) {
      return true;
    }
    const validation = validatePartnerRegistrationInput(
      new FormData(formRef.current),
    );
    const stepErrors = getPartnerRegistrationStepErrors(
      activeStep,
      validation.fieldErrors,
    );
    if (Object.keys(stepErrors).length === 0) {
      setClientFieldErrors({});
      return true;
    }
    setClientFieldErrors(stepErrors);
    focusFirstStepError(stepErrors);
    return false;
  }

  function goToStep(stepId: PartnerRegistrationStepId) {
    const targetIndex = getPartnerRegistrationStepIndex(stepId);
    if (targetIndex <= currentStepIndex || validateCurrentStep()) {
      setActiveStep(stepId);
    }
  }

  function goToNextStep() {
    if (!validateCurrentStep()) {
      return;
    }
    const nextStep = PARTNER_REGISTRATION_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  }

  function goToPreviousStep() {
    const previousStep = PARTNER_REGISTRATION_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setActiveStep(previousStep.id);
    }
  }

  function applyBrandProfile(profileId: string) {
    const profile = brandProfiles.find((candidate) => candidate.id === profileId);
    if (!profile || !formRef.current) {
      return;
    }
    const assignValue = (
      name: PartnerRegistrationFieldName,
      value?: string | null,
    ) => {
      const element = formRef.current?.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[name="${name}"]`);
      if (element && value !== undefined && value !== null) {
        element.value = value;
      }
    };
    assignValue("brandName", profile.name);
    assignValue("categoryLabel", profile.categoryLabel);
    assignValue("detailDescription", profile.detailDescription);
    assignValue("inquiryLink", profile.inquiryLink);
    assignValue("brandPhone", profile.brandPhone);
    setClientFieldErrors({});
  }

  function handleWebSubmit(event: FormEvent<HTMLFormElement>) {
    const validation = validatePartnerRegistrationInput(
      new FormData(event.currentTarget),
    );
    if (Object.keys(validation.fieldErrors).length === 0) {
      setClientFieldErrors({});
      return true;
    }
    event.preventDefault();
    setClientFieldErrors(validation.fieldErrors);
    const firstInvalid = PARTNER_REGISTRATION_FIELD_ORDER.find(
      (fieldName) => validation.fieldErrors[fieldName],
    );
    const targetStep = PARTNER_REGISTRATION_STEPS.find((step) =>
      step.fields.some((fieldName) => fieldName === firstInvalid),
    );
    if (targetStep) {
      setActiveStep(targetStep.id);
    }
    return false;
  }

  function handleServiceModeChange(value: PartnerServiceMode) {
    setServiceMode(value);
    if (value === "online") {
      setBranchEntryMode("single");
    }
  }

  function handleBenefitActionTypeChange(
    value: AdminPartnerFileBenefitActionType,
  ) {
    setBenefitActionType(value);
  }

  function handleBenefitListingModeChange(value: BenefitListingMode) {
    setBenefitListingMode(value);
    if (value === "coupon_only") {
      setBenefitActionType("none");
      setClientFieldErrors((current) => {
        const {
          benefitActionLink: _benefitActionLink,
          benefits: _benefits,
          conditions: _conditions,
          ...nextErrors
        } = current;
        void _benefitActionLink;
        void _benefits;
        void _conditions;
        return nextErrors;
      });
    }
  }

  function registerFieldRef(fieldName: PartnerRegistrationFieldName) {
    return (element: HTMLElement | null) => {
      fieldRefs.current[fieldName] = element;
    };
  }

  return {
    activeStep,
    registrationMode,
    serviceMode,
    branchEntryMode,
    benefitActionType,
    benefitListingMode,
    branchRows,
    webState,
    webFormAction,
    fieldErrors,
    formRef,
    effectiveBenefitActionType,
    branchListText,
    inferredBranchScopeType,
    currentStepIndex,
    isLastStep,
    setRegistrationMode,
    setBranchEntryMode,
    setBranchRows,
    clearClientFieldErrors: () => setClientFieldErrors({}),
    registerFieldRef,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    applyBrandProfile,
    handleWebSubmit,
    handleServiceModeChange,
    handleBenefitActionTypeChange,
    handleBenefitListingModeChange,
  };
}

export const PARTNER_REGISTRATION_COUPON_DEFAULTS = {
  benefits: COUPON_ONLY_BENEFIT_TEXT,
  conditions: COUPON_ONLY_CONDITION_TEXT,
} as const;
