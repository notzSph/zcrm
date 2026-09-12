"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import styles from "./select-menu.module.scss";

export type SelectMenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  tone?: "violet" | "yellow" | "green" | "red" | "neutral";
  count?: number;
};

type SelectMenuProps<T extends string> = {
  label: string;
  options: SelectMenuOption<T>[];
  value?: T;
  defaultValue?: T;
  name?: string;
  onChange?: (value: T) => void;
  compact?: boolean;
  className?: string;
};

export default function SelectMenu<T extends string>({
  label,
  options,
  value,
  defaultValue,
  name,
  onChange,
  compact = false,
  className = "",
}: SelectMenuProps<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value,
  );
  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[selectedIndex]?.focus();
  }, [open, selectedIndex]);

  function choose(nextValue: T) {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleRootBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[index].value);
      return;
    }
    const last = options.length - 1;
    let next = index;
    if (event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  }

  const SelectedIcon = selected?.icon;
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ""} ${className}`}
      ref={rootRef}
      onBlur={handleRootBlur}
    >
      {name && <input type="hidden" name={name} value={selectedValue ?? ""} />}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`${label}: ${selected?.label ?? "Select"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        title={label}
        data-tone={selected?.tone ?? "neutral"}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        {SelectedIcon && <SelectedIcon size={15} aria-hidden="true" />}
        <span>{selected?.label ?? "Select"}</span>
        {selected?.count !== undefined && (
          <strong className={styles.count}>{selected.count}</strong>
        )}
        <ChevronDown className={styles.chevron} size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul
          className={styles.menu}
          id={`${id}-options`}
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = option.value === selectedValue;
            return (
              <li
                id={`${id}-option-${index}`}
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                data-tone={option.tone ?? "neutral"}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                <span>{option.label}</span>
                {option.count !== undefined && <small>{option.count}</small>}
                {isSelected && <Check size={14} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
