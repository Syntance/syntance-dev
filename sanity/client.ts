import { createClient } from "next-sanity";
import { projectId, dataset, apiVersion } from "./env";

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
});
