type ResponsiveImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
};

const localImage = /^\/images\/([a-z0-9-]+)\.(?:jpe?g|webp)$/i;
const responsiveStems = new Set(['bar', 'catering', 'decor', 'event', 'hero', 'makeup', 'photography', 'venue']);

export function ResponsiveImage({ src, alt, className, loading = 'lazy', fetchPriority }: ResponsiveImageProps) {
  const match = localImage.exec(src);
  const isBundled = match && responsiveStems.has(match[1].toLowerCase());
  const modernSrc = isBundled ? `/images/${match[1]}.webp` : src;
  const srcSet = isBundled
    ? [640, 960, 1200].map((width) => `/images/${match[1]}-${width}.webp ${width}w`).join(', ')
    : undefined;

  return (
    <img
      src={modernSrc}
      srcSet={srcSet}
      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 1200px"
      width={1200}
      height={800}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
    />
  );
}
