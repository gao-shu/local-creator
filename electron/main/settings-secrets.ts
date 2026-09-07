/**
 * settings.json 内模型 API Key 使用 OS safeStorage 加密（可用时）
 */
import { safeStorage } from 'electron'
import type { AppSettings, ModelConfig } from '../../src/types/settings'

const ENC_PREFIX = 'enc:'

function encryptSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!safeStorage.isEncryptionAvailable()) return trimmed
  if (trimmed.startsWith(ENC_PREFIX)) return trimmed
  const encrypted = safeStorage.encryptString(trimmed)
  return `${ENC_PREFIX}${encrypted.toString('base64')}`
}

function decryptSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!trimmed.startsWith(ENC_PREFIX)) return trimmed
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    const buf = Buffer.from(trimmed.slice(ENC_PREFIX.length), 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return ''
  }
}

function mapModelSecrets(models: ModelConfig[], mode: 'encrypt' | 'decrypt'): ModelConfig[] {
  return models.map((model) => {
    const apiKey = model.apiKey?.trim()
    if (!apiKey) return model
    return {
      ...model,
      apiKey: mode === 'encrypt' ? encryptSecret(apiKey) : decryptSecret(apiKey),
    }
  })
}

export function encryptSettingsSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    llmModels: mapModelSecrets(settings.llmModels || [], 'encrypt'),
    imageModels: mapModelSecrets(settings.imageModels || [], 'encrypt'),
    videoModels: mapModelSecrets(settings.videoModels || [], 'encrypt'),
  }
}

export function decryptSettingsSecrets(settings: AppSettings): AppSettings {
  return {
    ...settings,
    llmModels: mapModelSecrets(settings.llmModels || [], 'decrypt'),
    imageModels: mapModelSecrets(settings.imageModels || [], 'decrypt'),
    videoModels: mapModelSecrets(settings.videoModels || [], 'decrypt'),
  }
}
