// From Spectrum UI (spectrumhq.in) — trimmed to the types Zeno's assistant uses.

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  previewUrl?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt?: string;
}
