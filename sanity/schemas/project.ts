import { defineField, defineType } from "sanity";

export const project = defineType({
  name: "project",
  title: "Projekt",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Nazwa projektu",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (subdomena)",
      type: "slug",
      description: "Identyfikator projektu, np. 'mojafirma'",
      options: { source: "name", maxLength: 48 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "clientDomain",
      title: "Domena klienta",
      type: "string",
      description: "Domena docelowa strony klienta, np. 'syntance.com' (wyświetlana w dashboardzie)",
    }),
    defineField({
      name: "previewUrl",
      title: "Preview URL",
      type: "url",
      description: "URL strony klienta — otwiera się po kliknięciu kafelka w portalu",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status projektu",
      type: "string",
      options: {
        list: [
          { title: "Projektowanie", value: "design" },
          { title: "Development", value: "development" },
          { title: "Testowanie", value: "qa" },
          { title: "Review", value: "review" },
          { title: "Live", value: "live" },
        ],
        layout: "radio",
      },
      initialValue: "design",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Opis projektu",
      type: "text",
      rows: 3,
    }),
  ],
  preview: {
    select: {
      title: "name",
      clientDomain: "clientDomain",
      status: "status",
    },
    prepare({ title, clientDomain, status }) {
      const statusMap: Record<string, string> = {
        design: "🎨 Projektowanie",
        development: "💻 Development",
        qa: "🧪 Testowanie",
        review: "👀 Review",
        live: "🟢 Live",
      };
      return {
        title,
        subtitle: `${clientDomain || "brak domeny"} — ${statusMap[status] || status}`,
      };
    },
  },
});
