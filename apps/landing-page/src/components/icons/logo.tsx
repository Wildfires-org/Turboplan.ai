import Image from "next/image";

export default function Logo({
  height = 24,
  width = 85,
}: {
  height?: number;
  width?: number;
}) {
  return (
    <Image
      src="/home/partners/Wildfires.png"
      alt="Logo"
      width={width}
      height={height}
    />
  );
}
