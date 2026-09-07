export interface ClientFileOut {
  id: string
  file_name: string
  original_name: string
  file_size: number
  mime_type: string
  file_path: string
  url: string
  created_at: string
}

export interface ApiEnvelope<T = unknown> {
  code?: number
  message?: string
  data?: T
}
