import { getPublishedEvents } from "../../lib/event-source.js";
import { eventCalendarFile } from "../../lib/events.js";
import { productionOrigin } from "../../lib/indexability.js";
export async function getStaticPaths() {
  return (await getPublishedEvents()).map(event => ({ params: { slug: event.slug }, props: { event } }));
}
export function GET({ props, site }) {
  return new Response(eventCalendarFile(props.event, site || productionOrigin), { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
