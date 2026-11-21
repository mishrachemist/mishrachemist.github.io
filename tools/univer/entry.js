import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import enUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';
export const MzUniver = { createUniver, LocaleType, mergeLocales, UniverSheetsCorePreset, enUS };
window.MzUniver = MzUniver;
