import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { GedcomData, Individual } from "../parser/types";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchResultsId = useId();

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
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return [];

    const matches: Individual[] = [];
    for (const individual of gedcom.individuals.values()) {
      if (individual.name.toLowerCase().includes(normalizedQuery)) {
        matches.push(individual);
        if (matches.length === 10) break;
      }
    }
    return matches;
  }, [query, gedcom]);

  const selectResult = (individual: Individual) => {
    onSelect(individual.id);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current >= results.length - 1 ? 0 : current + 1
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  };

  const showResults = isOpen && results.length > 0;
  const activeResultId =
    showResults && activeIndex >= 0
      ? `${searchResultsId}-option-${activeIndex}`
      : undefined;

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
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showResults}
        aria-controls={showResults ? searchResultsId : undefined}
        aria-activedescendant={activeResultId}
        aria-label="Search people by name"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search by name..."
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setIsOpen(nextQuery.trim().length >= 2);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
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
      {showResults && (
        <div
          id={searchResultsId}
          role="listbox"
          aria-label="Search results"
          style={{
            marginTop: 4,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {results.map((indi, index) => (
            <button
              type="button"
              key={indi.id}
              id={`${searchResultsId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => selectResult(indi)}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: index === activeIndex ? "#f5f5f5" : "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                borderBottom: "1px solid #f0f0f0",
              }}
              onMouseEnter={() => setActiveIndex(index)}
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
