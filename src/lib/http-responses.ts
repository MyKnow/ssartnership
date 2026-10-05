/** New JSON routes may reuse these safe responses without changing existing contracts. */
export const unauthorized = () => Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
export const forbidden = () => Response.json({ message: "접근 권한이 없습니다." }, { status: 403 });
export const payloadTooLarge = () => Response.json({ message: "요청 용량이 너무 큽니다." }, { status: 413 });
