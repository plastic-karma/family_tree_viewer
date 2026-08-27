import type { Family, GedcomData, Individual } from "../parser/types";

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

      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{individual.name}</h2>
      <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
        {individual.sex === "M"
          ? "Male"
          : individual.sex === "F"
            ? "Female"
            : "Unknown"}
      </div>

      <EventSection
        title="Birth"
        date={individual.birthDate}
        place={individual.birthPlace}
      />

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

      {individual.familyAsChild && (
        <Siblings
          familyId={individual.familyAsChild}
          individualId={individual.id}
          gedcom={gedcom}
          onNavigate={onNavigate}
        />
      )}

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
}: {
  familyId: string;
  individualId: string;
  gedcom: GedcomData;
  onNavigate: (id: string) => void;
}) {
  const family = gedcom.families.get(familyId);
  const siblings = family?.childrenIds
    .filter((id) => id !== individualId)
    .map((id) => gedcom.individuals.get(id))
    .filter((x): x is Individual => Boolean(x)) ?? [];

  if (siblings.length === 0) return null;

  return (
    <Section title="Siblings">
      {siblings.map((sib) => (
        <div key={sib.id}>
          <PersonLink id={sib.id} name={sib.name} onNavigate={onNavigate} />
        </div>
      ))}
    </Section>
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
