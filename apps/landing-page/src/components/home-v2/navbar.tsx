"use client";

import { useEffect, useRef, useState } from "react";

import { motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSession } from "@wildfires-org/turboplan-auth/client";
import { OmniSearch } from "@wildfires-org/turboplan-search/client";

import { useSearch } from "@/hooks/use-search";
import { useAnalytics } from "@/hooks/useAnalytics";
import useBreakpoint from "@/hooks/useBreakpoint";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useSearchVisibilityStore } from "@/stores/search-visibility-store";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";
import { UserAvatarDropdown } from "../top-bar/user-avatar-dropdown";
import { PAGE_CONTAINER, PAGE_GUTTER } from "./ui/layout";
import { EASE_OUT } from "./ui/motion";

type NavLink = {
  label: string;
  href: string;
  event: string;
  active: boolean;
};

const MOUNT_POLL_MS = 250;

// Homepage sections mount inside the page's Suspense boundary, so a target may
// not be in the DOM when an effect runs — poll until it appears, then observe.
// Returns a cleanup function.
const observeWhenMounted = (
  elementId: string,
  callback: IntersectionObserverCallback,
  threshold: number,
) => {
  let observer: IntersectionObserver | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  const attach = () => {
    const target = document.getElementById(elementId);
    if (!target) {
      return false;
    }
    observer = new IntersectionObserver(callback, { threshold });
    observer.observe(target);
    return true;
  };

  if (!attach()) {
    interval = setInterval(() => {
      if (attach() && interval) {
        clearInterval(interval);
        interval = null;
      }
    }, MOUNT_POLL_MS);
  }

  return () => {
    observer?.disconnect();
    if (interval) {
      clearInterval(interval);
    }
  };
};

const linkClasses =
  "font-inter text-body-md font-normal text-egray-800 transition-colors duration-200 hover:text-egray-900";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isContactInView, setIsContactInView] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { captureEvent } = useAnalytics();

  const session = useSession();
  const isAuthenticated = !!session?.user;

  const [search, setSearch] = useSearch();
  const isLargeScreen = useBreakpoint("lg");
  const isHeroSearchVisible = useSearchVisibilityStore(
    (state) => state.isHeroSearchVisible,
  );
  // Segment-aware match — a bare `includes()` would light up "Projects" on
  // e.g. /docs/guides/projects-and-workspaces.
  const isOnRoute = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  const isOnCatalogRoute = isOnRoute(routing.catalog());
  const showHeaderSearch =
    isOnCatalogRoute && !isHeroSearchVisible && isLargeScreen;

  const navLinks: NavLink[] = [
    {
      label: "Pricing",
      href: routing.pricing(),
      event: events.PRICING_NAV_CLICKED,
      active: false,
    },
    {
      label: "Projects",
      href: routing.catalog(),
      event: events.PROJECTS_CLICKED,
      active: isOnCatalogRoute,
    },
    {
      label: "Docs",
      href: routing.docs(),
      event: events.DOCS_CLICKED,
      active: isOnRoute(routing.docs()),
    },
    {
      label: "Contact",
      href: routing.contact(),
      event: events.CONTACT_CLICKED,
      // routing.contact() is an in-page anchor (/#contact), so the pathname
      // never matches — track the section's visibility instead.
      active: pathname === "/" && isContactInView,
    },
  ];

  // Auto-measure mobile menu height for smooth open/close animation.
  useEffect(() => {
    if (mobileOpen && menuRef.current) {
      setMenuHeight(menuRef.current.scrollHeight);
    } else {
      setMenuHeight(0);
    }
  }, [mobileOpen]);

  // Highlight "Contact" while the homepage's #contact section is in view.
  useEffect(() => {
    if (pathname !== "/") {
      setIsContactInView(false);
      return;
    }
    return observeWhenMounted(
      "contact",
      ([entry]) => setIsContactInView(entry.isIntersecting),
      0.4,
    );
  }, [pathname]);

  // Auto-hide the navbar once the footer bar scrolls into view.
  // Home only — on short subpages the footer is visible on load and
  // would permanently hide the navbar.
  useEffect(() => {
    if (pathname !== "/") {
      setHidden(false);
      return;
    }

    return observeWhenMounted(
      "footer-bar",
      ([entry]) => setHidden(entry.isIntersecting),
      0.5,
    );
  }, [pathname]);

  const handleNavClick = (event: string) => {
    captureEvent(event);
  };

  const handleSignInClick = () => {
    captureEvent(events.SIGN_IN_CLICKED);
  };

  const handleCreateProject = () => {
    captureEvent(events.TRY_IT_CLICKED);
    router.push(routing.home({ tryIt: "true" }));
  };

  const handleMobileCreateProject = () => {
    setMobileOpen(false);
    handleCreateProject();
  };

  return (
    <nav
      className={cn(
        // Transparent full-width wrapper — only the glass pill is interactive,
        // so the gutters around it never swallow clicks on the page below.
        "pointer-events-none sticky top-0 z-50 w-full pt-3 lg:pt-4",
        PAGE_GUTTER,
        "transition-[translate,opacity] duration-300 ease-out-expo",
        hidden && "-translate-y-full opacity-0",
      )}
      aria-label="Main navigation"
    >
      <div className={cn(PAGE_CONTAINER, !hidden && "pointer-events-auto")}>
        <div className="glass flex h-16 items-center justify-between rounded-[20px] pl-4 pr-2 lg:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex w-[180px] shrink-0 items-center sm:w-[200px] lg:w-[210px]"
          >
            <Image
              src={brand.logo}
              alt={brand.name}
              width={275}
              height={45}
              className="h-auto w-full"
              priority
            />
          </Link>

          {/* Center — nav links, replaced by OmniSearch on catalog routes */}
          <div className="hidden flex-1 items-center justify-center px-8 lg:flex">
            {showHeaderSearch ? (
              <motion.div
                initial={{ opacity: 0, transform: "translateX(12px)" }}
                animate={{ opacity: 1, transform: "translateX(0px)" }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="mx-4 max-w-screen-lg flex-1"
              >
                <OmniSearch.Root
                  variant="compact"
                  value={search}
                  onValueChange={setSearch}
                >
                  <OmniSearch.Input placeholder="Search agencies, offices and projects..." />
                  <OmniSearch.Overlay className="top-[80px]" />
                  <OmniSearch.Content />
                </OmniSearch.Root>
              </motion.div>
            ) : (
              <div className="flex items-center gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => handleNavClick(link.event)}
                    className={cn(
                      linkClasses,
                      link.active && "font-medium text-brand-800",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Desktop right side */}
          <div className="hidden shrink-0 items-center gap-[18px] lg:flex">
            {isAuthenticated && session ? (
              <UserAvatarDropdown session={session} />
            ) : (
              <Link
                href={routing.signIn()}
                onClick={handleSignInClick}
                className={linkClasses}
              >
                Sign In
              </Link>
            )}
            <CreateProjectButton onClick={handleCreateProject} />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="press flex size-11 items-center justify-center rounded-[14px] text-egray-700 hover:bg-white/60 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>

        {/* Mobile menu — glass panel under the pill, animated auto-height.
          max-height is the one layout-bound property the standards tolerate
          (accordion-style collapse); kept short at 250ms, paired with a fade.
          The clipping wrapper carries no styling of its own; the vertical
          padding gives the panel's shadow room inside the overflow clip. */}
        <div
          ref={menuRef}
          className="overflow-hidden transition-[max-height,opacity] duration-250 ease-out-expo lg:hidden"
          style={{
            maxHeight: mobileOpen ? `${menuHeight}px` : "0px",
            opacity: mobileOpen ? 1 : 0,
          }}
        >
          <div className="px-0.5 pb-6 pt-2">
            <div className="glass flex flex-col gap-4 rounded-[20px] px-5 pb-5 pt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => {
                    handleNavClick(link.event);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "py-1 font-inter text-body-md font-normal text-egray-800",
                    link.active && "font-medium text-brand-800",
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <hr className="border-egray-200/60" />

              {isAuthenticated ? (
                <>
                  <Link
                    href={routing.dashboard()}
                    onClick={() => setMobileOpen(false)}
                    className="py-1 font-inter text-body-md font-normal text-egray-800"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={routing.profile()}
                    onClick={() => setMobileOpen(false)}
                    className="py-1 font-inter text-body-md font-normal text-egray-800"
                  >
                    Profile
                  </Link>
                  <Link
                    href={routing.settings()}
                    onClick={() => setMobileOpen(false)}
                    className="py-1 font-inter text-body-md font-normal text-egray-800"
                  >
                    Settings
                  </Link>
                  <Link
                    href={routing.signOut()}
                    onClick={() => setMobileOpen(false)}
                    className="py-1 font-inter text-body-md font-normal text-egray-800"
                  >
                    Log Out
                  </Link>
                </>
              ) : (
                <Link
                  href={routing.signIn()}
                  onClick={() => {
                    handleSignInClick();
                    setMobileOpen(false);
                  }}
                  className="py-1 font-inter text-body-md font-normal text-egray-800"
                >
                  Sign In
                </Link>
              )}

              <button
                type="button"
                onClick={handleMobileCreateProject}
                className="btn-primary press inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 font-inter text-body-md font-medium"
              >
                Create Project
                <ArrowUpRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface CreateProjectButtonProps {
  onClick: () => void;
}

const CreateProjectButton = ({ onClick }: CreateProjectButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-primary press inline-flex h-10 items-center gap-2 rounded-xl px-5 font-inter text-body-md font-medium"
    >
      Create Project
      <ArrowUpRight className="size-4" />
    </button>
  );
};
