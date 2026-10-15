"use strict";

/**
 * Neutral Network ingestion adapter for the user-supplied "Personal Power" diagram.
 *
 * This adapter records what is visibly represented in the image. It does not
 * infer psychological diagnoses, validate the diagram's claims, or convert
 * practices into recommendations. Every node retains provenance and uncertainty.
 */

const SOURCE_ID = "user-image:personal-power:2026-10-15";

const GROUPS = [
  {
    id: "identity",
    label: "Identity and agency",
    items: [
      ["questioning", "Questioning", "high"],
      ["preserving", "Preserving", "high"],
      ["independence", "Independence", "high"],
      ["core-identity", "Core Personal Identity", "high"],
      ["work-will-vibration", "Work, Will and Vibration", "high"],
      ["personal-accountability", "Personal Accountability", "high"],
      ["personal-work-inner-beliefs", "Personal Work & Inner Beliefs", "high"],
      ["attention", "Attention", "high"],
      ["assumptions", "Assumptions", "high"]
    ]
  },
  {
    id: "boundaries",
    label: "Boundaries and relationships",
    items: [
      ["flying-monkeys", "The Corner – Flying Monkeys", "medium"],
      ["strict-boundaries", "Being strict with your Boundaries", "high"],
      ["psychic-protection", "Psychic Protection", "high"],
      ["prayer-mantras", "Prayer, Mantras", "medium"],
      ["accountability", "Accountability", "high"],
      ["authenticity-boundaries", "Authenticity & Boundaries", "high"],
      ["trustworthy-circle", "The Circle – Trustworthy", "high"],
      ["family-friends", "Family and Friends", "high"],
      ["fears-obstacles-shame", "Fears, Obstacles and Shame – Be Happy Now", "medium"],
      ["societal-ancestral-trauma-blocks", "Societal & Ancestral – Trauma Blocks", "medium"],
      ["beliefs-cbt-nlp", "Beliefs – CBT + NLP = Beliefs and Behaviors", "medium"]
    ]
  },
  {
    id: "reflection",
    label: "Reflection and creative practice",
    items: [
      ["deep-healing", "Deep Healing", "medium"],
      ["emotional-flares", "Emotional Flares", "low"],
      ["negative-energy", "Negative Energy", "high"],
      ["energy-transmutation", "Energy Transmutation", "high"],
      ["life-lessons", "Life Lessons", "low"],
      ["morning-momentum", "Morning Momentum", "high"],
      ["morning-rejuvenation", "Morning Rejuvenation", "high"],
      ["mindfulness-thinking-slow", "Mindfulness and Thinking Slow", "high"],
      ["adaptation-journal", "ADAPTATION – Journal", "high"],
      ["creativity-ng-obv", "Creativity – NG + OBV", "low"],
      ["neurographics", "Neurographics", "high"],
      ["journaling-assessments", "Journaling Assessments", "medium"],
      ["mindfulness", "Mindfulness", "high"],
      ["reprogramming-system", "REPROGRAMMING SYSTEM", "high"],
      ["analog-creative-works", "Analog and Creative Works", "high"]
    ]
  },
  {
    id: "body-energy",
    label: "Body, energy and work",
    items: [
      ["calf-full-body-exercise", "Calf Full Body Exercise", "medium"],
      ["cardio-swim-breath", "Cardio/Swim/Breath", "high"],
      ["hiit-warmup", "HIIT Warmup", "high"],
      ["morning-mobility", "Morning Mobility", "high"],
      ["healing-energy-mastery-xv", "Healing & Energy Mastery (XV)", "high"],
      ["deep-work-3h", "3H Deep Work – AMP & OB", "medium"],
      ["life-force-energy-wheel", "Life Force / Energy Wheel", "medium"]
    ]
  },
  {
    id: "principles",
    label: "Stated principles",
    items: [
      ["love-truth-wisdom", "Love Truth Wisdom", "high"],
      ["symbol-xxii-phi", "Symbol: XXII and phi-like glyph", "medium"]
    ]
  }
];

function buildPersonalPowerGraph(options = {}) {
  const sourceId = typeof options.sourceId === "string" && options.sourceId.trim()
    ? options.sourceId.trim()
    : SOURCE_ID;
  const capturedAt = options.capturedAt || null;

  const nodes = [];
  const edges = [];

  for (const group of GROUPS) {
    const groupId = "personal-power:group:" + group.id;
    nodes.push({
      id: groupId,
      type: "concept_group",
      label: group.label,
      epistemicStatus: "transcribed_from_image",
      verified: false,
      provenance: { sourceId, capturedAt, method: "manual_visual_transcription" }
    });

    for (const [id, label, confidence] of group.items) {
      const nodeId = "personal-power:item:" + id;
      nodes.push({
        id: nodeId,
        type: "diagram_label",
        label,
        confidence,
        epistemicStatus: "transcribed_from_image",
        verified: false,
        provenance: { sourceId, capturedAt, method: "manual_visual_transcription" }
      });
      edges.push({
        id: "personal-power:edge:group-" + id,
        from: groupId,
        to: nodeId,
        relation: "visually_grouped_with",
        epistemicStatus: "observed_layout_relation",
        verified: false,
        provenance: { sourceId, capturedAt }
      });
    }
  }

  return {
    schema: "mindcloud.neutral-network.graph.v1",
    graphId: "personal-power",
    title: "Personal Power",
    status: "ingestion_preview",
    source: {
      id: sourceId,
      kind: "user_supplied_image",
      title: "Personal Power diagram",
      capturedAt,
      limitations: [
        "Photograph of a screen; some text is blurred or ambiguous.",
        "Transcription represents visible labels, not proof that a claim is true.",
        "No psychological, medical, causal or efficacy claims are inferred."
      ]
    },
    epistemicRules: {
      claimIsNotEvidence: true,
      evidenceIsNotValidation: true,
      preserveUncertainty: true,
      inferCausality: false,
      promoteWithoutValidation: false
    },
    nodes,
    edges
  };
}

module.exports = { buildPersonalPowerGraph, SOURCE_ID };
