import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>404 | OpenEye</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="font-mono text-xs text-muted-foreground mb-4">
            Error 404
          </div>
          <h1 className="mb-4 text-4xl font-light font-display">Page not found</h1>
          <p className="mb-8 text-muted-foreground max-w-md mx-auto">
            The page <code className="font-mono text-sm bg-foreground/5 px-1.5 py-0.5 rounded">{location.pathname}</code> doesn't exist.
          </p>
          <Link
            to="/"
            className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
          >
            Back to Home
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
