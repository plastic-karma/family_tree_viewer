import { describe, it, expect } from "vitest";
import { parseGedcom } from "./gedcom";

describe("parseGedcom", () => {
  it("parses an empty string", () => {
    const result = parseGedcom("");
    expect(result.individuals.size).toBe(0);
    expect(result.families.size).toBe(0);
  });

  it("skips header and non-INDI/FAM records", () => {
    const input = `0 HEAD
1 SOUR FTM
2 VERS Family Tree Maker (20.0.0.376)
1 CHAR ANSI
0 @SUBM@ SUBM
0 TRLR`;

    const result = parseGedcom(input);
    expect(result.individuals.size).toBe(0);
    expect(result.families.size).toBe(0);
  });

  it("parses a basic individual with name and sex", () => {
    const input = `0 @I1@ INDI
1 NAME John /Doe/
1 SEX M`;

    const result = parseGedcom(input);
    expect(result.individuals.size).toBe(1);

    const person = result.individuals.get("@I1@");
    expect(person).toBeDefined();
    expect(person!.name).toBe("John Doe");
    expect(person!.sex).toBe("M");
  });

  it("strips slashes from surname in name", () => {
    const input = `0 @I1@ INDI
1 NAME Mary Elizabeth /O'Brien/`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.name).toBe("Mary Elizabeth O'Brien");
  });

  it("parses birth date and place", () => {
    const input = `0 @I1@ INDI
1 NAME Jane /Smith/
1 SEX F
1 BIRT
2 DATE 15 MAR 1990
2 PLAC Portland, Oregon, USA`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.birthDate).toBe("15 MAR 1990");
    expect(person!.birthPlace).toBe("Portland, Oregon, USA");
  });

  it("parses death date and place", () => {
    const input = `0 @I1@ INDI
1 NAME Old /Timer/
1 SEX M
1 BIRT
2 DATE 01 JAN 1900
1 DEAT
2 DATE 31 DEC 1980
2 PLAC New York, USA`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.birthDate).toBe("01 JAN 1900");
    expect(person!.deathDate).toBe("31 DEC 1980");
    expect(person!.deathPlace).toBe("New York, USA");
    // birthPlace was not specified
    expect(person!.birthPlace).toBeUndefined();
  });

  it("does not mix up birth and death fields", () => {
    const input = `0 @I1@ INDI
1 NAME Test /Person/
1 SEX F
1 DEAT
2 DATE 05 JUN 2020
2 PLAC Death City
1 BIRT
2 DATE 10 FEB 1950
2 PLAC Birth Town`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.birthDate).toBe("10 FEB 1950");
    expect(person!.birthPlace).toBe("Birth Town");
    expect(person!.deathDate).toBe("05 JUN 2020");
    expect(person!.deathPlace).toBe("Death City");
  });

  it("parses family-as-spouse and family-as-child references", () => {
    const input = `0 @I1@ INDI
1 NAME Parent /One/
1 SEX M
1 FAMS @F1@
1 FAMS @F2@
1 FAMC @F99@`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.familyAsSpouse).toEqual(["@F1@", "@F2@"]);
    expect(person!.familyAsChild).toBe("@F99@");
  });

  it("parses a family record with spouses, children, and marriage", () => {
    const input = `0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 CHIL @I4@
1 MARR
2 DATE 27 JUL 1980
2 PLAC Somewhere, USA`;

    const result = parseGedcom(input);
    expect(result.families.size).toBe(1);

    const fam = result.families.get("@F1@");
    expect(fam).toBeDefined();
    expect(fam!.husbandId).toBe("@I1@");
    expect(fam!.wifeId).toBe("@I2@");
    expect(fam!.childrenIds).toEqual(["@I3@", "@I4@"]);
    expect(fam!.marriageDate).toBe("27 JUL 1980");
    expect(fam!.marriagePlace).toBe("Somewhere, USA");
  });

  it("parses multiple individuals and families together", () => {
    const input = `0 HEAD
1 SOUR FTM
0 @I1@ INDI
1 NAME Dad /Smith/
1 SEX M
1 FAMS @F1@
0 @I2@ INDI
1 NAME Mom /Jones/
1 SEX F
1 FAMS @F1@
0 @I3@ INDI
1 NAME Kid /Smith/
1 SEX M
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR`;

    const result = parseGedcom(input);
    expect(result.individuals.size).toBe(3);
    expect(result.families.size).toBe(1);

    expect(result.individuals.get("@I1@")!.name).toBe("Dad Smith");
    expect(result.individuals.get("@I2@")!.name).toBe("Mom Jones");
    expect(result.individuals.get("@I3@")!.familyAsChild).toBe("@F1@");
    expect(result.families.get("@F1@")!.childrenIds).toEqual(["@I3@"]);
  });

  it("defaults sex to U for unknown values", () => {
    const input = `0 @I1@ INDI
1 NAME Unknown /Sex/
1 SEX X`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.sex).toBe("U");
  });

  it("defaults sex to U when SEX tag is missing", () => {
    const input = `0 @I1@ INDI
1 NAME No /Sex/`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.sex).toBe("U");
  });

  it("handles the last record in the file (no trailing level-0)", () => {
    const input = `0 @I1@ INDI
1 NAME Last /Record/
1 SEX F`;

    // The parser must flush the last record even without a trailing "0 TRLR"
    const result = parseGedcom(input);
    expect(result.individuals.size).toBe(1);
    expect(result.individuals.get("@I1@")!.name).toBe("Last Record");
  });

  it("handles Windows-style CRLF line endings", () => {
    const input = "0 @I1@ INDI\r\n1 NAME Windows /User/\r\n1 SEX M\r\n";

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.name).toBe("Windows User");
  });

  it("handles a family with no marriage info", () => {
    const input = `0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@`;

    const fam = parseGedcom(input).families.get("@F1@");
    expect(fam!.marriageDate).toBeUndefined();
    expect(fam!.marriagePlace).toBeUndefined();
  });

  it("handles a family with only one spouse", () => {
    const input = `0 @F1@ FAM
1 WIFE @I1@
1 CHIL @I2@`;

    const fam = parseGedcom(input).families.get("@F1@");
    expect(fam!.husbandId).toBeUndefined();
    expect(fam!.wifeId).toBe("@I1@");
  });

  it("individual has empty notes array by default", () => {
    const input = `0 @I1@ INDI
1 NAME No /Notes/
1 SEX M`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.notes).toEqual([]);
  });

  it("resolves a simple note reference", () => {
    // NOTE definition appears after the individual that references it,
    // just like in real GEDCOM files. This tests the deferred resolution.
    const input = `0 @I1@ INDI
1 NAME Daisy /Archer/
1 SEX F
1 NOTE @N1@
0 @N1@ NOTE
1 CONC Emigrated in 1638`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.notes).toEqual(["Emigrated in 1638"]);
  });

  it("resolves a note with CONC (concatenation, no linebreak)", () => {
    // CONC joins directly — no linebreak and no added space.
    // In real GEDCOM files, long lines are split mid-word or with a
    // trailing space on the first part, so concatenation reconstructs
    // the original text correctly.
    const input = `0 @I1@ INDI
1 NAME Test /Person/
1 SEX M
1 NOTE @N1@
0 @N1@ NOTE
1 CONC Emigrated in 1638 and founder
1 CONC  of Sudbury, Massachusetts`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.notes).toEqual([
      "Emigrated in 1638 and founder of Sudbury, Massachusetts",
    ]);
  });

  it("resolves a note with CONT (continuation, adds linebreak)", () => {
    const input = `0 @I1@ INDI
1 NAME Test /Person/
1 SEX M
1 NOTE @N1@
0 @N1@ NOTE
1 CONC Captain in WWI
1 CONT state representative in Michigan`;

    const person = parseGedcom(input).individuals.get("@I1@");
    // CONT adds a newline between the parts
    expect(person!.notes).toEqual([
      "Captain in WWI\nstate representative in Michigan",
    ]);
  });

  it("resolves multiple notes on one individual", () => {
    const input = `0 @I1@ INDI
1 NAME Busy /Person/
1 SEX F
1 NOTE @N1@
1 NOTE @N2@
0 @N1@ NOTE
1 CONC First note
0 @N2@ NOTE
1 CONC Second note`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.notes).toEqual(["First note", "Second note"]);
  });

  it("handles note reference to a non-existent note gracefully", () => {
    const input = `0 @I1@ INDI
1 NAME Ghost /Ref/
1 SEX M
1 NOTE @N999@`;

    const person = parseGedcom(input).individuals.get("@I1@");
    // Unresolved references are silently skipped
    expect(person!.notes).toEqual([]);
  });

  it("handles CONT with empty value as a blank line", () => {
    const input = `0 @N1@ NOTE
1 CONC Line one
1 CONT
1 CONC Line three`;

    // Parse just to check the note definition is built correctly.
    // We need an individual to reference it to verify.
    const fullInput = `0 @I1@ INDI
1 NAME Test /Person/
1 SEX M
1 NOTE @N1@
${input}`;

    const person = parseGedcom(fullInput).individuals.get("@I1@");
    expect(person!.notes).toEqual(["Line one\nLine three"]);
  });

  it("handles note defined before the individual that references it", () => {
    // Reverse order: note first, then individual
    const input = `0 @N1@ NOTE
1 CONC A historical note
0 @I1@ INDI
1 NAME Forward /Ref/
1 SEX F
1 NOTE @N1@`;

    const person = parseGedcom(input).individuals.get("@I1@");
    expect(person!.notes).toEqual(["A historical note"]);
  });
});
