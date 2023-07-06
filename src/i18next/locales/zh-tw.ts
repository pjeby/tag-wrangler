import {enKeys, REQUIRE, IN_SEARCH, EXCLUDE, FROM_SEARCH, OPEN_TAG_PAGE} from "./en"
type tKey = typeof enKeys[number]

type PartialTranslation = Partial<Record<tKey,string>>
type Namespace = "translation"

const translation: PartialTranslation = {
    "Rename": "重命名",
    ["Create A Tag"]: "创建標籤",
    ["Create tag page"]: "创建標籤葉",
    ["New search for"]: "重新搜索",
    [OPEN_TAG_PAGE]: "打開標簽葉",
    [REQUIRE]: "必须先包含",
    [IN_SEARCH]: "然后搜索",
    [EXCLUDE]: "排除",
    [FROM_SEARCH]: "在搜索之外",
  }
 


type TranslationObject = {
  [K in Namespace]: PartialTranslation;
};

const translationObject: TranslationObject = {
  translation,
};

export default translationObject;