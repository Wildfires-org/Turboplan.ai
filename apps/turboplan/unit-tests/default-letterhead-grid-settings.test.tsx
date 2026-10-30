import React from "react";

import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicGridLetterhead } from "@wildfires-org/turboplan-workspace/types";

import type * as SettingsModule from "../components/dashboard/default-letterhead-grid-settings";
import type { DefaultLetterheadGridResponse } from "../lib/default-letterhead-grid";

// The Letterhead block of the organization / office settings, rendered to
// markup. The default grid's GET, its logos and the permission check are
// stubbed with each test's state; the logo upload and the grid editor are
// stand-ins.

const ORGANIZATION_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const GRID_VERSION = "3f2a9c41d07be5a8";
const MARGIN_LOGO = "https://files.example.test/logo.png";
const LAYOUT_SETTINGS = "layout-settings-marker";

let gridState: { data?: DefaultLetterheadGridResponse; error?: unknown };
let canUpdate: boolean;
const permissionChecks: { entityType: string; entityId: string }[] = [];
const logoVersions: (string | null)[] = [];

mock.module("../hooks/use-default-letterhead-grid", {
  namedExports: {
    useDefaultLetterheadGrid: () => gridState,
    useDefaultLetterheadGridLogos: (
      _owner: unknown,
      grid: PublicGridLetterhead | null,
      version: string | null,
    ) => {
      logoVersions.push(version);
      return { logoSrcs: grid ? [null] : [], logoLoading: [] };
    },
    revalidateDefaultLetterheadGrid: () => {},
  },
});
mock.module("@wildfires-org/turboplan-rbac/hooks", {
  namedExports: {
    useEntityPermission: (check: { entityType: string; entityId: string }) => {
      permissionChecks.push({
        entityType: check.entityType,
        entityId: check.entityId,
      });
      return { hasPermission: canUpdate, isLoading: false };
    },
  },
});
mock.module("../components/providers/user-provider", {
  namedExports: { useUser: () => ({ user: { id: "user-1" } }) },
});
mock.module("../components/grid-letterhead-editor", {
  namedExports: { GridLetterheadEditor: () => null },
});
mock.module("../components/dashboard/document-logo-upload", {
  namedExports: {
    DocumentLogoUpload: ({
      label,
      value,
      helperText,
    }: {
      label: string;
      value: string | null;
      helperText?: string;
    }) => (
      <div data-testid="logo-upload" data-value={value ?? ""}>
        {label}|{helperText}
      </div>
    ),
  },
});
mock.module("../components/toast", {
  namedExports: { toast: () => {} },
});
mock.module("@wildfires-org/turboplan-api-client", {
  namedExports: {
    // The letterhead band's logo proxy (never asked: logos are given).
    ApiClient: class {},
    deleteFetcher: async () => null,
    fetcher: async () => null,
  },
});

let DefaultLetterheadGridSettings: typeof SettingsModule.DefaultLetterheadGridSettings;

before(async () => {
  // tsx compiles JSX with the classic runtime (`React.createElement`).
  Object.assign(globalThis, { React });
  ({ DefaultLetterheadGridSettings } = await import(
    "../components/dashboard/default-letterhead-grid-settings"
  ));
});

beforeEach(() => {
  gridState = {};
  canUpdate = true;
  permissionChecks.length = 0;
  logoVersions.length = 0;
});

const grid: PublicGridLetterhead = {
  cells: [
    {
      kind: "text",
      x: 0,
      width: 1,
      align: "left",
      lines: [{ text: "Example Agency", bold: true, size: "normal" }],
    },
  ],
  color: null,
};

const organization = { kind: "organization" as const, id: ORGANIZATION_ID };
const office = { kind: "office" as const, id: OFFICE_ID };

const render = (
  props: Partial<
    React.ComponentProps<typeof SettingsModule.DefaultLetterheadGridSettings>
  > = {},
) =>
  renderToStaticMarkup(
    <DefaultLetterheadGridSettings
      owner={organization}
      marginLogoSrc={MARGIN_LOGO}
      onMarginLogoChange={() => {}}
      hasLayoutLetterhead
      {...props}
    >
      <p>{LAYOUT_SETTINGS}</p>
    </DefaultLetterheadGridSettings>,
  );

const buttonLabels = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(([, inner]) =>
    inner.replace(/<[^>]+>/g, ""),
  );

describe("DefaultLetterheadGridSettings", () => {
  it("shows a placeholder, not the layout settings, until the grid loads", () => {
    const html = render();

    assert.match(html, /data-testid="default-letterhead-loading"/);
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, new RegExp(LAYOUT_SETTINGS));
    assert.doesNotMatch(html, /logo-upload/);
  });

  it("shows the layout settings without a grid or when the grid does not load", () => {
    gridState = { data: { grid: null, version: null } };
    assert.match(render(), new RegExp(LAYOUT_SETTINGS));

    gridState = { error: new Error("Failed") };
    const html = render();
    assert.match(html, new RegExp(LAYOUT_SETTINGS));
    assert.doesNotMatch(html, /default-letterhead-grid-preview|logo-upload/);
  });

  it("offers Edit and Remove with a grid to a user who may change the owner", () => {
    gridState = { data: { grid, version: GRID_VERSION } };
    const html = render({ owner: office });

    assert.match(html, /data-testid="default-letterhead-grid-preview"/);
    assert.doesNotMatch(html, new RegExp(LAYOUT_SETTINGS));
    assert.deepEqual(buttonLabels(html), ["Edit", "Remove"]);
    assert.match(html, /remove it to use them again\./);
    assert.deepEqual(permissionChecks.at(-1), {
      entityType: "office",
      entityId: OFFICE_ID,
    });
    // The logos are those of the grid at its version.
    assert.equal(logoVersions.at(-1), GRID_VERSION);
  });

  it("shows a READ user the grid without Edit or Remove", () => {
    gridState = { data: { grid, version: GRID_VERSION } };
    canUpdate = false;
    const html = render();

    assert.match(html, /data-testid="default-letterhead-grid-preview"/);
    assert.deepEqual(buttonLabels(html), []);
    assert.doesNotMatch(html, /remove it/i);
  });

  it("uploads the margin logo with a grid, from the same field", () => {
    gridState = { data: { grid, version: GRID_VERSION } };

    const html = render();
    const upload = html.match(/<div data-testid="logo-upload"[^>]*>.*?<\/div>/);
    assert.ok(upload, "no margin logo upload");
    assert.match(upload[0], new RegExp(`data-value="${MARGIN_LOGO}"`));
    assert.match(
      upload[0],
      /Margin logo\|Used when the letterhead has no logo\./,
    );

    // An office's documents fall back to the organization's logo.
    assert.match(
      render({ owner: office }),
      /without one, documents use the organization&#x27;s/,
    );
  });

  it("has no margin logo upload for a banner's image", () => {
    gridState = { data: { grid, version: GRID_VERSION } };

    const html = render({ marginLogoSrc: null, onMarginLogoChange: undefined });
    assert.match(html, /data-testid="default-letterhead-grid-preview"/);
    assert.doesNotMatch(html, /logo-upload/);
  });

  it("tells an office without layout settings that removing it brings back the organization's", () => {
    gridState = { data: { grid, version: GRID_VERSION } };

    const html = render({ owner: office, hasLayoutLetterhead: false });
    assert.match(
      html,
      /this office&#x27;s documents use it instead of the organization&#x27;s letterhead; remove it to go back to that\./,
    );
  });
});
