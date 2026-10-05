"use client";

import {
  createContext,
  useContext,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { buildGetFormHref } from "@/components/ui/navigation-form-href";

const NavigationFormPendingContext = createContext(false);

/** True while the surrounding `NavigationForm` navigation is still rendering. */
export function useNavigationFormPending() {
  return useContext(NavigationFormPendingContext);
}

/**
 * GET filter form that navigates client-side inside a transition, so a nested
 * `SubmitButton` stays busy until the filtered route has rendered.
 *
 * `useFormStatus` only tracks function actions; string-action forms, including
 * `next/form`, never report `pending`. Without JavaScript the native
 * `method="get"` submission still applies the same query string.
 */
export default function NavigationForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const href = buildGetFormHref(
      action,
      new FormData(event.currentTarget, submitter),
    );
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <form
      action={action}
      method="get"
      className={className}
      aria-busy={pending || undefined}
      onSubmit={handleSubmit}
    >
      <NavigationFormPendingContext.Provider value={pending}>
        {children}
      </NavigationFormPendingContext.Provider>
    </form>
  );
}
