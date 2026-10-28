"use strict";

const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 1000;

function invalid(code) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function normalizeGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw invalid("recursive_trace_graph_invalid");
  }
  const nodes = new Map();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== "string" || !node.id || nodes.has(node.id)) {
      throw invalid("recursive_trace_node_invalid");
    }
    nodes.set(node.id, node);
  }
  const edges = [];
  for (const edge of graph.edges) {
    if (!edge || typeof edge.from !== "string" || typeof edge.to !== "string" ||
        typeof edge.relation !== "string" || !nodes.has(edge.from) || !nodes.has(edge.to)) {
      throw invalid("recursive_trace_edge_invalid");
    }
    edges.push(edge);
  }
  return {nodes, edges};
}

/**
 * Trace a node's ancestry, descendants, or both through an EvidenceGraph snapshot.
 * Traversal is bounded and cycle-safe. It reports evidence references, but never
 * upgrades a claim to verified merely because a reference exists.
 */
function recursiveTrace(graph, input = {}) {
  const {nodes, edges} = normalizeGraph(graph);
  const rootId = typeof input.rootId === "string" ? input.rootId.trim() : "";
  if (!rootId || !nodes.has(rootId)) throw invalid("recursive_trace_root_not_found");
  const direction = input.direction || "both";
  if (!["backward", "forward", "both"].includes(direction)) {
    throw invalid("recursive_trace_direction_invalid");
  }
  const maxDepth = input.maxDepth === undefined ? DEFAULT_MAX_DEPTH : input.maxDepth;
  const maxNodes = input.maxNodes === undefined ? DEFAULT_MAX_NODES : input.maxNodes;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 256) {
    throw invalid("recursive_trace_max_depth_invalid");
  }
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 10000) {
    throw invalid("recursive_trace_max_nodes_invalid");
  }

  const adjacency = new Map();
  const reverse = new Map();
  for (const id of nodes.keys()) { adjacency.set(id, []); reverse.set(id, []); }
  for (const edge of edges) {
    adjacency.get(edge.from).push(edge);
    reverse.get(edge.to).push(edge);
  }
  for (const list of [...adjacency.values(), ...reverse.values()]) {
    list.sort((a,b) => String(a.id || "").localeCompare(String(b.id || "")) ||
      a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  }

  const included = new Map([[rootId, 0]]);
  const traversedEdges = new Map();
  const queue = [{id:rootId, depth:0, path:[rootId]}];
  const cycles = [];
  const truncated = {depth:false, nodes:false};
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) {
      const next = (direction === "backward" ? reverse.get(current.id) :
        direction === "forward" ? adjacency.get(current.id) :
        [...reverse.get(current.id), ...adjacency.get(current.id)]);
      if (next.length) truncated.depth = true;
      continue;
    }
    const nextEdges = [];
    if (direction === "backward" || direction === "both") {
      for (const edge of reverse.get(current.id)) nextEdges.push({edge, nextId:edge.from});
    }
    if (direction === "forward" || direction === "both") {
      for (const edge of adjacency.get(current.id)) nextEdges.push({edge, nextId:edge.to});
    }
    nextEdges.sort((a,b) => String(a.edge.id || "").localeCompare(String(b.edge.id || "")) ||
      a.nextId.localeCompare(b.nextId));
    for (const item of nextEdges) {
      traversedEdges.set(item.edge.id || [item.edge.from,item.edge.to,item.edge.relation].join("|"), item.edge);
      if (current.path.includes(item.nextId)) {
        cycles.push({from:current.id,to:item.nextId,edgeId:item.edge.id || null});
        continue;
      }
      if (included.has(item.nextId)) continue;
      if (included.size >= maxNodes) { truncated.nodes = true; queue.length = 0; break; }
      included.set(item.nextId, current.depth + 1);
      queue.push({id:item.nextId,depth:current.depth+1,path:[...current.path,item.nextId]});
    }
  }

  const traceNodes = [...included.entries()].map(([id, depth]) => {
    const node = nodes.get(id);
    const content = node.content && typeof node.content === "object" ? node.content : {};
    const evidenceRefs = [];
    if (typeof node.sourceRef === "string" && node.sourceRef.trim()) evidenceRefs.push(node.sourceRef);
    for (const ref of Array.isArray(content.evidenceRefs) ? content.evidenceRefs : []) {
      if (typeof ref === "string" && ref.trim()) evidenceRefs.push(ref.trim());
    }
    return {
      id, type:node.type || "unknown", label:node.label || id, depth,
      contentHash:node.contentHash || null,
      evidenceRefs:[...new Set(evidenceRefs)].sort(),
      declaredStatus:typeof content.status === "string" ? content.status : "unknown"
    };
  }).sort((a,b) => a.depth-b.depth || a.id.localeCompare(b.id));

  const traceEdges = [...traversedEdges.values()].map(edge => ({
    id:edge.id || null, from:edge.from, to:edge.to, relation:edge.relation
  })).sort((a,b) => String(a.id || "").localeCompare(String(b.id || "")));
  return {
    type:"mindcore_recursive_trace",
    schemaVersion:1,
    rootId,
    direction,
    status:truncated.nodes || truncated.depth ? "partial" : "complete",
    bounds:{maxDepth,maxNodes,visitedNodes:traceNodes.length,visitedEdges:traceEdges.length},
    truncation:truncated,
    cycleCount:cycles.length,
    cycles,
    nodes:traceNodes,
    edges:traceEdges,
    evidence:{references:[...new Set(traceNodes.flatMap(node => node.evidenceRefs))].sort(),
      independentlyValidated:false,
      note:"Evidence references are provenance pointers; trace traversal does not validate the referenced material."}
  };
}

module.exports = { recursiveTrace };
