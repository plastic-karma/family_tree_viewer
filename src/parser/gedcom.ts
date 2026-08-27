import type { Individual, Family, GedcomData } from "./types";

const GEDCOM_LINE_RE =
  /^(\d+)\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/;
const XREF_VALUE_RE = /^@[^@\s]+@$/;

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
  const noteDefinitions = new Map<string, string>();
  const noteRefs = new Map<string, string[]>();

  let currentIndi: Individual | null = null;
  let currentFam: Family | null = null;
  let currentNoteId: string | null = null;
  let currentNoteText = "";
  let inlineNoteIndex: number | null = null;
  let level1Tag: string | null = null;

  const finishInlineNote = () => {
    if (
      currentIndi &&
      inlineNoteIndex !== null &&
      currentIndi.notes[inlineNoteIndex] === ""
    ) {
      currentIndi.notes.splice(inlineNoteIndex, 1);
    }
    inlineNoteIndex = null;
  };

  const finishCurrentRecord = () => {
    finishInlineNote();
    if (currentIndi) individuals.set(currentIndi.id, currentIndi);
    if (currentFam) families.set(currentFam.id, currentFam);
    if (currentNoteId) noteDefinitions.set(currentNoteId, currentNoteText);

    currentIndi = null;
    currentFam = null;
    currentNoteId = null;
    currentNoteText = "";
    level1Tag = null;
  };

  for (const line of text.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Consume one separator before the value so CONC can retain an
    // additional leading space used to join words across physical lines.
    const match = GEDCOM_LINE_RE.exec(trimmed);
    if (!match) continue;

    const level = Number(match[1]);
    const xref = match[2] ?? null;
    const tag = match[3];
    const rawValue = match[4] ?? "";
    const value = tag === "CONC" ? rawValue : rawValue.trim();

    if (level === 0) {
      finishCurrentRecord();

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
        currentNoteText = value;
      }
      continue;
    }

    if (level === 1) {
      finishInlineNote();
      level1Tag = tag;

      if (currentIndi) {
        switch (tag) {
          case "NAME":
            currentIndi.name = value.replace(/\//g, "").trim();
            break;
          case "SEX":
            currentIndi.sex = value === "M" ? "M" : value === "F" ? "F" : "U";
            break;
          case "FAMS":
            if (value && !currentIndi.familyAsSpouse.includes(value)) {
              currentIndi.familyAsSpouse.push(value);
            }
            break;
          case "FAMC":
            if (value) currentIndi.familyAsChild = value;
            break;
          case "NOTE":
            if (XREF_VALUE_RE.test(value)) {
              const refs = noteRefs.get(currentIndi.id);
              if (refs) {
                if (!refs.includes(value)) refs.push(value);
              } else {
                noteRefs.set(currentIndi.id, [value]);
              }
            } else {
              currentIndi.notes.push(value);
              inlineNoteIndex = currentIndi.notes.length - 1;
            }
            break;
        }
      }

      if (currentNoteId) {
        if (tag === "CONC") {
          currentNoteText += value;
        } else if (tag === "CONT") {
          currentNoteText += `\n${value}`;
        }
      }

      if (currentFam) {
        switch (tag) {
          case "HUSB":
            if (value) currentFam.husbandId = value;
            break;
          case "WIFE":
            if (value) currentFam.wifeId = value;
            break;
          case "CHIL":
            if (value && !currentFam.childrenIds.includes(value)) {
              currentFam.childrenIds.push(value);
            }
            break;
        }
      }
      continue;
    }

    if (level === 2) {
      if (currentIndi) {
        if (inlineNoteIndex !== null) {
          if (tag === "CONC") {
            currentIndi.notes[inlineNoteIndex] += value;
          } else if (tag === "CONT") {
            currentIndi.notes[inlineNoteIndex] += `\n${value}`;
          }
        } else if (level1Tag === "BIRT") {
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

  finishCurrentRecord();

  for (const [individualId, refs] of noteRefs) {
    const individual = individuals.get(individualId);
    if (!individual) continue;

    for (const noteId of refs) {
      const note = noteDefinitions.get(noteId);
      if (note) individual.notes.push(note);
    }
  }

  // Family records are authoritative relationship links. Backfill omitted
  // reciprocal FAMS/FAMC tags so layout and detail navigation remain complete.
  for (const [familyId, family] of families) {
    if (family.husbandId) {
      const husband = individuals.get(family.husbandId);
      if (husband && !husband.familyAsSpouse.includes(familyId)) {
        husband.familyAsSpouse.push(familyId);
      }
    }

    if (family.wifeId) {
      const wife = individuals.get(family.wifeId);
      if (wife && !wife.familyAsSpouse.includes(familyId)) {
        wife.familyAsSpouse.push(familyId);
      }
    }

    for (const childId of family.childrenIds) {
      const child = individuals.get(childId);
      if (child && !child.familyAsChild) child.familyAsChild = familyId;
    }
  }

  return { individuals, families };
}
