import { defineField, defineType } from "sanity";

export const client = defineType({
  name: "client",
  title: "Klient",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Imię i nazwisko",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      description: "Email używany do logowania w portalu",
      validation: (rule) =>
        rule.required().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
          name: "email",
          invert: false,
        }),
    }),
    defineField({
      name: "company",
      title: "Firma",
      type: "string",
    }),
    defineField({
      name: "password",
      title: "Hasło startowe",
      type: "string",
      description:
        "Ustaw hasło startowe. Przy pierwszym logowaniu konto zostanie aktywowane.",
    }),
    defineField({
      name: "isAdmin",
      title: "Admin",
      type: "boolean",
      description:
        "Admin widzi wszystkie projekty Syntance i może nimi zarządzać.",
      initialValue: false,
    }),
    defineField({
      name: "notes",
      title: "Notatki",
      type: "text",
      rows: 3,
      description: "Wewnętrzne notatki o kliencie (niewidoczne dla klienta)",
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "email",
      isAdmin: "isAdmin",
    },
    prepare({ title, subtitle, isAdmin }) {
      return {
        title: isAdmin ? `👑 ${title}` : title,
        subtitle,
      };
    },
  },
});
