export const QUICK_START_OPTIONS: Record<string, string> = {
  "USFS Fuel Break CE":
    "I'm a NEPA planner at Umatilla NF, and I'm working on the P52 fuel break which will put a 2500-acre fuel break into WUI at Heppner Ranger District.",
  "USFS Veg EA":
    "I'm a silviculturist at Rogue River-Siskiyou NF, preparing an EA for the 1,200-acre Jackson Creek vegetation restoration project to reduce fuels and restore late-successional habitat.",
  "BLM Road Repair":
    "I'm a project lead in Utah, managing the reconstruction of a 5-mile segment of the popular Moab Slickrock Trail damaged by erosion.",
};

export interface QuickStartExample {
  emoji: string;
  label: string;
  prompt: string;
}

// Hero pill carousel — one example per federal agency, covering the range of
// project types TurboPlan is used for. Prompts are representative NEPA/CE
// scenarios, not real project data.
export const QUICK_START_EXAMPLES: QuickStartExample[] = [
  {
    emoji: "🚧",
    label: "Forest Road Repair",
    prompt:
      "I'm a NEPA planner at Tahoe NF, and I'm managing the repair of a washed-out section of Forest Road 43 to ensure safe access to recreation areas.",
  },
  {
    emoji: "🔥",
    label: "Fuels Reduction CE",
    prompt:
      "I'm a NEPA planner at Umatilla NF, and I'm working on the P52 fuel break which will put a 2500-acre fuel break into WUI at Heppner Ranger District.",
  },
  {
    emoji: "🌳",
    label: "Wildfire Resilience",
    prompt:
      "I'm a forester at Shasta-Trinity NF, and I'm coordinating a 3000-acre thinning project to reduce wildfire risk in the Wildland Urban Interface.",
  },
  {
    emoji: "🐄",
    label: "Rangeland Grazing CE",
    prompt:
      "I'm a land manager in Colorado and am renewing a 10-year grazing permit for a 1500-acre allotment in the San Luis Valley.",
  },
  {
    emoji: "🥾",
    label: "Trail Reconstruction",
    prompt:
      "I'm a project lead in Utah, managing the reconstruction of a 5-mile segment of the popular Moab Slickrock Trail damaged by erosion.",
  },
  {
    emoji: "⛽",
    label: "Pipeline Maintenance",
    prompt:
      "I'm overseeing routine maintenance of oil and gas pipelines crossing public lands in the Powder River Basin.",
  },
  {
    emoji: "🏞️",
    label: "Park Trail Repair",
    prompt:
      "I'm an NPS planner at Rocky Mountain NP, coordinating the repair of a damaged section of Bear Lake Trail after a winter storm.",
  },
  {
    emoji: "🏛️",
    label: "Historic Preservation",
    prompt:
      "I'm managing restoration work on the historic Yosemite Valley Chapel to ensure it remains structurally sound and accessible.",
  },
  {
    emoji: "💡",
    label: "Campground Lighting",
    prompt:
      "I'm responsible for replacing outdated lighting in campgrounds with energy-efficient alternatives in Great Smoky Mountains NP.",
  },
  {
    emoji: "☀️",
    label: "Solar Installation",
    prompt:
      "I'm a project lead installing rooftop solar panels on a DOE research facility in New Mexico to reduce energy consumption.",
  },
  {
    emoji: "🌿",
    label: "Habitat Restoration",
    prompt:
      "I'm managing a project to remove invasive plants and replant native vegetation in the Wetland Reserve Program area in Florida.",
  },
  {
    emoji: "🌉",
    label: "Guardrail Repair",
    prompt:
      "I'm overseeing the replacement of a damaged guardrail on a rural highway in Virginia after flood damage.",
  },
  {
    emoji: "🚦",
    label: "Highway Safety CE",
    prompt:
      "I'm implementing safety upgrades, including new signage and rumble strips, along a stretch of Highway 22 in Oregon.",
  },
  {
    emoji: "🚢",
    label: "Channel Dredging",
    prompt:
      "I'm leading dredging operations in the Mississippi River to ensure safe passage for commercial shipping.",
  },
  {
    emoji: "✈️",
    label: "Airfield Repaving",
    prompt:
      "I'm overseeing the resurfacing of a taxiway at Denver International Airport to address wear and tear.",
  },
  {
    emoji: "💧",
    label: "Water Quality Testing",
    prompt:
      "I'm conducting water quality testing in Chesapeake Bay to track pollution levels and restoration progress.",
  },
  {
    emoji: "🏘️",
    label: "Housing Rehab CE",
    prompt:
      "I'm managing a project to upgrade plumbing and electrical systems in a 50-unit affordable housing complex in Chicago.",
  },
  {
    emoji: "🪵",
    label: "Prescribed Burns",
    prompt:
      "I'm coordinating prescribed burns in Idaho to reduce fuel loads and improve habitat for sage grouse.",
  },
  {
    emoji: "🌾",
    label: "Soil Conservation",
    prompt:
      "I'm working with local farmers in Iowa to install contour buffer strips to reduce soil erosion.",
  },
  {
    emoji: "🌊",
    label: "Seagrass Restoration",
    prompt:
      "I'm restoring seagrass beds along the Florida Keys to support marine life and improve water quality.",
  },
];
