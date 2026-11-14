import fullTripSource from "./source/full-trip-planning.json" with { type: "json" };
import startHereSource from "./source/start-here.json" with { type: "json" };

export const QUESTIONNAIRE_VERSION = "2026-11-09.1";
export const QUESTIONNAIRE_ID = "twe-smart-enquiry";

export const SERVICE_OPTIONS = Object.freeze([
  { id: "readiness", slug: "travel-readiness-session", title: "Travel Readiness Session" },
  { id: "full_planning", slug: "full-trip-planning", title: "Full Trip Planning" },
  { id: "premium", slug: "premium-concierge", title: "Premium Concierge" },
  { id: "group", slug: "group-trip-planning", title: "Group Trip Planning" },
]);

const deferred = Object.freeze({
  "1811901185": "health_data_policy_pending",
  "1263904381": "commercial_policy_pending",
  "1719024406": "commercial_policy_pending",
  "1366732008": "commercial_policy_conflict",
  "858286919": "commercial_policy_conflict",
});

const metadata = Object.freeze({
  "476632894": { inputMode: "text", autoComplete: "name", contactField: "name" },
  "1078451195": { inputMode: "tel", autoComplete: "tel", contactField: "phone" },
  "214964047": { inputMode: "email", autoComplete: "email", contactField: "email" },
  "1444304495": { maxSelections: 3 },
  "1366732008": { requireAllOptions: true },
  "180737542": { sensitive: "visa_summary", access: "authorised_enquiry_staff" },
});

function normaliseSource(source, sourceKey) {
  let section = { id: "introduction", title: "Introduction", order: 0 };
  return source.items.map((item) => {
    if (item.type === "PAGE_BREAK") section = { id: item.id, title: item.title, description: item.description || "", order: item.order };
    return Object.freeze({
      source: sourceKey,
      sourceFormId: source.formId,
      id: item.id,
      order: item.order,
      sectionId: item.sectionId || section.id,
      sectionTitle: item.type === "PAGE_BREAK" ? item.title : section.title,
      type: item.type,
      label: item.title,
      description: item.description || "",
      required: Boolean(item.required),
      options: Object.freeze((item.options || []).map((option) => option.label)),
      allowOther: Boolean(item.allowOther),
      collection: deferred[item.id] ? "deferred" : "approved",
      deferredReason: deferred[item.id] || null,
      ...(metadata[item.id] || {}),
    });
  });
}

export const sourceQuestionnaires = Object.freeze({
  startHere: Object.freeze({
    id: "twe-start-here", version: QUESTIONNAIRE_VERSION, title: startHereSource.title,
    sourceFormId: startHereSource.formId,
    items: Object.freeze(normaliseSource(startHereSource, "start_here")),
  }),
  fullTripPlanning: Object.freeze({
    id: "twe-full-trip-planning", version: QUESTIONNAIRE_VERSION, title: fullTripSource.title,
    sourceFormId: fullTripSource.formId,
    items: Object.freeze(normaliseSource(fullTripSource, "full_trip_planning")),
  }),
});

export const questions = Object.freeze(Object.fromEntries(
  [...sourceQuestionnaires.startHere.items, ...sourceQuestionnaires.fullTripPlanning.items]
    .filter((item) => !["PAGE_BREAK", "SECTION_HEADER"].includes(item.type))
    .map((item) => [item.id, item]),
));

const step = (id, title, questionIds, routes = ["all"]) => Object.freeze({
  id, title, questionIds: Object.freeze(questionIds), routes: Object.freeze(routes),
});

export const questionnaireSteps = Object.freeze([
  step("support", "Choose your support", ["1428564940", "1997323435", "1653151808"], ["router", "planning", "safe_general"]),
  step("trip", "Your trip", ["541981576", "2025794352", "1087568926", "836507955", "502234433", "180737542"], ["planning", "safe_general", "package"]),
  step("experience", "Travel experience", ["539186385", "1817301688", "981551413"], ["planning"]),
  step("preferences", "Preferences", ["1056249278", "822834325", "1444304495", "1376109963", "1811901185", "130319592", "1518570516", "353526436", "410814081", "1379519325"], ["planning"]),
  step("extras", "Additional details", ["1263904381", "1719024406", "913802249", "1288466099"], ["planning", "safe_general", "package"]),
  step("contact", "Your details", ["476632894", "1078451195", "214964047"], ["all"]),
]);

export const branching = Object.freeze({
  serviceRouterQuestionId: "1428564940",
  notSureQuestionId: "1653151808",
  visaQuestionId: "502234433",
  visaDetailsQuestionId: "180737542",
  serviceAnswers: Object.freeze({
    "I need general travel advice to get ready (documents, budget, airport flow)": "readiness",
    "I want full trip planning (itinerary, accommodation, activities, bookings)": "full_planning",
    "I’m not sure yet — please guide me": "not_sure",
  }),
  notSureAnswers: Object.freeze({
    "I mainly need expert advice to feel ready and confident": "readiness",
    "I want everything planned for me so I just show up and enjoy": "full_planning",
  }),
});

export function selectedServiceFromAnswers(answers = {}, preset = "") {
  if (SERVICE_OPTIONS.some((service) => service.id === preset)) return preset;
  const initial = branching.serviceAnswers[answers[branching.serviceRouterQuestionId]] || "";
  if (initial !== "not_sure") return initial;
  return branching.notSureAnswers[answers[branching.notSureQuestionId]] || "not_sure";
}

export function questionnaireRoute(context = {}, answers = {}) {
  if (context.packageId) return "package";
  const service = selectedServiceFromAnswers(answers, context.serviceId);
  if (!service || service === "not_sure") return "router";
  return ["full_planning", "premium"].includes(service) ? "planning" : "safe_general";
}

export function applicableQuestionIds(context = {}, answers = {}) {
  const route = questionnaireRoute(context, answers);
  const ids = questionnaireSteps
    .filter((item) => item.routes.includes("all") || item.routes.includes(route))
    .flatMap((item) => item.questionIds)
    .filter((id) => questions[id]?.collection === "approved");
  if (context.serviceId || context.packageId) {
    for (const id of [branching.serviceRouterQuestionId, "1997323435", branching.notSureQuestionId]) {
      const index = ids.indexOf(id);
      if (index >= 0) ids.splice(index, 1);
    }
  }
  if (answers[branching.serviceRouterQuestionId] !== "I’m not sure yet — please guide me") {
    const index = ids.indexOf(branching.notSureQuestionId);
    if (index >= 0) ids.splice(index, 1);
  }
  if (answers[branching.visaQuestionId] !== "Yes") {
    const index = ids.indexOf(branching.visaDetailsQuestionId);
    if (index >= 0) ids.splice(index, 1);
  }
  return Object.freeze([...new Set(ids)]);
}

export function publicQuestionnaireDefinition() {
  return Object.freeze({ id: QUESTIONNAIRE_ID, version: QUESTIONNAIRE_VERSION, steps: questionnaireSteps, questions, branching });
}
