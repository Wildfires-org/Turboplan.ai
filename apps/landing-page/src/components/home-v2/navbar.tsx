"use client";

import { useEffect, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
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

type NavLink = {
  label: string;
  href: string;
  event: string;
  active: boolean;
};

const linkClasses =
  "font-inter text-body-md font-normal text-egray-800 transition-colors duration-200 hover:text-egray-900";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
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
      active: pathname === routing.contact(),
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

  // Auto-hide the navbar once the footer bar scrolls into view.
  // Home only — on short subpages the footer is visible on load and
  // would permanently hide the navbar.
  useEffect(() => {
    if (pathname !== "/") {
      setHidden(false);
      return;
    }

    // The footer mounts inside the page's Suspense boundary, so it may not
    // be in the DOM yet when this effect runs — poll until it appears.
    let observer: IntersectionObserver | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      const target = document.getElementById("footer-bar");
      if (!target) {
        return false;
      }
      observer = new IntersectionObserver(
        ([entry]) => setHidden(entry.isIntersecting),
        { threshold: 0.5 },
      );
      observer.observe(target);
      return true;
    };

    if (!attach()) {
      interval = setInterval(() => {
        if (attach() && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 250);
    }

    return () => {
      observer?.disconnect();
      if (interval) {
        clearInterval(interval);
      }
    };
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
        "sticky top-0 z-50 w-full bg-[rgba(244,249,247,0.40)] backdrop-blur-[10px]",
        "transition-all duration-500 ease-out-expo",
        hidden && "-translate-y-full opacity-0",
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-[79px] max-w-[1440px] items-center justify-between self-stretch px-6 py-[32px] lg:px-[100px]">
        {/* Logo */}
        <Link
          href="/"
          className="flex w-[252px] shrink-0 items-center sm:w-[220px] lg:w-[275px]"
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
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, width: 500, x: 30 }}
                animate={{ opacity: 1, width: "auto", x: 0 }}
                exit={{ opacity: 0, width: 530, x: 10 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="mx-4 max-w-screen-lg flex-1"
                style={{ transformOrigin: "left center" }}
              >
                <OmniSearch.Root
                  variant="compact"
                  value={search}
                  onValueChange={setSearch}
                >
                  <OmniSearch.Input placeholder="Search agencies, offices and projects..." />
                  <OmniSearch.Overlay className="top-[79px]" />
                  <OmniSearch.Content />
                </OmniSearch.Root>
              </motion.div>
            </AnimatePresence>
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
          className="flex size-11 items-center justify-center rounded-lg text-egray-700 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu — animated auto-height */}
      <div
        ref={menuRef}
        className="overflow-hidden border-t border-egray-100 bg-brandAlt-100 transition-all duration-300 ease-out-expo lg:hidden"
        style={{
          maxHeight: mobileOpen ? `${menuHeight}px` : "0px",
          opacity: mobileOpen ? 1 : 0,
        }}
      >
        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
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

          <hr className="border-egray-100" />

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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] bg-brandAlt-600 px-5 py-3 font-inter text-body-md font-medium text-white"
          >
            Create Project
            <ArrowUpRight className="size-4" />
          </button>
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
      className={cn(
        "group/cta relative inline-flex items-center gap-2 overflow-hidden rounded-[16px] bg-brandAlt-600 px-[32px] py-[12px]",
        "font-inter text-body-md font-medium text-white",
        "transition-all duration-300 ease-out-expo",
        "hover:-translate-y-px hover:shadow-ebutton",
        "active:translate-y-0",
      )}
    >
      {/* Floating deco ellipse — scales up and fades on hover */}
      <Image
        src="/images/button-deco.svg"
        alt=""
        width={109}
        height={69}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-[14px] h-[69px] w-[109px] animate-btn-deco-float blur-[13.65px] transition-all duration-500 ease-out-expo group-hover/cta:scale-[3] group-hover/cta:opacity-0"
      />
      {/* Glow flood — radial expansion from deco position */}
      <span className="pointer-events-none absolute left-[15%] top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand-deco opacity-0 transition-all duration-500 ease-out-expo group-hover/cta:scale-100 group-hover/cta:opacity-100" />
      <span className="relative z-10 flex items-center gap-2">
        Create Project
        <ArrowUpRight className="size-4" />
      </span>
    </button>
  );
};
