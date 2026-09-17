import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";

const HOST_COLOR = "#2a6db0";
const PATHOGEN_COLOR = "#d67a2c";

function buildVisibleNetwork(nodes, edges) {
  const hostNodes = nodes.filter((node) => node.type === "host").sort((a, b) => b.degree - a.degree);
  const pathogenNodes = nodes.filter((node) => node.type === "pathogen").sort((a, b) => b.degree - a.degree);

  const maxPerSide = 80;
  const visibleHosts = hostNodes.slice(0, maxPerSide);
  const visiblePathogens = pathogenNodes.slice(0, maxPerSide);
  const visibleIds = new Set([...visibleHosts, ...visiblePathogens].map((node) => node.id));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

  return {
    hosts: visibleHosts,
    pathogens: visiblePathogens,
    edges: visibleEdges,
    clipped: visibleHosts.length < hostNodes.length || visiblePathogens.length < pathogenNodes.length,
  };
}

function downloadBlob(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function NetworkGraph({ nodes, edges, interactions = [] }) {
  const network = useMemo(() => buildVisibleNetwork(nodes, edges), [nodes, edges]);
  const [selectedId, setSelectedId] = useState(() => network.hosts[0]?.id || network.pathogens[0]?.id || null);
  const [showInteractions, setShowInteractions] = useState(false);
  const [layoutMode, setLayoutMode] = useState("cose");
  const graphRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    const fallbackId = network.hosts[0]?.id || network.pathogens[0]?.id || null;
    if (!selectedId || ![...network.hosts, ...network.pathogens].some((node) => node.id === selectedId)) {
      setSelectedId(fallbackId);
    }
  }, [network, selectedId]);

  const visibleNodes = useMemo(() => [...network.hosts, ...network.pathogens], [network]);
  const nodeIndex = useMemo(() => new Map(visibleNodes.map((node) => [node.id, node])), [visibleNodes]);

  const connectedEdges = useMemo(
    () => (selectedId ? network.edges.filter((edge) => edge.source === selectedId || edge.target === selectedId) : []),
    [network.edges, selectedId],
  );

  const connectedNodes = useMemo(() => {
    if (!selectedId) {
      return [];
    }

    return connectedEdges
      .map((edge) => nodeIndex.get(edge.source === selectedId ? edge.target : edge.source))
      .filter(Boolean)
      .sort((a, b) => b.degree - a.degree);
  }, [connectedEdges, nodeIndex, selectedId]);

  const selectedNode = selectedId ? nodeIndex.get(selectedId) || null : null;

  const filteredInteractions = useMemo(() => {
    if (!selectedId) {
      return interactions;
    }
    return interactions.filter(
      (interaction) => interaction.hostProtein === selectedId || interaction.pathogenProtein === selectedId,
    );
  }, [interactions, selectedId]);

  useEffect(() => {
    if (!graphRef.current) {
      return undefined;
    }

    const elements = [
      ...visibleNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          degree: node.degree || 0,
          hit: node.hit || "",
          hitAccession: node.hitAccession || "",
          description: node.description || "",
          organism: node.organism || "",
          go: node.go || "",
        },
      })),
      ...network.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        },
      })),
    ];

    const cy = cytoscape({
      container: graphRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": (element) =>
              element.data("type") === "host" ? HOST_COLOR : PATHOGEN_COLOR,
            color: "#0f2740",
            "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
            "font-size": 9,
            "text-wrap": "none",
            "text-valign": "top",
            "text-halign": "center",
            "text-margin-y": -6,
            "text-outline-width": 3,
            "text-outline-color": "#ffffff",
            width: (element) => Math.min(18, Math.max(8, 6 + Math.sqrt(element.data("degree") || 1) * 1.2)),
            height: (element) => Math.min(18, Math.max(8, 6 + Math.sqrt(element.data("degree") || 1) * 1.2)),
            "border-width": 0,
          },
        },
        {
          selector: 'node[type = "host"]',
          style: {
            "background-color": HOST_COLOR,
          },
        },
        {
          selector: 'node[type = "pathogen"]',
          style: {
            "background-color": PATHOGEN_COLOR,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.7,
            "line-color": "#aebfd2",
            "curve-style": "bezier",
            opacity: 0.7,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#0f3557",
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 3,
            "line-color": "#0f3557",
            opacity: 1,
          },
        },
      ],
      wheelSensitivity: 0.18,
      minZoom: 0.25,
      maxZoom: 2.4,
    });

    cy.on("tap", "node", (event) => {
      setSelectedId(event.target.id());
      setShowInteractions(true);
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [network.edges, visibleNodes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const layoutByMode = {
      cose: {
        name: "cose",
        animate: true,
        fit: true,
        padding: 56,
        idealEdgeLength: 120,
        nodeRepulsion: 14000,
        gravity: 0.24,
        numIter: 1200,
      },
      concentric: {
        name: "concentric",
        animate: true,
        fit: true,
        padding: 56,
        minNodeSpacing: 18,
        concentric: (node) => node.data("type") === "pathogen" ? 3 : Math.max(1, node.data("degree") || 1),
        levelWidth: () => 1,
      },
      circle: {
        name: "circle",
        animate: true,
        fit: true,
        padding: 56,
      },
      breadthfirst: {
        name: "breadthfirst",
        animate: true,
        fit: true,
        padding: 56,
        directed: false,
        spacingFactor: 1.15,
      },
      grid: {
        name: "grid",
        animate: true,
        fit: true,
        padding: 56,
        avoidOverlap: true,
      },
    };

    const layout = layoutByMode[layoutMode] || layoutByMode.cose;

    cy.layout(layout).run();
  }, [layoutMode, network]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().unselect();

    if (!selectedId) {
      return;
    }

    const selected = cy.getElementById(selectedId);
    if (!selected || selected.empty()) {
      return;
    }

    selected.select();
  }, [selectedId]);

  const exportImage = () => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const pngData = cy.png({ full: true, scale: 2, bg: "#ffffff" });
    const link = document.createElement("a");
    link.href = pngData;
    link.download = "DeepHPI-network.png";
    link.click();
  };

  const exportJson = () => {
    downloadBlob(
      "DeepHPI-network.json",
      "application/json;charset=utf-8",
      JSON.stringify({ nodes, edges, interactions }, null, 2),
    );
  };

  if (!nodes.length) {
    return (
      <div className="paper-panel atlas-ring rounded-[1.8rem] p-8 text-center">
        <p className="text-sm leading-7 text-ink/80">
          DeepHPI completed successfully, but there is no network to draw for the returned interaction set.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="paper-panel atlas-ring rounded-[1.8rem] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 px-5 py-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/58">Interaction atlas</p>
              <p className="mt-1 text-sm text-ink/78">
                Explore the interaction graph with pan, zoom, drag, and node selection.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-ink/12 bg-white px-4 py-2">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: HOST_COLOR }} />
                <span className="text-sm text-ink/84">Host</span>
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: PATHOGEN_COLOR }} />
                <span className="text-sm text-ink/84">Pathogen</span>
              </div>
              <span className="rounded-full border border-ink/12 bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/74">
                {network.edges.length} edges
              </span>
              {network.clipped ? (
                <span className="rounded-full border border-amber/18 bg-amber/8 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber">
                  top-degree view
                </span>
              ) : null}
              <button
                type="button"
                onClick={exportImage}
                className="rounded-full border border-cobalt/24 bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt transition hover:border-cobalt hover:bg-cobalt/6"
              >
                Export PNG
              </button>
              <button
                type="button"
                onClick={exportJson}
                className="rounded-full border border-cobalt/24 bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt transition hover:border-cobalt hover:bg-cobalt/6"
              >
                Export JSON
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-ink/12 px-5 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Layout</span>
            {[
              ["cose", "Cose"],
              ["concentric", "Concentric"],
              ["circle", "Circle"],
              ["breadthfirst", "Breadthfirst"],
              ["grid", "Grid"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLayoutMode(value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  layoutMode === value
                    ? "border-panel bg-panel text-white"
                    : "border-ink/14 bg-white text-ink/80 hover:border-cobalt/24"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white/72 p-3">
            <div ref={graphRef} className="h-[760px] w-full rounded-[1.4rem] border border-ink/12 bg-white" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="paper-panel atlas-ring rounded-[1.5rem] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Predicted interactions</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{network.edges.length}</p>
            </div>
            <div className="paper-panel atlas-ring rounded-[1.5rem] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Host proteins</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{network.hosts.length}</p>
            </div>
            <div className="paper-panel atlas-ring rounded-[1.5rem] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Pathogen proteins</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{network.pathogens.length}</p>
            </div>
          </div>

          <div className="paper-panel atlas-ring rounded-[1.8rem] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/58">Selected node</p>
            {selectedNode ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.3rem] border border-ink/12 bg-white/70 p-4">
                  <p className="text-xl font-semibold text-ink">{selectedNode.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-ink/12 bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">
                      {selectedNode.type}
                    </span>
                    <span className="rounded-full border border-ink/12 bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">
                      degree {selectedNode.degree}
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-ink/12 bg-white/70 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/48">SwissProt hit</p>
                  {selectedNode.hit && selectedNode.hit !== "no hit" ? (
                    <div className="mt-3 space-y-2">
                      <a
                        href={`https://www.uniprot.org/uniprot/${selectedNode.hitAccession || selectedNode.hit}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-cobalt"
                      >
                        {selectedNode.hit}
                      </a>
                      {selectedNode.description ? <p className="text-sm leading-6 text-ink/80">{selectedNode.description}</p> : null}
                      {selectedNode.organism ? <p className="text-sm text-ink/70">{selectedNode.organism}</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink/74">No SwissProt hit was found.</p>
                  )}
                </div>

                <div className="rounded-[1.3rem] border border-ink/12 bg-white/70 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/48">Connected proteins</p>
                  <div className="mt-3 space-y-2">
                    {connectedNodes.slice(0, 8).map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(node.id);
                          setShowInteractions(true);
                        }}
                        className="flex w-full items-center justify-between rounded-[1rem] border border-ink/12 bg-white px-3 py-3 text-left transition hover:border-cobalt/24"
                      >
                        <span className="text-sm font-semibold text-ink">{node.label}</span>
                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/48">
                          degree {node.degree}
                        </span>
                      </button>
                    ))}
                    {!connectedNodes.length ? (
                      <p className="text-sm text-ink/74">No connected proteins are available for this node.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-ink/80">
                Select a node from the graph to inspect its connectivity.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="paper-panel atlas-ring rounded-[1.8rem] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/58">Interaction list</p>
            <p className="mt-1 text-sm text-ink/78">
              {selectedNode ? `Interactions connected to ${selectedNode.label}.` : "Returned host-pathogen interactions in the current network."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInteractions((current) => !current)}
            className="rounded-full border border-cobalt/24 bg-white px-4 py-2 text-xs font-semibold text-cobalt transition hover:border-cobalt hover:bg-cobalt/6"
          >
            {showInteractions ? "Hide Interactions" : "Show Interactions"}
          </button>
        </div>

        {showInteractions ? (
          <div className="max-h-[280px] overflow-auto border-t border-ink/12">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-panel text-white">
                <tr>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host protein</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host hit</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Pathogen protein</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Pathogen hit</th>
                  <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredInteractions.map((interaction) => (
                  <tr key={interaction.id} className="border-b border-ink/12">
                    <td className="px-4 py-3 text-sm font-semibold text-ink">{interaction.hostProtein}</td>
                    <td className="px-4 py-3 text-sm text-ink/80">{interaction.hostHit || "no hit"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-ink">{interaction.pathogenProtein}</td>
                    <td className="px-4 py-3 text-sm text-ink/80">{interaction.pathogenHit || "no hit"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-cobalt/18 bg-cobalt/8 px-3 py-2 font-mono text-xs text-cobalt">
                        {Number(interaction.confidence || 0).toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!filteredInteractions.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-ink/74">
                      No interactions are available for the current selection.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
