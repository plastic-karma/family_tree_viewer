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
}

export function DetailPanel({
  individual,
  gedcom,
  onClose,
  onNavigate,
  onUpdate,
  onAddSibling,
  onRemoveSibling,
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

      {spouseFamilies.length > 0 && (
        <Section title="Families">
          {spouseFamilies.map((family) => {
            const spouseId =
              family.husbandId === individual.id
                ? family.wifeId
                : family.husbandId;
            const spouse =
              spouseId && spouseId !== individual.id
                ? gedcom.individuals.get(spouseId)
                : undefined;

            return (
              <div key={family.id} style={{ marginBottom: 12 }}>
                {spouse && (
                  <div>
                    Spouse:{" "}
                    <PersonLink
                      id={spouse.id}
                      name={spouse.name || spouse.id}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {(family.marriageDate || family.marriagePlace) && (
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {family.marriageDate && (
                      <div>Married {family.marriageDate}</div>
                    )}
                    {family.marriagePlace && <div>{family.marriagePlace}</div>}
                  </div>
                )}
                {family.childrenIds.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Children:</div>
                    {family.childrenIds.map((childId) => {
                      const child = gedcom.individuals.get(childId);
                      return (
                        <div key={childId} style={{ marginLeft: 8 }}>
                          {child ? (
                            <PersonLink
                              id={child.id}
                              name={child.name || child.id}
                              onNavigate={onNavigate}
                            />
                          ) : (
                            <span>{childId}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      )}

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
        <SiblingSearchDialog
          individualId={individualId}
          gedcom={gedcom}
          onClose={() => setIsSearchOpen(false)}
          onSelect={addExistingSibling}
        />
      )}
    </Section>
  );
}

function SiblingSearchDialog({
  individualId,
  gedcom,
  onClose,
  onSelect,
}: {
  individualId: string;
  gedcom: GedcomData;
  onClose: () => void;
  onSelect: (siblingId: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const titleId = useId();
  const searchInputId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];

    const individual = gedcom.individuals.get(individualId);
    const selectedFamily = individual?.familyAsChild
      ? gedcom.families.get(individual.familyAsChild)
      : undefined;
    const currentFamilyIds = new Set(selectedFamily?.childrenIds ?? []);
    const matches: Array<{
      individual: Individual;
      unavailable: boolean;
    }> = [];

    for (const candidate of gedcom.individuals.values()) {
      if (
        candidate.id === individualId ||
        currentFamilyIds.has(candidate.id) ||
        !candidate.name.toLowerCase().includes(normalizedQuery)
      ) {
        continue;
      }

      const candidateFamily = candidate.familyAsChild
        ? gedcom.families.get(candidate.familyAsChild)
        : undefined;
      matches.push({
        individual: candidate,
        unavailable:
          selectedFamily !== undefined &&
          candidateFamily !== undefined &&
          selectedFamily.id !== candidateFamily.id,
      });
      if (matches.length === 10) break;
    }
    return matches;
  }, [gedcom, individualId, normalizedQuery]);

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
          Add existing sibling
        </h2>
        <button
          type="button"
          aria-label="Close sibling search"
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
          name="siblingSearch"
          type="search"
          aria-label="Search existing people by name"
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
          <div role="listbox" aria-label="Sibling search results">
            {results.map(({ individual, unavailable }) => (
              <button
                key={individual.id}
                type="button"
                role="option"
                aria-selected="false"
                aria-disabled={unavailable}
                disabled={unavailable}
                onClick={() => {
                  if (!onSelect(individual.id)) {
                    setSelectionError(
                      "That person could not be linked as a sibling."
                    );
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
                {unavailable && (
                  <div style={{ fontSize: 11 }}>
                    Already belongs to another parent family
                  </div>
                )}
              </button>
            ))}
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
