import type { CSSProperties, ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { source } from "@/lib/source";

interface DocsRootLayoutProps {
  children: ReactNode;
}

// Height of the global site <Navbar /> (see navbar.tsx: `h-[79px]` inner
// container). Fumadocs positions its sidebar + right-side TOC off the
// `--fd-nav-height` CSS variable (defaults to 0px when its own nav is
// disabled). Setting it to the real navbar height on the DocsLayout container
// pushes the sidebar/TOC below our global navbar instead of underneath it.
const NAVBAR_HEIGHT = "79px";

// `nav` is disabled: the site already renders a global <Navbar />/<SiteFooter />
// around every route (root layout), so DocsLayout only supplies the docs
// sidebar + right-side TOC chrome — no second top bar.
//
// `themeSwitch` is disabled: this app has no dark-mode design system, so the
// "Toggle Theme" button is removed (next-themes itself is disabled via
// RootProvider's theme.enabled=false in the root layout).
export default function DocsRootLayout({ children }: DocsRootLayoutProps) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ enabled: false }}
      themeSwitch={{ enabled: false }}
      containerProps={{
        style: { "--fd-nav-height": NAVBAR_HEIGHT } as CSSProperties,
      }}
    >
      {children}
    </DocsLayout>
  );
}
