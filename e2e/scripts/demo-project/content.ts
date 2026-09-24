/**
 * Static demo content for `seed-demo-project.ts`: a USFS Categorical Exclusion
 * for vegetation restoration on the Cleveland National Forest (Descanso Ranger
 * District, San Diego County, CA). Everything here is fictional but plausible.
 *
 * Titles, names and labels double as idempotency keys: the seed script deletes
 * rows whose title/name/label/content matches an entry here before re-creating
 * them, so edit an entry and re-run to replace it.
 */

export type DemoTaskStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "delayed";

export type DemoTask = {
  title: string;
  description: string;
  start: string;
  due: string;
  status: DemoTaskStatus;
  /** Titles of tasks (anywhere in the schedule) this task depends on */
  dependsOn?: string[];
  /** Original filenames of seeded documents to link to the task */
  documents?: string[];
};

export type DemoMilestone = {
  title: string;
  start: string;
  due: string;
  tasks: DemoTask[];
};

export type DemoField = {
  name: string;
  type: "text" | "list";
  values: string[];
};

export type DemoComment = {
  key: string;
  author: "owner" | "commenter";
  isPublic: boolean;
  content: string;
  replyTo?: string;
};

export type DemoTimelineEvent = {
  title: string;
  description: string;
  startedAt: string;
  endedAt?: string;
};

export type DemoDocument = {
  filename: string;
  title: string;
  paragraphs: string[];
};

/** Project schedule bounds — drive the project's start/end dates (progress bar). */
export const PROJECT_START = "2026-07-13";
export const PROJECT_END = "2027-09-24";

export const PROJECT_DESCRIPTION =
  "Restore approximately 1,250 acres of oak woodland, chaparral and riparian habitat in the Jackson Creek drainage (Descanso Ranger District, Cleveland National Forest) by masticating decadent chamise, hand-thinning encroaching brush around coast live oaks and removing non-native species along the creek. Analyzed as a Categorical Exclusion under 36 CFR 220.6(e)(6).";

export const DEMO_FIELDS: DemoField[] = [
  {
    name: "Project Acreage",
    type: "text",
    values: ["1,250 acres (NFS lands)"],
  },
  {
    name: "National Forest",
    type: "text",
    values: ["Cleveland National Forest"],
  },
  {
    name: "Ranger District",
    type: "text",
    values: ["Descanso Ranger District"],
  },
  {
    name: "County / State",
    type: "text",
    values: ["San Diego County, California"],
  },
  {
    name: "NEPA Pathway",
    type: "text",
    values: ["Categorical Exclusion — 36 CFR 220.6(e)(6)"],
  },
  { name: "Lead Agency", type: "text", values: ["USDA Forest Service"] },
  {
    name: "Consulting Agencies",
    type: "list",
    values: [
      "U.S. Fish and Wildlife Service (ESA Section 7)",
      "California State Historic Preservation Office",
      "San Diego Air Pollution Control District",
      "Kumeyaay tribal governments (government-to-government consultation)",
    ],
  },
  {
    name: "Watershed",
    type: "text",
    values: ["Upper Sweetwater River (HUC-12 181002030101)"],
  },
  {
    name: "Legal Description",
    type: "text",
    values: ["T15S R4E, Sections 10, 11, 14 and 15, SBBM"],
  },
  {
    name: "Vegetation Types",
    type: "list",
    values: [
      "Coast live oak woodland",
      "Chamise chaparral",
      "Sycamore–willow riparian",
      "Annual grassland",
    ],
  },
  {
    name: "Treatment Types",
    type: "list",
    values: [
      "Mastication of decadent chamise",
      "Hand thinning and piling",
      "Pile burning",
      "Non-herbicide invasive plant removal",
    ],
  },
  {
    name: "Decision Maker",
    type: "text",
    values: ["District Ranger, Descanso Ranger District"],
  },
  { name: "SOPA / PALS Number", type: "text", values: ["PALS #65123"] },
  { name: "Expected Decision", type: "text", values: ["May 2027"] },
];

export const DEMO_MILESTONES: DemoMilestone[] = [
  {
    title: "Project Initiation & Scoping",
    start: "2026-07-13",
    due: "2026-09-08",
    tasks: [
      {
        title: "Develop proposed action and purpose & need",
        description:
          "Draft the proposed action, purpose and need, and treatment prescriptions with the district silviculturist and fuels planner.",
        start: "2026-07-13",
        due: "2026-07-31",
        status: "completed",
      },
      {
        title: "List project on the Schedule of Proposed Actions (SOPA)",
        description:
          "Enter the project in PALS and publish it on the quarterly SOPA.",
        start: "2026-07-27",
        due: "2026-08-03",
        status: "completed",
        dependsOn: ["Develop proposed action and purpose & need"],
      },
      {
        title: "Mail scoping letter to interested parties",
        description:
          "Send the scoping letter and vicinity map to the project mailing list, tribes and agencies.",
        start: "2026-08-03",
        due: "2026-08-07",
        status: "completed",
        dependsOn: ["List project on the Schedule of Proposed Actions (SOPA)"],
        documents: ["Jackson Creek - Scoping Letter.pdf"],
      },
      {
        title: "30-day scoping period and public meeting",
        description:
          "Hold the public scoping meeting at the Descanso Community Hall and log all scoping comments.",
        start: "2026-08-07",
        due: "2026-09-08",
        status: "completed",
        dependsOn: ["Mail scoping letter to interested parties"],
      },
    ],
  },
  {
    title: "Resource Surveys",
    start: "2026-08-17",
    due: "2026-11-20",
    tasks: [
      {
        title: "Botany and rare plant surveys",
        description:
          "Floristic surveys of all treatment units, focusing on Cuyamaca larkspur and other Forest Service sensitive species.",
        start: "2026-08-17",
        due: "2026-10-09",
        status: "in_progress",
        documents: ["Jackson Creek - Botany Survey Interim Report.pdf"],
      },
      {
        title: "Wildlife surveys (spotted owl, arroyo toad habitat)",
        description:
          "Protocol call surveys for California spotted owl and habitat assessment for arroyo toad along Jackson Creek.",
        start: "2026-08-24",
        due: "2026-10-30",
        status: "in_progress",
      },
      {
        title: "Cultural resources survey and tribal consultation",
        description:
          "Intensive pedestrian survey of ground-disturbing units; initiate consultation with Kumeyaay tribal governments.",
        start: "2026-09-01",
        due: "2026-11-20",
        status: "in_progress",
      },
      {
        title: "Hydrology and soils field review",
        description:
          "Field review of riparian buffers and erosion hazard; delayed by the August red-flag closure.",
        start: "2026-09-08",
        due: "2026-09-22",
        status: "delayed",
      },
    ],
  },
  {
    title: "Effects Analysis & Specialist Reports",
    start: "2026-10-19",
    due: "2027-01-29",
    tasks: [
      {
        title: "Botany specialist report",
        description:
          "Biological evaluation for sensitive plants and invasive species risk assessment.",
        start: "2026-10-19",
        due: "2026-12-11",
        status: "not_started",
        dependsOn: ["Botany and rare plant surveys"],
      },
      {
        title: "Wildlife biological evaluation",
        description:
          "Effects determinations for sensitive and MIS wildlife species.",
        start: "2026-11-02",
        due: "2026-12-18",
        status: "not_started",
        dependsOn: ["Wildlife surveys (spotted owl, arroyo toad habitat)"],
      },
      {
        title: "Heritage report and SHPO concurrence",
        description:
          "Prepare the heritage report and request SHPO concurrence under the Region 5 Programmatic Agreement.",
        start: "2026-11-23",
        due: "2027-01-22",
        status: "not_started",
        dependsOn: ["Cultural resources survey and tribal consultation"],
      },
      {
        title: "ESA Section 7 informal consultation with USFWS",
        description:
          "Submit the biological assessment and obtain a letter of concurrence (not likely to adversely affect).",
        start: "2026-12-01",
        due: "2027-01-29",
        status: "not_started",
      },
    ],
  },
  {
    title: "Public Notice & Comment",
    start: "2027-02-01",
    due: "2027-04-02",
    tasks: [
      {
        title: "Publish legal notice in the San Diego Union-Tribune",
        description:
          "Publish the legal notice opening the optional 30-day comment period.",
        start: "2027-02-01",
        due: "2027-02-05",
        status: "not_started",
        dependsOn: ["Heritage report and SHPO concurrence"],
      },
      {
        title: "30-day public comment period",
        description: "Accept comments via CARA and the project inbox.",
        start: "2027-02-05",
        due: "2027-03-08",
        status: "not_started",
        dependsOn: ["Publish legal notice in the San Diego Union-Tribune"],
      },
      {
        title: "Analyze and respond to comments",
        description:
          "Code comments in CARA and prepare the response-to-comments appendix.",
        start: "2027-03-08",
        due: "2027-04-02",
        status: "not_started",
        dependsOn: ["30-day public comment period"],
      },
    ],
  },
  {
    title: "Decision",
    start: "2027-04-05",
    due: "2027-05-28",
    tasks: [
      {
        title: "Draft decision memo",
        description:
          "Prepare the decision memo, extraordinary circumstances review and project file index.",
        start: "2027-04-05",
        due: "2027-04-30",
        status: "not_started",
        dependsOn: ["Analyze and respond to comments"],
        documents: ["Jackson Creek - Draft Decision Memo.docx"],
      },
      {
        title: "Line officer review",
        description: "Forest NEPA coordinator and District Ranger review.",
        start: "2027-05-03",
        due: "2027-05-14",
        status: "not_started",
        dependsOn: ["Draft decision memo"],
      },
      {
        title: "Sign decision memo and notify interested parties",
        description:
          "District Ranger signs the DM; mail decision notification.",
        start: "2027-05-17",
        due: "2027-05-28",
        status: "not_started",
        dependsOn: ["Line officer review"],
      },
    ],
  },
  {
    title: "Implementation",
    start: "2027-06-01",
    due: "2027-09-24",
    tasks: [
      {
        title: "Unit layout and flagging",
        description:
          "Flag unit boundaries, riparian buffers and botanical/heritage avoidance areas.",
        start: "2027-06-01",
        due: "2027-06-18",
        status: "not_started",
        dependsOn: ["Sign decision memo and notify interested parties"],
      },
      {
        title: "Mastication of units JC-01 and JC-02",
        description:
          "Contracted masticator work outside the bird breeding season window where feasible.",
        start: "2027-06-21",
        due: "2027-08-13",
        status: "not_started",
        dependsOn: ["Unit layout and flagging"],
      },
      {
        title: "Hand thinning and piling in unit JC-03",
        description:
          "Hand crew thinning around coast live oaks; pile for burning.",
        start: "2027-07-06",
        due: "2027-08-27",
        status: "not_started",
        dependsOn: ["Unit layout and flagging"],
      },
      {
        title: "Riparian invasive removal in unit JC-04",
        description:
          "Manual removal of tamarisk and giant reed along Jackson Creek.",
        start: "2027-08-02",
        due: "2027-09-10",
        status: "not_started",
        dependsOn: ["Unit layout and flagging"],
      },
      {
        title: "Post-implementation monitoring",
        description:
          "Photo-point monitoring and invasive species re-sprout checks.",
        start: "2027-09-06",
        due: "2027-09-24",
        status: "not_started",
      },
    ],
  },
];

export const DEMO_COMMENTS: DemoComment[] = [
  {
    key: "scoping-open",
    author: "owner",
    isPublic: true,
    content:
      "The scoping period for the Jackson Creek Vegetation Restoration project is now open. Maps and the scoping letter are in the Documents section — comments are welcome through September 8.",
  },
  {
    key: "commenter-question",
    author: "commenter",
    isPublic: false,
    content:
      "I hike the Jackson Creek trail weekly. Will the mastication work close the trail, and how will you protect the big oaks near the creek crossing?",
  },
  {
    key: "owner-reply",
    author: "owner",
    isPublic: false,
    replyTo: "commenter-question",
    content:
      'Thanks for the comment! Short, posted closures are expected in units JC-01 and JC-02 during active work only. All coast live oaks over 6" DBH are retained, and the creek crossing sits inside the 50-ft riparian buffer where no equipment is allowed.',
  },
  {
    key: "internal-botany",
    author: "owner",
    isPublic: false,
    content:
      "Internal: botany crew found a new Cuyamaca larkspur occurrence at SP-01. Unit JC-01 boundary will be adjusted to flag a 100-ft avoidance buffer.",
  },
  {
    key: "internal-botany-followup",
    author: "owner",
    isPublic: false,
    replyTo: "internal-botany",
    content:
      "Follow-up: revised JC-01 boundary uploaded to the map; acreage drops by roughly 6 acres. Specialist report schedule unchanged.",
  },
];

export const DEMO_TIMELINE_EVENTS: DemoTimelineEvent[] = [
  {
    title: "Project listed on the SOPA",
    description:
      "Jackson Creek Vegetation Restoration appears on the Cleveland NF Schedule of Proposed Actions.",
    startedAt: "2026-08-03",
  },
  {
    title: "Scoping comment period",
    description:
      "30-day scoping period; 14 comment letters received from individuals, two organizations and one tribe.",
    startedAt: "2026-08-07",
    endedAt: "2026-09-08",
  },
  {
    title: "Public scoping meeting — Descanso Community Hall",
    description:
      "Open-house meeting with district specialists; about 35 attendees.",
    startedAt: "2026-08-20",
  },
  {
    title: "Botany field season",
    description: "Rare plant surveys across all four treatment units.",
    startedAt: "2026-08-17",
    endedAt: "2026-10-09",
  },
];

export const DEMO_CONTEXT = [
  {
    label: "Project background",
    content:
      "Jackson Creek drains the west slope of the Laguna Mountains into the upper Sweetwater River. Decades of fire exclusion left dense, decadent chamise chaparral encroaching on coast live oak woodland, and the riparian corridor is invaded by tamarisk and giant reed. The project restores stand structure on ~1,250 acres and reduces fuel continuity near Descanso.",
  },
  {
    label: "Key constraints",
    content:
      "Bird breeding season (Feb 15 – Aug 31) limits mechanical work; 50-ft no-equipment riparian buffer on Jackson Creek; Cuyamaca larkspur avoidance buffers; no herbicide use (required for the 220.6(e)(6) category); heritage sites flagged for avoidance.",
  },
  {
    label: "Scoping summary",
    content:
      "14 scoping letters: trail access during work (6), protection of large oaks (4), smoke from pile burning (2), support for invasive removal (2). No issues rose to extraordinary circumstances.",
  },
];

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    filename: "Jackson Creek - Scoping Letter.pdf",
    title: "Jackson Creek Vegetation Restoration - Scoping Letter",
    paragraphs: [
      "USDA Forest Service - Cleveland National Forest - Descanso Ranger District",
      "August 3, 2026",
      "Dear Interested Party,",
      "The Descanso Ranger District is proposing the Jackson Creek Vegetation Restoration project on approximately 1,250 acres of National Forest System lands in the Jackson Creek drainage, San Diego County, California (T15S R4E, Sections 10, 11, 14 and 15, SBBM).",
      "Purpose and need: decades of fire exclusion have allowed dense, decadent chamise chaparral to encroach on coast live oak woodland, increasing fuel continuity near the community of Descanso. Non-native tamarisk and giant reed are displacing native riparian vegetation along Jackson Creek.",
      "Proposed action: masticate decadent chaparral in units JC-01 and JC-02 (about 333 acres); hand-thin and pile brush around oaks in unit JC-03 (about 82 acres); manually remove invasive plants along the riparian corridor in unit JC-04 (about 88 acres). No herbicides and no new road construction are proposed.",
      "We anticipate documenting this decision with a Categorical Exclusion under 36 CFR 220.6(e)(6), timber stand and/or wildlife habitat improvement activities.",
      "Please send comments by September 8, 2026. A public open house will be held on August 20, 2026 at the Descanso Community Hall.",
      "Sincerely, District Ranger, Descanso Ranger District",
    ],
  },
  {
    filename: "Jackson Creek - Botany Survey Interim Report.pdf",
    title: "Jackson Creek - Botany Survey Interim Report",
    paragraphs: [
      "Survey period: August 17 - September 18, 2026. Surveyors: district botany crew (3 people).",
      "Methods: intuitive-controlled floristic surveys of all four treatment units, with focused searches in mesic openings and along the riparian corridor.",
      "Results to date: 212 vascular plant taxa recorded. One new occurrence of Cuyamaca larkspur (Delphinium hesperium ssp. cuyamacae), a Forest Service sensitive species, was found at survey point SP-01 in unit JC-01 (approximately 40 plants).",
      "Invasive species: tamarisk (Tamarix ramosissima) and giant reed (Arundo donax) are present along roughly 1.8 miles of Jackson Creek in unit JC-04; yellow star-thistle is scattered along NFSR 15S04.",
      "Recommendations: flag a 100-foot avoidance buffer around the SP-01 occurrence; clean equipment before entering units; schedule invasive removal before seed set.",
      "Remaining work: late-season surveys of unit JC-02 north slopes, to be completed by October 9, 2026.",
    ],
  },
  {
    filename: "Jackson Creek - Draft Decision Memo.docx",
    title: "Draft Decision Memo - Jackson Creek Vegetation Restoration",
    paragraphs: [
      "USDA Forest Service, Cleveland National Forest, Descanso Ranger District, San Diego County, California.",
      "Decision: I have decided to implement the Jackson Creek Vegetation Restoration project as described in this memo, on approximately 1,250 acres of National Forest System lands.",
      "Reasons for categorically excluding the decision: the action falls within the category at 36 CFR 220.6(e)(6), timber stand and/or wildlife habitat improvement activities that do not include herbicides or more than one mile of low-standard road construction.",
      "Extraordinary circumstances: no extraordinary circumstances were identified for federally listed species, floodplains or wetlands, wilderness, inventoried roadless areas, research natural areas, American Indian religious or cultural sites, or archaeological sites.",
      "Public involvement: the project was listed on the SOPA in August 2026 and scoped from August 7 to September 8, 2026; comments are summarized in the project record.",
      "Implementation date: implementation may begin immediately after this decision is signed.",
      "DRAFT - not for signature.",
    ],
  },
];

export const COMMENTER = {
  email: "demo.commenter@example.test",
  firstName: "Maria",
  lastName: "Delgado",
  city: "Descanso",
  state: "CA",
} as const;
