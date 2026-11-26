// =====================================================
// Cloudify - script.js
// Flow: city name -> lat/lon -> weather + AQI -> screen pe dikhana
// =====================================================

// ---------- 1) Page ke elements ----------
const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const message = document.getElementById("message");
const result = document.getElementById("result");
const aqiCard = document.getElementById("aqi");
const sunCard = document.getElementById("sun-uv");
const tipsCard = document.getElementById("tips");
const savedCard = document.getElementById("saved");
const savedList = document.getElementById("saved-list");
const saveBtn = document.getElementById("save-btn");
const skeleton = document.getElementById("skeleton");
const skeletonText = document.getElementById("skeleton-text");
const refreshBtn = document.getElementById("refresh-btn");
const hourly = document.getElementById("hourly");
const forecast = document.getElementById("forecast");
const forecastList = document.getElementById("forecast-list");
let hourlyChart = null;   // purana chart yaha rakhte hain, naya banane se pehle hataane ke liye

// ---------- 1b) Step 8: Units aur yaad rakhna (localStorage) ----------
function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

let unit = recall("cloudify-unit") === "F" ? "F" : "C";
let lastLoad = null;      // aakhri city ka data, taaki °C/°F badalne pe dobara API na bulani pade

// API hamesha Celsius deti hai; yaha F mein badalte hain
function convert(celsius) {
  return Math.round(unit === "F" ? celsius * 9 / 5 + 32 : celsius);
}
function convertWind(kmh) {
  return unit === "F" ? Math.round(kmh * 0.621371) + " mph" : Math.round(kmh) + " km/h";
}

// ---------- 1c) Step 13: Saved cities ka data ----------
const MAX_SAVED = 6;
function readSaved() {
  try {
    const list = JSON.parse(recall("cloudify-saved"));
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}
let savedCities = readSaved();     // [{name, country, latitude, longitude}]
let savedWeather = {};             // placeKey -> {temp, code, isDay} (temp Celsius mein)

// Har city ki pehchaan: lat,lon (2 decimal tak), taaki same city do baar save na ho
function placeKey(p) { return Number(p.latitude).toFixed(2) + "," + Number(p.longitude).toFixed(2); }

// ---------- 2) Weather code -> text, emoji, background colors ----------
// WMO codes list: https://open-meteo.com/en/docs
function describeWeather(code) {
  if (code === 0) return { text: "Clear sky", icon: "☀️", colors: ["#4facfe", "#00c6fb"] };
  if (code <= 2) return { text: "Partly cloudy", icon: "⛅", colors: ["#6a9bd8", "#a5c8f0"] };
  if (code === 3) return { text: "Overcast", icon: "☁️", colors: ["#8e9eab", "#9aa9b5"] };
  if (code <= 48) return { text: "Foggy", icon: "🌫️", colors: ["#9aa5b1", "#a7b4bd"] };
  if (code <= 57) return { text: "Drizzle", icon: "🌦️", colors: ["#5f86a8", "#8fb3cf"] };
  if (code <= 67) return { text: "Rain", icon: "🌧️", colors: ["#3a5a85", "#5b84b1"] };
  if (code <= 77) return { text: "Snow", icon: "❄️", colors: ["#7fa7d9", "#a9c4e6"] };
  if (code <= 82) return { text: "Rain showers", icon: "🌧️", colors: ["#3a5a85", "#5b84b1"] };
  if (code <= 86) return { text: "Snow showers", icon: "🌨️", colors: ["#7fa7d9", "#a9c4e6"] };
  return { text: "Thunderstorm", icon: "⛈️", colors: ["#2c3e66", "#5a4a8a"] };
}

// ---------- 3) AQI number -> label, color, advice (US AQI scale) ----------
function describeAQI(aqi) {
  if (aqi <= 50)  return { label: "Good", color: "#1e9e5a", advice: "Air is clean. Great day to be outside." };
  if (aqi <= 100) return { label: "Moderate", color: "#c98a00", advice: "Acceptable air. Very sensitive people may want to limit long outdoor activity." };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", color: "#d9640f", advice: "Children, elders and people with asthma should cut down outdoor exertion." };
  if (aqi <= 200) return { label: "Unhealthy", color: "#d63a3a", advice: "Everyone may feel effects. Consider a mask and keep outdoor time short." };
  if (aqi <= 300) return { label: "Very unhealthy", color: "#8e44ad", advice: "Avoid outdoor activity. Keep windows closed if you can." };
  return { label: "Hazardous", color: "#7b1e3a", advice: "Health emergency conditions. Stay indoors." };
}

// ---------- 3b) Step 7: Weather animations ----------
const fx = document.getElementById("fx");

// Weather code -> kaunsa scene chalana hai
function sceneFor(code) {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  return "storm";
}

function rand(min, max) { return min + Math.random() * (max - min); }

// Ek animated element banakar #fx layer mein daalta hai
function addEl(className, styles) {
  const el = document.createElement("div");
  el.className = className;
  Object.assign(el.style, styles);
  fx.appendChild(el);
}

function setScene(scene, isDay) {
  fx.innerHTML = "";                                   // purana scene hatao
  const load = window.innerWidth < 600 ? 0.6 : 1;      // phone pe kam particles, taaki smooth chale

  // Sooraj ya chaand-taare
  if (scene === "clear" || scene === "partly") {
    if (isDay) {
      addEl("sun", {});
    } else {
      addEl("moon", {});
      for (let i = 0; i < 35 * load; i++) {
        const size = rand(1.5, 3.5) + "px";
        addEl("star", { left: rand(0, 100) + "%", top: rand(0, 55) + "%", width: size, height: size,
                        animationDuration: rand(2, 5) + "s", animationDelay: -rand(0, 5) + "s" });
      }
    }
  }

  // Live extras: din mein parinde, raat mein toot-ta taara
  if ((scene === "clear" || scene === "partly") && isDay) {
    for (let i = 0; i < Math.round(3 * load); i++) {
      addEl("bird", { top: rand(8, 40) + "%", animationDuration: rand(20, 34) + "s",
                      animationDelay: -rand(0, 30) + "s" });
    }
  }
  if ((scene === "clear" || scene === "partly") && !isDay) {
    for (let i = 0; i < 3; i++) {
      addEl("shooting", { left: rand(0, 55) + "%", top: rand(2, 30) + "%",
                          animationDuration: rand(7, 13) + "s", animationDelay: -rand(0, 10) + "s" });
    }
  }

  // Baadal
  const cloudCount = { partly: 3, cloudy: 5, rain: 4, storm: 5, snow: 3 }[scene] || 0;
  for (let i = 0; i < cloudCount; i++) {
    const w = rand(120, 230);
    addEl("cloud", { top: rand(3, 45) + "%", width: w + "px", height: w * 0.28 + "px",
                     animationDuration: rand(45, 90) + "s", animationDelay: -rand(0, 90) + "s" });
  }

  // Baarish
  if (scene === "rain" || scene === "storm") {
    const drops = (scene === "storm" ? 90 : 70) * load;
    for (let i = 0; i < drops; i++) {
      addEl("drop", { left: rand(0, 100) + "%", height: rand(14, 26) + "px",
                      animationDuration: rand(0.55, 1) + "s", animationDelay: -rand(0, 1) + "s" });
    }
  }
  if (scene === "storm") addEl("flash", {});

  // Barf
  if (scene === "snow") {
    for (let i = 0; i < 45 * load; i++) {
      const size = rand(3, 7) + "px";
      addEl("flake", { left: rand(0, 100) + "%", width: size, height: size,
                       animationDuration: rand(7, 13) + "s", animationDelay: -rand(0, 10) + "s" });
    }
  }

  // Kohra
  if (scene === "fog") {
    [20, 45, 70].forEach(function (top) {
      addEl("fog", { top: top + "%", animationDuration: rand(9, 14) + "s" });
    });
  }

  updateCelestial();      // sooraj/chaand ko sahi jagah rakho
}

// Live: sooraj/chaand city ke asli time ke hisaab se aasmaan mein chalta hai
// (subah sunrise ke paas, dopahar ko upar, shaam ko sunset ke paas)
function updateCelestial() {
  const body = fx.querySelector(".sun, .moon");
  if (!body) return;

  let x = 82, y = 20;                                    // default: koi city abhi nahi chuni
  const d = lastLoad && lastLoad.wxData;
  if (d && d.daily.sunrise && d.daily.sunrise[0] && d.daily.sunset[0]) {
    // City ka abhi ka time = API ka time + page khule ko kitna waqt hua
    const now = Date.parse(d.current.time + "Z") + (Date.now() - lastLoad.loadedAt);
    const rise = Date.parse(d.daily.sunrise[0] + "Z");
    const set = Date.parse(d.daily.sunset[0] + "Z");
    const DAY = 24 * 60 * 60 * 1000;

    let t;                                               // 0 se 1: safar kitna poora hua
    if (body.classList.contains("sun")) {
      t = (now - rise) / (set - rise);
    } else {
      const night = DAY - (set - rise);
      t = now > set ? (now - set) / night : (now - (set - DAY)) / night;
    }
    t = Math.min(1, Math.max(0, t));

    x = 8 + 84 * t;                                      // left se right
    y = 78 - 62 * Math.sin(Math.PI * t);                 // arc: beech mein sabse upar
  }
  body.style.left = x + "%";
  body.style.top = y + "%";
}
setInterval(updateCelestial, 30000);                     // har 30 second mein thoda aage

// ---------- 4) Messages (loading / error) ----------
function showMessage(text, loading) {
  message.textContent = text;
  // Loading ho to skeleton (shimmer) dikhao; error ya info ho to message card
  message.classList.toggle("hidden", !!loading);
  skeleton.classList.toggle("hidden", !loading);
  skeletonText.textContent = loading ? text : "";
  [result, tipsCard, aqiCard, sunCard, hourly, forecast].forEach(function (el) { el.classList.add("hidden"); });
}

// ---------- 5) API calls ----------
async function getPlace(cityName) {
  const url = "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(cityName);
  const data = await (await fetch(url)).json();
  return data.results ? data.results[0] : null;
}

async function getWeatherData(lat, lon) {
  const url = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + lat + "&longitude=" + lon
    + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day,uv_index"
    + "&hourly=temperature_2m,precipitation_probability"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"
    + "&timezone=auto";
  const res = await fetch(url);
  const data = await res.json();
  // Service worker ne offline cache se diya? (ya browser offline hai)
  data._cached = res.headers.get("X-Cloudify-Cache") === "hit" || !navigator.onLine;
  return data;
}

// AQI alag try/catch mein: agar ye fail ho to bhi weather dikhna chahiye
async function getAirQuality(lat, lon) {
  try {
    const url = "https://air-quality-api.open-meteo.com/v1/air-quality"
      + "?latitude=" + lat + "&longitude=" + lon
      + "&current=us_aqi,pm2_5,pm10";
    const data = await (await fetch(url)).json();
    return data.current && data.current.us_aqi != null ? data.current : null;
  } catch (error) {
    return null;
  }
}

// ---------- 6) Screen pe dikhane wale functions ----------
function renderCurrent(place, wx, keepScene) {
  const info = describeWeather(wx.weather_code);
  const isDay = wx.is_day !== 0;            // 1 = din, 0 = raat
  if (!isDay) {                              // raat mein gehre colors
    info.colors = ["#161c46", "#3a4a86"];
    if (wx.weather_code === 0) info.icon = "🌙";
  }
  document.getElementById("city-name").textContent = place.name + (place.country ? ", " + place.country : "");
  document.getElementById("icon").textContent = info.icon;
  document.getElementById("temp").textContent = convert(wx.temperature_2m) + "°" + unit;
  document.getElementById("desc").textContent = info.text;
  document.getElementById("feels").textContent = convert(wx.apparent_temperature) + "°" + unit;
  document.getElementById("humidity").textContent = wx.relative_humidity_2m + "%";
  document.getElementById("wind").textContent = convertWind(wx.wind_speed_10m);

  // Weather ke hisaab se background badalna
  document.documentElement.style.setProperty("--sky-top", info.colors[0]);
  document.documentElement.style.setProperty("--sky-bottom", info.colors[1]);
  document.body.classList.toggle("night", !isDay);
  if (!keepScene) setScene(sceneFor(wx.weather_code), isDay);   // unit badalne pe animation dobara na shuru ho
}

function renderAQI(air) {
  if (!air) {                         // data nahi mila to card chhupa do
    aqiCard.classList.add("hidden");
    return;
  }
  const aqi = Math.round(air.us_aqi);
  const info = describeAQI(aqi);

  document.getElementById("aqi-value").textContent = aqi;
  const badge = document.getElementById("aqi-badge");
  badge.textContent = info.label;
  badge.style.setProperty("--aqi-color", info.color);
  document.getElementById("aqi-pm").textContent =
    "PM2.5: " + Math.round(air.pm2_5) + " µg/m³  ·  PM10: " + Math.round(air.pm10) + " µg/m³";
  document.getElementById("aqi-advice").textContent = info.advice;

  // Marker ki position: 0 se 300 ke scale pe (300 ke upar bhi bar ke end pe rukega)
  const percent = Math.min(aqi, 300) / 300 * 100;
  document.getElementById("aqi-marker").style.left = percent + "%";
  aqiCard.classList.remove("hidden");
}

// ---------- Step 11: UV index ----------
function describeUV(uv) {
  if (uv < 3)  return { label: "Low", color: "#1e9e5a", advice: "No protection needed for most people." };
  if (uv < 6)  return { label: "Moderate", color: "#c98a00", advice: "Wear sunglasses. Use sunscreen if you will be out for long." };
  if (uv < 8)  return { label: "High", color: "#d9640f", advice: "Use SPF 30+ sunscreen and a hat. Seek shade around midday." };
  if (uv < 11) return { label: "Very high", color: "#d63a3a", advice: "Avoid midday sun. Use SPF 50+, long sleeves and sunglasses." };
  return { label: "Extreme", color: "#8e44ad", advice: "Stay out of the sun at midday. Take full protection if you must go out." };
}

// Sunrise/sunset ka time city ke local time mein aata hai ("2026-11-26T06:45")
// Isliye "Z" lagake UTC maanke padhte hain aur UTC mein hi dikhate hain, taaki browser ka time zone beech mein na aaye
function formatClock(isoString) {
  return new Date(isoString + "Z").toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function renderSunUV(wxData) {
  const daily = wxData.daily;
  if (!daily.sunrise || !daily.sunrise[0] || !daily.sunset[0]) {   // jaise north pole pe sunrise hota hi nahi
    sunCard.classList.add("hidden");
    return;
  }
  const rise = Date.parse(daily.sunrise[0] + "Z");
  const set = Date.parse(daily.sunset[0] + "Z");
  const totalMinutes = Math.round((set - rise) / 60000);

  document.getElementById("sunrise-time").textContent = formatClock(daily.sunrise[0]);
  document.getElementById("sunset-time").textContent = formatClock(daily.sunset[0]);
  document.getElementById("day-length").textContent = Math.floor(totalMinutes / 60) + "h " + (totalMinutes % 60) + "m";

  const uv = wxData.current.uv_index != null ? wxData.current.uv_index : 0;
  const info = describeUV(uv);
  document.getElementById("uv-value").textContent = (Math.round(uv * 10) / 10).toFixed(1);
  const badge = document.getElementById("uv-badge");
  badge.textContent = "UV " + info.label;
  badge.style.setProperty("--aqi-color", info.color);
  document.getElementById("uv-peak").textContent =
    "Today's peak: " + (daily.uv_index_max && daily.uv_index_max[0] != null ? Math.round(daily.uv_index_max[0]) : "-");
  document.getElementById("uv-advice").textContent = uv === 0 ? "No UV right now." : info.advice;
  document.getElementById("uv-marker").style.left = Math.min(uv, 12) / 12 * 100 + "%";
  sunCard.classList.remove("hidden");
}

// ---------- Step 12: Smart tips ----------
// Abhi ke ghante ka index (hourly array mein)
function hourIndexNow(wxData) {
  const nowHour = wxData.current.time.slice(0, 13);
  const i = wxData.hourly.time.findIndex(function (t) { return t.slice(0, 13) === nowHour; });
  return i < 0 ? 0 : i;
}

function renderTips(wxData, air) {
  const wx = wxData.current;
  const daily = wxData.daily;
  const start = hourIndexNow(wxData);
  const times = wxData.hourly.time.slice(start, start + 24);
  const probs = (wxData.hourly.precipitation_probability || []).slice(start, start + 24);
  const maxP = probs.length ? Math.max.apply(null, probs) : 0;
  const firstRain = probs.findIndex(function (p) { return p >= 50; });   // pehla ghanta jab 50%+ baarish ho

  // 1) Headline: baarish kab hogi
  let icon, text;
  if (firstRain === 0) {
    icon = "☔"; text = "Rain is likely right now (" + probs[0] + "% chance).";
  } else if (firstRain > 0) {
    const when = new Date(times[firstRain]).toLocaleTimeString("en-US", { hour: "numeric" });
    icon = "☔"; text = "Rain likely around " + when + " (" + probs[firstRain] + "% chance).";
  } else if (maxP >= 30) {
    icon = "🌦️"; text = "Small chance of rain today, up to " + maxP + "% in the next 24 hours.";
  } else {
    icon = "😎"; text = "No rain expected in the next 24 hours.";
  }
  document.getElementById("tip-icon").textContent = icon;
  document.getElementById("tip-text").textContent = text;

  // 2) Tips ki list (feels-like hamesha Celsius mein aata hai, isliye thresholds seedhe use kar sakte hain)
  const tips = [];
  const feels = wx.apparent_temperature;
  if (feels <= 5)       tips.push(["🧥", "Freezing out there. Wear a heavy jacket, gloves and a scarf."]);
  else if (feels <= 12) tips.push(["🧥", "Cold. A warm jacket or sweater is a good idea."]);
  else if (feels <= 20) tips.push(["🧶", "Cool. Carry a light jacket."]);
  else if (feels <= 28) tips.push(["👕", "Comfortable. T-shirt and light clothes work well."]);
  else if (feels <= 35) tips.push(["🩳", "Hot. Wear light cotton clothes."]);
  else                  tips.push(["🥵", "Very hot. Wear loose cotton clothes and stay in the shade."]);

  if (maxP >= 40) tips.push(["☂️", "Carry an umbrella or a raincoat."]);
  if (feels >= 35 || wx.temperature_2m >= 35) tips.push(["💧", "Drink plenty of water and avoid long time in the sun."]);

  const peakUV = daily.uv_index_max ? daily.uv_index_max[0] : 0;
  if (peakUV >= 6) tips.push(["🧴", "UV peaks at " + Math.round(peakUV) + " today. Use sunscreen and sunglasses."]);
  else if (peakUV >= 3) tips.push(["🕶️", "Moderate UV today. Sunglasses are a good idea."]);

  if (air && air.us_aqi > 150)      tips.push(["😷", "Air quality is unhealthy. Wear a mask and limit outdoor time."]);
  else if (air && air.us_aqi > 100) tips.push(["😷", "Air is poor for sensitive people. Consider a mask outdoors."]);

  if (wx.wind_speed_10m >= 30) tips.push(["💨", "It is windy. Hold on to light things and drive carefully."]);
  if (wx.weather_code === 45 || wx.weather_code === 48) tips.push(["🌫️", "Fog reduces visibility. Drive slowly with low beam lights."]);
  if (wx.weather_code >= 95) tips.push(["⚡", "Thunderstorm. Stay indoors and avoid open areas and tall trees."]);
  if ((wx.weather_code >= 71 && wx.weather_code <= 77) || wx.weather_code === 85 || wx.weather_code === 86) {
    tips.push(["❄️", "Snow today. Wear shoes with good grip."]);
  }

  const list = document.getElementById("tip-list");
  list.innerHTML = "";
  tips.forEach(function (tip) {
    const li = document.createElement("li");
    const ic = document.createElement("span");
    ic.className = "t-icon";
    ic.textContent = tip[0];
    const tx = document.createElement("span");
    tx.textContent = tip[1];
    li.append(ic, tx);
    list.appendChild(li);
  });
  tipsCard.classList.remove("hidden");
}

function renderForecast(daily) {
  forecastList.innerHTML = "";
  daily.time.forEach(function (dateStr, i) {
    const dayInfo = describeWeather(daily.weather_code[i]);
    const dayName = i === 0
      ? "Today"
      : new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

    // Din ki baarish ki sambhavna (20% se kam ho to dikhana zaroori nahi)
    const prob = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;
    const rainNote = prob >= 20 ? " · 💧 " + prob + "%" : "";

    const row = document.createElement("div");
    row.className = "day";
    row.innerHTML =
      '<div class="day-name">' + dayName + '</div>' +
      '<div class="day-icon">' + dayInfo.icon + '</div>' +
      '<div class="day-desc">' + dayInfo.text + rainNote + '</div>' +
      '<div class="day-temps">' + convert(daily.temperature_2m_max[i]) + '° <span>' +
      convert(daily.temperature_2m_min[i]) + '°</span></div>';
    forecastList.appendChild(row);
  });
}

function renderHourlyChart(wxData) {
  if (typeof Chart === "undefined") {                 // Chart.js load nahi hui (offline) to baaki page chalne do
    hourly.classList.add("hidden");
    return;
  }
  // Abhi ke ghante se agle 24 ghante kaatna
  const nowHour = wxData.current.time.slice(0, 13);
  let start = wxData.hourly.time.findIndex(function (t) { return t.slice(0, 13) === nowHour; });
  if (start < 0) start = 0;

  const times = wxData.hourly.time.slice(start, start + 24);
  const temps = wxData.hourly.temperature_2m.slice(start, start + 24).map(convert);
  const rain = (wxData.hourly.precipitation_probability || []).slice(start, start + 24);
  const labels = times.map(function (t) {
    return new Date(t).toLocaleTimeString("en-US", { hour: "numeric" });
  });

  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(document.getElementById("hourly-chart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {   // Baarish ki sambhavna: neeche neele bars (right axis)
          type: "bar",
          label: "Rain chance",
          data: rain,
          yAxisID: "y1",
          backgroundColor: "rgba(130,205,255,0.55)",
          borderRadius: 3,
          order: 2
        },
        {   // Temperature: upar white line (left axis)
          type: "line",
          label: "Temperature",
          data: temps,
          yAxisID: "y",
          borderColor: "#ffffff",
          backgroundColor: "rgba(255,255,255,0.25)",
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#fff", boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: function (c) {
          return c.datasetIndex === 0 ? c.parsed.y + "% rain chance" : c.parsed.y + "°" + unit;
        } } }
      },
      scales: {
        x: { ticks: { color: "#fff", maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: "#fff", callback: function (v) { return v + "°"; } },
             grid: { color: "rgba(255,255,255,0.2)" } },
        y1: { position: "right", min: 0, max: 100,
              ticks: { color: "#fff", callback: function (v) { return v + "%"; }, stepSize: 25 },
              grid: { drawOnChartArea: false } }
      }
    }
  });
}

// Saare cards ek saath draw karta hai (naya search ho ya unit badla ho)
function renderAll(data, keepScene) {
  renderCurrent(data.place, data.wxData.current, keepScene);
  renderForecast(data.wxData.daily);
  renderAQI(data.air);
  renderSunUV(data.wxData);
  renderTips(data.wxData, data.air);
  updateSaveButton(data.place);
  renderSaved();
  updateAgo();

  // Browser tab ka title: "28°C Indore | Cloudify"
  document.title = convert(data.wxData.current.temperature_2m) + "°" + unit + " " + data.place.name + " | Cloudify";

  message.classList.add("hidden");
  skeleton.classList.add("hidden");
  result.classList.remove("hidden");
  hourly.classList.remove("hidden");     // chart tabhi banta hai jab card visible ho
  forecast.classList.remove("hidden");
  renderHourlyChart(data.wxData);
}

// ---------- 7) Main function: sab kuch yahi jodta hai ----------
async function loadCity(cityName) {
  showMessage("Loading weather...", true);
  try {
    const place = await getPlace(cityName);
    if (!place) {
      showMessage("City not found. Check the spelling and try again.");
      return;
    }
    await showPlace(place);
  } catch (error) {
    showMessage("Could not load weather. Check your internet connection and try again.");
  }
}

// Ek place (naam + lat/lon) ka poora weather dikhata hai.
// City search aur location button, dono yahi function use karte hain.
async function showPlace(place) {
  try {
    // Weather aur AQI dono ek saath mangwate hain (fast)
    const results = await Promise.all([
      getWeatherData(place.latitude, place.longitude),
      getAirQuality(place.latitude, place.longitude)
    ]);
    const wxData = results[0];
    const air = results[1];

    lastLoad = { place: place, wxData: wxData, air: air, loadedAt: Date.now() };
    renderAll(lastLoad, false);
    // Agli baar page khulte hi yahi city dikhane ke liye
    store("cloudify-last", JSON.stringify({
      name: place.name, country: place.country,
      latitude: place.latitude, longitude: place.longitude
    }));
  } catch (error) {
    showMessage("Could not load weather. Check your internet connection and try again.");
  }
}

// ---------- 8) Step 6: Use my location ----------
const locationBtn = document.getElementById("location-btn");

// Lat/lon se city ka naam (Open-Meteo ye nahi deta, isliye BigDataCloud ki free API)
async function getPlaceName(lat, lon) {
  try {
    const url = "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en"
      + "&latitude=" + lat + "&longitude=" + lon;
    const data = await (await fetch(url)).json();
    return { name: data.city || data.locality || "Your location", country: data.countryName || "" };
  } catch (error) {
    return { name: "Your location", country: "" };   // naam na mile to bhi weather chalega
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    showMessage("Your browser does not support location. Please search a city instead.");
    return;
  }
  showMessage("Finding your location...", true);

  navigator.geolocation.getCurrentPosition(
    // Success: browser ne lat/lon de diya
    async function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const nameInfo = await getPlaceName(lat, lon);
      showPlace({ name: nameInfo.name, country: nameInfo.country, latitude: lat, longitude: lon });
    },
    // Error: user ne permission nahi di, ya location mili nahi
    function (error) {
      if (error.code === 1) {
        showMessage("Location permission denied. Allow it in your browser, or search a city.");
      } else {
        showMessage("Could not get your location. Please search a city instead.");
      }
    },
    { timeout: 10000 }
  );
}

locationBtn.addEventListener("click", useMyLocation);

// ---------- 8b) Step 13: Saved cities ----------
function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2200);
}

function isSaved(place) {
  return savedCities.some(function (c) { return placeKey(c) === placeKey(place); });
}

function persistSaved() { store("cloudify-saved", JSON.stringify(savedCities)); }

// ⭐ button ka look: bhara hua (saved) ya khali
function updateSaveButton(place) {
  const saved = isSaved(place);
  saveBtn.textContent = saved ? "★" : "☆";
  saveBtn.classList.toggle("saved", saved);
  saveBtn.setAttribute("aria-pressed", saved);
  saveBtn.setAttribute("aria-label", saved ? "Remove this city from saved" : "Save this city");
}

function toggleSaved(place) {
  if (isSaved(place)) {
    savedCities = savedCities.filter(function (c) { return placeKey(c) !== placeKey(place); });
    toast(place.name + " removed");
  } else {
    if (savedCities.length >= MAX_SAVED) {
      toast("You can save up to " + MAX_SAVED + " cities. Remove one first.");
      return;
    }
    savedCities.push({ name: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude });
    toast(place.name + " saved");
  }
  persistSaved();
  if (lastLoad) updateSaveButton(lastLoad.place);
  renderSaved();
  refreshSavedWeather();
}

function openSaved(city) {
  input.value = city.name;
  hideSuggestions();
  showMessage("Loading weather...", true);
  showPlace(city);
}

// Saved cities ki strip draw karna (har city ka icon + abhi ka temperature = compare)
function renderSaved() {
  savedList.innerHTML = "";
  if (!savedCities.length) { savedCard.classList.add("hidden"); return; }

  const currentKey = lastLoad ? placeKey(lastLoad.place) : "";
  savedCities.forEach(function (city) {
    const w = savedWeather[placeKey(city)];

    const item = document.createElement("div");
    item.className = "saved-item" + (placeKey(city) === currentKey ? " active" : "");

    const open = document.createElement("button");
    open.type = "button";
    open.className = "saved-open";
    const icon = document.createElement("span");
    icon.className = "s-icon";
    icon.textContent = w ? (w.isDay === 0 && w.code === 0 ? "🌙" : describeWeather(w.code).icon) : "⏳";
    const temp = document.createElement("span");
    temp.className = "s-temp";
    temp.textContent = w ? convert(w.temp) + "°" : "--";
    const name = document.createElement("span");
    name.className = "s-name";
    name.textContent = city.name;
    open.append(icon, temp, name);
    open.addEventListener("click", function () { openSaved(city); });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "saved-remove";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", "Remove " + city.name);
    remove.addEventListener("click", function () { toggleSaved(city); });

    item.append(open, remove);
    savedList.appendChild(item);
  });
  savedCard.classList.remove("hidden");
}

// Saari saved cities ka abhi ka weather EK hi API call mein (lat/lon comma se alag karke)
async function refreshSavedWeather() {
  if (!savedCities.length) return;
  try {
    const lats = savedCities.map(function (c) { return c.latitude; }).join(",");
    const lons = savedCities.map(function (c) { return c.longitude; }).join(",");
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons
      + "&current=temperature_2m,weather_code,is_day&timezone=auto";
    const data = await (await fetch(url)).json();
    const results = Array.isArray(data) ? data : [data];     // ek city ho to object, zyada ho to array
    results.forEach(function (d, i) {
      const city = savedCities[i];
      if (city && d.current) {
        savedWeather[placeKey(city)] = { temp: d.current.temperature_2m, code: d.current.weather_code, isDay: d.current.is_day };
      }
    });
    renderSaved();
  } catch (error) { /* internet nahi hai to "--" dikhta rahega */ }
}

saveBtn.addEventListener("click", function () {
  if (lastLoad) toggleSaved(lastLoad.place);
});

// ---------- 8c) Step 14: Auto-refresh + "Updated ... ago" ----------
const REFRESH_EVERY = 10 * 60 * 1000;      // 10 minute
let refreshing = false;

function updateAgo() {
  if (!lastLoad) return;
  if (lastLoad.wxData._cached) {                      // internet nahi hai, purana data dikh raha hai
    document.getElementById("updated").textContent = "Offline · showing saved data";
    return;
  }
  const mins = Math.floor((Date.now() - lastLoad.loadedAt) / 60000);
  let text;
  if (mins < 1) text = "Updated just now";
  else if (mins < 60) text = "Updated " + mins + " min ago";
  else text = "Updated " + Math.floor(mins / 60) + " hr ago";
  document.getElementById("updated").textContent = text;
}

// Chupchap naya data laana (skeleton nahi dikhta, purani screen chalti rehti hai)
async function refreshCurrent() {
  if (!lastLoad || refreshing) return;
  refreshing = true;
  refreshBtn.classList.add("spinning");
  try {
    const place = lastLoad.place;
    const results = await Promise.all([
      getWeatherData(place.latitude, place.longitude),
      getAirQuality(place.latitude, place.longitude)
    ]);
    if (!results[0].current) throw new Error("No data");

    // Agar mausam ya din/raat badal gaya ho tabhi animation scene badlo
    const before = lastLoad.wxData.current;
    const after = results[0].current;
    const changed = sceneFor(before.weather_code) !== sceneFor(after.weather_code) || before.is_day !== after.is_day;

    lastLoad = { place: place, wxData: results[0], air: results[1], loadedAt: Date.now() };
    renderAll(lastLoad, !changed);
    refreshSavedWeather();
  } catch (error) {
    /* internet nahi hai to purana data dikhta rahe */
  }
  refreshing = false;
  refreshBtn.classList.remove("spinning");
  updateAgo();
}

refreshBtn.addEventListener("click", refreshCurrent);
setInterval(refreshCurrent, REFRESH_EVERY);       // har 10 minute mein
setInterval(updateAgo, 30000);                    // "Updated X min ago" taaza rakhna

// Tab wapas kholne par agar data purana ho gaya ho to turant refresh
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && lastLoad && Date.now() - lastLoad.loadedAt > REFRESH_EVERY) refreshCurrent();
});

// ---------- 9) Step 8: °C / °F toggle ----------
const unitButtons = { C: document.getElementById("unit-c"), F: document.getElementById("unit-f") };

function setUnit(newUnit) {
  unit = newUnit;
  store("cloudify-unit", unit);
  ["C", "F"].forEach(function (u) {
    unitButtons[u].classList.toggle("active", u === unit);
    unitButtons[u].setAttribute("aria-pressed", u === unit);
  });
  renderSaved();
  if (lastLoad) renderAll(lastLoad, true);     // API dobara nahi, sirf numbers badlo
}
unitButtons.C.addEventListener("click", function () { setUnit("C"); });
unitButtons.F.addEventListener("click", function () { setUnit("F"); });
setUnit(unit);                                  // saved unit ke hisaab se buttons set karo

// ---------- 9b) Step 11: Search suggestions (autocomplete) ----------
const suggestionsEl = document.getElementById("suggestions");
let suggestionList = [];      // abhi dikh rahi cities
let activeIndex = -1;         // keyboard se kaunsi chuni hai
let debounceTimer = null;
let latestQuery = "";

function hideSuggestions() {
  clearTimeout(debounceTimer);
  latestQuery = "";                     // chal rahi purani request ka jawab ignore hoga
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
  suggestionList = [];
  activeIndex = -1;
}

function highlight(index) {
  activeIndex = index;
  Array.from(suggestionsEl.children).forEach(function (li, i) {
    li.classList.toggle("active", i === index);
    li.setAttribute("aria-selected", i === index);
  });
}

function pickSuggestion(place) {
  input.value = place.name;
  hideSuggestions();
  showMessage("Loading weather...", true);
  showPlace(place);                     // lat/lon pehle se pata hai, dobara search nahi chahiye
}

function renderSuggestions(places) {
  suggestionsEl.innerHTML = "";
  suggestionList = places;
  activeIndex = -1;
  if (!places.length) { suggestionsEl.classList.add("hidden"); return; }

  places.forEach(function (p) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    const name = document.createElement("span");
    name.className = "sg-name";
    name.textContent = p.name;
    const sub = document.createElement("span");
    sub.className = "sg-sub";
    sub.textContent = [p.admin1, p.country].filter(Boolean).join(", ");   // jaise "Madhya Pradesh, India"
    li.append(name, sub);
    li.addEventListener("click", function () { pickSuggestion(p); });
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.remove("hidden");
}

// Debounce: har key pe API nahi, jab user 300ms ruke tab hi
input.addEventListener("input", function () {
  const q = input.value.trim();
  clearTimeout(debounceTimer);
  if (q.length < 2) { hideSuggestions(); return; }

  debounceTimer = setTimeout(async function () {
    latestQuery = q;
    try {
      const url = "https://geocoding-api.open-meteo.com/v1/search?count=5&name=" + encodeURIComponent(q);
      const data = await (await fetch(url)).json();
      if (q !== latestQuery) return;    // user aage type kar chuka, ye purana jawab hai
      renderSuggestions(data.results || []);
    } catch (error) {
      hideSuggestions();
    }
  }, 300);
});

// Keyboard: upar/neeche arrow, Enter, Escape
input.addEventListener("keydown", function (e) {
  if (suggestionsEl.classList.contains("hidden")) return;
  const n = suggestionList.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlight((activeIndex + 1) % n);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlight((activeIndex <= 0 ? n : activeIndex) - 1);
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    pickSuggestion(suggestionList[activeIndex]);
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

// Bahar kahin dabane pe list band
document.addEventListener("click", function (e) {
  if (!e.target.closest(".search-wrap")) hideSuggestions();
});

// ---------- 10) Search button / Enter press ----------
form.addEventListener("submit", function (event) {
  event.preventDefault();
  hideSuggestions();
  const city = input.value.trim();
  if (city) loadCity(city);
});

// ---------- 11) Page khulte hi: saved cities aur aakhri dekhi hui city ----------
renderSaved();
refreshSavedWeather();

try {
  const saved = JSON.parse(recall("cloudify-last"));
  if (saved && saved.latitude != null) {
    showMessage("Loading weather...", true);
    showPlace(saved);
  } else {
    setScene("partly", true);       // koi city nahi: tab bhi background chalta rahe
  }
} catch (error) {
  setScene("partly", true);
}

// =====================================================
// Step 15: PWA (installable app + offline)
// =====================================================

// Service worker (sirf https ya localhost pe chalta hai, file:// pe nahi)
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* register nahi hua to bhi app chalegi */ });
  });
}

// "Install" button: Chrome/Edge/Android jab app install karne layak maane tab ye event deta hai
const installBtn = document.getElementById("install-btn");
const iosHint = document.getElementById("ios-hint");
let installEvent = null;
const isInstalled = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();                       // browser ka apna chhota prompt rokke, apna button dikhayenge
  installEvent = e;
  if (!isInstalled) installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async function () {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", function () {
  installBtn.classList.add("hidden");
  toast("Cloudify installed");
});

// iPhone/iPad pe Safari install button nahi deta, isliye sirf hint dikhate hain
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !isInstalled) {
  iosHint.classList.remove("hidden");
}

// Internet jaane ya aane par chhota message
window.addEventListener("offline", function () { toast("You are offline. Showing saved data."); updateAgo(); });
window.addEventListener("online", function () { toast("Back online"); refreshCurrent(); });