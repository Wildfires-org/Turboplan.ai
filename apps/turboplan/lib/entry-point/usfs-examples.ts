import type { EntryExample } from "./types";

/**
 * The 59 US Forest Service project types (categorical exclusions) offered by
 * the project-type picker on the 2024-2026 wildfires.org home page. The
 * examples below are drawn from them. "DM" marks the types documented in a
 * decision memo.
 */
export const USFS_PROJECT_TYPES = [
  { id: "ce.fuel_break", name: "Fuel Break" },
  { id: "ce.wildfire", name: "Wildfire resilience (HFRA)" },
  { id: "ce.insect_disease", name: "Insect and Disease (HFRA)" },
  {
    id: "ce.insect_disease_small",
    name: "Sanitation Harvest to control Insects or Disease",
  },
  { id: "ce.timber_wildlife", name: "Timber Stand & Wildlife Improvement" },
  {
    id: "ce.sanitation_harvest",
    name: "Sale or Exchange of Land or Interest in Land and Resources (no DM)",
  },
  { id: "ce.small_sale", name: "Small Sale" },
  { id: "ce.salvage", name: "Small Salvage" },
  {
    id: "ce.forest_grassland_resilience",
    name: "Forest & Grassland Management",
  },
  { id: "ce.fuels_and_road_management", name: "Fuels and Road Management" },
  { id: "ce.inyo_fuels", name: "Inyo: Fuels and Road Management" },
  { id: "ce.klamath_fuels", name: "Klamath: Fuels and Road Management" },
  {
    id: "ce.tahoe_basin_coordinated_fuels_reduction",
    name: "Tahoe Basin: Coordinated Fuels Reduction",
  },
  {
    id: "ce.tahoe_basin_coordinated_fuels_planning",
    name: "Tahoe Basin: Fuels Reduction Planning",
  },
  {
    id: "ce.tahoe_basin_strategy_consistent_fuels_reduction",
    name: "Tahoe Basin: Strategy-Consistent Fuels Reduction",
  },
  {
    id: "ce.aquatic_habitat_improvement",
    name: "Aquatic Habitat Improvement",
  },
  { id: "ce.post_fire_rehabilitation", name: "Post-fire Rehabilitation" },
  {
    id: "ce.sage_grouse_or_mule_deer_habitat",
    name: "Sage Grouse or Mule Deer Habitat",
  },
  {
    id: "ce.aquatic_restoration_from_control_structures",
    name: "Aquatic Restoration through Control Structures",
  },
  {
    id: "ce.construction_and_reconstruction_of_trails",
    name: "Construction and Reconstruction of Trails (DM)",
  },
  { id: "ce.native_tree_regeneration", name: "Native Tree Regeneration" },
  {
    id: "ce.post_disturbance_restoration",
    name: "Post-disturbance Restoration",
  },
  {
    id: "ce.silvicultural_assessment_and_research",
    name: "Silvicultural Assessment and Research",
  },
  {
    id: "ce.approval_modification_or_continuation_of_special_uses",
    name: "Approval, Modification, or Continuation of Special Uses",
  },
  {
    id: "ce.forest_plans_plan_amendments_and_plan_revisions",
    name: "Land Management Plans, Plan Amendments, and Plan Revisions",
  },
  { id: "ce.oil_and_gas_exploration", name: "Oil and Gas Exploration" },
  {
    id: "ce.repair_and_maintenance_of_administrative_sites",
    name: "Repair and Maintenance of Administrative Sites (no DM)",
  },
  {
    id: "ce.repair_and_maintenance_of_recreation_sites_and_facilities",
    name: "Repair and Maintenance of Recreation Sites and Facilities (no DM)",
  },
  {
    id: "ce.repair_and_maintenance_of_roads_trails_and_landline_boundaries",
    name: "Repair and Maintenance of Roads, Trails, and Landline Boundaries (no DM)",
  },
  {
    id: "ce.roads_and_trails_to_natural_condition",
    name: "Restoration of Roads and Trails to Natural Condition",
  },
  {
    id: "ce.grazing_allotment_management_without_plans",
    name: "Grazing Allotment Management Without Plans",
  },
  { id: "ce.grazing_permit_or_lease", name: "Grazing Permit or Lease" },
  {
    id: "ce.livestock_trailing_and_crossing",
    name: "Livestock Trailing and Crossing",
  },
  {
    id: "ce.oil_or_gas_drilling_at_previous_site",
    name: "Oil or Gas: Drilling at Previous Site",
  },
  {
    id: "ce.oil_or_gas_drilling_within_a_developed_field",
    name: "Oil or Gas: Drilling Within a Developed Field",
  },
  { id: "ce.oil_or_gas_maintenance", name: "Oil or Gas Maintenance" },
  {
    id: "ce.oil_or_gas_pipeline_placement",
    name: "Oil or Gas: Pipeline Placement",
  },
  {
    id: "ce.oil_or_gas_surface_disturbance",
    name: "Oil or Gas: Surface Disturbance",
  },
  {
    id: "ce.short_term_forest_orders",
    name: "Short-term Forest Orders (no DM)",
  },
  {
    id: "ce.minerals_energy_geophysical_investigations",
    name: "Short-term Minerals, Energy, or Geophysical Investigations",
  },
  {
    id: "ce.land_acquisition_or_interest",
    name: "Acquisition of Land or Interest in Land (no DM)",
  },
  {
    id: "ce.administrative_site_infrastructure_management",
    name: "Administrative Site Infrastructure Management",
  },
  {
    id: "ce.adopting_federal_highway_administration_environmental_reviews",
    name: "Adopting Federal Highway Administration Environmental Reviews",
  },
  {
    id: "ce.advice_and_consultative_activities",
    name: "Advice and Consultative Activities",
  },
  {
    id: "ce.construction_and_reconstruction_of_existing_utilities",
    name: "Construction and Reconstruction of Existing Utilities",
  },
  {
    id: "ce.educational_and_informational_programs_and_activities",
    name: "Educational and Informational Programs and Activities",
  },
  {
    id: "ce.establish_administrative_procedure_process_or_instruction",
    name: "Establish Administrative Procedure, Process, or Instruction (no DM)",
  },
  { id: "ce.funding_programs", name: "Funding Programs" },
  { id: "ce.inventory_and_research", name: "Inventory and Research" },
  {
    id: "ce.new_or_amended_existing_recreation_special_use_authorization",
    name: "Issuance or Amendment of an Authorization for Recreation Special Uses (no DM)",
  },
  {
    id: "ce.law_enforcement_investigation",
    name: "Law Enforcement Investigation",
  },
  {
    id: "ce.recreation_site_infrastructure_construction_reconstruction_decommissioning_or_disposal",
    name: "Recreation Site Infrastructure Management",
  },
  {
    id: "ce.replacement_of_existing_or_expired_special_use_authorization",
    name: "Replacement of Existing or Expired Special Use Authorization (no DM)",
  },
  {
    id: "ce.construction_realignment_of_roads",
    name: "Road Construction and Realignment",
  },
  {
    id: "ce.non_construction_road_management",
    name: "Road Management without Construction",
  },
  {
    id: "ce.routine_activity_policy_development_and_implementation",
    name: "Routine Activity Policy Development and Implementation",
  },
  { id: "ce.short_term_special_uses", name: "Short-term Special Uses (no DM)" },
  {
    id: "ce.ski_area_permit_issuance",
    name: "Ski Area Permit Issuance (no DM)",
  },
  {
    id: "ce.trade_and_market_development_abroad",
    name: "Trade and Market Development Abroad",
  },
] as const;

export type UsfsProjectTypeId = (typeof USFS_PROJECT_TYPES)[number]["id"];

type UsfsExample = EntryExample & { projectType: UsfsProjectTypeId };

/**
 * Example chips for a Forest Service audience, most common work first: the
 * agency's own forestry, restoration and facilities work, not projects a
 * business applies for. The places are made up; the work and acreages are
 * typical of each project type.
 */
export const USFS_EXAMPLES: UsfsExample[] = [
  {
    id: "fuel-break",
    label: "Fuel break",
    icon: "flame",
    projectType: "ce.fuel_break",
    projectTitle: "Cedar Ridge Fuel Break",
    prompt:
      "I'm the NEPA planner on the Cedar Ridge Ranger District. We want to build a 300-foot-wide shaded fuel break along 14 miles of ridgeline above the Pine Hollow community, about 2,400 acres in the wildland-urban interface. Work includes thinning small trees, masticating brush and burning piles, using existing roads only. Help me scope it under the fuel break categorical exclusion and draft the decision memo.",
  },
  {
    id: "wildfire-resilience",
    label: "Wildfire resilience",
    icon: "trees",
    projectType: "ce.wildfire",
    projectTitle: "Bear Creek Wildfire Resilience Project",
    prompt:
      "I'm leading the interdisciplinary team for the Bear Creek wildfire resilience project: about 2,800 acres of dry mixed-conifer forest next to the town of Millbrook. We plan variable-density thinning, ladder-fuel removal and follow-up prescribed burning. I want to use the HFRA wildfire resilience categorical exclusion, so help me check its acreage and collaboration requirements and outline the decision memo.",
  },
  {
    id: "insect-disease",
    label: "Bark beetle",
    icon: "bug",
    projectType: "ce.insect_disease",
    projectTitle: "Sawmill Flats Insect and Disease Project",
    prompt:
      "Bark beetle mortality is spreading through overstocked pine stands in the Sawmill Flats area of our district. I'm proposing a 2,500-acre insect and disease project under the HFRA categorical exclusion: thinning dense stands, removing infested and hazard trees along forest roads, and planting seedlings where mortality is heavy. The area is inside a designated insect and disease treatment area. Draft a proposed action and a scoping letter.",
  },
  {
    id: "post-fire",
    label: "Post-fire rehab",
    icon: "shovel",
    projectType: "ce.post_fire_rehabilitation",
    projectTitle: "Granite Butte Fire Rehabilitation",
    prompt:
      "Last summer's Granite Butte Fire burned about 6,000 acres on our district. I'm planning rehabilitation on roughly 3,500 acres within the burn: seeding native grasses on severely burned slopes, installing erosion control above the Willow Creek road, repairing fences and trails, and treating weeds that spread along dozer lines. Help me document it under the post-fire rehabilitation categorical exclusion and draft the decision memo.",
  },
  {
    id: "reforestation",
    label: "Reforestation",
    icon: "sprout",
    projectType: "ce.native_tree_regeneration",
    projectTitle: "Lone Pine Reforestation",
    prompt:
      "I'm a silviculturist planning to reforest about 1,200 acres that burned at high severity three years ago in the Lone Pine area. We'd plant ponderosa pine and Douglas-fir seedlings grown from local seed, prepare sites by hand, and come back for release treatments in later years. Help me set this up as a native tree regeneration categorical exclusion and list the surveys we need before planting.",
  },
  {
    id: "road-repair",
    label: "Road repair",
    icon: "construction",
    projectType:
      "ce.repair_and_maintenance_of_roads_trails_and_landline_boundaries",
    projectTitle: "Forest Road 45 Storm Repairs",
    prompt:
      "Spring storms washed out two sections of Forest Road 45, the main access to Bluebell campground and the Bluebell trailhead. I'm planning to rebuild the road prism, replace a failed culvert, add drainage dips and resurface three miles of road, all within the existing footprint. Help me document the work under the road maintenance categorical exclusion and put together the project file.",
  },
  {
    id: "trail-reroute",
    label: "Trail reroute",
    icon: "footprints",
    projectType: "ce.construction_and_reconstruction_of_trails",
    projectTitle: "Raven Lake Trail Reroute",
    prompt:
      "A steep stretch of the Raven Lake trail is eroding and draining straight into the lake. I'm planning to reroute 1.8 miles onto a sustainable grade, close and revegetate the old tread, and build two drainage crossings. It's a popular day hike, so we'll need a temporary closure during construction. Help me write this up under the trail construction categorical exclusion with a decision memo.",
  },
  {
    id: "stream-habitat",
    label: "Stream habitat",
    icon: "fish",
    projectType: "ce.aquatic_habitat_improvement",
    projectTitle: "Willow Creek Habitat Restoration",
    prompt:
      "I'm a fisheries biologist planning in-stream habitat work on four miles of Willow Creek: placing large wood structures, reconnecting two side channels and planting willows along eroding banks. The creek holds native trout, so work would stay inside the summer in-water work window. Help me scope it under the aquatic habitat improvement categorical exclusion and list the consultations we'll need.",
  },
  {
    id: "culvert-replacement",
    label: "Fish passage",
    icon: "waves",
    projectType: "ce.aquatic_restoration_from_control_structures",
    projectTitle: "Mill Creek Fish Passage",
    prompt:
      "Three undersized culverts on Forest Road 2110 block fish passage on Mill Creek and its tributaries, and an old diversion dam upstream no longer serves any water right. I'm proposing to replace the culverts with open-bottom arches sized for the 100-year flow and remove the dam. Help me check the aquatic restoration categorical exclusion and outline the decision memo, including timing limits and erosion controls.",
  },
  {
    id: "road-decommissioning",
    label: "Road decommissioning",
    icon: "route",
    projectType: "ce.roads_and_trails_to_natural_condition",
    projectTitle: "Upper Basin Road Decommissioning",
    prompt:
      "Our travel analysis found about 12 miles of unneeded roads in the Upper Basin watershed that are delivering sediment to fish-bearing streams. I'm proposing to decommission them by ripping and recontouring the road beds, pulling culverts and seeding with native species. Help me check the categorical exclusion for restoring roads to a natural condition and draft the scoping letter.",
  },
  {
    id: "small-salvage",
    label: "Small salvage",
    icon: "axe",
    projectType: "ce.salvage",
    projectTitle: "Elk Ridge Windthrow Salvage",
    prompt:
      "A winter windstorm blew down timber on about 220 acres along Elk Ridge. I'm proposing a small salvage sale to remove dead and down trees, using existing roads plus half a mile of temporary road that we'll decommission afterward. Help me confirm it fits the salvage categorical exclusion and draft the scoping notice and decision memo.",
  },
  {
    id: "small-sale",
    label: "Small timber sale",
    icon: "tree-pine",
    projectType: "ce.small_sale",
    projectTitle: "Hollow Spring Small Sale",
    prompt:
      "We'd like to offer a small thinning sale on about 65 acres of overstocked second-growth near Hollow Spring, using existing system roads and no new road construction. The goals are healthier stands and local sawlogs and firewood. Help me check it against the small-sale categorical exclusion and draft the project record.",
  },
  {
    id: "stand-improvement",
    label: "Stand improvement",
    icon: "leaf",
    projectType: "ce.timber_wildlife",
    projectTitle: "Deer Meadow Stand Improvement",
    prompt:
      "I'm planning precommercial thinning and pruning on about 1,500 acres of young plantations in the Deer Meadow area, plus small openings and snags for wildlife. Hand crews would do the work from existing roads, with no herbicide. Help me document it under the timber stand and wildlife habitat improvement categorical exclusion and draft the decision memo.",
  },
  {
    id: "mule-deer-habitat",
    label: "Mule deer habitat",
    icon: "paw-print",
    projectType: "ce.sage_grouse_or_mule_deer_habitat",
    projectTitle: "Juniper Ridge Winter Range Restoration",
    prompt:
      "Juniper is crowding out the sagebrush and bitterbrush winter range on Juniper Ridge. I'm planning to cut encroaching juniper by hand on about 3,000 acres to restore mule deer winter range and sage grouse habitat, with no new roads. Help me scope it under the sage grouse and mule deer habitat categorical exclusion and list the wildlife surveys we'll need.",
  },
  {
    id: "campground-upgrade",
    label: "Campground upgrade",
    icon: "tent",
    projectType: "ce.repair_and_maintenance_of_recreation_sites_and_facilities",
    projectTitle: "Aspen Grove Campground Upgrades",
    prompt:
      "Aspen Grove campground needs work: replacing two vault toilets, resurfacing the loop road and spurs, swapping out 30 picnic tables and fire rings, and making six sites accessible. Everything stays inside the existing footprint. Help me document it under the recreation site maintenance categorical exclusion and schedule the work around the summer season.",
  },
  {
    id: "guard-station",
    label: "Guard station repairs",
    icon: "warehouse",
    projectType: "ce.repair_and_maintenance_of_administrative_sites",
    projectTitle: "Fox Creek Guard Station Repairs",
    prompt:
      "The Fox Creek guard station needs a new roof, a replacement septic system and an accessible ramp. The building is more than 50 years old, so our heritage staff will need to weigh in. Help me document the work under the administrative site maintenance categorical exclusion and put together the project file.",
  },
];
