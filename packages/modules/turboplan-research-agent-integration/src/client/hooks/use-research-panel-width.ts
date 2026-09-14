"use client";

import { useLocalStorage } from "usehooks-ts";

const RESEARCH_PANEL_DEFAULT_WIDTH = 595;

export const useResearchPanelWidth = () => {
  return useLocalStorage("research-panel-width", RESEARCH_PANEL_DEFAULT_WIDTH);
};
