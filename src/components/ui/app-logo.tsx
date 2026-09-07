// Copyright (c) local-creator contributors. All rights reserved.

import { resolvePublicAssetUrl } from '@/lib/brand/public-asset-url'
import { APP_PRODUCT_NAME } from '@/constants/brand'
import { cn } from '@/lib/utils'

export { APP_PRODUCT_NAME } from '@/constants/brand'

/** 应用品牌 Logo（与 public/favicon.png、打包 icon 一致） */
export const APP_LOGO_SRC = resolvePublicAssetUrl('/favicon.png')

type AppLogoSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<AppLogoSize, { image: string; text: string }> = {
  sm: { image: 'h-8 w-8', text: 'text-lg' },
  md: { image: 'h-10 w-10', text: 'text-xl' },
  lg: { image: 'h-12 w-12', text: 'text-2xl' },
}

interface AppLogoProps {
  className?: string
  imageClassName?: string
  nameClassName?: string
  size?: AppLogoSize
  showName?: boolean
}

export function AppLogo({
  className,
  imageClassName,
  nameClassName,
  size = 'sm',
  showName = true,
}: AppLogoProps) {
  const sizeClass = SIZE_CLASS[size]

  return (
    <div className={cn('flex items-center shrink-0', className)}>
      <img
        src={APP_LOGO_SRC}
        alt={APP_PRODUCT_NAME}
        className={cn(sizeClass.image, 'rounded-lg object-contain', imageClassName)}
        draggable={false}
      />
      {showName ? (
        <span className={cn('ml-2 font-bold tracking-tight', sizeClass.text, nameClassName)}>
          {APP_PRODUCT_NAME}
        </span>
      ) : null}
    </div>
  )
}
