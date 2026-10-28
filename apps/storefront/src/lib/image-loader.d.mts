export type ImageLoaderProps = {
  src: string
  width: number
  quality?: number
}

export function buildImageUrl(props: ImageLoaderProps): string

export default function imageLoader(props: ImageLoaderProps): string
