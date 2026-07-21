const STORAGE_KEY = "pizza-bol-calculator";

const DEFAULTS = {
  balls: 4,
  weight: 250,
  hydration: 60,
  salt: 2,
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

  currentFlour = flour;
  updateSchedule();

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

// ---- Rijsschema (fermentatiebenadering) ----
// Fermentatiesnelheid t.o.v. 21 °C via een Q10-benadering; gist% × equivalente
// kamertemp-uren ≈ constante. Bewust een schatting: echte tijd hangt af van
// deegtemperatuur, gistsoort en omgeving.
const Q10 = 2.3;
const T_REF = 21;
// Cold fermentation doesn't follow the same Q10 — yeast activity is very
// temperature-sensitive near fridge temps — so the fridge branch uses a
// steeper Q10 anchored at 4 °C = 0.056/hour. Calibrated so 18-24 h at 4 °C
// lands ~0.45-0.50% instant at default strength (mainstream higher-yeast
// style); a warmer fridge ferments faster and needs less yeast.
const FRIDGE_RATE_AT_4 = 0.056;
const Q10_COLD = 3.5;
const YEAST_K = 1.5;
const SCHEDULE_KEY = "pizza-bol-schedule";

let currentFlour = 0;
let scheduleMethod = "room";
let lastIdyPct = 0;

const sched = {
  buttons: document.querySelectorAll(".seg-btn"),
  modeSections: document.querySelectorAll(".sched-fields[data-mode]"),
  roomTemp: document.getElementById("room-temp"),
  roomTempValue: document.getElementById("room-temp-value"),
  roomHours: document.getElementById("room-hours"),
  roomHoursValue: document.getElementById("room-hours-value"),
  coldRoomTemp: document.getElementById("cold-room-temp"),
  coldRoomTempValue: document.getElementById("cold-room-temp-value"),
  fridgeHours: document.getElementById("fridge-hours"),
  fridgeHoursValue: document.getElementById("fridge-hours-value"),
  coldRoomHours: document.getElementById("cold-room-hours"),
  coldRoomHoursValue: document.getElementById("cold-room-hours-value"),
  fridgeTemp: document.getElementById("fridge-temp"),
  fridgeTempValue: document.getElementById("fridge-temp-value"),
  strength: document.getElementById("strength"),
  strengthValue: document.getElementById("strength-value"),
  idyGrams: document.getElementById("sched-idy-g"),
  idyPct: document.getElementById("sched-idy-pct"),
  freshGrams: document.getElementById("sched-fresh-g"),
  timeline: document.getElementById("sched-timeline"),
};

function fermentRate(tempC) {
  return Math.pow(Q10, (tempC - T_REF) / 10);
}

function fridgeRate(tempC) {
  return FRIDGE_RATE_AT_4 * Math.pow(Q10_COLD, (tempC - 4) / 10);
}

function formatSmall(grams) {
  if (grams < 1) return `${grams.toFixed(2)} g`;
  if (grams < 10) return `${grams.toFixed(1)} g`;
  return `${Math.round(grams)} g`;
}

function halfHour(value) {
  return Math.round(value * 2) / 2;
}

function fmtTemp(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} °C`;
}

function fmtHours(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} u`;
}

function refreshSliderLabels() {
  sched.roomTempValue.textContent = fmtTemp(readNumber(sched.roomTemp, 21));
  sched.roomHoursValue.textContent = fmtHours(readNumber(sched.roomHours, 6));
  sched.coldRoomTempValue.textContent = fmtTemp(readNumber(sched.coldRoomTemp, 21));
  sched.fridgeHoursValue.textContent = fmtHours(readNumber(sched.fridgeHours, 24));
  sched.coldRoomHoursValue.textContent = fmtHours(readNumber(sched.coldRoomHours, 2));
  sched.fridgeTempValue.textContent = fmtTemp(readNumber(sched.fridgeTemp, 4));
}

function updateSchedule() {
  let equiv;
  let steps;

  refreshSliderLabels();

  if (scheduleMethod === "cold") {
    const temp = readNumber(sched.coldRoomTemp, 21);
    const fridgeH = Math.max(0, readNumber(sched.fridgeHours, 24));
    const roomH = Math.max(0, readNumber(sched.coldRoomHours, 2));
    const fridgeT = readNumber(sched.fridgeTemp, 4);
    equiv = roomH * fermentRate(temp) + fridgeH * fridgeRate(fridgeT);
    steps = [
      "Meng het deeg en laat het 1–2 u afgedekt op kamertemperatuur staan.",
      `Bol op en zet het deeg ${Math.round(fridgeH)} u in de koelkast (${fmtTemp(fridgeT)}).`,
      `Haal het ${Math.round(roomH)} u voor het bakken eruit, zodat het op temperatuur (${Math.round(temp)} °C) komt.`,
    ];
  } else {
    const temp = readNumber(sched.roomTemp, 21);
    const hours = Math.max(0.5, readNumber(sched.roomHours, 6));
    equiv = hours * fermentRate(temp);
    const bulk = Math.max(0.5, halfHour(hours * 0.35));
    const proof = Math.max(0.5, halfHour(hours - bulk));
    steps = [
      "Meng het deeg tot een gladde bal.",
      `Laat ~${bulk} u afgedekt rijzen (bulkrijs) bij ${Math.round(temp)} °C.`,
      `Bol op en laat ~${proof} u narijzen tot luchtig.`,
      "Vorm en bak af.",
    ];
  }

  if (!Number.isFinite(equiv) || equiv <= 0) equiv = 6;

  const strength = readNumber(sched.strength, 1);
  lastIdyPct = (strength * YEAST_K) / equiv;
  const idyGrams = (currentFlour * lastIdyPct) / 100;

  sched.strengthValue.textContent = strengthLabel(strength);
  sched.idyPct.textContent = `${lastIdyPct.toFixed(2)} %`;
  sched.idyGrams.textContent = formatSmall(idyGrams);
  sched.freshGrams.textContent = formatSmall(idyGrams * 3);
  sched.timeline.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

  saveSchedule();
}

function strengthLabel(strength) {
  if (strength <= 0.7) return "minder gist";
  if (strength >= 1.3) return "meer gist";
  if (Math.abs(strength - 1) < 0.03) return "standaard";
  return `×${strength.toFixed(2)}`;
}

function setMethod(method) {
  scheduleMethod = method;
  for (const btn of sched.buttons) {
    const active = btn.dataset.method === method;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  }
  for (const el of sched.modeSections) {
    el.hidden = el.dataset.mode !== method;
  }
}

function saveSchedule() {
  localStorage.setItem(
    SCHEDULE_KEY,
    JSON.stringify({
      method: scheduleMethod,
      roomTemp: sched.roomTemp.value,
      roomHours: sched.roomHours.value,
      coldRoomTemp: sched.coldRoomTemp.value,
      fridgeHours: sched.fridgeHours.value,
      coldRoomHours: sched.coldRoomHours.value,
      fridgeTemp: sched.fridgeTemp.value,
      strength: sched.strength.value,
    })
  );
}

function loadSchedule() {
  try {
    const s = JSON.parse(localStorage.getItem(SCHEDULE_KEY));
    if (!s) return;
    if (s.roomTemp) sched.roomTemp.value = s.roomTemp;
    if (s.roomHours) sched.roomHours.value = s.roomHours;
    if (s.coldRoomTemp) sched.coldRoomTemp.value = s.coldRoomTemp;
    if (s.fridgeHours) sched.fridgeHours.value = s.fridgeHours;
    if (s.coldRoomHours) sched.coldRoomHours.value = s.coldRoomHours;
    if (s.fridgeTemp) sched.fridgeTemp.value = s.fridgeTemp;
    if (s.strength) sched.strength.value = s.strength;
    if (s.method === "cold") setMethod("cold");
  } catch {
    // ignore corrupt storage
  }
}

for (const btn of sched.buttons) {
  btn.addEventListener("click", () => {
    setMethod(btn.dataset.method);
    updateSchedule();
  });
}

for (const el of [
  sched.roomTemp,
  sched.roomHours,
  sched.coldRoomTemp,
  sched.fridgeHours,
  sched.coldRoomHours,
  sched.fridgeTemp,
  sched.strength,
]) {
  el.addEventListener("input", updateSchedule);
}

document.getElementById("apply-yeast").addEventListener("click", () => {
  inputs.yeast.value = lastIdyPct.toFixed(2);
  calculate();
});

// ---- Gist omrekenen (vers : actief droog : instant ≈ 3 : 1,25 : 1) ----
const YEAST_FACTORS = { fresh: 3, active: 1.25, instant: 1 };
const conv = {
  fresh: document.getElementById("conv-fresh"),
  active: document.getElementById("conv-active"),
  instant: document.getElementById("conv-instant"),
};

function convertYeast(sourceKey) {
  const value = parseFloat(conv[sourceKey].value);
  if (!Number.isFinite(value) || value < 0) {
    for (const key in conv) {
      if (key !== sourceKey) conv[key].value = "";
    }
    return;
  }
  const instantEquiv = value / YEAST_FACTORS[sourceKey];
  for (const key in conv) {
    if (key === sourceKey) continue;
    conv[key].value = Math.round(instantEquiv * YEAST_FACTORS[key] * 100) / 100;
  }
}

for (const key in conv) {
  conv[key].addEventListener("input", () => convertYeast(key));
}

loadSchedule();
loadSavedValues();
calculate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
