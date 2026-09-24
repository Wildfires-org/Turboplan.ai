interface LayoutWrapperProps {
  children: React.ReactNode;
}

// Every route is full-bleed and manages its own container: home and the
// catalog pages (listings, project and template detail) use the homepage
// layout system, checkout / 404 / error center their own glass panel, and the
// Fumadocs DocsLayout under /docs needs full width for its sidebar + content +
// TOC columns.
export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return <div className="flex w-full flex-col">{children}</div>;
}
