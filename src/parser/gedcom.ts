import type { Individual, Family, GedcomData } from "./types";

/**
 * Parse a GEDCOM file string into structured data.
 *
 * GEDCOM lines follow the pattern: LEVEL [XREF] TAG [VALUE]
 * - Level 0 lines start new records (INDI, FAM, HEAD, etc.)
 * - Higher levels are nested properties of the current record
 *
 * We use a simple state-machine approach:
 * - Track which record we're currently inside (currentIndi / currentFam)
 * - Track the level-1 "context" tag (e.g., BIRT vs DEAT) so we know
 *   where to attach level-2 DATE/PLAC values
 */
export function parseGedcom(text: string): GedcomData {
  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();

  // Notes are stored separately during parsing, then resolved at the end.
  // This is necessary because NOTE definitions (0 @N1@ NOTE) can appear
  // after the individuals that reference them (1 NOTE @N1@).
  const noteDefinitions = new Map<string, string>();
  // Track which individuals reference which notes (by note ID)
  const noteRefs = new Map<string, string[]>(); // individual ID → note IDs

  const lines = text.split(/\r?\n/);

  // State: what record are we currently building?
  let currentIndi: Individual | null = null;
  let currentFam: Family | null = null;
  let currentNoteId: string | null = null;
  let currentNoteText: string = "";

  // Sub-context: when we're inside a BIRT/DEAT/MARR block,
  // we need to know where to attach DATE/PLAC values
  let level1Tag: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse the line into its components.
    // Level 0 with xref: "0 @I3@ INDI"
    // Other levels:      "1 NAME John /Doe/"
    //                    "2 DATE 02 OCT 1957"
    // The regex uses a single space delimiter before the value capture group
    // so that leading whitespace in the value is preserved. This matters for
    // CONC tags where "1 CONC  of Massachusetts" needs the leading space to
    // reconstruct "founder of Massachusetts" correctly.
    const match = trimmed.match(/^(\d+)\s+(@\w+@)?\s*(\w+)(?:\s(.*))?$/);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    const xref = match[2] || null; // e.g. "@I3@"
    const tag = match[3];
    const rawValue = match[4] ?? "";
    const value = tag === "CONC" ? rawValue : rawValue.trim();

    // Level 0: start of a new record — save the previous one first
    if (level === 0) {
      if (currentIndi) individuals.set(currentIndi.id, currentIndi);
      if (currentFam) families.set(currentFam.id, currentFam);
      if (currentNoteId) {
        noteDefinitions.set(currentNoteId, currentNoteText);
      }
      currentIndi = null;
      currentFam = null;
      currentNoteId = null;
      currentNoteText = "";
      level1Tag = null;

      if (tag === "INDI" && xref) {
        currentIndi = {
          id: xref,
          name: "",
          sex: "U",
          familyAsSpouse: [],
          notes: [],
        };
      } else if (tag === "FAM" && xref) {
        currentFam = {
          id: xref,
          childrenIds: [],
        };
      } else if (tag === "NOTE" && xref) {
        currentNoteId = xref;
        // Some NOTE records have text on the same line as the tag
        if (value) currentNoteText = value;
      }
      continue;
    }

    // Level 1: direct properties of the current record
    if (level === 1) {
      level1Tag = tag;

      if (currentIndi) {
        switch (tag) {
          case "NAME":
            // GEDCOM names use slashes around the surname: "John /Doe/"
            currentIndi.name = value.replace(/\//g, "").trim();
            break;
          case "SEX":
            currentIndi.sex = value === "M" ? "M" : value === "F" ? "F" : "U";
            break;
          case "FAMS":
            currentIndi.familyAsSpouse.push(value);
            break;
          case "FAMC":
            currentIndi.familyAsChild = value;
            break;
          case "NOTE":
            // NOTE references look like "@N40@" — store for resolution later.
            // We defer resolution because note definitions may appear after
            // the individuals that reference them.
            if (value.startsWith("@")) {
              if (!noteRefs.has(currentIndi.id)) {
                noteRefs.set(currentIndi.id, []);
              }
              noteRefs.get(currentIndi.id)!.push(value);
            }
            break;
          // BIRT, DEAT are handled as context for level-2 parsing
        }
      }

      // CONC/CONT lines build up note definition text.
      // CONC = concatenate (no linebreak), CONT = continue (new line)
      if (currentNoteId) {
        if (tag === "CONC") {
          currentNoteText += value;
        } else if (tag === "CONT") {
          currentNoteText += "\n" + value;
        }
      }

      if (currentFam) {
        switch (tag) {
          case "HUSB":
            currentFam.husbandId = value;
            break;
          case "WIFE":
            currentFam.wifeId = value;
            break;
          case "CHIL":
            currentFam.childrenIds.push(value);
            break;
          // MARR is handled as context for level-2 parsing
        }
      }
      continue;
    }

    // Level 2: sub-properties (DATE, PLAC) — meaning depends on level1Tag context
    if (level === 2) {
      if (currentIndi) {
        if (level1Tag === "BIRT") {
          if (tag === "DATE") currentIndi.birthDate = value;
          if (tag === "PLAC") currentIndi.birthPlace = value;
        } else if (level1Tag === "DEAT") {
          if (tag === "DATE") currentIndi.deathDate = value;
          if (tag === "PLAC") currentIndi.deathPlace = value;
        }
      }

      if (currentFam && level1Tag === "MARR") {
        if (tag === "DATE") currentFam.marriageDate = value;
        if (tag === "PLAC") currentFam.marriagePlace = value;
      }
    }
  }

  // Don't forget the last record in the file
  if (currentIndi) individuals.set(currentIndi.id, currentIndi);
  if (currentFam) families.set(currentFam.id, currentFam);
  if (currentNoteId) noteDefinitions.set(currentNoteId, currentNoteText);

  // Resolve note references: replace note IDs with actual note text.
  // We do this as a second pass because notes are defined at the bottom
  // of GEDCOM files, after the individuals that reference them.
  for (const [indiId, refs] of noteRefs) {
    const indi = individuals.get(indiId);
    if (!indi) continue;
    for (const noteId of refs) {
      const text = noteDefinitions.get(noteId);
      if (text) {
        indi.notes.push(text);
      }
    }
  }

  return { individuals, families };
}
