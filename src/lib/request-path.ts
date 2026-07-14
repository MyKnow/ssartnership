export const REQUEST_PATH_HEADER = "x-ssartnership-request-path";

type RequestUrl = {
  pathname: string;
  search: string;
};

type RequestHeaders = {
  get(name: string): string | null;
};

export function buildForwardedRequestPath({ pathname, search }: RequestUrl) {
  return `${pathname}${search}`;
}

export function getForwardedRequestPath(headers: RequestHeaders) {
  return headers.get(REQUEST_PATH_HEADER);
}
