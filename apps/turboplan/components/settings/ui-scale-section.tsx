"use client";

import { Button, cn, Label } from "@wildfires-org/turboplan-utils";

import {
  DEFAULT_UI_SCALE,
  MAX_UI_SCALE,
  MIN_UI_SCALE,
  UI_SCALE_STEP,
  useUiScale,
} from "@/components/providers/ui-scale-provider";
import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";

const UI_SCALE_INPUT_ID = "interface-scale";

const formatScale = (scale: number) => `${Number(scale.toFixed(2))}%`;

export const UiScaleSection = () => {
  const { scale, setScale, resetScale } = useUiScale();

  const isDefault = scale === DEFAULT_UI_SCALE;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setScale(Number(event.target.value));
  };

  return (
    <section aria-labelledby="appearance-title" className={PANEL_CLASS}>
      <h2 id="appearance-title" className={PANEL_TITLE_CLASS}>
        Appearance
      </h2>

      <div className="mt-4 space-y-4 border-t border-slate-900/[0.06] pt-5 dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <Label
            htmlFor={UI_SCALE_INPUT_ID}
            className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground"
          >
            Interface scale
          </Label>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[13px] font-medium tabular-nums ring-1 ring-inset",
              isDefault
                ? "bg-slate-900/[0.04] text-gray-550 ring-slate-900/[0.06]"
                : "bg-brand-50 text-brand-900 ring-brand-800/15",
            )}
          >
            {formatScale(scale)}
          </span>
        </div>

        <p className="text-[13px] leading-5 text-gray-550">
          Makes text, spacing and controls across the app larger or smaller.
          Saved on this device only.
        </p>

        <div className="glass-inset rounded-xl px-4 py-3">
          <input
            id={UI_SCALE_INPUT_ID}
            type="range"
            min={MIN_UI_SCALE}
            max={MAX_UI_SCALE}
            step={UI_SCALE_STEP}
            value={scale}
            onChange={handleChange}
            aria-valuetext={formatScale(scale)}
            className="h-2 w-full cursor-pointer rounded-full accent-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700"
          />
          <div className="mt-1.5 flex justify-between text-xs tabular-nums text-gray-550">
            <span>{formatScale(MIN_UI_SCALE)}</span>
            <span>{formatScale(MAX_UI_SCALE)}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={resetScale}
          disabled={isDefault}
          className="h-9 px-4"
        >
          Reset to default
        </Button>
      </div>
    </section>
  );
};
