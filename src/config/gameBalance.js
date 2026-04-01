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
      baseRate: 0.1,
      baseCost: 10,
      costResource: "matter"
    },
    condenser: {
      id: "condenser",
      name: "Condenser",
      resource: "matter",
      baseRate: 0.35,
      baseCost: 200,
      costResource: "matter"
    },
    prism: {
      id: "prism",
      name: "Element Prism",
      resource: "fire",
      baseRate: 0.05,
      baseCost: 25,
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
  expeditions: {
    unlockNodeId: "expeditionKeystone",
    offlineProgressMultiplier: 0.55,
    minSuccessChance: 0.15,
    maxSuccessChance: 0.95,
    ships: {
      raft: {
        id: "raft",
        name: "Raft",
        purchaseCost: { matter: 0, fire: 0, shards: 0 },
        unlock: { type: "ascensionNode", value: "expeditionKeystone" },
        visual: {
          theme: "raft",
          mastCount: 1,
          palette: {
            hullStart: "#9a6a36",
            hullEnd: "#70421e",
            sailTop: "#f4ead2",
            sailBottom: "#d8c6a0",
            waterTop: "rgba(100, 140, 160, 0.16)",
            waterBottom: "rgba(40, 76, 92, 0.24)"
          },
          zones: {
            hull: { left: 22, top: 70 },
            sail: { left: 42, top: 26 },
            anchor: { left: 72, top: 74 },
            net: { left: 60, top: 52 }
          }
        },
        baseStats: {
          speedMultiplier: 1,
          riskMitigation: 0,
          yieldMultiplier: 1,
          penaltyDampening: 0,
          rareDropWeight: 1
        }
      },
      sloop: {
        id: "sloop",
        name: "Sloop",
        purchaseCost: { matter: 9000, fire: 180, shards: 8 },
        unlock: { type: "ascensionNode", value: "cartographerSpindle" },
        requiredBlueprint: "ship:sloop:keel-plan",
        visual: {
          theme: "sloop",
          mastCount: 2,
          palette: {
            hullStart: "#8f6736",
            hullEnd: "#60391d",
            sailTop: "#f6f0df",
            sailBottom: "#d6c7a9",
            waterTop: "rgba(86, 128, 155, 0.16)",
            waterBottom: "rgba(34, 70, 92, 0.26)"
          },
          zones: {
            hull: { left: 24, top: 68 },
            sail: { left: 48, top: 22 },
            anchor: { left: 78, top: 72 },
            net: { left: 62, top: 44 }
          }
        },
        baseStats: {
          speedMultiplier: 1.08,
          riskMitigation: 0.02,
          yieldMultiplier: 1.03,
          penaltyDampening: 0.06,
          rareDropWeight: 1.05
        }
      },
      brig: {
        id: "brig",
        name: "Brig",
        purchaseCost: { matter: 28000, fire: 520, shards: 22 },
        unlock: { type: "ascensionNode", value: "hazardSeals" },
        requiredBlueprint: "ship:brig:frame-draft",
        visual: {
          theme: "brig",
          mastCount: 2,
          palette: {
            hullStart: "#7f5532",
            hullEnd: "#4d2c1b",
            sailTop: "#e9dfca",
            sailBottom: "#bfa983",
            waterTop: "rgba(76, 118, 145, 0.18)",
            waterBottom: "rgba(30, 62, 84, 0.28)"
          },
          zones: {
            hull: { left: 20, top: 70 },
            sail: { left: 46, top: 20 },
            anchor: { left: 80, top: 74 },
            net: { left: 66, top: 46 }
          }
        },
        baseStats: {
          speedMultiplier: 0.98,
          riskMitigation: 0.06,
          yieldMultiplier: 1.1,
          penaltyDampening: 0.14,
          rareDropWeight: 1.12
        }
      },
      galleon: {
        id: "galleon",
        name: "Galleon",
        purchaseCost: { matter: 75000, fire: 1400, shards: 55 },
        unlock: { type: "ascensionNodeCount", value: 24 },
        requiredBlueprint: "ship:galleon:royal-charter",
        visual: {
          theme: "galleon",
          mastCount: 3,
          palette: {
            hullStart: "#6f4c2d",
            hullEnd: "#3a2416",
            sailTop: "#ece0c2",
            sailBottom: "#b89d72",
            waterTop: "rgba(66, 110, 136, 0.2)",
            waterBottom: "rgba(24, 52, 74, 0.3)"
          },
          zones: {
            hull: { left: 18, top: 72 },
            sail: { left: 44, top: 18 },
            anchor: { left: 82, top: 76 },
            net: { left: 68, top: 44 }
          }
        },
        baseStats: {
          speedMultiplier: 0.9,
          riskMitigation: 0.12,
          yieldMultiplier: 1.22,
          penaltyDampening: 0.22,
          rareDropWeight: 1.18
        }
      }
    },
    shipFacilities: {
      hull: {
        label: "Hull",
        maxLevel: 6,
        levelCosts: [
          { matter: 1200, fire: 20, shards: 1 },
          { matter: 3200, fire: 55, shards: 2 },
          { matter: 8400, fire: 130, shards: 4 },
          { matter: 21000, fire: 300, shards: 8 },
          { matter: 47000, fire: 640, shards: 15 },
          { matter: 92000, fire: 1300, shards: 28 }
        ],
        effectsPerLevel: {
          penaltyDampening: 0.04,
          riskMitigation: 0.01
        }
      },
      sail: {
        label: "Sail",
        maxLevel: 6,
        levelCosts: [
          { matter: 900, fire: 30, shards: 1 },
          { matter: 2400, fire: 85, shards: 2 },
          { matter: 6200, fire: 210, shards: 4 },
          { matter: 15200, fire: 470, shards: 8 },
          { matter: 36000, fire: 1020, shards: 15 },
          { matter: 76000, fire: 2100, shards: 28 }
        ],
        effectsPerLevel: {
          speedMultiplier: 0.045
        }
      },
      anchor: {
        label: "Anchor",
        maxLevel: 5,
        levelCosts: [
          { matter: 1000, fire: 22, shards: 1 },
          { matter: 2800, fire: 72, shards: 3 },
          { matter: 7200, fire: 180, shards: 6 },
          { matter: 18000, fire: 420, shards: 11 },
          { matter: 43000, fire: 930, shards: 20 }
        ],
        effectsPerLevel: {
          riskMitigation: 0.025
        }
      },
      net: {
        label: "Net",
        maxLevel: 5,
        levelCosts: [
          { matter: 1100, fire: 24, shards: 1 },
          { matter: 3000, fire: 78, shards: 3 },
          { matter: 7900, fire: 195, shards: 6 },
          { matter: 19600, fire: 460, shards: 12 },
          { matter: 46500, fire: 1000, shards: 22 }
        ],
        effectsPerLevel: {
          rareDropWeight: 0.09,
          yieldMultiplier: 0.015
        }
      }
    },
    duplicateBlueprintPolicy: {
      mode: "intel",
      intelPerDuplicate: 4,
      shardsPerDuplicate: 0
    },
    rareBlueprintDrops: {
      "initiate-run": [
        {
          id: "part:raft:sail:patched-cloth",
          name: "Patched Cloth Sail",
          rarity: "semi-rare",
          chance: 0.11,
          fromPool: ["standard", "stability"],
          shipId: "raft",
          slot: "sail",
          effects: { speedMultiplier: 0.05, yieldMultiplier: 0.015 }
        },
        {
          id: "ship:sloop:keel-plan",
          name: "Sloop Keel Plan",
          rarity: "rare",
          chance: 0.9,
          fromPool: ["volatile", "standard"],
          blueprintForShip: "sloop"
        }
      ],
      "architect-run": [
        {
          id: "part:sloop:anchor:forged-ring",
          name: "Forged Anchor Ring",
          rarity: "rare",
          chance: 0.05,
          fromPool: ["cartographer", "standard"],
          shipId: "sloop",
          slot: "anchor",
          effects: { riskMitigation: 0.04, penaltyDampening: 0.05 }
        },
        {
          id: "ship:brig:frame-draft",
          name: "Brig Frame Draft",
          rarity: "rare",
          chance: 0.025,
          fromPool: ["volatile", "cartographer"],
          blueprintForShip: "brig"
        }
      ],
      "sovereign-run": [
        {
          id: "part:brig:hull:abyssal-plating",
          name: "Abyssal Hull Plating",
          rarity: "epic",
          chance: 0.04,
          fromPool: ["sealed", "salvage"],
          shipId: "brig",
          slot: "hull",
          effects: { penaltyDampening: 0.12, riskMitigation: 0.03 }
        },
        {
          id: "ship:galleon:royal-charter",
          name: "Royal Charter",
          rarity: "epic",
          chance: 0.02,
          fromPool: ["sealed", "volatile"],
          blueprintForShip: "galleon"
        }
      ]
    },
    defaultRouteChoices: [
      {
        id: "shielded",
        name: "Shielded Conduits",
        description: "Lower risk route with lighter salvage output.",
        riskDelta: -0.08,
        yieldDelta: -0.1,
        speedMultiplier: 0.92,
        intelFlat: 1,
        encounterPool: "stability"
      },
      {
        id: "balanced",
        name: "Balanced Route",
        description: "Stable pacing and neutral outcomes.",
        riskDelta: 0,
        yieldDelta: 0,
        speedMultiplier: 1,
        intelFlat: 0,
        encounterPool: "standard"
      },
      {
        id: "overclocked",
        name: "Overclocked Lanes",
        description: "Higher reward potential with volatile hazards.",
        riskDelta: 0.1,
        yieldDelta: 0.16,
        speedMultiplier: 1.1,
        intelFlat: 0,
        encounterPool: "volatile"
      }
    ],
    bands: [
      {
        id: "initiate-run",
        name: "Initiate Freightline",
        description: "A short salvage run through abandoned relay tunnels.",
        durationSeconds: 60,
        stageCount: 2,
        risk: 0.18,
        cost: { matter: 1200, fire: 20, shards: 0 },
        unlock: { type: "ascensionNodeCount", value: 2 },
        rewards: { matter: 2400, fire: 28, shards: 1, intel: 2 },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Lower pressure corridors with safer extraction valves.",
            riskDelta: -0.08,
            yieldDelta: -0.1,
            speedMultiplier: 0.92,
            intelFlat: 1,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Moderate pressure corridors with standard salvage pacing.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Aggressive acceleration through unstable tunnels.",
            riskDelta: 0.1,
            yieldDelta: 0.16,
            speedMultiplier: 1.1,
            intelFlat: 0,
            encounterPool: "volatile"
          }
        ],
        encounters: [
          {
            id: "leak",
            name: "Boiler Leak",
            description: "Pressurized steam floods the tunnel frame.",
            difficulty: 0.34,
            success: { yieldDelta: 0.06, intelFlat: 1 },
            fail: { riskDelta: 0.05, yieldDelta: -0.05, matterPenalty: 160 }
          },
          {
            id: "relay-cache",
            name: "Relay Cache",
            description: "An old crate cluster can be stripped for parts.",
            difficulty: 0.28,
            success: { yieldDelta: 0.08, fireFlat: 6 },
            fail: { riskDelta: 0.03, firePenalty: 4 }
          }
        ],
        encounterPools: {
          stability: ["leak"],
          standard: ["leak", "relay-cache"],
          volatile: ["relay-cache"]
        }
      },
      {
        id: "architect-run",
        name: "Architect Pressure Route",
        description: "High-pressure vaults with unstable extraction channels.",
        durationSeconds: 95,
        stageCount: 3,
        risk: 0.28,
        cost: { matter: 5200, fire: 60, shards: 1 },
        unlock: { type: "ascensionNodeCount", value: 7 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle"],
        rewards: { matter: 9600, fire: 120, shards: 3, intel: 5 },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Prioritize pressure-safe valves over throughput.",
            riskDelta: -0.1,
            yieldDelta: -0.12,
            speedMultiplier: 0.9,
            intelFlat: 1,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Standard pressure handling with mixed salvage output.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Drive extraction turbines beyond safe envelopes.",
            riskDelta: 0.12,
            yieldDelta: 0.18,
            speedMultiplier: 1.12,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "cartographer-cut",
            name: "Cartographer Cutthrough",
            description: "Exclusive branch: rune-mapped shortcuts across collapsed vaults.",
            requiredNodes: ["cartographerSpindle"],
            riskDelta: -0.04,
            yieldDelta: 0.08,
            speedMultiplier: 1.16,
            intelFlat: 2,
            encounterPool: "cartographer"
          }
        ],
        encounters: [
          {
            id: "fracture",
            name: "Pressure Fracture",
            description: "A wall fracture threatens the haul path.",
            difficulty: 0.42,
            success: { yieldDelta: 0.1, shardsFlat: 1 },
            fail: { riskDelta: 0.08, yieldDelta: -0.08, firePenalty: 18 }
          },
          {
            id: "warden",
            name: "Warden Sweep",
            description: "Automata patrols force a route scramble.",
            difficulty: 0.48,
            success: { yieldDelta: 0.12, intelFlat: 2 },
            fail: { riskDelta: 0.07, matterPenalty: 520 }
          },
          {
            id: "survey-beacon",
            name: "Survey Beacon Archive",
            description: "A dormant survey beacon can reveal high-value vault lanes.",
            difficulty: 0.44,
            success: { yieldDelta: 0.1, intelFlat: 3 },
            fail: { riskDelta: 0.05, yieldDelta: -0.04 }
          }
        ],
        encounterPools: {
          stability: ["fracture"],
          standard: ["fracture", "warden"],
          volatile: ["warden"],
          cartographer: ["survey-beacon", "warden"]
        }
      },
      {
        id: "sovereign-run",
        name: "Sovereign Anomaly Rift",
        description: "A sovereign-tier descent into volatile arcane machinery.",
        durationSeconds: 140,
        stageCount: 4,
        risk: 0.38,
        cost: { matter: 16000, fire: 210, shards: 4 },
        unlock: { type: "ascensionNodeCount", value: 13 },
        requiredNodes: ["expeditionKeystone", "cartographerSpindle", "hazardSeals"],
        rewards: { matter: 36000, fire: 460, shards: 8, intel: 11 },
        routeChoices: [
          {
            id: "shielded",
            name: "Shielded Conduits",
            description: "Sacrifice throughput for calibrated containment.",
            riskDelta: -0.12,
            yieldDelta: -0.14,
            speedMultiplier: 0.88,
            intelFlat: 2,
            encounterPool: "stability"
          },
          {
            id: "balanced",
            name: "Balanced Route",
            description: "Neutral route through layered anomaly baffles.",
            riskDelta: 0,
            yieldDelta: 0,
            speedMultiplier: 1,
            intelFlat: 0,
            encounterPool: "standard"
          },
          {
            id: "overclocked",
            name: "Overclocked Lanes",
            description: "Maximum extraction through unstable rift seams.",
            riskDelta: 0.14,
            yieldDelta: 0.22,
            speedMultiplier: 1.14,
            intelFlat: 0,
            encounterPool: "volatile"
          },
          {
            id: "sealed-vault",
            name: "Sealed Vault Plunge",
            description: "Exclusive branch: hazard-proof descent into sovereign vault cores.",
            requiredNodes: ["hazardSeals"],
            riskDelta: -0.03,
            yieldDelta: 0.12,
            speedMultiplier: 0.98,
            intelFlat: 3,
            encounterPool: "sealed"
          },
          {
            id: "salvage-gambit",
            name: "Salvage Gambit",
            description: "Exclusive branch: shard siphon sweep through fracture wakes.",
            requiredNodes: ["salvageVats"],
            riskDelta: 0.08,
            yieldDelta: 0.28,
            speedMultiplier: 1.08,
            intelFlat: 1,
            encounterPool: "salvage"
          }
        ],
        encounters: [
          {
            id: "rift-storm",
            name: "Rift Storm",
            description: "Chaotic anomaly winds batter containment rigging.",
            difficulty: 0.55,
            success: { yieldDelta: 0.16, shardsFlat: 2, intelFlat: 2 },
            fail: { riskDelta: 0.11, yieldDelta: -0.12, matterPenalty: 1800, firePenalty: 50 }
          },
          {
            id: "void-gate",
            name: "Void Gate Calibration",
            description: "A broken gate can be stabilized for huge salvage.",
            difficulty: 0.5,
            success: { yieldDelta: 0.2, fireFlat: 40 },
            fail: { riskDelta: 0.1, shardsPenalty: 1, firePenalty: 30 }
          },
          {
            id: "vault-harmonics",
            name: "Vault Harmonics",
            description: "Sovereign vault harmonics can be tuned for amplified extraction.",
            difficulty: 0.53,
            success: { yieldDelta: 0.18, shardsFlat: 2, intelFlat: 2 },
            fail: { riskDelta: 0.08, matterPenalty: 1300 }
          },
          {
            id: "salvage-surge",
            name: "Salvage Surge",
            description: "A collapsing wake reveals concentrated shard debris.",
            difficulty: 0.58,
            success: { yieldDelta: 0.24, shardsFlat: 3 },
            fail: { riskDelta: 0.12, shardsPenalty: 2 }
          }
        ],
        encounterPools: {
          stability: ["rift-storm"],
          standard: ["rift-storm", "void-gate"],
          volatile: ["void-gate", "rift-storm"],
          sealed: ["vault-harmonics", "rift-storm"],
          salvage: ["salvage-surge", "void-gate"]
        }
      }
    ]
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
