import useSWR, { type ScopedMutator } from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import {
  gridLogoCells,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import { isDocumentLetterheadKey } from "@/hooks/use-document-letterhead";
import {
  blobToDataUrl,
  isLetterheadLogoKey,
} from "@/hooks/use-letterhead-logo";
import {
  type DefaultLetterheadGridOwner,
  type DefaultLetterheadGridResponse,
  defaultLetterheadGridUrl,
  isProjectLetterheadTargetKey,
} from "@/lib/default-letterhead-grid";
import { fetchDefaultLetterheadGridLogoBlob } from "@/lib/export/letterhead-logo";

// A logo of an owner's default grid, by the grid's version: a logo `index`
// names another logo once the grid changed, so a new version is a new key
// and a logo cached for an older one is never shown for it.
export type DefaultLetterheadGridLogoKey = readonly [
  "default-letterhead-grid-logo",
  DefaultLetterheadGridOwner["kind"],
  string,
  string | null,
  number,
];

// The settings' key: the endpoint itself, read with the shared fetcher.
export const defaultLetterheadGridKey = (owner: DefaultLetterheadGridOwner) =>
  defaultLetterheadGridUrl(owner);

export const defaultLetterheadGridLogoKey = (
  owner: DefaultLetterheadGridOwner,
  version: string | null,
  index: number,
): DefaultLetterheadGridLogoKey => [
  "default-letterhead-grid-logo",
  owner.kind,
  owner.id,
  version,
  index,
];

// The proxy answers for the grid stored now; the key's version only keeps
// the cache apart.
export const fetchDefaultLetterheadGridLogoDataUrl = async ([
  ,
  kind,
  id,
  ,
  index,
]: DefaultLetterheadGridLogoKey) => {
  const logo = await fetchDefaultLetterheadGridLogoBlob({ kind, id }, index);
  return logo ? blobToDataUrl(logo.blob) : null;
};

/**
 * The organization's or office's default grid letterhead and its version
 * (`grid` null while none is set). `data` is undefined while loading or when
 * it failed (`error`).
 */
export const useDefaultLetterheadGrid = (
  owner: DefaultLetterheadGridOwner | null,
) =>
  useSWR<DefaultLetterheadGridResponse>(
    owner ? defaultLetterheadGridKey(owner) : null,
    fetcher,
    { revalidateOnFocus: false },
  );

/**
 * One logo of the owner's default grid at `version` (its logo `index`) as a
 * data URL, through the settings' logo proxy; nothing is fetched without an
 * owner. `src` is null while loading or when the logo is missing;
 * `isLoading` tells them apart.
 */
export const useDefaultLetterheadGridLogoState = (
  owner: DefaultLetterheadGridOwner | null,
  version: string | null,
  index: number,
): { src: string | null; isLoading: boolean } => {
  const { data, isLoading } = useSWR(
    owner ? defaultLetterheadGridLogoKey(owner, version, index) : null,
    fetchDefaultLetterheadGridLogoDataUrl,
    { revalidateOnFocus: false },
  );
  return { src: data ?? null, isLoading };
};

/**
 * A default grid's logos (the grid at `version`) for `LetterheadBand`
 * (`logoSrcs` / `logoLoading`, by logo index). One hook per logo a grid can
 * hold (MAX_GRID_LOGOS).
 */
export const useDefaultLetterheadGridLogos = (
  owner: DefaultLetterheadGridOwner,
  grid: PublicGridLetterhead | null,
  version: string | null,
) => {
  const count = grid ? gridLogoCells(grid).length : 0;
  const first = useDefaultLetterheadGridLogoState(
    count > 0 ? owner : null,
    version,
    0,
  );
  const second = useDefaultLetterheadGridLogoState(
    count > 1 ? owner : null,
    version,
    1,
  );
  const logos = [first, second].slice(0, count);
  return {
    logoSrcs: logos.map((logo) => logo.src),
    logoLoading: logos.map((logo) => logo.isLoading),
  };
};

/**
 * After an organization's or office's default grid changed (saved from a
 * document, edited, removed): its settings cache — set to `saved` when the
 * answer is at hand (its logos follow the new version's keys) — every
 * project's `letterhead-target` (an office may have a default of its own
 * now, or none), and every document letterhead and logo the client holds (a
 * document on "default" now resolves to it; the picker labels it). Those are
 * revalidated in place: the open document is usually on its own copy, which
 * did not change and must not flicker.
 */
export const revalidateDefaultLetterheadGrid = (
  mutate: ScopedMutator,
  owner: DefaultLetterheadGridOwner,
  saved?: DefaultLetterheadGridResponse,
) => {
  const key = defaultLetterheadGridKey(owner);
  void (saved ? mutate(key, saved, { revalidate: false }) : mutate(key));
  void mutate(isProjectLetterheadTargetKey);
  void mutate(isLetterheadLogoKey);
  void mutate(isDocumentLetterheadKey);
};
