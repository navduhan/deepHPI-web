import { navigationItems } from "../content/siteContent";
import { withBasePath } from "../lib/base-path";

function isActive(currentPath, href) {
  return currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));
}

export function RouteLink({ href, navigate, className = "", children }) {
  const onClick = (event) => {
    if (href.startsWith("/")) {
      event.preventDefault();
      navigate(href);
    }
  };

  return (
    <a href={withBasePath(href)} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

export function AppShell({ currentPath, navigate, children }) {
  return (
    <div className="min-h-screen text-ink">
      <div className="mx-auto max-w-[1480px] px-4 py-4 md:px-6 md:py-6">
        <header className="paper-panel atlas-ring overflow-hidden rounded-[1.75rem]">
          <div className="px-5 py-5 lg:px-7">
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:items-center">
              <div className="flex justify-center xl:justify-start">
                <img src={withBasePath("/assets/site-logo.png")} alt="DeepHPI" className="h-18 w-auto object-contain md:h-22" />
              </div>

              <nav className="flex flex-wrap justify-center gap-2">
                {navigationItems.map((item) => {
                  const active = isActive(currentPath, item.href);
                  return (
                    <RouteLink
                      key={item.href}
                      href={item.href}
                      navigate={navigate}
                      className={`rounded-full border px-4 py-2.5 text-[13px] font-semibold tracking-[0.01em] shadow-sm transition ${
                        active
                          ? "border-panel bg-panel !text-white shadow-[0_10px_22px_rgba(18,61,103,0.18)]"
                          : "border-ink/14 bg-white text-ink hover:border-panel/42 hover:bg-panel/[0.04] hover:text-panel"
                      }`}
                    >
                      {item.label}
                    </RouteLink>
                  );
                })}
              </nav>

              <div className="hidden xl:block" />
            </div>
          </div>
        </header>

        <main className="mt-5 space-y-5">{children}</main>

        <footer className="mt-5 paper-panel rounded-[1.5rem] px-5 py-5 lg:px-7">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-ink/78">DeepHPI: deep learning framework for host-pathogen interaction prediction.</p>
            <div className="flex items-center gap-6">
              <img src={withBasePath("/assets/usu-logo.png")} alt="Utah State University" className="h-10 w-auto object-contain" />
              <img
                src={withBasePath("/assets/lab_logo_red.png")}
                alt="Kaundal Bioinformatics Laboratory"
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
