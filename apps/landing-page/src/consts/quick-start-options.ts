export const QUICK_START_OPTIONS: Record<string, string> = {
  "USFS Fuel Break CE":
    "I'm a NEPA planner at Umatilla NF, and I'm working on the P52 fuel break which will put a 2500-acre fuel break into WUI at Heppner Ranger District.",
  "USFS Veg EA":
    "I'm a silviculturist at Rogue River-Siskiyou NF, preparing an EA for the 1,200-acre Jackson Creek vegetation restoration project to reduce fuels and restore late-successional habitat.",
  "USFS Road Repair":
    "I'm a NEPA planner at Tahoe NF, and I'm managing the repair of a washed-out section of Forest Road 43 to restore safe access to campgrounds and trailheads.",
};

export interface QuickStartExample {
  emoji: string;
  label: string;
  prompt: string;
}

// Hero pill carousel: US Forest Service projects on national forests and
// grasslands, the work TurboPlan is built for. Prompts are representative
// NEPA/CE scenarios, not real project data.
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
    emoji: "🪲",
    label: "Bark Beetle Response",
    prompt:
      "I'm a silviculturist at Black Hills NF, planning a 2,000-acre thinning project to slow mountain pine beetle spread in overstocked ponderosa pine stands.",
  },
  {
    emoji: "🌱",
    label: "Post-fire Reforestation",
    prompt:
      "I'm a forester at Eldorado NF, planning to plant mixed-conifer seedlings on 1,500 acres that burned at high severity in a recent wildfire.",
  },
  {
    emoji: "🪵",
    label: "Prescribed Burns",
    prompt:
      "I'm a fuels specialist at Boise NF, coordinating prescribed burns on 4,000 acres to reduce fuel loads and restore open ponderosa pine forest.",
  },
  {
    emoji: "🥾",
    label: "Trail Reroute",
    prompt:
      "I'm a recreation planner at Mt. Hood NF, rerouting two miles of an eroding trail onto a sustainable grade and restoring the old tread.",
  },
  {
    emoji: "🐟",
    label: "Fish Passage",
    prompt:
      "I'm a fisheries biologist at Siuslaw NF, replacing three undersized culverts that block coho salmon passage under a forest road.",
  },
  {
    emoji: "🌊",
    label: "Stream Restoration",
    prompt:
      "I'm a hydrologist at Okanogan-Wenatchee NF, adding large wood and reconnecting side channels along four miles of a native trout stream.",
  },
  {
    emoji: "🛣️",
    label: "Road Decommissioning",
    prompt:
      "I'm a hydrologist at Nez Perce-Clearwater NF, decommissioning 12 miles of unneeded forest roads that are delivering sediment to streams.",
  },
  {
    emoji: "🦌",
    label: "Mule Deer Habitat",
    prompt:
      "I'm a wildlife biologist at Fremont-Winema NF, cutting encroaching juniper on 3,000 acres to restore mule deer winter range.",
  },
  {
    emoji: "🌿",
    label: "Invasive Weed Treatment",
    prompt:
      "I'm a botanist at Coconino NF, treating invasive weeds along 40 miles of forest roads and in recently burned areas.",
  },
  {
    emoji: "🏕️",
    label: "Campground Upgrade",
    prompt:
      "I'm a recreation manager at Sawtooth NF, replacing vault toilets and making six campsites accessible at a lakeside campground.",
  },
  {
    emoji: "🏚️",
    label: "Guard Station Repairs",
    prompt:
      "I'm a facilities engineer at Bitterroot NF, replacing the roof and septic system of a historic guard station.",
  },
];
