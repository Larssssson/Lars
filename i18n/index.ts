import { areas } from "./de/areas";
import { auth } from "./de/auth";
import { common } from "./de/common";
import { dashboard } from "./de/dashboard";
import { errors } from "./de/errors";
import { header } from "./de/header";
import { nav } from "./de/nav";

/**
 * Alle Oberflächentexte, eine Datei pro Bereich (BRIEFING 0.3).
 * Eine englische Fassung kann später als /i18n/en mit derselben Form ergänzt werden.
 */
export const de = { areas, auth, common, dashboard, errors, header, nav };

export type Messages = typeof de;

export const t: Messages = de;
