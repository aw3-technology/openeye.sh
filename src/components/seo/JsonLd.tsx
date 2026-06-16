import { Helmet } from "react-helmet-async";

/**
 * Inject a schema.org JSON-LD block into <head> for the current route.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}