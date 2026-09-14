import IIconProps from "@/types/icon-props";

export default function CheckIcon({ size = 20 }: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16.6667 5.05627L7.49999 14.2229L3.33333 10.0563"
        stroke="#1B845C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
