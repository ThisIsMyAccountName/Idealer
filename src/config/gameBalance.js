export const BALANCE = {
  tickMs: 100,
  minRenderIntervalMs: 80,
  autoSaveMs: 30000,
  offlineEfficiency: 0.5,
  baseClickMatter: 1,
  elementConversionCost: 100,
  prestigeDivisor: 100,
  generatorCostGrowth: 1.15,
  generators: {
    furnace: {
      id: "furnace",
      name: "Furnace",
      resource: "matter",
      baseRate: 0.6,
      baseCost: 10,
      costResource: "matter"
    },
    condenser: {
      id: "condenser",
      name: "Condenser",
      resource: "matter",
      baseRate: 3,
      baseCost: 250,
      costResource: "matter"
    },
    prism: {
      id: "prism",
      name: "Element Prism",
      resource: "fire",
      baseRate: 0.08,
      baseCost: 20,
      costResource: "fire"
    }
  },
  upgrades: {
    kineticGloves: {
      id: "kineticGloves",
      name: "Kinetic Gloves",
      description: "+1 Matter per click",
      costResource: "matter",
      cost: 120,
      unlock: { type: "matterSeen", value: 100 }
    },
    alloyIntake: {
      id: "alloyIntake",
      name: "Alloy Intake",
      description: "+20% Matter production",
      costResource: "matter",
      cost: 450,
      unlock: { type: "matterSeen", value: 450 }
    },
    emberCatalyst: {
      id: "emberCatalyst",
      name: "Ember Catalyst",
      description: "+25% Fire production",
      costResource: "fire",
      cost: 25,
      unlock: { type: "fireSeen", value: 15 }
    },
    thermalLens: {
      id: "thermalLens",
      name: "Thermal Lens",
      description: "Conversions produce +1 Fire",
      costResource: "fire",
      cost: 60,
      unlock: { type: "matterSeen", value: 2000 }
    }
  },
  research: {
    arcaneThermodynamics: {
      id: "arcaneThermodynamics",
      name: "Arcane Thermodynamics",
      description: "+10% Matter production per level",
      maxLevel: 5,
      baseCost: 12,
      costGrowth: 1.6,
      costResource: "fire",
      unlock: { type: "matterSeen", value: 1000 }
    },
    crystalLattice: {
      id: "crystalLattice",
      name: "Crystal Lattice",
      description: "+15% Fire production per level",
      maxLevel: 4,
      baseCost: 20,
      costGrowth: 1.65,
      costResource: "fire",
      unlock: { type: "fireSeen", value: 25 }
    },
    shardTheory: {
      id: "shardTheory",
      name: "Shard Theory",
      description: "+5% prestige shard gain per level",
      maxLevel: 6,
      baseCost: 35,
      costGrowth: 1.75,
      costResource: "fire",
      unlock: { type: "ascensions", value: 1 }
    }
  }
};
