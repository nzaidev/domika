export type Lang = "es" | "en";

export type Route =
  | "landing"
  | "dashboard"
  | "leads"
  | "properties"
  | "detail"
  | "tasks"
  | "network"
  | "brochures"
  | "settings";

export type Property = {
  id: number;
  photo: string;
  price: string;
  type: string;
  title: string;
  loc: string;
  beds: number;
  baths: number;
  sqm: number;
  status: "active" | "draft";
  shared?: boolean;
  photos: number;
};

export type Lead = {
  id: number;
  name: string;
  zone: string;
  budget: string;
  type: string;
  avatar: string;
};

export type Translations = Record<string, string>;
