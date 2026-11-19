import { forwardRef, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string };
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
  sizes?: string;
};

/** Bundled art is already sized for the phone, so a plain <img> is enough. */
const Image = forwardRef<HTMLImageElement, Props>(function Image(
  { src, fill, priority, unoptimized: _u, quality: _q, placeholder: _p, blurDataURL: _b, style, loading, ...props },
  ref,
) {
  return <img ref={ref} {...props} src={typeof src === "string" ? src : src.src}
    loading={priority ? "eager" : loading ?? "lazy"} decoding="async"
    style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
});

export default Image;
