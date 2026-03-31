export const BALANCE = {
  tickMs: 100,
  minRenderIntervalMs: 80,
  autoSaveMs: 30000,
  offlineEfficiency: 0.5,
  baseClickMatter: 1,
  elementConversionCost: 100,
  prestigeDivisor: 100,
  fireShardValue: 100,
  ascendBaseMatter: 500,
  ascendBaseFire: 5,
  ascendCostGrowth: 1.6,
  generatorCostGrowth: 1.15,
  generators: {
    furnace: {
      id: "furnace",
      name: "Furnace",
      resource: "matter",
      baseRate: 0.18,
      baseCost: 10,
      costResource: "matter"
    },
    condenser: {
      id: "condenser",
      name: "Condenser",
      resource: "matter",
      baseRate: 0.7,
      baseCost: 480,
      costResource: "matter"
    },
    prism: {
      id: "prism",
      name: "Element Prism",
      resource: "fire",
      baseRate: 0.05,
      baseCost: 30,
      costResource: "fire"
    }
  },
  upgradeOrder: [
    "kineticGloves",
    "runicGrip",
    "alloyIntake",
    "emberEcho",
    "thermalLens",
    "signalFocusing",
    "vacuumSeals",
    "mercuryRegulators",
    "cinderThreads",
    "fluxPistons",
    "stellarConveyor",
    "pulseCoil",
    "twinFlux",
    "emberCatalyst",
    "prismaticVeil",
    "isochronSprings",
    "phaseBaffles",
    "snapCircuitry",
    "riftLattice",
    "thermalLattice",
    "arcSpanners",
    "scholarVane",
    "obsidianCore",
    "shardSiphon",
    "glassFoundry",
    "catalystCoil",
    "refluxMatrix",
    "alchemyWeave",
    "fluxRelay"
  ],
  researchOrder: [
    "arcaneThermodynamics",
    "kineticAmplifier",
    "crystalLattice",
    "fieldResonance",
    "furnaceTuning",
    "ignitionSpiral",
    "condenserTuning",
    "metallurgicMemory",
    "ambientCharge",
    "yieldCatalysis",
    "continuumTuning",
    "prismLore",
    "atomicLattice",
    "conversionAnchors",
    "criticalStudies",
    "cryoCalibration",
    "shardOptics",
    "twinFlow",
    "criticalFocus",
    "harmonicForge",
    "refundTheory",
    "catalystBleed",
    "matrixDamping",
    "emberClicks",
    "transmuteCadence",
    "shardTheory",
    "shardFractal",
    "transcendentSchema"
  ],
  upgradeCostDefaults: {
    quadCap: 35,
    quadScale: 0.015,
    targetEnd: 1e31,
    unlockCostFactor: 1,
    autoBalance: true
  },
  researchCostDefaults: {
    quadCap: 2,
    quadScale: 0.05,
    targetEnd: 240,
    baseScalePerIndex: 0.25,
    baseScaleExponent: 1,
    autoBalance: true
  },
  upgradePower: 10,
  upgrades: {
    kineticGloves: {
      id: "kineticGloves",
      name: "Kinetic Gloves",
      description: "+0.24 Matter per click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 120,
      costCurve: { autoBalance: false }
    },
    alloyIntake: {
      id: "alloyIntake",
      name: "Alloy Intake",
      description: "+0.15% Matter production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 450
    },
    emberCatalyst: {
      id: "emberCatalyst",
      name: "Ember Catalyst",
      description: "+0.2% Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 25
    },
    thermalLens: {
      id: "thermalLens",
      name: "Thermal Lens",
      description: "+0.03 Fire per conversion",
      costResource: "matter",
      maxTier: 999,
      baseCost: 60
    },
    vacuumSeals: {
      id: "vacuumSeals",
      name: "Vacuum Seals",
      description: "+0.25% Matter production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1200
    },
    fluxPistons: {
      id: "fluxPistons",
      name: "Flux Pistons",
      description: "-0.2% generator cost growth",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2600
    },
    cinderThreads: {
      id: "cinderThreads",
      name: "Cinder Threads",
      description: "+0.05 Fire per conversion",
      costResource: "matter",
      maxTier: 999,
      baseCost: 85
    },
    pulseCoil: {
      id: "pulseCoil",
      name: "Pulse Coil",
      description: "+0.7 Matter per click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1800
    },
    thermalLattice: {
      id: "thermalLattice",
      name: "Thermal Lattice",
      description: "+0.3% Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 140
    },
    stellarConveyor: {
      id: "stellarConveyor",
      name: "Stellar Conveyor",
      description: "+0.5% offline efficiency",
      costResource: "matter",
      maxTier: 999,
      baseCost: 120
    },
    mercuryRegulators: {
      id: "mercuryRegulators",
      name: "Mercury Regulators",
      description: "-0.3% conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2400
    },
    obsidianCore: {
      id: "obsidianCore",
      name: "Obsidian Core",
      description: "+0.4% shard gain",
      costResource: "matter",
      maxTier: 999,
      baseCost: 200
    },
    arcSpanners: {
      id: "arcSpanners",
      name: "Arc Spanners",
      description: "-0.3% research cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 180
    },
    glassFoundry: {
      id: "glassFoundry",
      name: "Glass Foundry",
      description: "+0.1% all production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 4000
    },
    runicGrip: {
      id: "runicGrip",
      name: "Runic Grip",
      description: "+0.2% click power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 280
    },
    emberEcho: {
      id: "emberEcho",
      name: "Ember Echo",
      description: "+0.01 Fire on click",
      costResource: "matter",
      maxTier: 999,
      baseCost: 240
    },
    signalFocusing: {
      id: "signalFocusing",
      name: "Signal Focusing",
      description: "+0.3% Furnace output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 520
    },
    phaseBaffles: {
      id: "phaseBaffles",
      name: "Phase Baffles",
      description: "+0.3% Condenser output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 760
    },
    prismaticVeil: {
      id: "prismaticVeil",
      name: "Prismatic Veil",
      description: "+0.4% Prism output",
      costResource: "matter",
      maxTier: 999,
      baseCost: 980
    },
    catalystCoil: {
      id: "catalystCoil",
      name: "Catalyst Coil",
      description: "+0.15% conversion yield",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1600
    },
    isochronSprings: {
      id: "isochronSprings",
      name: "Isochron Springs",
      description: "-0.05 Matter conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1500
    },
    snapCircuitry: {
      id: "snapCircuitry",
      name: "Snap Circuitry",
      description: "+0.05% click crit chance",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1200
    },
    riftLattice: {
      id: "riftLattice",
      name: "Rift Lattice",
      description: "+0.2% click crit power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1500
    },
    refluxMatrix: {
      id: "refluxMatrix",
      name: "Reflux Matrix",
      description: "Refund 0.05% conversion cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 1800
    },
    twinFlux: {
      id: "twinFlux",
      name: "Twin Flux",
      description: "+0.1% Matter and Fire production",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2100
    },
    alchemyWeave: {
      id: "alchemyWeave",
      name: "Alchemy Weave",
      description: "+0.08% all production and +0.05% click power",
      costResource: "matter",
      maxTier: 999,
      baseCost: 3200
    },
    shardSiphon: {
      id: "shardSiphon",
      name: "Shard Siphon",
      description: "+0.2% shard gain",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2400
    },
    scholarVane: {
      id: "scholarVane",
      name: "Scholar Vane",
      description: "-0.1% research cost",
      costResource: "matter",
      maxTier: 999,
      baseCost: 2600
    },
    fluxRelay: {
      id: "fluxRelay",
      name: "Flux Relay",
      description: "-0.1% generator cost growth",
      costResource: "matter",
      maxTier: 999,
      baseCost: 3600
    }
  },
  research: {
    arcaneThermodynamics: {
      id: "arcaneThermodynamics",
      name: "Arcane Thermodynamics",
      description: "+3% Matter production",
      maxLevel: 5,
      baseCost: 12,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 1000 }
    },
    crystalLattice: {
      id: "crystalLattice",
      name: "Crystal Lattice",
      description: "+4% Fire production",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 25 }
    },
    shardTheory: {
      id: "shardTheory",
      name: "Shard Theory",
      description: "+2% shard gain",
      maxLevel: 6,
      baseCost: 35,
      costGrowth: 1.75,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    fieldResonance: {
      id: "fieldResonance",
      name: "Field Resonance",
      description: "+2% Matter production",
      maxLevel: 5,
      baseCost: 14,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2200 }
    },
    ignitionSpiral: {
      id: "ignitionSpiral",
      name: "Ignition Spiral",
      description: "+3% Fire production",
      maxLevel: 4,
      baseCost: 22,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 45 }
    },
    metallurgicMemory: {
      id: "metallurgicMemory",
      name: "Metallurgic Memory",
      description: "Conversion cost -2%",
      maxLevel: 4,
      baseCost: 18,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2500 }
    },
    shardOptics: {
      id: "shardOptics",
      name: "Shard Optics",
      description: "+2% shard gain",
      maxLevel: 5,
      baseCost: 30,
      costGrowth: 1.72,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    continuumTuning: {
      id: "continuumTuning",
      name: "Continuum Tuning",
      description: "+4% offline efficiency",
      maxLevel: 3,
      baseCost: 24,
      costGrowth: 1.68,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 55 }
    },
    atomicLattice: {
      id: "atomicLattice",
      name: "Atomic Lattice",
      description: "+2% all production",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3500 }
    },
    cryoCalibration: {
      id: "cryoCalibration",
      name: "Cryo Calibration",
      description: "-0.5% generator cost growth",
      maxLevel: 4,
      baseCost: 28,
      costGrowth: 1.72,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3800 }
    },
    ambientCharge: {
      id: "ambientCharge",
      name: "Ambient Charge",
      description: "+1.5 Matter per click",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2800 }
    },
    harmonicForge: {
      id: "harmonicForge",
      name: "Harmonic Forge",
      description: "+1.5% all production",
      maxLevel: 5,
      baseCost: 16,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 70 }
    },
    transcendentSchema: {
      id: "transcendentSchema",
      name: "Transcendent Schema",
      description: "+6% shard gain",
      maxLevel: 1,
      baseCost: 80,
      costGrowth: 1.9,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    },
    kineticAmplifier: {
      id: "kineticAmplifier",
      name: "Kinetic Amplifier",
      description: "+6% click power",
      maxLevel: 4,
      baseCost: 18,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 800 }
    },
    furnaceTuning: {
      id: "furnaceTuning",
      name: "Furnace Tuning",
      description: "+5% Furnace output",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.62,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 1400 }
    },
    condenserTuning: {
      id: "condenserTuning",
      name: "Condenser Tuning",
      description: "+5% Condenser output",
      maxLevel: 4,
      baseCost: 24,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2200 }
    },
    prismLore: {
      id: "prismLore",
      name: "Prism Lore",
      description: "+6% Prism output",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.66,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 70 }
    },
    yieldCatalysis: {
      id: "yieldCatalysis",
      name: "Yield Catalysis",
      description: "+4% conversion yield",
      maxLevel: 5,
      baseCost: 28,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2000 }
    },
    refundTheory: {
      id: "refundTheory",
      name: "Refund Theory",
      description: "Refund 2% conversion cost",
      maxLevel: 4,
      baseCost: 30,
      costGrowth: 1.66,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2600 }
    },
    conversionAnchors: {
      id: "conversionAnchors",
      name: "Conversion Anchors",
      description: "-3 Matter conversion cost",
      maxLevel: 4,
      baseCost: 26,
      costGrowth: 1.63,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2400 }
    },
    criticalStudies: {
      id: "criticalStudies",
      name: "Critical Studies",
      description: "+1% click crit chance",
      maxLevel: 4,
      baseCost: 32,
      costGrowth: 1.67,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3000 }
    },
    criticalFocus: {
      id: "criticalFocus",
      name: "Critical Focus",
      description: "+10% click crit power",
      maxLevel: 4,
      baseCost: 38,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3600 }
    },
    emberClicks: {
      id: "emberClicks",
      name: "Ember Clicks",
      description: "+0.2 Fire on click",
      maxLevel: 5,
      baseCost: 22,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 60 }
    },
    transmuteCadence: {
      id: "transmuteCadence",
      name: "Transmute Cadence",
      description: "+0.8 Matter per click",
      maxLevel: 5,
      baseCost: 34,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3200 }
    },
    twinFlow: {
      id: "twinFlow",
      name: "Twin Flow",
      description: "+2% Matter and Fire production",
      maxLevel: 4,
      baseCost: 36,
      costGrowth: 1.68,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 90 }
    },
    catalystBleed: {
      id: "catalystBleed",
      name: "Catalyst Bleed",
      description: "+0.2 Fire per conversion",
      maxLevel: 4,
      baseCost: 30,
      costGrowth: 1.64,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 2800 }
    },
    matrixDamping: {
      id: "matrixDamping",
      name: "Matrix Damping",
      description: "-2% generator cost growth",
      maxLevel: 4,
      baseCost: 40,
      costGrowth: 1.7,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 3800 }
    },
    shardFractal: {
      id: "shardFractal",
      name: "Shard Fractal",
      description: "+3% shard gain",
      maxLevel: 3,
      baseCost: 60,
      costGrowth: 1.75,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    }
  }
};
