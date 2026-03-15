export function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-foreground/[0.06]">
      <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="font-mono text-xs text-muted-foreground">
          © 2026 OpenEye. Apache 2.0 License.
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-muted-foreground">
          <a href="https://github.com/openeye-ai" className="hover:text-foreground transition-colors">GitHub</a>
          <span>openeye.sh</span>
          <span>Nebius.Build Hackathon — SF 2026</span>
        </div>
      </div>
    </footer>
  );
}
