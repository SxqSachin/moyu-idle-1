// shared/types/curio.ts
export interface CurioItem {
  id: number;
  uuid: string;
  owner: string;
  name: string;
  description: string;
  lore_tag: string;
  rarity: number;
  extra?: string; // JSON string
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CurioItemWithOwner extends CurioItem {
  ownerName?: string;
}

export interface CurioIdentifyResult {
  type: 'item' | 'curio';
  data: any; // For 'item': { id: string, count: number }, for 'curio': CurioItem
}

export interface CurioIdentifyRequest {
  count: number;
}

export interface CurioIdentifyResponse {
  success: boolean;
  results?: CurioIdentifyResult[];
  error?: string;
}

export interface CurioQueryRequest {
  page?: number;
  limit?: number;
}

export interface CurioQueryResponse {
  success: boolean;
  curios: CurioItem[];
  total: number;
  error?: string;
}

export interface CurioTagsResponse {
  success: boolean;
  tags: string[];
  error?: string;
}

export interface CurioByTagRequest {
  tag: string;
  page?: number;
  limit?: number;
}

export interface CurioByTagResponse {
  success: boolean;
  curios: CurioItem[];
  total: number;
  error?: string;
}

export interface CurioMuseumRequest {
  page?: number;
  limit?: number;
}

export interface CurioMuseumResponse {
  success: boolean;
  curios: CurioItemWithOwner[];
  total: number;
  error?: string;
}