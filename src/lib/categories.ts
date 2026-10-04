import categoriesData from "../../data/categories.json";
import type { Category } from "./schema";

export const CATEGORIES: Category[] = categoriesData;

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoryName(id: string): string {
  return getCategory(id)?.name ?? id;
}
