import type { RefObject } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { getFieldErrorClass } from "@/components/ui/form-field-state";

export default function SignupIdentityFields({
  username,
  year,
  locked,
  signupYears,
  usernameError,
  yearError,
  usernameRef,
  yearGroupRef,
  onUsernameChange,
  onYearChange,
}: {
  username: string;
  year: string;
  locked: boolean;
  signupYears: number[];
  usernameError?: string;
  yearError?: string;
  usernameRef: RefObject<HTMLInputElement | null>;
  yearGroupRef: RefObject<HTMLDivElement | null>;
  onUsernameChange: (value: string) => void;
  onYearChange: (value: string) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        SSAFY 기수
        <div
          ref={yearGroupRef}
          tabIndex={-1}
          className={getFieldErrorClass(
            Boolean(yearError),
            "grid grid-cols-3 gap-2 rounded-2xl",
          )}
        >
          {signupYears.map((optionYear) => {
            const selected = year === String(optionYear);
            return (
              <Button
                key={optionYear}
                type="button"
                variant={selected ? "primary" : "secondary"}
                className="w-full justify-center rounded-2xl"
                onClick={() => {
                  if (!locked) {
                    onYearChange(String(optionYear));
                  }
                }}
                disabled={locked}
                aria-invalid={Boolean(yearError) || undefined}
              >
                {optionYear === 0 ? "운영진" : `${optionYear}기`}
              </Button>
            );
          })}
        </div>
        {yearError ? <FormMessage variant="error">{yearError}</FormMessage> : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <MmUsernameInput
          ref={usernameRef}
          name="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          disabled={locked}
          aria-invalid={Boolean(usernameError) || undefined}
          className={getFieldErrorClass(Boolean(usernameError))}
        />
        {usernameError ? <FormMessage variant="error">{usernameError}</FormMessage> : null}
      </label>
    </>
  );
}
