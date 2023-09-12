export const RENAME = "Rename";
export const CREATE_TAG_PAGE = "Create tag page";
export const CREATE_A_TAG = "Create A Tag";
export const OPEN_TAG_PAGE = "Open tag page";
export const NEW_SEARCH_FOR = "New search for";
export const REQUIRE = "Require";
export const IN_SEARCH = "in search";
export const EXCLUDE = "Exclude";
export const FROM_SEARCH = "from search";
export const enKeys = [
  RENAME, 
  CREATE_TAG_PAGE, 
  CREATE_A_TAG,
  OPEN_TAG_PAGE,
  NEW_SEARCH_FOR,
  REQUIRE,
  IN_SEARCH,
  EXCLUDE,
  FROM_SEARCH
] as const;

const _en = enKeys.map((en_key) => ([en_key, en_key]))
export default {
  translation: Object.fromEntries(_en)
}