import type { ComponentPropsWithRef } from "react";

/** Blob previews and arbitrary operator URLs need native image semantics. */
export default function PlainImage(props: ComponentPropsWithRef<"img">) {
  // eslint-disable-next-line @next/next/no-img-element -- native preview/unknown URL boundary
  return <img {...props} alt={props.alt ?? ""} />;
}
