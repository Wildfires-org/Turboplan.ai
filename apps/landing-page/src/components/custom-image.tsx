import Image, { ImageProps } from "next/image";

interface ICustomImageProps extends Omit<ImageProps, "quality"> {
  quality?: number;
}

export default function CustomImage({
  quality = 80,
  ...props
}: ICustomImageProps) {
  return <Image quality={quality} {...props} alt={props.alt} />;
}
