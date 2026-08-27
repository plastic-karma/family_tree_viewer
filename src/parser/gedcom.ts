import type {
  Individual,
  Family,
  GedcomDocument,
} from "./types";

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
export function parseGedcom(text: string): GedcomDocument {
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

  return { individuals, families, sourceText: text };
}

interface GedcomSourceLine {
  content: string;
  ending: string;
}

interface ParsedGedcomSourceLine {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
}

interface IndividualRecord {
  id: string;
  start: number;
  end: number;
}

interface SourceEdit {
  index: number;
  order: number;
  deleteCount: 0 | 1;
  contents: string[];
}

/**
 * Export the current editable fields into the original GEDCOM document.
 *
 * Unknown records and tags remain byte-for-byte unchanged. Only NAME and
 * BIRT.DATE values whose parsed values changed are rewritten.
 */
export function exportGedcom(document: GedcomDocument): string {
  const lines = splitGedcomSource(document.sourceText);
  if (lines.length === 0) return document.sourceText;

  const defaultEnding =
    lines.find((line) => line.ending !== "")?.ending ?? "\n";
  const records = findIndividualRecords(lines);

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    const individual = document.individuals.get(record.id);
    if (!individual) continue;

    updateIndividualRecord(lines, record, individual, defaultEnding);
  }

  return lines.map((line) => line.content + line.ending).join("");
}

function splitGedcomSource(text: string): GedcomSourceLine[] {
  const lines: GedcomSourceLine[] = [];
  const endingPattern = /\r\n|\n|\r/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = endingPattern.exec(text)) !== null) {
    lines.push({
      content: text.slice(start, match.index),
      ending: match[0],
    });
    start = match.index + match[0].length;
  }

  if (start < text.length) {
    lines.push({ content: text.slice(start), ending: "" });
  }

  return lines;
}

function parseGedcomSourceLine(
  line: GedcomSourceLine
): ParsedGedcomSourceLine | null {
  const match = GEDCOM_LINE_RE.exec(line.content.trim());
  if (!match) return null;

  return {
    level: Number(match[1]),
    xref: match[2] ?? null,
    tag: match[3],
    value: (match[4] ?? "").trim(),
  };
}

function findIndividualRecords(
  lines: GedcomSourceLine[]
): IndividualRecord[] {
  const records: IndividualRecord[] = [];

  for (let start = 0; start < lines.length; start += 1) {
    const line = parseGedcomSourceLine(lines[start]);
    if (line?.level !== 0 || line.tag !== "INDI" || !line.xref) continue;

    let end = start + 1;
    while (end < lines.length) {
      if (parseGedcomSourceLine(lines[end])?.level === 0) break;
      end += 1;
    }

    records.push({ id: line.xref, start, end });
    start = end - 1;
  }

  return records;
}

function updateIndividualRecord(
  lines: GedcomSourceLine[],
  record: IndividualRecord,
  individual: Individual,
  defaultEnding: string
) {
  const nameLines: number[] = [];
  const birthDateLines: number[] = [];
  let lastBirthLine: number | null = null;
  let insideBirth = false;

  for (let index = record.start + 1; index < record.end; index += 1) {
    const line = parseGedcomSourceLine(lines[index]);
    if (!line) continue;

    if (line.level === 1) {
      insideBirth = line.tag === "BIRT";
      if (line.tag === "NAME") nameLines.push(index);
      if (insideBirth) lastBirthLine = index;
      continue;
    }

    if (line.level === 2 && insideBirth && line.tag === "DATE") {
      birthDateLines.push(index);
    }
  }

  const edits: SourceEdit[] = [];
  let order = 0;
  const desiredName = cleanGedcomValue(individual.name);
  const lastNameLine = nameLines.at(-1);
  const sourceName =
    lastNameLine === undefined
      ? ""
      : normalizeGedcomName(
          parseGedcomSourceLine(lines[lastNameLine])?.value ?? ""
        );

  if (sourceName !== normalizeGedcomName(desiredName)) {
    if (desiredName && lastNameLine !== undefined) {
      edits.push({
        index: lastNameLine,
        order: order++,
        deleteCount: 1,
        contents: [`1 NAME ${desiredName}`],
      });
    } else if (desiredName) {
      edits.push({
        index: record.start + 1,
        order: order++,
        deleteCount: 0,
        contents: [`1 NAME ${desiredName}`],
      });
    } else {
      for (const index of nameLines) {
        edits.push({
          index,
          order: order++,
          deleteCount: 1,
          contents: [],
        });
      }
    }
  }

  const desiredBirthDate = cleanGedcomValue(individual.birthDate ?? "");
  const lastBirthDateLine = birthDateLines.at(-1);
  const sourceBirthDate =
    lastBirthDateLine === undefined
      ? ""
      : parseGedcomSourceLine(lines[lastBirthDateLine])?.value ?? "";

  if (sourceBirthDate !== desiredBirthDate) {
    if (desiredBirthDate && lastBirthDateLine !== undefined) {
      edits.push({
        index: lastBirthDateLine,
        order: order++,
        deleteCount: 1,
        contents: [`2 DATE ${desiredBirthDate}`],
      });
    } else if (desiredBirthDate && lastBirthLine !== null) {
      edits.push({
        index: lastBirthLine + 1,
        order: order++,
        deleteCount: 0,
        contents: [`2 DATE ${desiredBirthDate}`],
      });
    } else if (desiredBirthDate) {
      edits.push({
        index: record.end,
        order: order++,
        deleteCount: 0,
        contents: ["1 BIRT", `2 DATE ${desiredBirthDate}`],
      });
    } else {
      for (const index of birthDateLines) {
        edits.push({
          index,
          order: order++,
          deleteCount: 1,
          contents: [],
        });
      }
    }
  }

  edits.sort(
    (left, right) =>
      right.index - left.index || right.order - left.order
  );

  for (const edit of edits) {
    if (edit.deleteCount === 1 && edit.contents.length === 1) {
      lines[edit.index] = {
        content: edit.contents[0],
        ending: lines[edit.index].ending,
      };
    } else if (edit.deleteCount === 1) {
      removeSourceLine(lines, edit.index);
    } else {
      insertSourceLines(lines, edit.index, edit.contents, defaultEnding);
    }
  }
}

function normalizeGedcomName(value: string): string {
  return value.replace(/\//g, "").trim();
}

function cleanGedcomValue(value: string): string {
  return value.replace(/\r\n|\n|\r/g, " ").trim();
}

function removeSourceLine(lines: GedcomSourceLine[], index: number) {
  const removedFinalLine =
    index === lines.length - 1 && lines[index].ending === "";
  lines.splice(index, 1);

  if (removedFinalLine && lines.length > 0) {
    lines[lines.length - 1].ending = "";
  }
}

function insertSourceLines(
  lines: GedcomSourceLine[],
  index: number,
  contents: string[],
  defaultEnding: string
) {
  if (contents.length === 0) return;

  if (index < lines.length) {
    const ending =
      lines[index].ending ||
      (index > 0 ? lines[index - 1].ending : "") ||
      defaultEnding;
    lines.splice(
      index,
      0,
      ...contents.map((content) => ({ content, ending }))
    );
    return;
  }

  const preserveTrailingEnding =
    lines.length > 0 && lines[lines.length - 1].ending !== "";
  if (lines.length > 0 && !preserveTrailingEnding) {
    lines[lines.length - 1].ending = defaultEnding;
  }

  lines.push(
    ...contents.map((content, contentIndex) => ({
      content,
      ending:
        preserveTrailingEnding || contentIndex < contents.length - 1
          ? defaultEnding
          : "",
    }))
  );
}
