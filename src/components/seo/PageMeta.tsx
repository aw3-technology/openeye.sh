import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  /** og:type — "article" for blog posts and docs, "website" otherwise. */
  type?: "website" | "article";
  /** Social preview image (absolute or site-relative). Defaults to the site card. */
  image?: string;
  /** Keep the page out of search indexes (login, utility pages). */
  noindex?: boolean;
}

export const SITE_URL = "https://openeye.sh";

export function absoluteUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
}

/**
 * Per-route head tags: unique title, description, self-referencing
 * canonical, and matching og:url/og:title/og:description.
 */
export function PageMeta({ title, description, path, type = "website", image, noindex = false }: PageMetaProps) {
  const url = `${SITE_URL}${path}`;
  const imageUrl = absoluteUrl(image ?? "/og-image.webp");
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="OpenEye" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
