import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LANDING_UPLOADS_PARAM } from "@wildfires-org/turboplan-upload/types";

import {
  buildSelfServiceHandoffUrl,
  proposeProjectTitle,
} from "../lib/entry-point/handoff";
import { USFS_EXAMPLES } from "../lib/entry-point/usfs-examples";
import { parseLandingUploadKeys } from "../lib/landing-uploads";
import { parseSignupAttribution } from "../lib/signup-attribution";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const stagingKey = (name: string) =>
  `landing-uploads/1730000000000-${UUID}-${name}`;

/** Reads a handoff URL the way app/self-service/hooks/use-url-params does. */
const readAsSelfService = (href: string) => {
  const url = new URL(href, "http://localhost:3000");
  return {
    pathname: url.pathname,
    email: url.searchParams.get("email"),
    projectTitle: url.searchParams.get("projectTitle"),
    projectDescription: url.searchParams.get("projectDescription"),
    landingUploadKeys: parseLandingUploadKeys(url.searchParams),
    attribution: parseSignupAttribution(url.searchParams),
  };
};

describe("buildSelfServiceHandoffUrl", () => {
  it("hands the prompt and project name to /self-service", () => {
    const prompt = "  Thin 400 acres of overstocked pine near Elk Ridge.\n";
    const handoff = readAsSelfService(
      buildSelfServiceHandoffUrl({
        prompt,
        projectTitle: "Elk Ridge Thinning",
      }),
    );

    assert.equal(handoff.pathname, "/self-service");
    assert.equal(handoff.projectTitle, "Elk Ridge Thinning");
    assert.equal(
      handoff.projectDescription,
      "Thin 400 acres of overstocked pine near Elk Ridge.",
    );
    assert.equal(handoff.landingUploadKeys, undefined);
    assert.equal(handoff.attribution, undefined);
  });

  it("leaves the email for the self-service form to ask for", () => {
    const handoff = readAsSelfService(
      buildSelfServiceHandoffUrl({ prompt: "Fuel break", projectTitle: "X" }),
    );

    // Without an email (or a session) the form does not auto-submit.
    assert.equal(handoff.email, null);
  });

  it("carries every attached document's staging key", () => {
    const keys = [stagingKey("scoping.pdf"), stagingKey("map & notes.docx")];
    const href = buildSelfServiceHandoffUrl({
      prompt: "Culvert replacements",
      projectTitle: "Mill Creek Fish Passage",
      uploadKeys: keys,
    });

    assert.deepEqual(
      new URL(href, "http://localhost").searchParams.getAll(
        LANDING_UPLOADS_PARAM,
      ),
      keys,
    );
    assert.deepEqual(readAsSelfService(href).landingUploadKeys, keys);
  });

  it("forwards campaign attribution and the anonymous analytics id", () => {
    const handoff = readAsSelfService(
      buildSelfServiceHandoffUrl({
        prompt: "Trail reroute",
        projectTitle: "Raven Lake Trail Reroute",
        attribution: {
          utm_source: "newsletter",
          utm_campaign: "fall",
          ph_did: "anon-123",
        },
      }),
    );

    assert.deepEqual(handoff.attribution, {
      ph_did: "anon-123",
      utm_source: "newsletter",
      utm_campaign: "fall",
    });
  });
});

describe("proposeProjectTitle", () => {
  const [fuelBreak] = USFS_EXAMPLES;

  it("uses the example's name when its prompt is sent unchanged", () => {
    assert.equal(
      proposeProjectTitle(fuelBreak.prompt, fuelBreak),
      fuelBreak.projectTitle,
    );
    assert.equal(
      proposeProjectTitle(`\n${fuelBreak.prompt}  `, fuelBreak),
      fuelBreak.projectTitle,
    );
  });

  it("falls back to the prompt once the example was edited", () => {
    assert.equal(
      proposeProjectTitle("Shaded fuel break on Cedar Ridge.", fuelBreak),
      "Shaded fuel break on Cedar Ridge",
    );
  });

  it("takes the first sentence or line of the prompt", () => {
    assert.equal(
      proposeProjectTitle("Aspen Grove campground upgrades. New toilets."),
      "Aspen Grove campground upgrades",
    );
    assert.equal(
      proposeProjectTitle("Snow Peak permit renewal\nSame 900 acres"),
      "Snow Peak permit renewal",
    );
    assert.equal(
      proposeProjectTitle("Is a 65-acre sale a CE? Probably."),
      "Is a 65-acre sale a CE",
    );
  });

  it("keeps decimals and collapses whitespace", () => {
    assert.equal(
      proposeProjectTitle("Reroute   1.8 miles of the Raven Lake trail."),
      "Reroute 1.8 miles of the Raven Lake trail",
    );
  });

  it("cuts a long sentence at the last clause that fits", () => {
    assert.equal(
      proposeProjectTitle(
        "I'm the NEPA planner on the Cedar Ridge Ranger District, and we want to build a fuel break.",
      ),
      "I'm the NEPA planner on the Cedar Ridge Ranger District",
    );
  });

  it("cuts at a word boundary when no clause is long enough", () => {
    const title = proposeProjectTitle(
      "I'm a planner, thinning overstocked ponderosa pine across the upper watershed near town.",
    );

    assert.equal(
      title,
      "I'm a planner, thinning overstocked ponderosa pine across",
    );
    assert.ok(title.length <= 60);
  });

  it("hard-cuts a single word that is too long", () => {
    assert.equal(proposeProjectTitle("x".repeat(80)).length, 60);
  });
});
