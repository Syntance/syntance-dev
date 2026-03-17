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
      description: "Subdomena klienta, np. 'mojafirma' → mojafirma.syntance.dev",
      options: { source: "name", maxLength: 48 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "client",
      title: "Przypisany klient",
      type: "reference",
      to: [{ type: "client" }],
      description: "Wybierz klienta, który ma dostęp do tego projektu",
    }),
    defineField({
      name: "previewUrl",
      title: "Preview URL",
      type: "url",
      description: "URL do live preview strony (np. Vercel preview deployment)",
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
      clientName: "client.name",
      status: "status",
    },
    prepare({ title, clientName, status }) {
      const statusMap: Record<string, string> = {
        design: "🎨 Projektowanie",
        development: "💻 Development",
        qa: "🧪 Testowanie",
        review: "👀 Review",
        live: "🟢 Live",
      };
      return {
        title,
        subtitle: `${clientName || "Brak klienta"} — ${statusMap[status] || status}`,
      };
    },
  },
});
