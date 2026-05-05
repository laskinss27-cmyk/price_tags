import React, { useMemo, useState } from "react";
import type { Category } from "../types";

interface Props {
  categories: Category[];
  selectedId: string | null;
  goodsCountByCategory: Record<string, number>;
  onSelect: (id: string | null) => void;
}

interface Node {
  cat: Category;
  children: Node[];
  /** Полное число товаров с учётом потомков. */
  totalGoods: number;
}

function buildTree(cats: Category[], counts: Record<string, number>): Node[] {
  const byParent = new Map<string, Category[]>();
  for (const c of cats) {
    const arr = byParent.get(c.parent) || [];
    arr.push(c);
    byParent.set(c.parent, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

  function make(cat: Category): Node {
    const children = (byParent.get(cat.id) || []).map(make);
    const total = (counts[cat.id] || 0) + children.reduce((s, n) => s + n.totalGoods, 0);
    return { cat, children, totalGoods: total };
  }
  return (byParent.get("0") || []).map(make);
}

function Row({
  node,
  depth,
  selectedId,
  expanded,
  toggle,
  onSelect,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const isOpen = expanded.has(node.cat.id);
  const has = node.children.length > 0;
  const active = selectedId === node.cat.id;

  return (
    <>
      <div
        className={"cat-row" + (active ? " active" : "")}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(active ? null : node.cat.id)}
      >
        <span
          className={"twist" + (has ? "" : " empty")}
          onClick={(e) => {
            e.stopPropagation();
            toggle(node.cat.id);
          }}
        >
          {has ? (isOpen ? "▾" : "▸") : ""}
        </span>
        <span className="name" title={node.cat.name}>{node.cat.name}</span>
        {node.totalGoods > 0 && <span className="num">{node.totalGoods}</span>}
      </div>
      {isOpen &&
        node.children.map((c) => (
          <Row
            key={c.cat.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            toggle={toggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

export function CategoryTree({ categories, selectedId, goodsCountByCategory, onSelect }: Props) {
  const tree = useMemo(() => buildTree(categories, goodsCountByCategory), [categories, goodsCountByCategory]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  };

  return (
    <div className="cat-list">
      <div
        className={"cat-row" + (selectedId === null ? " active" : "")}
        style={{ paddingLeft: 6, fontWeight: 600 }}
        onClick={() => onSelect(null)}
      >
        <span className="twist empty"></span>
        <span className="name">Все товары</span>
      </div>
      {tree.map((n) => (
        <Row
          key={n.cat.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          toggle={toggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
