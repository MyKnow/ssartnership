import type { RefObject } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { getFieldErrorClass } from "@/components/ui/form-field-state";

export default function SignupIdentityFields({
  username,
  year,
  password,
  step,
  signupYears,
  usernameError,
  yearError,
  passwordError,
  usernameRef,
  yearGroupRef,
  passwordRef,
  onUsernameChange,
  onYearChange,
  onPasswordChange,
}: {
  username: string;
  year: string;
  password: string;
  step: "request" | "verify";
  signupYears: number[];
  usernameError?: string;
  yearError?: string;
  passwordError?: string;
  usernameRef: RefObject<HTMLInputElement | null>;
  yearGroupRef: RefObject<HTMLDivElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  onUsernameChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <MmUsernameInput
          ref={usernameRef}
          name="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          aria-invalid={Boolean(usernameError) || undefined}
          className={getFieldErrorClass(Boolean(usernameError))}
        />
        {usernameError ? <FormMessage variant="error">{usernameError}</FormMessage> : null}
      </label>

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
                variant={selected ? "primary" : "ghost"}
                className="w-full justify-center rounded-2xl"
                onClick={() => {
                  if (step !== "verify") {
                    onYearChange(String(optionYear));
                  }
                }}
                disabled={step === "verify"}
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
        사이트 비밀번호
        <PasswordInput
          ref={passwordRef}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
          aria-invalid={Boolean(passwordError) || undefined}
          className={getFieldErrorClass(Boolean(passwordError))}
        />
        {passwordError ? <FormMessage variant="error">{passwordError}</FormMessage> : null}
      </label>
    </>
  );
}
