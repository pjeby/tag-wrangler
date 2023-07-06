import { moment } from 'obsidian';
import * as resources from './locales'

type I18Config = ReturnType<typeof manuI18Config>
export const i18next = (async function(global, factory) {
    
  const i18next = global.i18next
  if (i18next) {
    return await factory(i18next)
  }
  throw new Error("No instance of i18 found.")
})(
  globalThis, 
  async function factory(i18, config = manuI18Config()) {
    const current_lang = moment.locale();
    const _config: I18Config = {
      ...manuI18Config(),
      lng: current_lang,
      ...config
    }
    // middleware
    await i18.init(_config)
    return i18;
  }
);
  

function manuI18Config(config = {}) {
  return ({
    lng: 'en',
    debug: true,
    defaultNS: "translation",
    ns: "translation",
    resources,
    ...config
  })
};





