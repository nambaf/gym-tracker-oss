'use client'

import { createContext, useContext, type ReactNode } from 'react'

type AppConfig = {
  aiEnabled: boolean
}

const Ctx = createContext<AppConfig | null>(null)

export function AppConfigProvider({
  aiEnabled,
  children,
}: AppConfig & { children: ReactNode }) {
  return <Ctx.Provider value={{ aiEnabled }}>{children}</Ctx.Provider>
}

export function useAppConfig(): AppConfig {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppConfig must be used within AppConfigProvider')
  return v
}

export function useAIEnabled(): boolean {
  return useAppConfig().aiEnabled
}
