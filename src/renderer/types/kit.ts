import type { InstalledKitRecord, LocalizedText } from '../../shared/kit/constants';

export interface KitSkillRef {
  id: string;
  name: string | LocalizedText;
  description?: string | LocalizedText;
}

export interface KitSkillBundle {
  bundle?: string;
  list: KitSkillRef[];
}

export interface KitTag {
  text: string | LocalizedText;
  color?: string;
}

export interface MarketplaceKit {
  id: string;
  _type?: 'localKit' | 'marketplace';
  name: string | LocalizedText;
  description: string | LocalizedText;
  icon?: string;
  author?: string;
  version?: string;
  downloadCount?: string;
  tryAsking?: (string | LocalizedText)[];
  skills?: KitSkillBundle;
  mcpServers?: unknown[] | null;
  connectors?: unknown[] | null;
  category?: string;
  tagline?: string | LocalizedText;
  motto?: string | LocalizedText;
  tags?: KitTag[];
  avatarBg?: string;
}

export interface KitCategory {
  id: string;
  name: LocalizedText;
}

export type InstalledKit = InstalledKitRecord;
