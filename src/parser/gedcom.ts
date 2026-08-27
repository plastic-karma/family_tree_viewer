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

export function addSibling(
  document: GedcomDocument,
  individualId: string,
  siblingId: string
): GedcomDocument | null {
  if (individualId === siblingId) return null;

  const individual = document.individuals.get(individualId);
  const sibling = document.individuals.get(siblingId);
  if (!individual || !sibling) return null;

  const individualFamily = individual.familyAsChild
    ? document.families.get(individual.familyAsChild)
    : undefined;
  const siblingFamily = sibling.familyAsChild
    ? document.families.get(sibling.familyAsChild)
    : undefined;
  if (
    individualFamily &&
    siblingFamily &&
    individualFamily.id !== siblingFamily.id
  ) {
    return null;
  }

  const existingFamily = individualFamily ?? siblingFamily;
  const familyId = existingFamily?.id ?? nextFamilyXref(document);
  const individualWasChild =
    existingFamily?.childrenIds.includes(individualId) ?? false;
  const siblingWasChild =
    existingFamily?.childrenIds.includes(siblingId) ?? false;
  if (individualWasChild && siblingWasChild) return null;

  const childrenIds = existingFamily
    ? [...existingFamily.childrenIds]
    : [];
  if (!individualWasChild) childrenIds.push(individualId);
  if (!siblingWasChild) childrenIds.push(siblingId);
  const family: Family = existingFamily
    ? { ...existingFamily, childrenIds }
    : { id: familyId, childrenIds };

  const individuals = new Map(document.individuals);
  if (individual.familyAsChild !== familyId) {
    individuals.set(individualId, { ...individual, familyAsChild: familyId });
  }
  if (sibling.familyAsChild !== familyId) {
    individuals.set(siblingId, { ...sibling, familyAsChild: familyId });
  }

  const families = new Map(document.families);
  families.set(familyId, family);

  return {
    ...document,
    individuals,
    families,
    sourceText: linkSiblingsInSource(
      document.sourceText,
      individual,
      sibling,
      family
    ),
  };
}

export function removeSibling(
  document: GedcomDocument,
  individualId: string,
  siblingId: string
): GedcomDocument | null {
  if (individualId === siblingId) return null;

  const individual = document.individuals.get(individualId);
  const sibling = document.individuals.get(siblingId);
  const familyId = individual?.familyAsChild;
  if (!individual || !sibling || !familyId) return null;

  const family = document.families.get(familyId);
  if (!family || !family.childrenIds.includes(siblingId)) return null;

  const families = new Map(document.families);
  families.set(familyId, {
    ...family,
    childrenIds: family.childrenIds.filter((id) => id !== siblingId),
  });

  let individuals = document.individuals;
  if (sibling.familyAsChild === familyId) {
    individuals = new Map(document.individuals);
    individuals.set(siblingId, { ...sibling, familyAsChild: undefined });
  }

  return {
    ...document,
    individuals,
    families,
    sourceText: removeSiblingFromSource(
      document.sourceText,
      familyId,
      siblingId
    ),
  };
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

interface GedcomRecord {
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
 * Export editable fields into the document's current source snapshot.
 *
 * Relationship edits update that snapshot when they are applied. Unknown
 * records and tags remain byte-for-byte unchanged; this pass rewrites only
 * NAME and BIRT.DATE values whose parsed values changed.
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
): GedcomRecord[] {
  const records: GedcomRecord[] = [];

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
  record: GedcomRecord,
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

function nextFamilyXref(document: GedcomDocument): string {
  const used = new Set<string>();
  for (const id of document.individuals.keys()) used.add(id);
  for (const id of document.families.keys()) used.add(id);
  for (const match of document.sourceText.matchAll(/@[^@\s]+@/g)) {
    used.add(match[0]);
  }

  let sequence = 1;
  while (used.has(`@F${sequence}@`)) sequence += 1;
  return `@F${sequence}@`;
}

function linkSiblingsInSource(
  sourceText: string,
  individual: Individual,
  sibling: Individual,
  family: Family
): string {
  const lines = splitGedcomSource(sourceText);
  const defaultEnding =
    lines.find((line) => line.ending !== "")?.ending ?? "\n";

  if (individual.familyAsChild !== family.id) {
    setFamilyAsChildReference(
      lines,
      individual.id,
      family.id,
      defaultEnding
    );
  }
  if (sibling.familyAsChild !== family.id) {
    setFamilyAsChildReference(
      lines,
      sibling.id,
      family.id,
      defaultEnding
    );
  }

  const familyRecord = findGedcomRecord(lines, "FAM", family.id);
  if (familyRecord) {
    const existingChildren = new Set<string>();
    for (
      let index = familyRecord.start + 1;
      index < familyRecord.end;
      index += 1
    ) {
      const line = parseGedcomSourceLine(lines[index]);
      if (line?.level === 1 && line.tag === "CHIL") {
        existingChildren.add(line.value);
      }
    }

    const childLines: string[] = [];
    if (!existingChildren.has(individual.id)) {
      childLines.push(`1 CHIL ${individual.id}`);
    }
    if (!existingChildren.has(sibling.id)) {
      childLines.push(`1 CHIL ${sibling.id}`);
    }
    insertSourceLines(lines, familyRecord.end, childLines, defaultEnding);
  } else {
    insertSourceLines(
      lines,
      findTrailerIndex(lines),
      serializeFamilyRecord(family),
      defaultEnding
    );
  }

  return lines.map((line) => line.content + line.ending).join("");
}

function removeSiblingFromSource(
  sourceText: string,
  familyId: string,
  siblingId: string
): string {
  const lines = splitGedcomSource(sourceText);
  const removals: number[] = [];
  const familyRecord = findGedcomRecord(lines, "FAM", familyId);
  const siblingRecord = findGedcomRecord(lines, "INDI", siblingId);

  if (familyRecord) {
    for (
      let index = familyRecord.start + 1;
      index < familyRecord.end;
      index += 1
    ) {
      const line = parseGedcomSourceLine(lines[index]);
      if (
        line?.level === 1 &&
        line.tag === "CHIL" &&
        line.value === siblingId
      ) {
        removals.push(index);
      }
    }
  }

  if (siblingRecord) {
    for (
      let index = siblingRecord.start + 1;
      index < siblingRecord.end;
      index += 1
    ) {
      const line = parseGedcomSourceLine(lines[index]);
      if (
        line?.level === 1 &&
        line.tag === "FAMC" &&
        line.value === familyId
      ) {
        removals.push(index);
      }
    }
  }

  removals.sort((left, right) => right - left);
  for (const index of removals) removeSourceLine(lines, index);
  return lines.map((line) => line.content + line.ending).join("");
}

function findGedcomRecord(
  lines: GedcomSourceLine[],
  tag: "INDI" | "FAM",
  id: string
): GedcomRecord | undefined {
  for (let start = 0; start < lines.length; start += 1) {
    const line = parseGedcomSourceLine(lines[start]);
    if (
      line?.level !== 0 ||
      line.tag !== tag ||
      line.xref !== id
    ) {
      continue;
    }

    let end = start + 1;
    while (end < lines.length) {
      if (parseGedcomSourceLine(lines[end])?.level === 0) break;
      end += 1;
    }
    return { id, start, end };
  }
  return undefined;
}

function setFamilyAsChildReference(
  lines: GedcomSourceLine[],
  individualId: string,
  familyId: string,
  defaultEnding: string
) {
  const record = findGedcomRecord(lines, "INDI", individualId);
  if (!record) return;

  let lastReference: number | null = null;
  for (let index = record.start + 1; index < record.end; index += 1) {
    const line = parseGedcomSourceLine(lines[index]);
    if (line?.level === 1 && line.tag === "FAMC") {
      lastReference = index;
    }
  }

  if (lastReference !== null) {
    lines[lastReference].content = `1 FAMC ${familyId}`;
  } else {
    insertSourceLines(
      lines,
      record.end,
      [`1 FAMC ${familyId}`],
      defaultEnding
    );
  }
}


function serializeFamilyRecord(family: Family): string[] {
  const lines = [`0 ${family.id} FAM`];
  if (family.husbandId) lines.push(`1 HUSB ${family.husbandId}`);
  if (family.wifeId) lines.push(`1 WIFE ${family.wifeId}`);
  if (family.marriageDate || family.marriagePlace) {
    lines.push("1 MARR");
    if (family.marriageDate) {
      lines.push(`2 DATE ${cleanGedcomValue(family.marriageDate)}`);
    }
    if (family.marriagePlace) {
      lines.push(`2 PLAC ${cleanGedcomValue(family.marriagePlace)}`);
    }
  }
  for (const childId of family.childrenIds) {
    lines.push(`1 CHIL ${childId}`);
  }
  return lines;
}

function findTrailerIndex(lines: GedcomSourceLine[]): number {
  const trailerIndex = lines.findIndex((line) => {
    const parsed = parseGedcomSourceLine(line);
    return parsed?.level === 0 && parsed.tag === "TRLR";
  });
  return trailerIndex === -1 ? lines.length : trailerIndex;
}
