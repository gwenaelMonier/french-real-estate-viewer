export interface YearData {
  med_m2?: number | null;
  med_m2_maison?: number | null;
  med_m2_appart?: number | null;
  med_m2_terrain?: number | null;
  nb?: number;
  nb_maison?: number;
  nb_appart?: number;
  nb_terrain?: number | null;
  loyer_residentiel?: number;
  loyer_maison?: number;
  loyer_appart?: number;
  nb_loyer_residentiel?: number;
  nb_loyer_maison?: number;
  nb_loyer_appart?: number;
}

export interface Commune extends YearData {
  code_commune: string;
  nom_commune: string;
  code_dep: string;
  lat: number;
  lon: number;
  years: Record<string, YearData>;
}

export type FilterType = "residential" | "house" | "apt" | "land";
export type ModeType = "price" | "rent" | "yield";
