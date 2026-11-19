import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

import { appRouter } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean;
  prefetch?: boolean | null;
  scroll?: boolean;
  shallow?: boolean;
  legacyBehavior?: boolean;
  passHref?: boolean;
};

function toPath(href: Props["href"]): string {
  if (typeof href === "string") return href;
  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? "/"}${query}`;
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, replace, prefetch: _prefetch, scroll: _scroll, shallow: _shallow, legacyBehavior: _legacy, passHref: _pass, onClick, target, ...props },
  ref,
) {
  const path = toPath(href);
  const internal = path.startsWith("/") && !path.startsWith("//");
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !internal || target === "_blank") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (replace) appRouter.replace(path);
    else appRouter.push(path);
  };
  return <a ref={ref} href={path} target={target} onClick={handle} {...props} />;
});

export default Link;
