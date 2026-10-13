// Supply these only alongside the corresponding visible, approved page content.
export function personSchema(person, site) {
  return { "@type": "Person", name: person.name, jobTitle: person.role, image: new URL(person.image, site).href };
}

// Publishing seams: no speculative events, articles, dates, authors or locations.
export function articleSchema(article) {
  if (!article?.approved || !article.title || !article.url || !article.publishedAt || !article.author) return null;
  return { "@type": "Article", headline: article.title, url: article.url, datePublished: article.publishedAt, author: { "@type": "Person", name: article.author }, ...(article.modifiedAt ? { dateModified: article.modifiedAt } : {}) };
}

export function eventSchema(event) {
  if (!event?.confirmed || !event.title || !event.url || !event.startDate || !event.location) return null;
  return { "@type": "Event", name: event.title, url: event.url, startDate: event.startDate, location: event.location,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    ...(event.description ? { description: event.description } : {}),
    ...(event.image ? { image: event.image } : {}),
    ...(event.eventAttendanceMode ? { eventAttendanceMode: event.eventAttendanceMode } : {}),
  };
}
