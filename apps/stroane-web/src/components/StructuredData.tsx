import React from "react";

interface Props {
  schema: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
}

// Renders JSON-LD structured data inline. Search engines read it in <body> or <head>.
const StructuredData: React.FC<Props> = ({ schema, id }) => (
  <script
    id={id}
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
  />
);

export default StructuredData;
