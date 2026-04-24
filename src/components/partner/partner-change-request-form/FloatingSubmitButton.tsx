import SubmitButton from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";

export default function FloatingSubmitButton({
  children,
  pendingText,
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="pointer-events-none fixed bottom-safe-bottom-5 left-1/2 z-[45] flex -translate-x-1/2 px-4 md:left-auto md:right-[max(1.5rem,calc((100vw-72rem)/4+1.5rem))] md:translate-x-0 md:px-0">
      <SubmitButton
        pendingText={pendingText}
        disabled={disabled}
        className={cn(
          "pointer-events-auto h-14 w-[calc(100vw-2rem)] max-w-sm rounded-full px-6 text-base shadow-floating sm:w-auto sm:min-w-[12rem]",
          className,
        )}
      >
        {children}
      </SubmitButton>
    </div>
  );
}
