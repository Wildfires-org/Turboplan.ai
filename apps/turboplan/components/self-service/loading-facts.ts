// Shown while the self-service signup is being processed. Every entry is a
// verifiable public fact with its source named — do not add marketing claims
// or numbers that cannot be checked.
export type LoadingFact = {
  text: string;
  source: string;
};

export const LOADING_FACTS: LoadingFact[] = [
  {
    text: "Between 2010 and 2018, a federal Environmental Impact Statement took 4.5 years on average to complete. The median was 3.5 years.",
    source: "CEQ, EIS Timelines (2010–2018)",
  },
  {
    text: "The average final EIS ran 661 pages — plus appendices. The median was 447 pages.",
    source: "CEQ, Length of EISs (2013–2018)",
  },
  {
    text: "The 2023 Fiscal Responsibility Act capped EISs at 150 pages and two years, and Environmental Assessments at 75 pages and one year.",
    source: "Fiscal Responsibility Act of 2023, NEPA amendments",
  },
  {
    text: "NEPA was signed into law on January 1, 1970 — New Year's Day. The statute itself is only a few pages long.",
    source: "42 U.S.C. § 4321 et seq.",
  },
  {
    text: "More than 80 countries have adopted environmental review laws modeled on NEPA.",
    source: "CEQ, NEPA: A Study of Its Effectiveness After 25 Years",
  },
  {
    text: "About 95% of federal NEPA decisions are categorical exclusions — not EAs or EISs.",
    source: "Council on Environmental Quality",
  },
  {
    text: "The Forest Service manages 193 million acres of national forests and grasslands — an area bigger than Texas.",
    source: "USDA Forest Service",
  },
  {
    text: "The Bureau of Land Management oversees about 245 million surface acres, roughly one in every ten acres in the United States.",
    source: "Bureau of Land Management",
  },
  {
    text: "About one in three U.S. homes sits in the wildland-urban interface, the fastest-growing land-use type in the country.",
    source: "Radeloff et al., PNAS (2018)",
  },
  {
    text: "Smokey Bear first appeared in 1944. His famous line, “Only you can prevent forest fires,” arrived in 1947.",
    source: "USDA Forest Service",
  },
  {
    text: "Yellowstone became the world's first national park in 1872 — almost a century before NEPA required anyone to study environmental impacts.",
    source: "National Park Service",
  },
];
