import { admin } from "./de/admin";
import { ai } from "./de/ai";
import { approvals } from "./de/approvals";
import { checks } from "./de/checks";
import { areas } from "./de/areas";
import { auth } from "./de/auth";
import { clients } from "./de/clients";
import { common } from "./de/common";
import { dashboard } from "./de/dashboard";
import { dispatch } from "./de/dispatch";
import { documents } from "./de/documents";
import { errors } from "./de/errors";
import { formats } from "./de/formats";
import { header } from "./de/header";
import { nav } from "./de/nav";
import { notifications } from "./de/notifications";
import { profile } from "./de/profile";
import { projects } from "./de/projects";
import { redaktion } from "./de/redaktion";
import { search } from "./de/search";
import { shifts } from "./de/shifts";
import { tasks } from "./de/tasks";
import { warnings } from "./de/warnings";

/**
 * Alle Oberflächentexte, eine Datei pro Bereich (BRIEFING 0.3).
 * Eine englische Fassung kann später als /i18n/en mit derselben Form ergänzt werden.
 */
export const de = { admin, ai, approvals, areas, checks, auth, clients, common, dashboard, dispatch, documents, errors, formats, header, nav, notifications, profile, projects, redaktion, search, shifts, tasks, warnings };

export type Messages = typeof de;

export const t: Messages = de;
