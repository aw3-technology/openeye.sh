import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
}

const SITE_URL = "https://openeye.sh";

/**
 * Per-route head tags: unique title, description, self-referencing
 * canonical, and matching og:url/og:title/og:description.
 */
export function PageMeta({ title, description, path }: PageMetaProps) {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}