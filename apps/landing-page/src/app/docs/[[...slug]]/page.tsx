import { findNeighbour } from "fumadocs-core/page-tree";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { docsMdxComponents } from "@/components/docs/docs-mdx";
import { DocsPageNav } from "@/components/docs/docs-page-nav";
import { DocsTOC, DocsTOCBar } from "@/components/docs/docs-toc";
import { SECTION_LEAD_CLASS } from "@/components/home-v2/ui/section-header";
import { brand } from "@/lib/brand";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

// Docs page title: the site's heading recipe (Geist, -0.04em), sized for a
// reading column rather than a hero.
const DOCS_TITLE_CLASS =
  "font-heading text-[32px] font-normal leading-[1.15] tracking-[-0.04em] text-balance text-egray-900 md:text-[40px]";

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;
  const neighbours = findNeighbour(source.pageTree, page.url);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      // #nd-page: Fumadocs reserves room for its fixed TOC with padding and
      // caps the width; the TOC is an in-flow sticky column here (see
      // DocsTOC), and below xl the section bar stacks above the article.
      container={{ className: "max-w-none gap-x-10 pt-0 pe-0 max-xl:flex-col" }}
      article={{ className: "gap-5 px-0 pt-0 pb-4 md:px-0 md:pt-6" }}
      breadcrumb={{
        className:
          "font-inter text-[13px] text-egray-700 [&_svg]:text-egray-500",
      }}
      tableOfContent={{ component: <DocsTOC /> }}
      // Always on: below md it also carries the sidebar drawer trigger.
      tableOfContentPopover={{ enabled: true, component: <DocsTOCBar /> }}
      footer={{ component: <DocsPageNav {...neighbours} /> }}
    >
      <div className="flex flex-col gap-3">
        <DocsTitle className={DOCS_TITLE_CLASS}>{page.data.title}</DocsTitle>
        <DocsDescription className={cn(SECTION_LEAD_CLASS, "mb-4")}>
          {page.data.description}
        </DocsDescription>
      </div>
      <DocsBody>
        <MDXContent components={docsMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      siteName: brand.name,
      type: "article",
      images: [{ url: brand.ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: [brand.ogImage],
    },
  };
}
