import type { Family, GedcomData, Individual } from "./parser/types";

/**
 * Restrict tree data to one person, their birth family, and their spouses.
 * Children from the person's spouse families are intentionally excluded.
 */
export function filterToDirectFamily(
  data: GedcomData,
  personId: string
): GedcomData {
  if (!data.individuals.has(personId)) {
    return { individuals: new Map(), families: new Map() };
  }

  const visibleIndividualIds = new Set<string>([personId]);
  const visibleFamilies = new Map<string, Family>();

  for (const [familyId, family] of data.families) {
    const isBirthFamily = family.childrenIds.includes(personId);
    const isSpouseFamily =
      family.husbandId === personId || family.wifeId === personId;
    if (!isBirthFamily && !isSpouseFamily) continue;

    visibleFamilies.set(familyId, family);
    if (family.husbandId) visibleIndividualIds.add(family.husbandId);
    if (family.wifeId) visibleIndividualIds.add(family.wifeId);

    if (isBirthFamily) {
      for (const siblingId of family.childrenIds) {
        visibleIndividualIds.add(siblingId);
      }
    }
  }

  const visibleIndividuals = new Map<string, Individual>();
  for (const [id, individual] of data.individuals) {
    if (visibleIndividualIds.has(id)) {
      visibleIndividuals.set(id, individual);
    }
  }

  return {
    individuals: visibleIndividuals,
    families: visibleFamilies,
  };
}
