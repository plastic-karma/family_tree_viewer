/**
 * Represents a single individual (INDI record) from a GEDCOM file.
 */
export interface Individual {
  id: string; // e.g. "@I3@"
  name: string;
  sex: "M" | "F" | "U";
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  // References to FAM records where this person is a spouse
  familyAsSpouse: string[];
  // Reference to the FAM record where this person is a child
  familyAsChild?: string;
  // Resolved note text (from NOTE references)
  notes: string[];
}

/**
 * Represents a family unit (FAM record) from a GEDCOM file.
 * A family links two spouses and their children together.
 */
export interface Family {
  id: string; // e.g. "@F1@"
  husbandId?: string;
  wifeId?: string;
  childrenIds: string[];
  marriageDate?: string;
  marriagePlace?: string;
}

/**
 * The fully parsed GEDCOM data, indexed by ID for fast lookups.
 * We use Maps rather than plain objects because:
 * - Map preserves insertion order (useful for consistent rendering)
 * - Map.get() makes the "might not exist" case explicit (returns undefined)
 * - Map has a cleaner API for iteration (.entries(), .values(), .forEach())
 */
export interface GedcomData {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
}
