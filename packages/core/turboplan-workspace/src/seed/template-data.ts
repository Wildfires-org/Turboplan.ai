/**
 * Seed data for template projects.
 *
 * Each template references an existing USFS office by slug.
 * Cover images are hosted on Cloudflare R2.
 */

import { getR2Env } from "@wildfires-org/turboplan-env";

export type TemplateSeed = {
  name: string;
  slug: string;
  description: string;
  organizationSlug: string;
  officeSlug: string;
  coverImageUrl: string;
};

const COVER_IMAGE_KEYS = [
  "generated-images/project-9a9f7096-46fc-4d15-8489-877fa689527f-1770379803359-8f5VpGxmFoxy0rGzWnyoDW2Lq0UQeb.png",
  "generated-images/project-9f63208c-c3f9-4b44-a121-a7bf8b0822a8-1770391824708-zomnHOugBv8X8qTc2e5msBGZgHtEP7.png",
  "generated-images/project-1fd6150d-7aa7-4d20-b927-86126b089970-1770379021217-w7dVBIIsVz3toklrbJ3PiqdychDi0N.png",
];

export const getTemplateSeeds = (): TemplateSeed[] => {
  const { R2_PUBLIC_URL } = getR2Env();
  const getCoverImageUrl = (index: number) =>
    `${R2_PUBLIC_URL}/${COVER_IMAGE_KEYS[index]}`;

  return [
    {
      name: "Fuel Break CE",
      slug: "fuel-break-ce",
      description:
        "Categorical exclusion template for fuel break construction and maintenance projects to reduce wildfire risk.",
      organizationSlug: "usfs",
      officeSlug: "tahoe-nf",
      coverImageUrl: getCoverImageUrl(0),
    },
    {
      name: "Insects and Disease CE",
      slug: "insects-and-disease-ce",
      description:
        "Categorical exclusion template for insect and disease management activities in national forests.",
      organizationSlug: "usfs",
      officeSlug: "shasta-trinity-nf",
      coverImageUrl: getCoverImageUrl(1),
    },
    {
      name: "Wildfire Resilience CE",
      slug: "wildfire-resilience-ce",
      description:
        "Categorical exclusion template for wildfire resilience and forest health improvement projects.",
      organizationSlug: "usfs",
      officeSlug: "eldorado-nf",
      coverImageUrl: getCoverImageUrl(2),
    },
    {
      name: "Routine Road Maintenance CE",
      slug: "routine-road-maintenance-ce",
      description:
        "Categorical exclusion template for routine maintenance of forest roads and trails.",
      organizationSlug: "usfs",
      officeSlug: "plumas-nf",
      coverImageUrl: getCoverImageUrl(0),
    },
    {
      name: "Harvesting of Live Trees CE",
      slug: "harvesting-of-live-trees-ce",
      description:
        "Categorical exclusion template for timber harvesting projects involving live tree removal.",
      organizationSlug: "usfs",
      officeSlug: "lassen-nf",
      coverImageUrl: getCoverImageUrl(1),
    },
    {
      name: "Post-fire Rehabilitation CE",
      slug: "post-fire-rehabilitation-ce",
      description:
        "Categorical exclusion template for post-fire rehabilitation and reforestation efforts.",
      organizationSlug: "usfs",
      officeSlug: "stanislaus-nf",
      coverImageUrl: getCoverImageUrl(2),
    },
  ];
};
