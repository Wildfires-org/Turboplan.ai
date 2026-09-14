import IIconProps from "@/types/icon-props";

export default function Arrow({
  size = 16,
  color = "currentColor",
  ...rest
}: IIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M3.6967 9.02812L14.3033 9.02812"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={color}
      />
      <path
        d="M9 3.72482L14.3033 9.02812L9 14.3314"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={color}
      />
    </svg>
  );
}
