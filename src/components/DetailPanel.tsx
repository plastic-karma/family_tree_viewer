import { useId, useMemo, useState, type FormEvent } from "react";
import type { Family, GedcomData, Individual } from "../parser/types";

interface DetailPanelProps {
  individual: Individual;
  gedcom: GedcomData;
  onClose: () => void;
  onNavigate: (personId: string) => void;
  onUpdate: (
    personId: string,
    updates: Pick<Individual, "name" | "birthDate">
  ) => void;
  onAddSibling: (personId: string, siblingId: string) => boolean;
  onRemoveSibling: (personId: string, siblingId: string) => void;
  onAddSpouse: (
    personId: string,
    spouseId: string,
    familyId?: string
  ) => boolean;
  onRemoveSpouse: (
    personId: string,
    spouseId: string,
    familyId?: string
  ) => void;
  onAddChild: (
    parentId: string,
    childId: string,
    familyId?: string
  ) => boolean;
  onRemoveChild: (
    parentId: string,
    childId: string,
    familyId?: string
  ) => void;
}

export function DetailPanel({
  individual,
  gedcom,
  onClose,
  onNavigate,
  onUpdate,
  onAddSibling,
  onRemoveSibling,
  onAddSpouse,
  onRemoveSpouse,
  onAddChild,
  onRemoveChild,
}: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(individual.name);
  const [draftBirthDate, setDraftBirthDate] = useState(
    individual.birthDate ?? ""
  );
  const [editError, setEditError] = useState<string | null>(null);

  const submitUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    const birthDate = draftBirthDate.trim();

    if (!name) {
      setEditError("Name is required.");
      return;
    }

    onUpdate(individual.id, {
      name,
      birthDate: birthDate || undefined,
    });
    setDraftName(name);
    setDraftBirthDate(birthDate);
    setEditError(null);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraftName(individual.name);
    setDraftBirthDate(individual.birthDate ?? "");
    setEditError(null);
    setIsEditing(false);
  };
  const spouseFamilies = individual.familyAsSpouse
    .map((familyId) => gedcom.families.get(familyId))
    .filter(
      (family): family is Family =>
        family !== undefined &&
        (family.husbandId === individual.id ||
          family.wifeId === individual.id)
    );

  return (
    <div
      role="complementary"
      aria-label={`${individual.name || "Person"} details`}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 360,
        maxWidth: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        background: "#fff",
        borderLeft: "1px solid #ddd",
        padding: 20,
        overflowY: "auto",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
        zIndex: 10,
      }}
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          fontSize: 18,
          cursor: "pointer",
          color: "#666",
        }}
      >
        ×
      </button>

      {isEditing ? (
        <form onSubmit={submitUpdate} style={{ marginBottom: 20 }}>
          <label htmlFor="edit-person-name" style={fieldLabelStyle}>
            Name
          </label>
          <input
            id="edit-person-name"
            name="name"
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            autoFocus
            style={fieldInputStyle}
          />

          <label htmlFor="edit-person-birth-date" style={fieldLabelStyle}>
            Birth date
          </label>
          <input
            id="edit-person-birth-date"
            name="birthDate"
            type="text"
            value={draftBirthDate}
            onChange={(event) =>
              setDraftBirthDate(event.currentTarget.value)
            }
            placeholder="e.g. 15 MAR 1990"
            style={fieldInputStyle}
          />

          {editError && (
            <p
              role="alert"
              style={{ margin: "0 0 12px", color: "#b42318", fontSize: 13 }}
            >
              {editError}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={{
                ...editButtonStyle,
                borderColor: "#4a90d9",
                background: "#4a90d9",
                color: "#fff",
              }}
            >
              Save
            </button>
            <button type="button" onClick={cancelEditing} style={editButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>
            {individual.name}
          </h2>
          <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
            {individual.sex === "M"
              ? "Male"
              : individual.sex === "F"
                ? "Female"
                : "Unknown"}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={{ ...editButtonStyle, marginBottom: 16 }}
          >
            Edit
          </button>

          <EventSection
            title="Birth"
            date={individual.birthDate}
            place={individual.birthPlace}
          />
        </>
      )}

      <EventSection
        title="Death"
        date={individual.deathDate}
        place={individual.deathPlace}
      />

      {individual.familyAsChild && (
        <Section title="Parents">
          <ParentNames
            familyId={individual.familyAsChild}
            gedcom={gedcom}
            onNavigate={onNavigate}
          />
        </Section>
      )}

      <Siblings
        familyId={individual.familyAsChild}
        individualId={individual.id}
        gedcom={gedcom}
        onNavigate={onNavigate}
        onAddSibling={onAddSibling}
        onRemoveSibling={onRemoveSibling}
      />

      <Families
        individualId={individual.id}
        families={spouseFamilies}
        gedcom={gedcom}
        onNavigate={onNavigate}
        onAddSpouse={onAddSpouse}
        onRemoveSpouse={onRemoveSpouse}
        onAddChild={onAddChild}
        onRemoveChild={onRemoveChild}
      />

      {individual.notes.length > 0 && (
        <Section title="Notes">
          {individual.notes.map((note, i) => (
            <div
              key={i}
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 13,
                color: "#444",
                marginBottom: 8,
              }}
            >
              {note}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function PersonLink({
  id,
  name,
  onNavigate,
}: {
  id: string;
  name: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "#4a90d9",
        cursor: "pointer",
        fontSize: "inherit",
        textAlign: "left",
      }}
    >
      {name}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3
        style={{
          margin: "0 0 4px",
          fontSize: 11,
          fontWeight: 400,
          textTransform: "uppercase",
          color: "#999",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function EventSection({
  title,
  date,
  place,
}: {
  title: string;
  date?: string;
  place?: string;
}) {
  if (!date && !place) return null;
  return (
    <Section title={title}>
      {date && <div>{date}</div>}
      {place && <div style={{ color: "#666" }}>{place}</div>}
    </Section>
  );
}

function Families({
  individualId,
  families,
  gedcom,
  onNavigate,
  onAddSpouse,
  onRemoveSpouse,
  onAddChild,
  onRemoveChild,
}: {
  individualId: string;
  families: Family[];
  gedcom: GedcomData;
  onNavigate: (id: string) => void;
  onAddSpouse: (
    personId: string,
    spouseId: string,
    familyId?: string
  ) => boolean;
  onRemoveSpouse: (
    personId: string,
    spouseId: string,
    familyId?: string
  ) => void;
  onAddChild: (
    parentId: string,
    childId: string,
    familyId?: string
  ) => boolean;
  onRemoveChild: (
    parentId: string,
    childId: string,
    familyId?: string
  ) => void;
}) {
  const [searchTarget, setSearchTarget] = useState<{
    relationship: "spouse" | "child";
    familyId?: string;
  } | null>(null);
  const allFamiliesHaveSpouses = families.every((family) => {
    const spouseId =
      family.husbandId === individualId
        ? family.wifeId
        : family.husbandId;
    return spouseId !== undefined && spouseId !== individualId;
  });

  const addExistingPerson = (personId: string): boolean => {
    if (!searchTarget) return false;

    const added =
      searchTarget.relationship === "spouse"
        ? onAddSpouse(individualId, personId, searchTarget.familyId)
        : onAddChild(individualId, personId, searchTarget.familyId);
    if (added) setSearchTarget(null);
    return added;
  };

  return (
    <Section title="Families">
      {families.map((family) => {
        const spouseId =
          family.husbandId === individualId
            ? family.wifeId
            : family.husbandId;
        const spouse =
          spouseId && spouseId !== individualId
            ? gedcom.individuals.get(spouseId)
            : undefined;

        return (
          <div
            key={family.id}
            style={{
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: "1px solid #eee",
            }}
          >
            {spouseId && spouseId !== individualId ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  Spouse:{" "}
                  {spouse ? (
                    <PersonLink
                      id={spouse.id}
                      name={spouse.name || spouse.id}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <span>{spouseId}</span>
                  )}
                </div>
                {spouse && (
                  <button
                    type="button"
                    aria-label={`Remove ${spouse.name || spouse.id} as spouse`}
                    onClick={() =>
                      onRemoveSpouse(individualId, spouse.id, family.id)
                    }
                    style={{
                      ...editButtonStyle,
                      padding: "2px 6px",
                      color: "#b42318",
                      fontSize: 11,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setSearchTarget({
                    relationship: "spouse",
                    familyId: family.id,
                  })
                }
                style={editButtonStyle}
              >
                Add spouse
              </button>
            )}

            {(family.marriageDate || family.marriagePlace) && (
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                {family.marriageDate && (
                  <div>Married {family.marriageDate}</div>
                )}
                {family.marriagePlace && <div>{family.marriagePlace}</div>}
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>
                Children:
              </div>
              {family.childrenIds.map((childId) => {
                const child = gedcom.individuals.get(childId);
                return (
                  <div
                    key={childId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      margin: "0 0 4px 8px",
                    }}
                  >
                    {child ? (
                      <PersonLink
                        id={child.id}
                        name={child.name || child.id}
                        onNavigate={onNavigate}
                      />
                    ) : (
                      <span>{childId}</span>
                    )}
                    {child && (
                      <button
                        type="button"
                        aria-label={`Remove ${child.name || child.id} as child`}
                        onClick={() =>
                          onRemoveChild(
                            individualId,
                            child.id,
                            family.id
                          )
                        }
                        style={{
                          ...editButtonStyle,
                          padding: "2px 6px",
                          color: "#b42318",
                          fontSize: 11,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setSearchTarget({
                    relationship: "child",
                    familyId: family.id,
                  })
                }
                style={{
                  ...editButtonStyle,
                  marginTop: family.childrenIds.length > 0 ? 4 : 0,
                }}
              >
                Add child
              </button>
            </div>
          </div>
        );
      })}

      {families.length === 0 && (
        <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
          No spouse or children linked.
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {(families.length === 0 || allFamiliesHaveSpouses) && (
          <button
            type="button"
            onClick={() =>
              setSearchTarget({ relationship: "spouse" })
            }
            style={editButtonStyle}
          >
            Add spouse
          </button>
        )}
        {families.length === 0 && (
          <button
            type="button"
            onClick={() => setSearchTarget({ relationship: "child" })}
            style={editButtonStyle}
          >
            Add child
          </button>
        )}
      </div>

      {searchTarget && (
        <RelationshipSearchDialog
          relationship={searchTarget.relationship}
          individualId={individualId}
          familyId={searchTarget.familyId}
          gedcom={gedcom}
          onClose={() => setSearchTarget(null)}
          onSelect={addExistingPerson}
        />
      )}
    </Section>
  );
}

function Siblings({
  familyId,
  individualId,
  gedcom,
  onNavigate,
  onAddSibling,
  onRemoveSibling,
}: {
  familyId?: string;
  individualId: string;
  gedcom: GedcomData;
  onNavigate: (id: string) => void;
  onAddSibling: (personId: string, siblingId: string) => boolean;
  onRemoveSibling: (personId: string, siblingId: string) => void;
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const family = familyId ? gedcom.families.get(familyId) : undefined;
  const siblings =
    family?.childrenIds
      .filter((id) => id !== individualId)
      .map((id) => gedcom.individuals.get(id))
      .filter((value): value is Individual => value !== undefined) ?? [];

  const addExistingSibling = (siblingId: string): boolean => {
    const added = onAddSibling(individualId, siblingId);
    if (added) setIsSearchOpen(false);
    return added;
  };

  return (
    <Section title="Siblings">
      {siblings.map((sibling) => (
        <div
          key={sibling.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <PersonLink
            id={sibling.id}
            name={sibling.name || sibling.id}
            onNavigate={onNavigate}
          />
          <button
            type="button"
            aria-label={`Remove ${sibling.name || sibling.id} as sibling`}
            onClick={() => onRemoveSibling(individualId, sibling.id)}
            style={{
              ...editButtonStyle,
              padding: "2px 6px",
              color: "#b42318",
              fontSize: 11,
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        style={{ ...editButtonStyle, marginTop: siblings.length > 0 ? 4 : 0 }}
      >
        Add sibling
      </button>

      {isSearchOpen && (
        <RelationshipSearchDialog
          relationship="sibling"
          individualId={individualId}
          gedcom={gedcom}
          onClose={() => setIsSearchOpen(false)}
          onSelect={addExistingSibling}
        />
      )}
    </Section>
  );
}

type EditableRelationship = "sibling" | "spouse" | "child";

const relationshipSearchCopy: Record<
  EditableRelationship,
  {
    title: string;
    inputName: string;
    closeLabel: string;
    searchLabel: string;
    resultsLabel: string;
    failureMessage: string;
  }
> = {
  sibling: {
    title: "Add existing sibling",
    inputName: "siblingSearch",
    closeLabel: "Close sibling search",
    searchLabel: "Search existing people by name",
    resultsLabel: "Sibling search results",
    failureMessage: "That person could not be linked as a sibling.",
  },
  spouse: {
    title: "Add existing spouse",
    inputName: "spouseSearch",
    closeLabel: "Close spouse search",
    searchLabel: "Search existing people to add as a spouse",
    resultsLabel: "Spouse search results",
    failureMessage: "That person could not be linked as a spouse.",
  },
  child: {
    title: "Add existing child",
    inputName: "childSearch",
    closeLabel: "Close child search",
    searchLabel: "Search existing people to add as a child",
    resultsLabel: "Child search results",
    failureMessage: "That person could not be linked as a child.",
  },
};

function unavailableRelationshipReason(
  relationship: EditableRelationship,
  individualId: string,
  candidate: Individual,
  gedcom: GedcomData,
  familyId?: string
): string | null {
  if (relationship === "spouse") return null;

  const individual = gedcom.individuals.get(individualId);
  if (relationship === "sibling") {
    const selectedFamily = individual?.familyAsChild
      ? gedcom.families.get(individual.familyAsChild)
      : undefined;
    const candidateFamily = candidate.familyAsChild
      ? gedcom.families.get(candidate.familyAsChild)
      : undefined;
    return selectedFamily &&
      candidateFamily &&
      selectedFamily.id !== candidateFamily.id
      ? "Already belongs to another parent family"
      : null;
  }

  const targetFamily = familyId
    ? gedcom.families.get(familyId)
    : undefined;
  if (
    targetFamily &&
    (targetFamily.husbandId === candidate.id ||
      targetFamily.wifeId === candidate.id)
  ) {
    return "Already a parent in this family";
  }

  const candidateFamily = candidate.familyAsChild
    ? gedcom.families.get(candidate.familyAsChild)
    : undefined;
  if (
    candidateFamily &&
    (!targetFamily || candidateFamily.id !== targetFamily.id)
  ) {
    return "Already belongs to another parent family";
  }
  for (const family of gedcom.families.values()) {
    if (
      family.childrenIds.includes(candidate.id) &&
      (!targetFamily || family.id !== targetFamily.id)
    ) {
      return "Already belongs to another parent family";
    }
  }
  return null;
}

function RelationshipSearchDialog({
  relationship,
  individualId,
  familyId,
  gedcom,
  onClose,
  onSelect,
}: {
  relationship: EditableRelationship;
  individualId: string;
  familyId?: string;
  gedcom: GedcomData;
  onClose: () => void;
  onSelect: (personId: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const titleId = useId();
  const searchInputId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const copy = relationshipSearchCopy[relationship];
  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];

    const linkedIds = new Set<string>();
    const individual = gedcom.individuals.get(individualId);
    if (relationship === "sibling") {
      const selectedFamily = individual?.familyAsChild
        ? gedcom.families.get(individual.familyAsChild)
        : undefined;
      for (const id of selectedFamily?.childrenIds ?? []) {
        linkedIds.add(id);
      }
    } else if (relationship === "spouse") {
      for (const family of gedcom.families.values()) {
        if (family.husbandId === individualId && family.wifeId) {
          linkedIds.add(family.wifeId);
        } else if (family.wifeId === individualId && family.husbandId) {
          linkedIds.add(family.husbandId);
        }
      }
    } else if (familyId) {
      const family = gedcom.families.get(familyId);
      for (const id of family?.childrenIds ?? []) linkedIds.add(id);
    }

    const matches: Array<{
      individual: Individual;
      unavailableReason: string | null;
    }> = [];
    for (const candidate of gedcom.individuals.values()) {
      if (
        candidate.id === individualId ||
        linkedIds.has(candidate.id) ||
        !candidate.name.toLowerCase().includes(normalizedQuery)
      ) {
        continue;
      }

      matches.push({
        individual: candidate,
        unavailableReason: unavailableRelationshipReason(
          relationship,
          individualId,
          candidate,
          gedcom,
          familyId
        ),
      });
      if (matches.length === 10) break;
    }
    return matches;
  }, [
    familyId,
    gedcom,
    individualId,
    normalizedQuery,
    relationship,
  ]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0, 0, 0, 0.35)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        style={{
          position: "relative",
          width: 420,
          maxWidth: "100%",
          maxHeight: "min(560px, calc(100vh - 40px))",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: 20,
          borderRadius: 8,
          background: "#fff",
          boxShadow: "0 12px 32px rgba(0,0,0,0.24)",
        }}
      >
        <h2 id={titleId} style={{ margin: "0 36px 16px 0", fontSize: 18 }}>
          {copy.title}
        </h2>
        <button
          type="button"
          aria-label={copy.closeLabel}
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            border: "none",
            background: "none",
            color: "#666",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ×
        </button>

        <label htmlFor={searchInputId} style={fieldLabelStyle}>
          Search people
        </label>
        <input
          id={searchInputId}
          name={copy.inputName}
          type="search"
          aria-label={copy.searchLabel}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder="Search by name..."
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setSelectionError(null);
          }}
          style={fieldInputStyle}
        />

        {normalizedQuery.length < 2 ? (
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            Type at least 2 characters.
          </p>
        ) : results.length === 0 ? (
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            No matching people available.
          </p>
        ) : (
          <div role="listbox" aria-label={copy.resultsLabel}>
            {results.map(({ individual, unavailableReason }) => {
              const unavailable = unavailableReason !== null;
              return (
                <button
                  key={individual.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  aria-disabled={unavailable}
                  disabled={unavailable}
                  onClick={() => {
                    if (!onSelect(individual.id)) {
                      setSelectionError(copy.failureMessage);
                    }
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    borderBottom: "1px solid #f0f0f0",
                    background: "none",
                    color: unavailable ? "#999" : "inherit",
                    textAlign: "left",
                    cursor: unavailable ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  <div>{individual.name || individual.id}</div>
                  {individual.birthDate && (
                    <div style={{ fontSize: 11, color: "#888" }}>
                      b. {individual.birthDate}
                    </div>
                  )}
                  {unavailableReason && (
                    <div style={{ fontSize: 11 }}>
                      {unavailableReason}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectionError && (
          <p
            role="alert"
            style={{ margin: "12px 0 0", color: "#b42318", fontSize: 13 }}
          >
            {selectionError}
          </p>
        )}
      </div>
    </div>
  );
}

function ParentNames({
  familyId,
  gedcom,
  onNavigate,
}: {
  familyId: string;
  gedcom: GedcomData;
  onNavigate: (id: string) => void;
}) {
  const family = gedcom.families.get(familyId);
  if (!family) return null;

  const father = family.husbandId
    ? gedcom.individuals.get(family.husbandId)
    : undefined;
  const mother = family.wifeId
    ? gedcom.individuals.get(family.wifeId)
    : undefined;

  return (
    <>
      {father && (
        <div>
          <PersonLink
            id={father.id}
            name={father.name}
            onNavigate={onNavigate}
          />
        </div>
      )}
      {mother && (
        <div>
          <PersonLink
            id={mother.id}
            name={mother.name}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </>
  );
}

const fieldLabelStyle = {
  display: "block",
  marginBottom: 4,
  color: "#666",
  fontSize: 12,
  fontWeight: 600,
} as const;

const fieldInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 12,
  padding: "8px 10px",
  border: "1px solid #bbb",
  borderRadius: 6,
  color: "#213547",
  background: "#fff",
  font: "inherit",
} as const;

const editButtonStyle = {
  padding: "7px 12px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  color: "#213547",
  cursor: "pointer",
} as const;
