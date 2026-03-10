import type { Individual, GedcomData } from "../parser/types";

/**
 * Side panel showing details for a selected person.
 *
 * onNavigate is called when the user clicks a linked person name
 * (parent, spouse, or child). The parent component handles updating
 * the selection and telling React Flow to center on that node.
 */

interface DetailPanelProps {
  individual: Individual;
  gedcom: GedcomData;
  onClose: () => void;
  onNavigate: (personId: string) => void;
}

export function DetailPanel({
  individual,
  gedcom,
  onClose,
  onNavigate,
}: DetailPanelProps) {
  const spouseFamilies = individual.familyAsSpouse
    .map((famId) => gedcom.families.get(famId))
    .filter(Boolean);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 320,
        height: "100vh",
        background: "#fff",
        borderLeft: "1px solid #ddd",
        padding: 20,
        overflowY: "auto",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
        zIndex: 10,
      }}
    >
      <button
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
        x
      </button>

      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{individual.name}</h2>
      <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
        {individual.sex === "M"
          ? "Male"
          : individual.sex === "F"
            ? "Female"
            : "Unknown"}
      </div>

      {(individual.birthDate || individual.birthPlace) && (
        <Section title="Birth">
          {individual.birthDate && <div>{individual.birthDate}</div>}
          {individual.birthPlace && (
            <div style={{ color: "#666" }}>{individual.birthPlace}</div>
          )}
        </Section>
      )}

      {(individual.deathDate || individual.deathPlace) && (
        <Section title="Death">
          {individual.deathDate && <div>{individual.deathDate}</div>}
          {individual.deathPlace && (
            <div style={{ color: "#666" }}>{individual.deathPlace}</div>
          )}
        </Section>
      )}

      {individual.familyAsChild && (
        <Section title="Parents">
          <ParentNames
            familyId={individual.familyAsChild}
            gedcom={gedcom}
            onNavigate={onNavigate}
          />
        </Section>
      )}

      {spouseFamilies.length > 0 && (
        <Section title="Families">
          {spouseFamilies.map((fam) => {
            if (!fam) return null;
            const spouseId =
              fam.husbandId === individual.id ? fam.wifeId : fam.husbandId;
            const spouse = spouseId
              ? gedcom.individuals.get(spouseId)
              : undefined;
            return (
              <div key={fam.id} style={{ marginBottom: 12 }}>
                {spouse && (
                  <div>
                    Spouse:{" "}
                    <PersonLink
                      id={spouse.id}
                      name={spouse.name}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {fam.marriageDate && (
                  <div style={{ color: "#666", fontSize: 12 }}>
                    Married {fam.marriageDate}
                  </div>
                )}
                {fam.childrenIds.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Children:</div>
                    {fam.childrenIds.map((childId) => {
                      const child = gedcom.individuals.get(childId);
                      return (
                        <div key={childId} style={{ marginLeft: 8 }}>
                          <PersonLink
                            id={childId}
                            name={child?.name || childId}
                            onNavigate={onNavigate}
                          />
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

/**
 * A clickable person name. Styled as a link to signal interactivity.
 * We use a button with link-like styling rather than an <a> tag because
 * there's no URL to navigate to — it's an in-app action.
 */
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
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          color: "#999",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
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
