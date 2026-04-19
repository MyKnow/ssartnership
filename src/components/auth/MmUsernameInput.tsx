import { forwardRef } from "react";
import Input from "@/components/ui/Input";

type MmUsernameInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "autoComplete" | "autoCapitalize" | "autoCorrect" | "spellCheck" | "inputMode"
>;

const MmUsernameInput = forwardRef<HTMLInputElement, MmUsernameInputProps>(
  function MmUsernameInput(
    {
      name = "username",
      placeholder = "예시: myknow",
      required = true,
      ...props
    },
    ref,
  ) {
    return (
      <Input
        ref={ref}
        name={name}
        placeholder={placeholder}
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        required={required}
        {...props}
      />
    );
  },
);

export default MmUsernameInput;
