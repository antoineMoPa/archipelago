import { Color3 } from "@babylonjs/core";

export const MAP_THEME = {
  deepSea: Color3.FromHexString("#0b2233"),
  openSea: Color3.FromHexString("#154a63"),
  shallowSea: Color3.FromHexString("#3f8fa0"),
  surf: Color3.FromHexString("#bfe3e0"),
  beach: Color3.FromHexString("#d9cfa3"),
  land: Color3.FromHexString("#6f7a4a"),
  landHighlight: Color3.FromHexString("#8a8f5c"),
  cityGround: Color3.FromHexString("#6c6e6b"),
  street: Color3.FromHexString("#d5d5cf"),
  roof: ["#b9bab5", "#a6a8a4", "#c9c7bf", "#9a9c98", "#d2d0c8"].map((hex) => Color3.FromHexString(hex)),
  roadDeck: Color3.FromHexString("#cfd0c9"),
  horizon: Color3.FromHexString("#0b2233"),
  labelFont: "Barlow Condensed",
  labelText: "#ffffff",
  labelOutline: "#0d1116",
};
