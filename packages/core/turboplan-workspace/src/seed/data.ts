/**
 * Seed data for publicly-listed organizations and their offices.
 *
 * Snapshot of the real organizations and offices from the staging database
 * (Neon project "neondb", ep-orange-smoke-a67supgm) as of 2026-07-28, including
 * their live logo and cover image URLs. Personal/user-created organizations
 * are excluded — only publicly-cataloged agencies and firms are seeded.
 */

import {
  OfficeStatus,
  OrganizationStatus,
  OrganizationType,
} from "@wildfires-org/turboplan-db/types";

export interface OrganizationSeed {
  name: string;
  shortName: string;
  slug: string;
  description: string;
  country: string;
  // Email domains that auto-affiliate a user with this org (and derive their
  // role) at first login.
  emailDomains?: string[];
  // Organization type. Defaults to GOVERNMENT at insert time when omitted.
  type?: OrganizationType;
  // Organization status. Defaults to ACTIVE at insert time when omitted.
  status?: OrganizationStatus;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface OfficeSeed {
  name: string;
  slug: string;
  description?: string;
  organizationSlug: string; // Reference to parent organization
  // Office status. Defaults to ACTIVE at insert time when omitted.
  status?: OfficeStatus;
  logoUrl?: string;
  coverImageUrl?: string;
}

/**
 * Organizations to seed (government agencies plus environmental-planning firms).
 */
export const ORGANIZATION_SEEDS: OrganizationSeed[] = [
  {
    name: "Bureau of Land Management",
    shortName: "BLM",
    slug: "blm",
    description:
      "An agency within the U.S. Department of the Interior that manages federal lands, predominantly in the western United States.",
    country: "USA",
    emailDomains: ["blm.gov"],
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/blm.svg",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/organization-4d172786-f15b-4879-8e1e-9d2c4649faf4-1785232623565.png",
  },
  {
    name: "Department of Transportation",
    shortName: "DOT",
    slug: "dot",
    description:
      "A federal Cabinet department of the U.S. government concerned with transportation.",
    country: "USA",
    emailDomains: ["dot.gov"],
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/dot.svg",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/organization-f0d98421-bdaa-49d8-96fc-9aef50279b11-1785234254255.png",
  },
  {
    name: "Department of Wildlife",
    shortName: "DOW",
    slug: "dow",
    description:
      "State-level agencies responsible for managing wildlife resources.",
    country: "USA",
    status: OrganizationStatus.ARCHIVED,
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/dow.svg",
  },
  {
    name: "National Park Service",
    shortName: "NPS",
    slug: "nps",
    description:
      "An agency of the U.S. Department of the Interior that manages all national parks, national monuments, and other conservation properties.",
    country: "USA",
    emailDomains: ["nps.gov"],
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/nps.svg",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/organization-ed110e76-81fd-4454-8fa6-a37c094af358-1785234244024.png",
  },
  {
    name: "Tennessee Valley Authority",
    shortName: "TVA",
    slug: "tva",
    description:
      "A federally owned electric utility corporation in the United States.",
    country: "USA",
    emailDomains: ["tva.gov"],
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/tva.svg",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/organization-02e02953-9a52-4cbe-b7a0-79a272ea43dd-1785234264005.png",
  },
  {
    name: "United States Forest Service",
    shortName: "USFS",
    slug: "usfs",
    description:
      "An agency of the U.S. Department of Agriculture that administers the nation's 154 national forests and 20 grasslands.",
    country: "USA",
    emailDomains: ["usda.gov"],
    logoUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/org-logos/usfs.svg",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/organization-c18998f6-a5ca-481e-8b21-7c8076b11c55-1785237826480.png",
  },
];

/**
 * Offices for the organizations above.
 */
export const OFFICE_SEEDS: OfficeSeed[] = [
  {
    name: "Alaska State Office",
    slug: "alaska-state-office",
    description:
      "The BLM Alaska State Office manages public lands across Alaska, overseeing district offices in Anchorage, Arctic, and Fairbanks.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-252ae2b5-aae5-4a43-b636-33d61dd30e59-1785231649848.png",
  },
  {
    name: "Albuquerque District Office",
    slug: "albuquerque-district-office",
    description:
      "A BLM district office managing public lands in central New Mexico around Albuquerque and the Rio Grande basin.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3215cf25-2702-4b5c-bda9-944bd95690a9-1785232200814.png",
  },
  {
    name: "Anchorage District Office",
    slug: "anchorage-district-office",
    description:
      "A BLM district office in Alaska serving the Anchorage and south-central Alaska region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c48bdf4f-bcc6-4e2a-8c49-2f44ac2d8ce2-1785231842769.png",
  },
  {
    name: "Arctic District Office",
    slug: "arctic-district-office",
    description:
      "A BLM district office managing public lands in the Arctic region of Alaska.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-49ef2189-7f67-4097-811e-2963802fc170-1785231852828.png",
  },
  {
    name: "Arizona State Office",
    slug: "arizona-state-office",
    description:
      "The BLM Arizona State Office manages 12.2 million acres of public land across Arizona, overseeing district offices including Arizona Strip, Colorado River, Gila, and Phoenix.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3e5c820d-577b-467d-8ea8-c187bd7ea838-1785231660308.png",
  },
  {
    name: "Arizona Strip District Office",
    slug: "arizona-strip-district-office",
    description:
      "A BLM district office managing the Arizona Strip region in northern Arizona, north of the Grand Canyon.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9401a2e9-b18e-4f73-8a39-b29a6344a969-1785231873864.png",
  },
  {
    name: "Battle Mountain District Office",
    slug: "battle-mountain-district-office",
    description:
      "A BLM district office managing public lands in the Battle Mountain region of central Nevada.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8b94d5e2-4fee-4c16-b945-919fa89a7634-1785232132181.png",
  },
  {
    name: "Boise District Office",
    slug: "boise-district-office",
    description:
      "A BLM district office managing public lands in southwestern Idaho around the Boise region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6466c62b-2443-436e-a73a-a957c383d6aa-1785232036493.png",
  },
  {
    name: "Burns District Office",
    slug: "burns-district-office",
    description:
      "A BLM district office managing public lands in the Burns and high desert region of eastern Oregon.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-cfe06caf-28a4-4d24-a0a2-bd519648d377-1785232253979.png",
  },
  {
    name: "California Desert District Office",
    slug: "california-desert-district-office",
    description:
      "A BLM district office managing public lands in the California Desert region, including the Mojave Desert and Death Valley area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a4fb57f3-1e6f-4033-9a2b-679ca8e591ca-1785231917936.png",
  },
  {
    name: "California State Office",
    slug: "california-state-office",
    description:
      "The BLM California State Office manages 15 million acres of public land across California, overseeing California Desert, Central California, and Northern California district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0debef8e-43a4-4a53-aa7e-32c36b30cb9a-1785231670883.png",
  },
  {
    name: "Canyon Country District Office",
    slug: "canyon-country-district-office",
    description:
      "A BLM district office managing public lands in southeastern Utah, including the Moab and Canyonlands area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-69ffc8c9-a5c9-41c0-ba1c-0b5684c5962d-1785232359645.png",
  },
  {
    name: "Carson City District Office",
    slug: "carson-city-district-office",
    description:
      "A BLM district office managing public lands in western Nevada around Carson City and the Sierra Nevada foothills.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-bc81bc1a-0012-496a-afd9-5e93f0b00b7d-1785232142363.png",
  },
  {
    name: "Central California District Office",
    slug: "central-california-district-office",
    description:
      "A BLM district office managing public lands in California's Central Valley and Sierra Nevada foothills.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-49f692c7-90ee-4769-8b14-691b0abc51d9-1785231928642.png",
  },
  {
    name: "Coeur d'Alene District Office",
    slug: "coeur-dalene-district-office",
    description:
      "A BLM district office managing public lands in the Idaho Panhandle around Coeur d'Alene.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6eb3ab81-34f9-468d-89f3-c9e145f1c8c8-1785232046246.png",
  },
  {
    name: "Color Country District Office",
    slug: "color-country-district-office",
    description:
      "A BLM district office managing public lands in southwestern Utah, including the Cedar City and Color Country region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-5084d5b7-7f59-4690-925e-1e0a064a2642-1785232373718.png",
  },
  {
    name: "Colorado River District Office",
    slug: "colorado-river-district-office",
    description:
      "A BLM district office managing public lands along the Colorado River in western Arizona.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-80343f5f-612c-436d-98cd-2869b54ac6f6-1785231885268.png",
  },
  {
    name: "Colorado State Office",
    slug: "colorado-state-office",
    description:
      "The BLM Colorado State Office manages 8.3 million acres of public land across Colorado, overseeing Northwest, Rocky Mountain, Southwest, and Upper Colorado River district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e5970dfa-b68b-4277-99bd-c1dba773db99-1785231681194.png",
  },
  {
    name: "Coos Bay District Office",
    slug: "coos-bay-district-office",
    description:
      "A BLM district office managing public lands along the southern Oregon coast around Coos Bay.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-488d027e-924b-484a-8631-d72d332a9f2a-1785232264482.png",
  },
  {
    name: "Eastern Montana/Dakotas District Office",
    slug: "eastern-montanadakotas-district-office",
    description:
      "A BLM district office managing public lands in eastern Montana, North Dakota, and South Dakota.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-51ca46ff-6253-4f77-b4a1-5c7f96a3abc7-1785232100914.png",
  },
  {
    name: "Eastern States State Office",
    slug: "eastern-states-state-office",
    description:
      "The BLM Eastern States State Office manages public lands and mineral estate in the 31 states east of and bordering the Mississippi River, overseeing Northeastern States and Southeastern States offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0f7d9c74-1c69-465e-b142-3b91d4e68735-1785231691695.png",
  },
  {
    name: "Elko District Office",
    slug: "elko-district-office",
    description:
      "A BLM district office managing public lands in northeastern Nevada around Elko.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f4b0f3fd-bf5e-4860-b4b1-ce26320190c4-1785232152966.png",
  },
  {
    name: "Ely District Office",
    slug: "ely-district-office",
    description:
      "A BLM district office managing public lands in east-central Nevada around Ely.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-55200c54-1364-494a-9883-1e9259e8e697-1785232163161.png",
  },
  {
    name: "Fairbanks District Office",
    slug: "fairbanks-district-office",
    description:
      "A BLM district office serving the Fairbanks and interior Alaska region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e06322ba-bff3-4473-b11a-2925593bf29d-1785231863752.png",
  },
  {
    name: "Farmington District Office",
    slug: "farmington-district-office",
    description:
      "A BLM district office managing public lands in the Farmington and Four Corners region of northwestern New Mexico.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-983e2af9-ef5f-4dbb-94f5-763a88d9270e-1785232213634.png",
  },
  {
    name: "Gila District Office",
    slug: "gila-district-office",
    description:
      "A BLM district office managing public lands in south-central Arizona around the Gila River basin.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0ffe8ff4-ab62-4699-b8f3-29ca3ee877f7-1785231895740.png",
  },
  {
    name: "Green River District",
    slug: "green-river-district",
    description:
      "A BLM district office managing public lands in eastern Utah around the Green River and Uinta Basin.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8c498a69-0472-4885-979c-080977624297-1785232383929.png",
  },
  {
    name: "High Desert District Office",
    slug: "high-desert-district-office",
    description:
      "A BLM district office managing public lands in southwestern Wyoming, including the Red Desert and Killpecker Dunes area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-7613c399-2619-481f-8da5-e86b716d80ef-1785232415946.png",
  },
  {
    name: "High Plains District Office",
    slug: "high-plains-district-office",
    description:
      "A BLM district office managing public lands in southeastern Wyoming, including the High Plains and Laramie region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8d8b43dd-406a-4239-9947-326c161bd8b3-1785232449515.png",
  },
  {
    name: "Idaho Falls District Office",
    slug: "idaho-falls-district-office",
    description:
      "A BLM district office managing public lands in eastern Idaho around the Idaho Falls region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-43d687fa-caf9-49e5-b0e1-354216a4b231-1785232056713.png",
  },
  {
    name: "Idaho State Office",
    slug: "idaho-state-office",
    description:
      "The BLM Idaho State Office manages nearly 12 million acres of public land across Idaho, overseeing Boise, Coeur d'Alene, Idaho Falls, and Twin Falls district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d04c211f-35aa-475a-b0ee-f10d18ca6487-1785231702270.png",
  },
  {
    name: "Lakeview District Office",
    slug: "lakeview-district-office",
    description:
      "A BLM district office managing public lands in the Lakeview and south-central Oregon region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-5875ce1f-2d24-4ae3-b813-7a99c96c18a0-1785232274192.png",
  },
  {
    name: "Las Cruces District Office",
    slug: "las-cruces-district-office",
    description:
      "A BLM district office managing public lands in southern New Mexico around Las Cruces and the Organ Mountains.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-73d776ec-92ac-45b0-98e0-25e126262f8c-1785232223444.png",
  },
  {
    name: "Medford District Office",
    slug: "medford-district-office",
    description:
      "A BLM district office managing public lands in the Medford and Rogue Valley region of southwestern Oregon.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2e0e7991-4314-48a1-9e88-9cd681d62d46-1785232283720.png",
  },
  {
    name: "Montana/Dakotas State Office",
    slug: "montanadakotas-state-office",
    description:
      "The BLM Montana/Dakotas State Office manages 8.1 million acres of public land across Montana, North Dakota, and South Dakota, overseeing Eastern Montana/Dakotas, North Central Montana, and Western Montana district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4e0d35d9-ca94-4ce5-b6c3-c7a5e4c46258-1785231713932.png",
  },
  {
    name: "Nevada State Office",
    slug: "nevada-state-office",
    description:
      "The BLM Nevada State Office manages 48 million acres of public land across Nevada, overseeing Battle Mountain, Carson City, Elko, Ely, Southern Nevada, and Winnemucca district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9bb52e82-1626-44c4-b31d-e2a9e76bc320-1785231724667.png",
  },
  {
    name: "New Mexico State Office",
    slug: "new-mexico-state-office",
    description:
      "The BLM New Mexico State Office manages 13.4 million acres of public land across New Mexico, Oklahoma, Kansas, and Texas, overseeing Albuquerque, Farmington, Las Cruces, and Pecos district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-13d9558c-9f10-4543-94e2-2b6ec054924e-1785231734534.png",
  },
  {
    name: "North Central Montana District Office",
    slug: "north-central-montana-district-office",
    description:
      "A BLM district office managing public lands in north-central Montana, including the Lewistown area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c9e25aa1-bf4e-49be-b2be-3584bc6a034f-1785232111632.png",
  },
  {
    name: "Northeastern States Office",
    slug: "northeastern-states-office",
    description:
      "A BLM office managing public lands and mineral estate in the northeastern United States, from Maine to Virginia.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c8418134-d4d9-41a6-b57c-079f85037e1b-1785232009338.png",
  },
  {
    name: "Northern California District Office",
    slug: "northern-california-district-office",
    description:
      "A BLM district office managing public lands in Northern California, including the Redding and Susanville areas.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a021a9c7-2b22-4a12-ba35-1b665bfd027a-1785231938280.png",
  },
  {
    name: "Northwest District Office",
    slug: "northwest-district-office",
    description:
      "A BLM district office managing public lands in northwestern Colorado.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3a348c59-27f1-4477-b8da-7b9bd065a88c-1785231957680.png",
  },
  {
    name: "Northwest Oregon District Office",
    slug: "northwest-oregon-district-office",
    description:
      "A BLM district office managing public lands in northwestern Oregon, including the Willamette Valley and Salem area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-32a08fb2-3396-4984-800a-f33e4cef7c9f-1785232293457.png",
  },
  {
    name: "Oklahoma Field Office",
    slug: "oklahoma-field-office",
    description:
      "A BLM field office managing public lands and mineral leasing in Oklahoma.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3eb41a44-78d1-4894-8028-7a9aee4692e2-1785232244233.png",
  },
  {
    name: "Oregon/Washington State Office",
    slug: "oregonwashington-state-office",
    description:
      "The BLM Oregon/Washington State Office manages 16.3 million acres of public land across Oregon and Washington, overseeing Burns, Coos Bay, Lakeview, Medford, Northwest Oregon, Prineville, Roseburg, Spokane, and Vale district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6b26d001-52f6-454a-903b-cd73eb5a133c-1785231745547.png",
  },
  {
    name: "Paria River District",
    slug: "paria-river-district",
    description:
      "A BLM district office managing public lands in southern Utah around the Paria River and Grand Staircase-Escalante region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b4db54be-a20e-45e0-acc6-058e67e64710-1785232395669.png",
  },
  {
    name: "Pecos District Office",
    slug: "pecos-district-office",
    description:
      "A BLM district office managing public lands in the Pecos River region of southeastern New Mexico.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6509753c-a20a-4aa9-ab95-b3ab18ef2466-1785232233938.png",
  },
  {
    name: "Phoenix District Office",
    slug: "phoenix-district-office",
    description:
      "A BLM district office managing public lands in the Phoenix and central Arizona region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0b0f09d0-7acf-4d1c-8c68-81b9b4856f3e-1785231907150.png",
  },
  {
    name: "Prineville District Office",
    slug: "prineville-district-office",
    description:
      "A BLM district office managing public lands in central Oregon around the Prineville and Ochoco region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-30d15bef-db77-4c66-abf1-461be9db1776-1785232316619.png",
  },
  {
    name: "Rocky Mountain District Office",
    slug: "rocky-mountain-district-office",
    description:
      "A BLM district office managing public lands in the Rocky Mountain region of Colorado.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f7c8d49a-32ae-46d4-8b1c-381e25ef10b8-1785231967603.png",
  },
  {
    name: "Roseburg District Office",
    slug: "roseburg-district-office",
    description:
      "A BLM district office managing public lands in southwestern Oregon around Roseburg and the Umpqua River basin.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0af1117a-3a2e-4343-bcf2-571acc851e49-1785232326463.png",
  },
  {
    name: "Southeastern States Office",
    slug: "southeastern-states-office",
    description:
      "A BLM office managing public lands and mineral estate in the southeastern United States, from Kentucky to Florida.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9669314f-0d80-4965-8144-e687a51f21f9-1785232020477.png",
  },
  {
    name: "Southern Nevada District Office",
    slug: "southern-nevada-district-office",
    description:
      "A BLM district office managing public lands in southern Nevada, including the Las Vegas and Mojave Desert region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ee24609d-0f08-4f76-a345-5a1db532c421-1785232173509.png",
  },
  {
    name: "Southwest District Office",
    slug: "southwest-district-office",
    description:
      "A BLM district office managing public lands in southwestern Colorado, including the San Juan Mountains area.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-01a62107-1a02-4063-9564-68da4242546a-1785231978281.png",
  },
  {
    name: "Spokane District Office",
    slug: "spokane-district-office",
    description:
      "A BLM district office managing public lands in eastern Washington around Spokane and the Columbia Plateau.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-83277c03-447a-464b-98c0-50329ebc57b9-1785232337531.png",
  },
  {
    name: "Twin Falls District Office",
    slug: "twin-falls-district-office",
    description:
      "A BLM district office managing public lands in southern Idaho around the Twin Falls region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2e821a60-5f1a-4e96-9ad1-c0d6f4db4b4f-1785232090536.png",
  },
  {
    name: "Uncompahgre Field Office",
    slug: "uncompahgre-field-office",
    description:
      "A BLM field office managing public lands in the Uncompahgre Plateau region of western Colorado.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4949484e-1c0b-4d9d-9694-bbc44c26632e-1785231999106.png",
  },
  {
    name: "Upper Colorado River District Office",
    slug: "upper-colorado-river-district-office",
    description:
      "A BLM district office managing public lands along the Upper Colorado River basin in Colorado.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-82799dba-b5fd-4107-beef-788685d9b644-1785231988945.png",
  },
  {
    name: "Utah State Office",
    slug: "utah-state-office",
    description:
      "The BLM Utah State Office manages 22.9 million acres of public land across Utah, overseeing Canyon Country, Color Country, Green River, Paria River, and West Desert district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d2d235b6-612a-4159-8936-5e9a0ffa97dc-1785231776198.png",
  },
  {
    name: "Vale District Office",
    slug: "vale-district-office",
    description:
      "A BLM district office managing public lands in eastern Oregon around Vale and the Snake River valley.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3ab3b8c5-942b-46ab-9c40-73f9d0741012-1785232349838.png",
  },
  {
    name: "West Desert District Office",
    slug: "west-desert-district-office",
    description:
      "A BLM district office managing public lands in western Utah, including the West Desert and Great Salt Lake region.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-96a3da9c-035a-4588-9a72-6b6823ab6a72-1785232405569.png",
  },
  {
    name: "Western Montana District Office",
    slug: "western-montana-district-office",
    description:
      "A BLM district office managing public lands in western Montana, including the Missoula and Butte areas.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f2e0846c-28d2-40d6-810f-ec5dff2d59d9-1785232121591.png",
  },
  {
    name: "Wind River/Bighorn Basin District Office",
    slug: "wind-riverbighorn-basin-district-office",
    description:
      "A BLM district office managing public lands in the Wind River and Bighorn Basin region of north-central Wyoming.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d5bb8940-7564-4c40-ae84-661c944dc6cc-1785232459979.png",
  },
  {
    name: "Winnemucca District Office",
    slug: "winnemucca-district-office",
    description:
      "A BLM district office managing public lands in northwestern Nevada around Winnemucca.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-563ea4e7-7088-47ee-a3e1-e43dc3e20da7-1785232183593.png",
  },
  {
    name: "Wyoming State Office",
    slug: "wyoming-state-office",
    description:
      "The BLM Wyoming State Office manages 18.4 million acres of public land across Wyoming, overseeing High Desert, High Plains, and Wind River/Bighorn Basin district offices.",
    organizationSlug: "blm",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8a6d792a-163c-41d6-8f33-271ac989e8d6-1785231787267.png",
  },
  {
    name: "Federal Aviation Administration (FAA)",
    slug: "federal-aviation-administration-faa",
    description:
      "The FAA regulates civil aviation safety and operates the nation's air traffic control system.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8b895305-4102-4215-a633-77e85d8aaf43-1785234422612.png",
  },
  {
    name: "Federal Highway Administration (FHWA)",
    slug: "federal-highway-administration-fhwa",
    description:
      "The FHWA administers federal-aid highway programs and provides stewardship over the Nation's roads and highways.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2342a7aa-9836-4db5-960f-9b4ced9d5001-1785234432963.png",
  },
  {
    name: "Federal Motor Carrier Safety Administration (FMCSA)",
    slug: "federal-motor-carrier-safety-administrat",
    description:
      "The FMCSA regulates commercial motor vehicle safety to reduce crashes, injuries, and fatalities involving large trucks and buses.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3b4a8d48-11e3-4c38-8fab-6fad7a742415-1785234465079.png",
  },
  {
    name: "Federal Railroad Administration (FRA)",
    slug: "federal-railroad-administration-fra",
    description:
      "The FRA regulates rail safety and administers railroad programs, including Amtrak oversight.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e08a72ac-30c3-4800-986b-22af0616f6b2-1785234443182.png",
  },
  {
    name: "Federal Transit Administration (FTA)",
    slug: "federal-transit-administration-fta",
    description:
      "The FTA provides financial and technical assistance to local public transit systems across the United States.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-46217684-82e6-451b-bad4-8ff9d883b781-1785234454479.png",
  },
  {
    name: "Maritime Administration (MARAD)",
    slug: "maritime-administration-marad",
    description:
      "MARAD promotes the US maritime industry, oversees US-flag vessels, and administers maritime training and assistance programs.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d070e6df-28e5-4988-8cd3-2ac3e766f1c8-1785234513670.png",
  },
  {
    name: "National Highway Traffic Safety Administration (NHTSA)",
    slug: "national-highway-traffic-safety-administ",
    description:
      "NHTSA sets and enforces vehicle safety standards, investigates safety defects, and regulates fuel economy and vehicle emissions compliance.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3bd9d540-1749-4fd2-8263-49d83675ef6e-1785234490010.png",
  },
  {
    name: "Office of the Secretary of Transportation (OST)",
    slug: "office-of-the-secretary-of-transportatio",
    description:
      "The Office of the Secretary provides leadership and policy direction for all DOT operating administrations and programs.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1737794a-9388-476d-bd58-5b7430aef58c-1785234534261.png",
  },
  {
    name: "Pipeline and Hazardous Materials Safety Administration (PHMSA)",
    slug: "pipeline-and-hazardous-materials-safety-",
    description:
      "PHMSA regulates the safety of pipeline transportation and the transportation of hazardous materials by all modes.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-debf072d-4803-4b0e-a00f-fc07f0c1ff6b-1785234502031.png",
  },
  {
    name: "Surface Transportation Board (STB)",
    slug: "surface-transportation-board-stb",
    description:
      "The STB is an independent adjudicatory body that resolves disputes involving rail transportation and certain non-rail transportation matters.",
    organizationSlug: "dot",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e1c1abf8-fb0b-4ec3-bf96-5e92083ddafb-1785234523523.png",
  },
  {
    name: "Region 10: California - Great Basin",
    slug: "region-10-california-great-basin",
    description:
      "NPS Region 10 covers national park sites in middle and northern CA and most of NV.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3390aaae-fefa-4c1e-9ecc-1d13efc593e5-1785234392534.png",
  },
  {
    name: "Region 11: Alaska",
    slug: "region-11-alaska",
    description: "NPS Region 11 covers national park sites in Alaska.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-18c6f271-5b51-4ae9-b5bb-dfa7875f2b58-1785234402468.png",
  },
  {
    name: "Region 12: Pacific Islands",
    slug: "region-12-pacific-islands",
    description:
      "NPS Region 12 covers national park sites in American Samoa, Guam, and Hawaii.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1329e34e-06ab-4ce5-ac8e-4ef47b9af7c9-1785234412439.png",
  },
  {
    name: "Region 1: North Atlantic - Appalachian & National Capital Area",
    slug: "region-1-north-atlantic-appalachian-nati",
    description:
      "NPS Region 1 covers national park sites in CT, DE, DC, KY, ME, MD, MA, NH, NJ, NY, PA, RI, VT, VA, and WV.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0aa9cb76-b246-4020-9ded-b4a31c45952a-1785234274653.png",
  },
  {
    name: "Region 2: South Atlantic - Gulf",
    slug: "region-2-south-atlantic-gulf",
    description:
      "NPS Region 2 covers national park sites in AL, GA, NC, Puerto Rico, SC, and TN.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-48cc1150-a222-49a5-a0eb-de4d7aee0ce8-1785234285777.png",
  },
  {
    name: "Region 3: Great Lakes",
    slug: "region-3-great-lakes",
    description:
      "NPS Region 3 covers national park sites in IL, IN, MI, MN, OH, and WI.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-85307f9a-b0e7-4bf5-8a87-8ea043fbf218-1785234295834.png",
  },
  {
    name: "Region 4: Mississippi Basin",
    slug: "region-4-mississippi-basin",
    description:
      "NPS Region 4 covers national park sites in AR, IA, LA, MS, and MO.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-da6cefeb-e8cf-4f75-884e-87b049f93d4a-1785234306821.png",
  },
  {
    name: "Region 5: Missouri Basin",
    slug: "region-5-missouri-basin",
    description:
      "NPS Region 5 covers national park sites in KS, MT, NE, ND, and SD.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f6fab452-b1e4-46aa-a408-18233f022f39-1785234316693.png",
  },
  {
    name: "Region 6: Arkansas - Rio Grande - Texas - Gulf",
    slug: "region-6-arkansas-rio-grande-texas-gulf",
    description: "NPS Region 6 covers national park sites in OK and TX.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-bb0d384c-7b49-45eb-abc9-38362fde6676-1785234327278.png",
  },
  {
    name: "Region 7: Upper Colorado Basin",
    slug: "region-7-upper-colorado-basin",
    description:
      "NPS Region 7 covers national park sites in CO, NM, UT, and WY.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b6d011a3-b01c-4f4b-85bd-807a6ff0d8d7-1785234337460.png",
  },
  {
    name: "Region 8: Lower Colorado Basin",
    slug: "region-8-lower-colorado-basin",
    description:
      "NPS Region 8 covers national park sites in AZ, southern NV, and southern CA.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fbfed86e-6d09-4892-b91e-4d002130646e-1785234371067.png",
  },
  {
    name: "Region 9: Columbia - Pacific Northwest",
    slug: "region-9-columbia-pacific-northwest",
    description:
      "NPS Region 9 covers national park sites in ID, most of OR, and WA.",
    organizationSlug: "nps",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-826a3a02-5873-4ef1-ae97-c77f4d64af94-1785234381953.png",
  },
  {
    name: "Chattanooga Field Office",
    slug: "chattanooga-field-office",
    description:
      "TVA regional operations office in Chattanooga, Tennessee, managing power distribution and river management activities in the southeastern Tennessee Valley.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-cbd065d4-4216-4135-93d0-4048a491622b-1785234566106.png",
  },
  {
    name: "Cumberland Region",
    slug: "cumberland-region",
    description:
      "TVA region operating dams and power facilities in the Cumberland River basin, serving parts of Kentucky and Tennessee.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fa14cf33-21e5-4a61-a203-84131c41c79c-1785234638744.png",
  },
  {
    name: "Memphis Field Office",
    slug: "memphis-field-office",
    description:
      "TVA regional operations office in Memphis, Tennessee, serving the western Tennessee Valley area along the Mississippi River.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-210b356f-13cb-4b4c-a98d-c95f9208adf0-1785234586991.png",
  },
  {
    name: "Muscle Shoals Field Office",
    slug: "muscle-shoals-field-office",
    description:
      "Original TVA facility at Wilson Dam in Muscle Shoals, Alabama. Site of the agency's founding and home to environmental and energy research operations.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e0a30ab0-92fd-4028-92e3-993cd04f2606-1785234555370.png",
  },
  {
    name: "Nashville Field Office",
    slug: "nashville-field-office",
    description:
      "TVA regional operations office in Nashville, Tennessee, serving the central Tennessee Valley area.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-08c4392f-4114-430c-a313-63a2cf861b75-1785234575930.png",
  },
  {
    name: "Ohio Region",
    slug: "ohio-region",
    description:
      "TVA region operating dams and power facilities in the Ohio River basin area of western Kentucky.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-5e40764c-8a26-4166-be79-11e4bfcaef52-1785234659656.png",
  },
  {
    name: "TVA Headquarters - Knoxville",
    slug: "tva-headquarters-knoxville",
    description:
      "TVA's main administrative headquarters located in Knoxville, Tennessee. Houses executive leadership and central operations.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1b34153e-e1c4-4a26-af85-872f6d00f70f-1785234545128.png",
  },
  {
    name: "Tennessee Region",
    slug: "tennessee-region",
    description:
      "TVA region operating dams and power facilities in the Tennessee River basin, the core of TVA's hydroelectric and flood control system.",
    organizationSlug: "tva",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-55a8e928-4c53-4107-b50b-cd42d1c493be-1785234649052.png",
  },
  {
    name: "Allegheny National Forest",
    slug: "allegheny-national-forest",
    description:
      "A National Forest in northwestern Pennsylvania, the only national forest in the state.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4833422e-5d9d-4448-a01f-2b141ada767b-1785238734049.png",
  },
  {
    name: "Angeles National Forest",
    slug: "angeles-national-forest",
    description:
      "A National Forest in the San Gabriel Mountains of southern California, north of Los Angeles.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d604ca56-f739-4647-a6fd-a3f3fbc1eed6-1785238758353.png",
  },
  {
    name: "Angelina National Forest",
    slug: "angelina-national-forest",
    description:
      "A National Forest in eastern Texas, part of the National Forests and Grasslands of Texas.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-06261349-3d1f-416b-849e-8ea834ec2b3c-1785238769678.png",
  },
  {
    name: "Apache National Forest",
    slug: "apache-national-forest",
    description:
      "A National Forest in western New Mexico, in the Apache-Sitgreaves area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fd0f07f0-d252-4b20-8f1e-e61d1c035976-1785240462702.png",
  },
  {
    name: "Apache-Sitgreaves National Forest",
    slug: "apache-sitgreaves-national-forest",
    description:
      "A National Forest in Arizona, combining the Apache and Sitgreaves forests in the White Mountains area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6d37dfde-1e17-42c4-bae6-fa9d42304c09-1785238780915.png",
  },
  {
    name: "Apalachicola National Forest",
    slug: "apalachicola-national-forest",
    description:
      "A National Forest in the Florida panhandle, the largest national forest in Florida.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2a057274-77ca-4695-8aca-54bb44ebc60d-1785238792350.png",
  },
  {
    name: "Arapaho National Forest",
    slug: "arapaho-nf",
    description: "A National Forest in north-central Colorado.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f13ec896-0878-4aae-9545-c55c55cb4bb3-1785241023554.png",
  },
  {
    name: "Ashley National Forest",
    slug: "ashley-national-forest",
    description:
      "A National Forest in northeastern Utah, including the High Uintas Wilderness.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-75ce3751-f8b8-4622-a26c-9cadffc80872-1785238809765.png",
  },
  {
    name: "Beaverhead-Deerlodge National Forest",
    slug: "beaverhead-deerlodge-national-forest",
    description:
      "A National Forest in southwestern Montana, combining the Beaverhead and Deerlodge forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-dbd8568e-a510-4006-a582-a3fc20a4fef6-1785238819511.png",
  },
  {
    name: "Bienville National Forest",
    slug: "bienville-national-forest",
    description: "A National Forest in Mississippi, in the Bienville Division.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-496aeb6b-bc1a-440a-9b89-c52f38cecb4c-1785240266337.png",
  },
  {
    name: "Bighorn National Forest",
    slug: "bighorn-national-forest",
    description:
      "A National Forest in north-central Wyoming, including the Bighorn Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-24c8deeb-ebce-48d6-b8d8-acc6561552ea-1785238830265.png",
  },
  {
    name: "Bitterroot National Forest",
    slug: "bitterroot-national-forest",
    description:
      "A National Forest in western Montana, covering the Bitterroot Range along the Idaho border.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-5741782e-e89e-4be1-92af-3ab5a8df60ff-1785238841224.png",
  },
  {
    name: "Black Hills National Forest",
    slug: "black-hills-national-forest",
    description:
      "A National Forest in western South Dakota and northeastern Wyoming, including the Black Hills region.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0ff5620c-57ff-4bc1-be2d-74501a7d1277-1785238851881.png",
  },
  {
    name: "Boise National Forest",
    slug: "boise-national-forest",
    description:
      "A National Forest in southwestern Idaho, surrounding the city of Boise.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c0e3f413-d7fe-43d1-9446-e1600e401fc4-1785238864636.png",
  },
  {
    name: "Boise-Sawtooth National Forest",
    slug: "boise-sawtooth-national-forest",
    description:
      "A National Forest in central Idaho, combining the Boise and Sawtooth forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a873d4f4-a835-49e7-9ebb-688ea5e935ff-1785240632822.png",
  },
  {
    name: "Bridger-Teton National Forest",
    slug: "bridger-teton-national-forest",
    description:
      "A National Forest in western Wyoming, combining the Bridger and Teton mountain ranges.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-92c9b92d-b3a3-4870-96fd-c88ec9ae0f5f-1785238889405.png",
  },
  {
    name: "Caribou-Targhee National Forest",
    slug: "caribou-targhee-national-forest",
    description:
      "A National Forest spanning southeastern Idaho and western Wyoming, combining the Caribou and Targhee forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-20447720-e7ed-4a76-b889-d5574abf2fc5-1785238898965.png",
  },
  {
    name: "Carson National Forest",
    slug: "carson-national-forest",
    description:
      "A National Forest in northern New Mexico, encompassing the Sangre de Cristo Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3e647f9f-b942-43eb-befa-c0ea1086fba8-1785238909615.png",
  },
  {
    name: "Chattahoochee-Oconee National Forest",
    slug: "chattahoochee-oconee-national-forest",
    description:
      "A National Forest in northern Georgia, combining the Chattahoochee and Oconee forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ca339543-6420-4ca9-bac1-0fc8155e70fc-1785238919727.png",
  },
  {
    name: "Chequamegon-Nicolet National Forest",
    slug: "chequamegon-nicolet-national-forest",
    description:
      "A National Forest in northern Wisconsin, combining the Chequamegon and Nicolet forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9d911b5c-9897-476d-8eae-c214f01d3974-1785238929580.png",
  },
  {
    name: "Cherokee National Forest",
    slug: "cherokee-national-forest",
    description:
      "A National Forest in eastern Tennessee, in the southern Appalachian Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2cd804af-d9c8-49bb-9299-bd29a653569c-1785238949585.png",
  },
  {
    name: "Chippewa National Forest",
    slug: "chippewa-national-forest",
    description:
      "A National Forest in north-central Minnesota, known for its lakes and wetlands.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a8e38dd8-43eb-40f7-9c74-17bbde2c8470-1785238985848.png",
  },
  {
    name: "Chugach National Forest",
    slug: "chugach-national-forest",
    description:
      "A National Forest in south-central Alaska, the second-largest national forest in the US.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-91954046-745b-4f00-bd00-8913268e2b72-1785238996183.png",
  },
  {
    name: "Cibola National Forest",
    slug: "cibola-national-forest",
    description:
      "A National Forest in western New Mexico, encompassing the Zuni and Magdalena Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6d0d48f8-3460-43ad-8872-83438e5f6d2b-1785239006571.png",
  },
  {
    name: "Cimarron National Grassland",
    slug: "cimarron-national-grassland",
    description:
      "A National Forest in central Colorado, part of the PSICC complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a614c126-4158-4dee-8da2-bcb7a9bae20e-1785240569534.png",
  },
  {
    name: "Clearwater National Forest",
    slug: "clearwater-national-forest",
    description:
      "A National Forest in north-central Idaho, part of the Nez Perce-Clearwater complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-76f2072c-b96a-4da1-9f3e-634eb25b02b5-1785239017639.png",
  },
  {
    name: "Cleveland National Forest",
    slug: "cleveland-nf",
    description: "A National Forest in southern California near San Diego.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f10d8410-12e5-4c19-9528-b3bdd426081e-1785241033438.png",
  },
  {
    name: "Coconino National Forest",
    slug: "coconino-national-forest",
    description:
      "A National Forest in central Arizona, encompassing the red rock country around Sedona.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c2fa4edd-fd87-46f7-8ad1-28c3f069fec7-1785239080584.png",
  },
  {
    name: "Colville National Forest",
    slug: "colville-national-forest",
    description:
      "A National Forest in northeastern Washington state, in the Colville area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-163bd3fc-af1b-42a8-b2f6-750635473ac3-1785239090160.png",
  },
  {
    name: "Conecuh National Forest",
    slug: "conecuh-national-forest",
    description:
      "A National Forest in Alabama, part of the National Forests of Alabama including the Oakmulgee and Shoal Creek Divisions.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-732e89c1-c2c8-42b6-97f8-0e643c3b09a7-1785240622536.png",
  },
  {
    name: "Coronado National Forest",
    slug: "coronado-national-forest",
    description:
      "A National Forest in southeastern Arizona, encompassing the Sky Islands region along the Mexican border.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-be4751c0-ddcb-46b3-909b-4d7ba564d9e7-1785239099687.png",
  },
  {
    name: "Croatan National Forest",
    slug: "croatan-national-forest",
    description:
      "A National Forest in eastern Tennessee and western North Carolina, in the Appalachian Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fa03391e-4fbb-434e-b14f-658da68e73aa-1785240103479.png",
  },
  {
    name: "Custer National Forest",
    slug: "custer-national-forest",
    description:
      "A National Forest spanning Montana, North Dakota, and South Dakota.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a90a9098-bd39-456a-8684-f1bef1a314de-1785239110137.png",
  },
  {
    name: "Daniel Boone National Forest",
    slug: "daniel-boone-national-forest",
    description:
      "A National Forest in eastern Kentucky, in the Appalachian Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-7391d88c-565a-4614-a622-e33421dfc48c-1785239120253.png",
  },
  {
    name: "Davy Crockett National Forest",
    slug: "davy-crockett-national-forest",
    description:
      "A National Forest in eastern Texas, in the Davy Crockett Division of the National Forests of Texas.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ae172621-7bd8-49ce-8f5f-68ea5254518f-1785240333599.png",
  },
  {
    name: "De Soto National Forest",
    slug: "de-soto-national-forest",
    description: "A National Forest in Mississippi, in the De Soto Division.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fea7b2ae-0791-44d7-b4f4-ad33917ec884-1785240234718.png",
  },
  {
    name: "Delta National Forest",
    slug: "delta-national-forest",
    description:
      "A National Forest in Mississippi, the only bottomland hardwood forest in the National Forest System.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-580f2653-568b-439f-9594-4a7f3e1ddaad-1785240250517.png",
  },
  {
    name: "Deschutes National Forest",
    slug: "deschutes-national-forest",
    description:
      "A National Forest in central Oregon, encompassing the Deschutes River canyon area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b030dd9f-2c4c-4272-acd1-5ac282378e53-1785239136474.png",
  },
  {
    name: "Dixie National Forest",
    slug: "dixie-national-forest",
    description:
      "A National Forest in southwestern Utah, encompassing the Markagunt Plateau.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9f89c6a9-1a7e-4542-b07b-510f6e7a8438-1785239157603.png",
  },
  {
    name: "El Yunque National Forest",
    slug: "el-yunque-national-forest",
    description:
      "A National Forest in Puerto Rico, the only tropical rainforest in the US National Forest System.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b270d6ed-3043-4927-9ea1-f56abcdf8c60-1785239169692.png",
  },
  {
    name: "Eldorado National Forest",
    slug: "eldorado-nf",
    description:
      "A National Forest in the central Sierra Nevada of California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b8556c33-c235-4bc2-96f6-e01c73fd5b05-1785241043555.png",
  },
  {
    name: "Finger Lakes National Forest",
    slug: "finger-lakes-national-forest",
    description:
      "A National Forest in central New York, the only national forest in New York State.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1e0b5c54-fac7-46cb-bcba-fc5839e6d677-1785239186241.png",
  },
  {
    name: "Fishlake National Forest",
    slug: "fishlake-national-forest",
    description:
      "A National Forest in central Utah, named for Fish Lake in the Fishlake Plateau region.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d0c0190e-b15a-4673-ba7c-943ea4d16d89-1785239218030.png",
  },
  {
    name: "Flathead National Forest",
    slug: "flathead-national-forest",
    description:
      "A National Forest in northwestern Montana, bordering Glacier National Park.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-941a2565-5770-4301-afb7-b4f16501c9e0-1785239228049.png",
  },
  {
    name: "Francis Marion National Forest",
    slug: "francis-marion-national-forest",
    description:
      "A National Forest in coastal South Carolina, part of the Francis Marion and Sumter National Forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2a49382f-c3f6-4c3e-be80-e18768d54b98-1785239237784.png",
  },
  {
    name: "Fremont-Winema National Forest",
    slug: "fremont-winema-national-forest",
    description:
      "A National Forest in southern Oregon, combining the Fremont and Winema forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-337fabd2-5c35-4e9d-b929-79caab6fa824-1785239248630.png",
  },
  {
    name: "GMUG National Forest",
    slug: "gmug-national-forest",
    description:
      "A National Forest in central Colorado, combining the Grand Mesa, Uncompahgre, and Gunnison forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ab8aab1c-11cb-44d3-ace4-9bc3e68fb03a-1785240558662.png",
  },
  {
    name: "Gallatin National Forest",
    slug: "gallatin-national-forest",
    description:
      "A National Forest in southwestern Montana, encompassing the Gallatin Range.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-19c65c58-ed75-4b10-b23e-8e28d3ad817e-1785239258630.png",
  },
  {
    name: "George Washington National Forest",
    slug: "george-washington-national-forest",
    description:
      "A National Forest in western Virginia, part of the George Washington and Jefferson National Forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b86e8834-682c-4ccf-8c66-9779916f0c96-1785239268573.png",
  },
  {
    name: "Gifford Pinchot National Forest",
    slug: "gifford-pinchot-nf",
    description:
      "A National Forest in southwestern Washington state including Mount St. Helens.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3f35e09b-d394-4fa9-96b3-21f9eff6cc61-1785241053339.png",
  },
  {
    name: "Gila National Forest",
    slug: "gila-national-forest",
    description:
      "A National Forest in southwestern New Mexico, encompassing the Gila Wilderness.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4bec61f3-b244-40bd-a0ae-ed859a688681-1785239279965.png",
  },
  {
    name: "Grand Mesa National Forest",
    slug: "grand-mesa-national-forest",
    description:
      "A National Forest in western Colorado, encompassing the Grand Mesa, the world's largest flat-topped mountain.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-80d55913-3822-4d08-8a6b-efa27a47e47a-1785239289991.png",
  },
  {
    name: "Grand Mesa Uncompahgre and Gunnison National Forests",
    slug: "grand-mesa-uncompahgre-and-gunnison-nati",
    description:
      "A National Forest in central Colorado, part of the GMUG complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f2e5a44f-03cb-42f7-b5d9-a5556dc5e3e8-1785239329777.png",
  },
  {
    name: "Green Mountain National Forest",
    slug: "green-mountain-national-forest",
    description:
      "A National Forest in central Vermont, the only national forest in Vermont.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-df8b09f8-c693-472b-9400-cd6d6de9eda1-1785239340190.png",
  },
  {
    name: "Gunnison National Forest",
    slug: "gunnison-national-forest",
    description:
      "A National Forest in central Colorado, part of the GMUG complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-893baf8d-ca50-4425-abe8-888b7c358ce8-1785239299700.png",
  },
  {
    name: "Helena National Forest",
    slug: "helena-national-forest",
    description:
      "A National Forest in west-central Montana, surrounding the city of Helena.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a4ba7d6a-12a3-4248-b56a-611f6652c5df-1785239350199.png",
  },
  {
    name: "Hiawatha National Forest",
    slug: "hiawatha-national-forest",
    description:
      "A National Forest in Michigan's Upper Peninsula, bordering Lakes Superior, Michigan, and Huron.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b39e3d60-6bf5-4e12-a985-e9a8a75c9bc9-1785239360421.png",
  },
  {
    name: "Holly Springs National Forest",
    slug: "holly-springs-national-forest",
    description:
      "A National Forest in northern Mississippi, in the Holly Springs Division.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-505667e8-918c-48f8-bfa4-7148111884cf-1785240299050.png",
  },
  {
    name: "Homochitto National Forest",
    slug: "homochitto-national-forest",
    description:
      "A National Forest in Mississippi, in the Homochitto Division.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-722b70a7-bf0f-4145-963d-387c1219fb67-1785240282026.png",
  },
  {
    name: "Hoosier National Forest",
    slug: "hoosier-national-forest",
    description:
      "A National Forest in Indiana, the only national forest in Indiana.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b559451e-f51b-4153-8988-7d2d76e52341-1785240542371.png",
  },
  {
    name: "Humboldt-Toiyabe National Forest",
    slug: "humboldt-toiyabe-national-forest",
    description:
      "A National Forest in northwestern Nevada and eastern California, the largest national forest outside Alaska.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-fdd5561a-6f49-4fcc-97ef-7e702a791ab9-1785240643177.png",
  },
  {
    name: "Huron-Manistee National Forest",
    slug: "huron-manistee-national-forest",
    description: "A National Forest in northern Michigan's Lower Peninsula.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e139883c-565f-4bd3-8a08-5cafca9ba71b-1785240120275.png",
  },
  {
    name: "Idaho Panhandle National Forest",
    slug: "idaho-panhandle-national-forest",
    description:
      "A National Forest in northern Idaho, combining the Idaho Panhandle forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-082a5ff6-a6be-45d4-851b-92d0cd2ae840-1785240137417.png",
  },
  {
    name: "Inyo National Forest",
    slug: "inyo-national-forest",
    description:
      "A National Forest in central California, in the Coast Range, including the San Joaquin River headwaters.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a1588191-c1a8-4f7f-8768-066c6184dedc-1785239370206.png",
  },
  {
    name: "Jefferson National Forest",
    slug: "jefferson-national-forest",
    description:
      "A National Forest in western Virginia, part of the George Washington and Jefferson National Forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4f360a27-bb50-4a49-8ae3-11df254ad595-1785240047377.png",
  },
  {
    name: "Kaibab National Forest",
    slug: "kaibab-national-forest",
    description:
      "A National Forest in northern Arizona, encompassing the Kaibab Plateau north of the Grand Canyon.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9383138d-bf07-4e03-8b3c-8269f4a54921-1785239380337.png",
  },
  {
    name: "Kisatchie National Forest",
    slug: "kisatchie-national-forest",
    description:
      "A National Forest in central Louisiana, the only national forest in the state.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d023c8f1-7437-4c19-b617-98029af615a1-1785239390377.png",
  },
  {
    name: "Klamath National Forest",
    slug: "klamath-national-forest",
    description:
      "A National Forest in northwestern California, in the Klamath River area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8272a5a3-0b72-4bf5-9101-0f2b9740cf82-1785239406363.png",
  },
  {
    name: "Kootenai National Forest",
    slug: "kootenai-national-forest",
    description:
      "A National Forest in northwestern Montana, in the Kootenai River valley.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1e5ec98b-36ba-4023-8125-97c01afc8a2c-1785239416189.png",
  },
  {
    name: "Lassen National Forest",
    slug: "lassen-nf",
    description:
      "A National Forest in northeastern California surrounding Lassen Volcanic National Park.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f54b0570-3c60-41ba-8f91-68028ac42203-1785241069250.png",
  },
  {
    name: "Lewis and Clark National Forest",
    slug: "lewis-and-clark-national-forest",
    description:
      "A National Forest in central Montana, encompassing the Big Snowy and Little Belt Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-cfe2a3e5-ad4a-4d60-8da8-e03c35fb1dc6-1785239426211.png",
  },
  {
    name: "Lincoln National Forest",
    slug: "lincoln-national-forest",
    description:
      "A National Forest in central New Mexico, encompassing the Capitan and Sacramento Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9068d754-3d29-43d1-8b86-b60746d5b2e5-1785239479718.png",
  },
  {
    name: "Lolo National Forest",
    slug: "lolo-national-forest",
    description:
      "A National Forest in western Montana, surrounding the city of Missoula.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4dc646f0-339f-4c67-a3d4-ca52ab1afea0-1785239494507.png",
  },
  {
    name: "Los Padres National Forest",
    slug: "los-padres-nf",
    description:
      "A National Forest in the coastal mountains of southern and central California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4958fcf6-fbf3-4184-a7c3-3810b4bfeb9b-1785241079643.png",
  },
  {
    name: "Malheur National Forest",
    slug: "malheur-national-forest",
    description:
      "A National Forest in eastern Oregon, in the Blue Mountains region.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c7b1d7d0-9ed7-41db-b62e-a70e0b38ccfe-1785239504596.png",
  },
  {
    name: "Manti-La Sal National Forest",
    slug: "manti-la-sal-national-forest",
    description:
      "A National Forest in southeastern Utah, combining the Manti and La Sal mountain ranges.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0bbbe692-8979-442f-8a88-c296650204e9-1785239515040.png",
  },
  {
    name: "Mark Twain National Forest",
    slug: "mark-twain-national-forest",
    description:
      "A National Forest in southern Missouri, the only national forest in Missouri.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6f635894-4696-48da-a5e7-b83eecadab7c-1785239525921.png",
  },
  {
    name: "Medicine Bow-Routt National Forest",
    slug: "medicine-bow-routt-national-forest",
    description:
      "A National Forest in central Colorado, combining the Medicine Bow and Routt forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-58166f83-168c-4e1d-9b22-f5de8dcef428-1785239535464.png",
  },
  {
    name: "Mendocino National Forest",
    slug: "mendocino-national-forest",
    description:
      "A National Forest in northern California, in the Coast Range north of San Francisco.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ed693492-ec5f-4919-a239-b649aa7886b4-1785239545255.png",
  },
  {
    name: "Modoc National Forest",
    slug: "modoc-national-forest",
    description:
      "A National Forest in northeastern California, in the Warner Mountains area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b3e99066-93b3-4c0b-95c7-d6fe35ab9a01-1785239555392.png",
  },
  {
    name: "Monongahela National Forest",
    slug: "monongahela-national-forest",
    description:
      "A National Forest in eastern West Virginia, the largest national forest in the eastern US.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0cc68b71-9255-495e-ac6d-428747383216-1785239565272.png",
  },
  {
    name: "Mt. Baker-Snoqualmie National Forest",
    slug: "mt-baker-snoqualmie-national-forest",
    description:
      "A National Forest in western Washington, combining the Mt. Baker and Snoqualmie forests in the Cascade Range.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d38a1a4b-968e-43f8-9855-6e8718a17bb1-1785239582247.png",
  },
  {
    name: "Mt. Hood National Forest",
    slug: "mt-hood-nf",
    description:
      "A National Forest in Oregon that includes the peak of Mount Hood.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-17609d03-9905-45d8-b04a-ebcfb500ca11-1785241089226.png",
  },
  {
    name: "Nantahala National Forest",
    slug: "nantahala-national-forest",
    description:
      "A National Forest in eastern Tennessee and western North Carolina, in the Appalachian Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b7fccbd7-aba3-4d35-bd08-a8716fbbf059-1785240077135.png",
  },
  {
    name: "Nebraska National Forest",
    slug: "nebraska-national-forest",
    description:
      "A National Forest in central Nebraska, including the Nebraska National Forests and Grasslands.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6ea7a4dd-f577-4def-bb6a-abbc7391250c-1785239618125.png",
  },
  {
    name: "Nez Perce National Forest",
    slug: "nez-perce-national-forest",
    description:
      "A National Forest in central Idaho, part of the Nez Perce-Clearwater complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-84ddf6fb-84ef-4787-bd3f-5ac3ea947314-1785239627802.png",
  },
  {
    name: "Nez Perce-Clearwater National Forest",
    slug: "nez-perce-clearwater-national-forest",
    description:
      "A National Forest in western Montana, combining the Nez Perce and Clearwater forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ee6e2606-c5c3-479b-aca2-95f55b493ec8-1785240518703.png",
  },
  {
    name: "Ocala National Forest",
    slug: "ocala-national-forest",
    description:
      "A National Forest in central Florida, known for its sand pine scrub ecosystem.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a69a1e61-4a96-46d9-a7d5-d46c1047fd54-1785239638738.png",
  },
  {
    name: "Ochoco National Forest",
    slug: "ochoco-national-forest",
    description:
      "A National Forest in central Oregon, encompassing the Ochoco Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b5529ef4-fd5c-497d-a638-a10db0eb7e9c-1785239147264.png",
  },
  {
    name: "Okanogan-Wenatchee National Forest",
    slug: "okanogan-wenatchee-national-forest",
    description:
      "A National Forest in central and eastern Washington, combining the Okanogan and Wenatchee forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-adf3f943-77ce-423e-a0df-5917259975ab-1785239654814.png",
  },
  {
    name: "Olympic National Forest",
    slug: "olympic-national-forest",
    description:
      "A National Forest on the Olympic Peninsula in western Washington state.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-01ed0916-b648-4c2e-bf84-a23fefdd4750-1785239665346.png",
  },
  {
    name: "Osceola National Forest",
    slug: "osceola-national-forest",
    description:
      "A National Forest in northeastern Florida, south of Jacksonville.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-84e281fd-f575-4c01-8df9-3192eb8e749c-1785239677176.png",
  },
  {
    name: "Ottawa National Forest",
    slug: "ottawa-national-forest",
    description:
      "A National Forest in the Upper Peninsula of Michigan, in the western UP.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4eebec60-30cd-4b98-b2ad-e9254f6ef218-1785239686625.png",
  },
  {
    name: "Ouachita National Forest",
    slug: "ouachita-national-forest",
    description:
      "A National Forest spanning western Arkansas and southeastern Oklahoma.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6aec2448-d437-443a-87e9-4471cf0ba8eb-1785239696503.png",
  },
  {
    name: "Ozark-St. Francis National Forest",
    slug: "ozark-st-francis-national-forest",
    description:
      "A National Forest in northwestern Arkansas, combining the Ozark and St. Francis forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-333f46e2-561c-4d78-94ab-ffd455db5404-1785239712162.png",
  },
  {
    name: "Payette National Forest",
    slug: "payette-national-forest",
    description:
      "A National Forest in west-central Idaho, in the Payette River drainage.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-cc7c5a6b-dfe8-4b5c-a15a-9da936a708fd-1785239722358.png",
  },
  {
    name: "Pike National Forest",
    slug: "pike-nf",
    description: "A National Forest in central Colorado including Pikes Peak.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-22118796-ac51-4298-943d-cc7facf38bf5-1785241099038.png",
  },
  {
    name: "Pike and San Isabel National Forest",
    slug: "pike-and-san-isabel-national-forest",
    description:
      "A National Forest in central Colorado, part of the PSICC complex including Pikes Peak.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6a66031e-e745-4281-aa29-e753aeb05737-1785239750592.png",
  },
  {
    name: "Pisgah National Forest",
    slug: "pisgah-national-forest",
    description:
      "A National Forest in western North Carolina, part of the Pisgah-Nantahala complex in the Blue Ridge Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-2f961787-d25b-40dc-b0ff-a6053f44207d-1785239761051.png",
  },
  {
    name: "Plumas National Forest",
    slug: "plumas-nf",
    description:
      "A National Forest in the northern Sierra Nevada of California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e909ed3c-cb3f-447b-be1b-99de609433ea-1785241109396.png",
  },
  {
    name: "Prescott National Forest",
    slug: "prescott-national-forest",
    description:
      "A National Forest in central Arizona, in the Bradshaw Mountains area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6e5bac9a-d733-4ea5-bfca-70dacb19fdf0-1785239770589.png",
  },
  {
    name: "Rio Grande National Forest",
    slug: "rio-grande-national-forest",
    description:
      "A National Forest in central Colorado, in the San Luis Valley area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-c6948918-4683-43d5-a253-ff4239888b17-1785239780330.png",
  },
  {
    name: "Rogue River-Siskiyou National Forest",
    slug: "rogue-river-siskiyou-national-forest",
    description:
      "A National Forest in southwestern Oregon, combining the Rogue River and Siskiyou forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-511b4719-686f-43bc-8623-f7ad2465ddff-1785239790397.png",
  },
  {
    name: "Roosevelt National Forest",
    slug: "roosevelt-national-forest",
    description:
      "A National Forest in north-central Colorado, part of the ARP complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3bdaee49-09a3-4858-bffc-404552a56df8-1785240509070.png",
  },
  {
    name: "Routt National Forest",
    slug: "routt-national-forest",
    description:
      "A National Forest in central Colorado, part of the Medicine Bow-Routt complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-b7eb69e4-c55c-4c9a-a909-df8181a3294a-1785240493094.png",
  },
  {
    name: "Sabine National Forest",
    slug: "sabine-national-forest",
    description:
      "A National Forest in eastern Texas, in the Sabine Division of the National Forests of Texas.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8e5e176a-82f3-49d8-b89b-59efd3fee17d-1785240352401.png",
  },
  {
    name: "Salmon-Challis National Forest",
    slug: "salmon-challis-national-forest",
    description:
      "A National Forest in central Idaho, combining the Salmon and Challis areas in the Frank Church River of No Return Wilderness region.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-05291674-f935-4f9e-8f8c-af04d392cc18-1785239806296.png",
  },
  {
    name: "Sam Houston National Forest",
    slug: "sam-houston-national-forest",
    description:
      "A National Forest in eastern Texas, in the Sam Houston Division of the National Forests of Texas.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-f269713b-4d2a-48b4-9cc8-1d730ff0e0ca-1785240362270.png",
  },
  {
    name: "San Bernardino National Forest",
    slug: "san-bernardino-national-forest",
    description:
      "A National Forest in southern California, in the San Bernardino Mountains east of Los Angeles.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1760253a-f566-4015-9f82-a490625ad576-1785239816377.png",
  },
  {
    name: "San Bernardino-S Angeles National Forest",
    slug: "san-bernardino-s-angeles-national-forest",
    description:
      "A National Forest in central California, in the Sierra Nevada.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-8c9720da-7a83-43b2-b434-ec5a65446f9b-1785240653521.png",
  },
  {
    name: "San Isabel National Forest",
    slug: "san-isabel-national-forest",
    description:
      "A National Forest in central Colorado, part of the Pike and San Isabel complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ffb3601c-ef6e-4dca-b0f1-3d2f962514f8-1785240482295.png",
  },
  {
    name: "San Juan National Forest",
    slug: "san-juan-national-forest",
    description:
      "A National Forest in southwestern Colorado, in the San Juan Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9821e71c-4b3a-45b0-866c-974fc148587e-1785239826266.png",
  },
  {
    name: "Santa Fe National Forest",
    slug: "santa-fe-national-forest",
    description:
      "A National Forest in northern New Mexico, in the Sangre de Cristo Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-ed9dd44c-158e-4b4d-8920-8bb91ab950cc-1785239836548.png",
  },
  {
    name: "Sawtooth National Forest",
    slug: "sawtooth-national-forest",
    description:
      "A National Forest in central Idaho, in the Sawtooth Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-7d451943-4135-4a4f-bf88-1a8e7a335bee-1785239846956.png",
  },
  {
    name: "Sequoia National Forest",
    slug: "sequoia-nf",
    description:
      "A National Forest in the southern Sierra Nevada of California, home to giant sequoia groves.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-cf1d499f-8d54-4e36-84f7-21a2b3d0c0f1-1785241119001.png",
  },
  {
    name: "Shasta-Trinity National Forest",
    slug: "shasta-trinity-nf",
    description:
      "The largest National Forest in California, located in the northern part of the state.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9a933315-ded8-450e-a887-18f4771f66d9-1785241155714.png",
  },
  {
    name: "Shawnee National Forest",
    slug: "shawnee-national-forest",
    description:
      "A National Forest in southeastern Ohio, the only national forest in Ohio.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-d4a1cdce-f37b-453c-872d-60d671354b84-1785239878021.png",
  },
  {
    name: "Shoshone National Forest",
    slug: "shoshone-national-forest",
    description:
      "A National Forest in northwestern Wyoming, in the Absaroka and Wind River ranges.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-9484b61f-485a-47c9-a3a5-9c98cc076b80-1785239887649.png",
  },
  {
    name: "Sierra National Forest",
    slug: "sierra-nf",
    description:
      "A National Forest in the southern Sierra Nevada of California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-01072cad-59f6-4482-9488-e30533a5c5f6-1785241168071.png",
  },
  {
    name: "Sitgreaves National Forest",
    slug: "sitgreaves-national-forest",
    description:
      "A National Forest in eastern Arizona, in the Apache-Sitgreaves area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-53fc1d74-3435-4f8a-9ceb-79d9d594e0dc-1785240472536.png",
  },
  {
    name: "Siuslaw National Forest",
    slug: "siuslaw-national-forest",
    description:
      "A National Forest on the central Oregon coast, encompassing the Coast Range.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-41dacd1a-c41d-400d-b40b-2c2f53505341-1785239898304.png",
  },
  {
    name: "Six Rivers National Forest",
    slug: "six-rivers-national-forest",
    description:
      "A National Forest in northwestern California, named for the six rivers that flow through it.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-1e3e6fed-ef6e-4f2b-827f-57106becebdf-1785239908171.png",
  },
  {
    name: "Stanislaus National Forest",
    slug: "stanislaus-nf",
    description:
      "A National Forest in the central Sierra Nevada of California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-6d9f6275-11df-474e-a373-b0907dd4446e-1785241178125.png",
  },
  {
    name: "Sumter National Forest",
    slug: "sumter-national-forest",
    description:
      "A National Forest in eastern South Carolina, part of the Francis Marion and Sumter National Forests.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-891b6d64-679c-4203-b839-e5dc2b179fcd-1785239918495.png",
  },
  {
    name: "Superior National Forest",
    slug: "superior-national-forest",
    description:
      "A National Forest in northeastern Minnesota, including the Boundary Waters Canoe Area Wilderness.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-95c1a7a5-029c-4030-bbf9-de2f119d0a78-1785239935581.png",
  },
  {
    name: "Tahoe National Forest",
    slug: "tahoe-nf",
    description:
      "A National Forest located in the northern Sierra Nevada of California.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-edc659b9-5300-49fa-b41a-e7ab6adfc230-1785241188269.png",
  },
  {
    name: "Talladega National Forest",
    slug: "talladega-national-forest",
    description:
      "A National Forest in Arizona and New Mexico, in the Apache-Sitgreaves area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0e1947c4-0995-419d-b643-49ad20fb075a-1785241304296.png",
  },
  {
    name: "Tombigbee National Forest",
    slug: "tombigbee-national-forest",
    description:
      "A National Forest in eastern Mississippi, in the Tombigbee Division.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-7c6fd970-2b89-4f2e-aa5a-8c446d77d060-1785240317062.png",
  },
  {
    name: "Tongass National Forest",
    slug: "tongass-national-forest",
    description:
      "The largest national forest in the US, covering much of southeastern Alaska.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-19606030-6b2d-43f1-a970-aefeb1c2af73-1785239946197.png",
  },
  {
    name: "Tonto National Forest",
    slug: "tonto-national-forest",
    description:
      "A National Forest in central Arizona, surrounding the Phoenix metropolitan area.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-e3d1bbf1-d482-468c-b515-7571c2b66bf2-1785239956807.png",
  },
  {
    name: "Tuskegee National Forest",
    slug: "tuskegee-national-forest",
    description:
      "A National Forest in central Alabama, in the Talladega Division of the National Forests of Alabama.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-3d70268b-a41c-4323-a2fb-988025d6c573-1785240217135.png",
  },
  {
    name: "Uinta-Wasatch-Cache National Forest",
    slug: "uinta-wasatch-cache-national-forest",
    description:
      "A National Forest in Utah, combining the Uinta, Wasatch, and Cache forests in northern Utah.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4d3d6775-2c89-4907-aa66-477eb4cc7ddf-1785239966407.png",
  },
  {
    name: "Umatilla National Forest",
    slug: "umatilla-national-forest",
    description:
      "A National Forest in eastern Oregon and southeastern Washington, in the Blue Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-4549ab14-57cd-44f7-acbd-bf7bc27b295a-1785239976204.png",
  },
  {
    name: "Umpqua National Forest",
    slug: "umpqua-national-forest",
    description:
      "A National Forest in southwestern Oregon, in the Umpqua River basin.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-100641a5-e878-4b5b-a2f2-42e855d327c2-1785240031277.png",
  },
  {
    name: "Uncompahgre National Forest",
    slug: "uncompahgre-national-forest",
    description:
      "A National Forest in central Colorado, part of the GMUG complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-55e8cb4b-e489-452a-b8e1-fee5a72cbab6-1785239309323.png",
  },
  {
    name: "Uwharrie National Forest",
    slug: "uwharrie-national-forest",
    description:
      "A National Forest in eastern Tennessee and western North Carolina, part of the Pisgah-Nantahala complex.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-88c05a5d-ea05-47b1-b2bb-9e095fbe3126-1785240086879.png",
  },
  {
    name: "Wallowa-Whitman National Forest",
    slug: "wallowa-whitman-national-forest",
    description:
      "A National Forest in eastern Oregon, in the Wallowa Mountains.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-5122da7f-df1c-46f4-93bc-328fd0620723-1785240056834.png",
  },
  {
    name: "Wayne National Forest",
    slug: "wayne-national-forest",
    description:
      "A National Forest in southeastern Ohio, the only national forest in Ohio.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-96fff55e-47d1-4832-8d73-22d3e1ea2473-1785240067218.png",
  },
  {
    name: "White Mountain National Forest",
    slug: "white-mountain-national-forest",
    description:
      "A National Forest in northern New Hampshire, the only national forest in New Hampshire.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-7d44a554-9e63-4f01-9ac5-9e19053a7eff-1785240532457.png",
  },
  {
    name: "White River National Forest",
    slug: "white-river-nf",
    description:
      "The most visited National Forest in the country, located in Colorado.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-a4b84192-4e04-457a-a80b-4ec74e0a3d9c-1785241197623.png",
  },
  {
    name: "Willamette National Forest",
    slug: "willamette-nf",
    description:
      "A National Forest on the western slopes of the Cascade Range in Oregon.",
    organizationSlug: "usfs",
    coverImageUrl:
      "https://pub-0b0335fb17054a4bb1c52980eb08c3cc.r2.dev/generated-images/office-0d4c6f9d-697a-418a-a6af-72726a948c06-1785241207243.png",
  },
];
