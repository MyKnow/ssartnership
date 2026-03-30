import Input from "@/components/ui/Input";

export default function MmUsernameInput({
  name = "username",
  value,
  onChange,
  disabled = false,
}: {
  name?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
}) {
  return (
    <Input
      name={name}
      value={value}
      onChange={onChange}
      placeholder="MM 아이디"
      type="text"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      disabled={disabled}
      required
    />
  );
}
