function createMonteCarloTreeResearch(config = {}) {
  const exploration = Number(config.exploration ?? 1.414);
  const defaultRollouts = Number.isInteger(config.rollouts) ? Math.max(1, config.rollouts) : 64;

  function search({ root, expand, simulate, rollouts = defaultRollouts }) {
    if (!root) throw new Error("root is required");
    const rootNode = { state: root, visits: 0, value: 0, children: [] };

    function uct(node, parentVisits) {
      if (!node.visits) return Infinity;
      return node.value / node.visits + exploration * Math.sqrt(Math.log(Math.max(1, parentVisits)) / node.visits);
    }

    for (let i = 0; i < rollouts; i++) {
      let node = rootNode;
      const path = [node];

      while (node.children.length) {
        node = node.children.reduce((best, child) =>
          uct(child, node.visits) > uct(best, node.visits) ? child : best
        );
        path.push(node);
      }

      const children = expand ? (expand(node.state) || []) : [];
      if (children.length) {
        node.children = children.map(state => ({ state, visits: 0, value: 0, children: [] }));
        node = node.children[0];
        path.push(node);
      }

      const reward = Number(simulate ? simulate(node.state) : 0);
      for (const visited of path) {
        visited.visits += 1;
        visited.value += reward;
      }
    }

    const best = rootNode.children.reduce((a,b) =>
      !a || b.visits > a.visits ? b : a, null
    );

    return {
      algorithm: "Monte Carlo Tree Research",
      rollouts,
      exploration,
      winner: best ? best.state : root,
      root: rootNode
    };
  }

  return { search };
}
module.exports = { createMonteCarloTreeResearch };
