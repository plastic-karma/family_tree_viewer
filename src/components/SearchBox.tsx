import { useState, useRef, useEffect } from "react";
import type { GedcomData } from "../parser/types";

/**
 * Search-as-you-type component for finding individuals by name.
 *
 * State is entirely local — the parent only needs to know when
 * someone is selected (via onSelect). The search query and dropdown
 * visibility are not relevant to any other component.
 *
 * We cap results at 10 to keep the dropdown manageable. For 2,300
 * people, a simple string includes() is fast enough — no need for
 * a search index or fuzzy matching library.
 */

interface SearchBoxProps {
  gedcom: GedcomData;
  onSelect: (personId: string) => void;
}

export function SearchBox({ gedcom, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside.
  // This is a common pattern: register a document-level listener
  // that checks if the click target is inside our component.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results =
    query.length >= 2
      ? [...gedcom.individuals.values()]
          .filter((indi) =>
            indi.name.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10)
      : [];

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 10,
        width: 280,
      }}
    >
      <input
        type="text"
        placeholder="Search by name..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (query.length >= 2) setIsOpen(true);
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 14,
          border: "1px solid #ccc",
          borderRadius: 6,
          boxSizing: "border-box",
          outline: "none",
        }}
      />
      {isOpen && results.length > 0 && (
        <div
          style={{
            marginTop: 4,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {results.map((indi) => (
            <button
              key={indi.id}
              onClick={() => {
                onSelect(indi.id);
                setQuery("");
                setIsOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                borderBottom: "1px solid #f0f0f0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <div>{indi.name}</div>
              {indi.birthDate && (
                <div style={{ fontSize: 11, color: "#888" }}>
                  b. {indi.birthDate}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
