import { MouseEvent } from "react";

export default interface IIconProps {
  size?: number;
  className?: string;
  onClick?: (e?: MouseEvent<SVGSVGElement>) => void;
  color?: string;
}
