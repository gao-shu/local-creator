import { createContext, useContext, useEffect, useState } from 'react'

interface LayoutContextValue {
  fullWidth: boolean
  setFullWidth: (value: boolean) => void
}

export const LayoutContext = createContext<LayoutContextValue>({
  fullWidth: false,
  setFullWidth: () => {},
})

export function useLayoutState() {
  const [fullWidth, setFullWidth] = useState(false)
  return { fullWidth, setFullWidth }
}

export function useFullWidth(condition: boolean) {
  const { setFullWidth } = useContext(LayoutContext)

  useEffect(() => {
    setFullWidth(condition)
    return () => setFullWidth(false)
  }, [condition, setFullWidth])
}
