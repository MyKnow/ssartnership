import Input from "@/components/ui/Input";

export default function MmUsernameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <Input
      value={value}
      onChange={onChange}
      placeholder="MM 아이디"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      required
    />
  );
}
