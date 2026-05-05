export interface Category {
  id: string;
  name: string;
  parent: string;
}

export type Good = Record<string, any> & {
  id: string | number;
  name?: string;
  model?: string;
  manufacturer_name?: string;
  price_sale?: string | number;
  price_goodsale?: string | number;
  archived?: string | number;
  categories?: (string | number)[];
};

export type TagSize = "60x40" | "90x65";

export interface TagSettings {
  company_name: string;
  price_field: "price_sale" | "price_goodsale";
  article_field: string;
  show_article: boolean;
  show_model: boolean;
  qr_size_mm: number;
  name_size_pt: number;
  tag_size: TagSize;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export type PriceMap = Record<string, number>;
