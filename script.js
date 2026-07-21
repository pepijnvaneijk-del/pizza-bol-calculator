const STORAGE_KEY = "pizza-bol-calculator";

const DEFAULTS = {
  balls: 4,
  weight: 250,
  hydration: 62,
  salt: 2.5,
  yeast: 0.5,
};

const inputs = {
  balls: document.getElementById("balls"),
  weight: document.getElementById("weight"),
  hydration: document.getElementById("hydration"),
  salt: document.getElementById("salt"),
  yeast: document.getElementById("yeast"),
};

const output = {
  flour: document.getElementById("flour-value"),
  water: document.getElementById("water-value"),
  salt: document.getElementById("salt-value"),
  yeast: document.getElementById("yeast-value"),
};

const flourInput = document.getElementById("flour-input");
const fromFlourResult = document.getElementById("from-flour-result");
const fromFlourOutput = {
  water: document.getElementById("from-flour-water"),
  salt: document.getElementById("from-flour-salt"),
  yeast: document.getElementById("from-flour-yeast"),
  total: document.getElementById("from-flour-total"),
  balls: document.getElementById("from-flour-balls"),
};

function loadSavedValues() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    for (const key in inputs) {
      if (typeof saved[key] === "number" && !Number.isNaN(saved[key])) {
        inputs[key].value = saved[key];
      }
    }
  } catch {
    // ignore corrupt storage
  }
}

function saveValues(values) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function formatGrams(value) {
  return `${Math.round(value)} g`;
}

function readNumber(el, fallback) {
  const value = parseFloat(el.value);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function calculate() {
  const balls = Math.max(1, readNumber(inputs.balls, DEFAULTS.balls));
  const weight = Math.max(1, readNumber(inputs.weight, DEFAULTS.weight));
  const hydration = readNumber(inputs.hydration, DEFAULTS.hydration) / 100;
  const salt = readNumber(inputs.salt, DEFAULTS.salt) / 100;
  const yeast = readNumber(inputs.yeast, DEFAULTS.yeast) / 100;

  const totalDough = balls * weight;
  const flour = totalDough / (1 + hydration + salt + yeast);
  const water = flour * hydration;
  const saltAmount = flour * salt;
  const yeastAmount = flour * yeast;

  output.flour.textContent = Math.round(flour);
  output.water.textContent = formatGrams(water);
  output.salt.textContent = formatGrams(saltAmount);
  output.yeast.textContent = formatGrams(yeastAmount);

  saveValues({
    balls,
    weight,
    hydration: hydration * 100,
    salt: salt * 100,
    yeast: yeast * 100,
  });

  calculateFromFlour();
}

function calculateFromFlour() {
  const flour = parseFloat(flourInput.value);
  if (!Number.isFinite(flour) || flour <= 0) {
    fromFlourResult.hidden = true;
    return;
  }

  const hydration = readNumber(inputs.hydration, DEFAULTS.hydration) / 100;
  const salt = readNumber(inputs.salt, DEFAULTS.salt) / 100;
  const yeast = readNumber(inputs.yeast, DEFAULTS.yeast) / 100;
  const weight = Math.max(1, readNumber(inputs.weight, DEFAULTS.weight));

  const water = flour * hydration;
  const saltAmount = flour * salt;
  const yeastAmount = flour * yeast;
  const total = flour + water + saltAmount + yeastAmount;
  const fullBalls = Math.floor(total / weight);
  const remainder = Math.round(total - fullBalls * weight);

  fromFlourOutput.water.textContent = formatGrams(water);
  fromFlourOutput.salt.textContent = formatGrams(saltAmount);
  fromFlourOutput.yeast.textContent = formatGrams(yeastAmount);
  fromFlourOutput.total.textContent = formatGrams(total);
  fromFlourOutput.balls.innerHTML = `Goed voor <strong>${fullBalls} bol${fullBalls === 1 ? "" : "len"}</strong> van ${Math.round(weight)} g${remainder > 0 ? ` (+ ${remainder} g over)` : ""}.`;
  fromFlourResult.hidden = false;
}

for (const el of Object.values(inputs)) {
  el.addEventListener("input", calculate);
}

flourInput.addEventListener("input", calculateFromFlour);

for (const btn of document.querySelectorAll(".step-btn")) {
  btn.addEventListener("click", () => {
    const target = inputs[btn.dataset.target];
    const delta = parseFloat(btn.dataset.delta);
    const min = parseFloat(target.min) || 1;
    target.value = Math.max(min, readNumber(target, min) + delta);
    calculate();
  });
}

document.getElementById("reset-defaults").addEventListener("click", () => {
  inputs.hydration.value = DEFAULTS.hydration;
  inputs.salt.value = DEFAULTS.salt;
  inputs.yeast.value = DEFAULTS.yeast;
  calculate();
});

loadSavedValues();
calculate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
