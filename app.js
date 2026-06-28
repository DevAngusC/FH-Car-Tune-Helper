const BASE_TUNE = {
  tireFront: 28.0,
  tireRear: 28.2,
  finalDrive: 3.62,
  camberFront: -2.1,
  camberRear: -1.4,
  toeFront: 0.0,
  toeRear: 0.08,
  caster: 6.0,
  arbFront: 50,
  arbRear: 50,
  springFront: 50,
  springRear: 50,
  rideFront: 42,
  rideRear: 44,
  reboundFront: 56,
  reboundRear: 54,
  bumpFront: 34,
  bumpRear: 33,
  aeroFront: 55,
  aeroRear: 63,
  brakeBalance: 49,
  brakePressure: 105,
  diffFrontAccel: 0,
  diffFrontDecel: 0,
  diffRearAccel: 58,
  diffRearDecel: 18,
  diffCenter: 65,
};

const DEFAULT_ADJUSTMENT_RANGES = {
  arb: { frontMin: 1, frontMax: 100, rearMin: 1, rearMax: 100 },
  spring: { frontMin: 1, frontMax: 100, rearMin: 1, rearMax: 100 },
  rebound: { frontMin: 1, frontMax: 100, rearMin: 1, rearMax: 100 },
  bump: { frontMin: 1, frontMax: 100, rearMin: 1, rearMax: 100 },
  aero: { frontMin: 0, frontMax: 100, rearMin: 0, rearMax: 100 },
};

const adjustmentRangeGroups = [
  { id: "arb", label: "防傾桿", frontKey: "arbFront", rearKey: "arbRear" },
  { id: "spring", label: "彈簧", frontKey: "springFront", rearKey: "springRear" },
  { id: "rebound", label: "回彈阻尼", frontKey: "reboundFront", rearKey: "reboundRear" },
  { id: "bump", label: "壓縮阻尼", frontKey: "bumpFront", rearKey: "bumpRear" },
  { id: "aero", label: "空力", frontKey: "aeroFront", rearKey: "aeroRear" },
];

const adjustmentRangeFields = [
  ["frontMin", "前最低"],
  ["frontMax", "前最高"],
  ["rearMin", "後最低"],
  ["rearMax", "後最高"],
];

const adjustmentRangeValueLimits = [0, 9999];
const adjustableSettingIds = new Set(adjustmentRangeGroups.map((group) => group.id));
const adjustableTuneKeyMeta = Object.fromEntries(
  adjustmentRangeGroups.flatMap((group) => [
    [group.frontKey, { groupId: group.id, side: "front" }],
    [group.rearKey, { groupId: group.id, side: "rear" }],
  ]),
);

const state = {
  view: "config",
  race: "technical",
  tuneFocus: "balanced",
  engine: "flatTorque",
  drive: "awd",
  carWeight: 1500,
  frontWeightPercent: 52,
  powerKw: 400,
  torqueNm: 650,
  gearbox: {
    gearCount: 6,
    topSpeedKmh: "",
    accel97: "",
    accel161: "",
    finalDrive: BASE_TUNE.finalDrive,
  },
  adjustmentRanges: createAdjustmentRanges(),
  activeIssueCategory: "steering",
  issues: new Set(),
};

const vehicleSpecLimits = {
  carWeight: [600, 3000],
  frontWeightPercent: [35, 65],
  powerKw: [50, 1500],
  torqueNm: [100, 2500],
};

const gearboxLimits = {
  gearCount: [4, 10],
  topSpeedKmh: [80, 600],
  accel97: [1, 30],
  accel161: [2, 60],
  finalDrive: [2.2, 6.5],
};

const PSI_TO_BAR = 0.0689476;

const raceTypes = [
  {
    id: "technical",
    label: "多彎賽道",
    subtitle: "低中速連續彎",
    title: "多彎賽道基礎值",
    mods: {
      tireFront: -0.2,
      tireRear: -0.1,
      finalDrive: 0.24,
      camberFront: -0.35,
      camberRear: -0.2,
      toeFront: 0.02,
      caster: 0.2,
      arbFront: -4,
      arbRear: 3,
      springFront: -3,
      springRear: -2,
      rideFront: -3,
      rideRear: -2,
      reboundFront: -1,
      bumpFront: -1,
      aeroFront: 13,
      aeroRear: 12,
      diffRearAccel: 4,
      diffRearDecel: 2,
    },
    principles: ["短終傳讓出彎轉速回到馬力帶", "前端抓地優先，後端保留一點旋轉", "高下壓換取連續彎穩定性"],
  },
  {
    id: "fast",
    label: "少彎高速",
    subtitle: "高速彎與長直線",
    title: "少彎高速基礎值",
    mods: {
      tireFront: 0.1,
      tireRear: 0.2,
      finalDrive: -0.28,
      camberFront: 0.2,
      camberRear: 0.15,
      toeFront: -0.01,
      toeRear: 0.03,
      arbFront: 2,
      arbRear: -1,
      springFront: 3,
      springRear: 2,
      rideFront: -4,
      rideRear: -4,
      reboundFront: 2,
      reboundRear: 2,
      aeroFront: -12,
      aeroRear: -10,
      brakePressure: 2,
    },
    principles: ["較長終傳保留尾速", "低車高與較少下壓降低阻力", "後輪微內八維持高速穩定"],
  },
  {
    id: "rally",
    label: "拉力賽",
    subtitle: "混合路面與跳躍",
    title: "拉力賽基礎值",
    mods: {
      tireFront: -1.0,
      tireRear: -0.9,
      finalDrive: 0.18,
      camberFront: 0.45,
      camberRear: 0.35,
      toeFront: 0.03,
      toeRear: 0.03,
      caster: -0.2,
      arbFront: -12,
      arbRear: -10,
      springFront: -18,
      springRear: -17,
      rideFront: 24,
      rideRear: 25,
      reboundFront: -12,
      reboundRear: -12,
      bumpFront: -9,
      bumpRear: -9,
      aeroFront: -6,
      aeroRear: -2,
      brakeBalance: 1,
      brakePressure: -4,
      diffRearAccel: 8,
      diffRearDecel: 4,
    },
    principles: ["軟懸吊吸收碎震與落地", "較高車身保留懸吊行程", "差速器給更多鎖定換取鬆散路面推進"],
  },
  {
    id: "crossCountry",
    label: "越野賽",
    subtitle: "草地、泥地、大落差",
    title: "越野賽基礎值",
    mods: {
      tireFront: -1.4,
      tireRear: -1.3,
      finalDrive: 0.12,
      camberFront: 0.7,
      camberRear: 0.55,
      toeFront: 0.04,
      toeRear: 0.06,
      caster: -0.3,
      arbFront: -18,
      arbRear: -16,
      springFront: -25,
      springRear: -24,
      rideFront: 34,
      rideRear: 35,
      reboundFront: -18,
      reboundRear: -18,
      bumpFront: -14,
      bumpRear: -14,
      aeroFront: -18,
      aeroRear: -16,
      brakeBalance: 2,
      brakePressure: -7,
      diffRearAccel: 12,
      diffRearDecel: 8,
    },
    principles: ["胎壓與彈簧偏低，讓輪胎吃住地面", "車高優先於空力效率", "差速器鎖定偏高，避免單輪空轉"],
  },
  {
    id: "drag",
    label: "直線加速",
    subtitle: "起步與換檔效率",
    title: "直線加速基礎值",
    mods: {
      tireFront: 1.0,
      tireRear: -1.6,
      finalDrive: 0.34,
      camberFront: 1.8,
      camberRear: 1.25,
      toeFront: 0,
      toeRear: -0.05,
      caster: -0.5,
      arbFront: -8,
      arbRear: -14,
      springFront: 8,
      springRear: -10,
      rideFront: 3,
      rideRear: -4,
      reboundFront: 8,
      reboundRear: -10,
      bumpFront: -6,
      bumpRear: -9,
      aeroFront: -28,
      aeroRear: -24,
      brakePressure: -8,
      diffRearAccel: 30,
      diffRearDecel: -8,
    },
    principles: ["驅動輪低胎壓換起步抓地", "接近零外傾減少直線摩擦損失", "空力阻力壓低，差速器加速鎖定提高"],
  },
  {
    id: "drift",
    label: "甩尾",
    subtitle: "角度、油門、回正",
    title: "甩尾基礎值",
    mods: {
      tireFront: 1.0,
      tireRear: 1.8,
      finalDrive: 0.48,
      camberFront: -2.25,
      camberRear: 0.45,
      toeFront: 0.17,
      toeRear: -0.05,
      caster: 0.8,
      arbFront: 8,
      arbRear: 2,
      springFront: 5,
      springRear: -3,
      rideFront: -2,
      rideRear: -1,
      reboundFront: 8,
      reboundRear: 2,
      bumpFront: 4,
      bumpRear: 1,
      aeroFront: -18,
      aeroRear: -18,
      brakeBalance: -2,
      brakePressure: 8,
      diffRearAccel: 34,
      diffRearDecel: 52,
    },
    principles: ["大前外傾與前束外八提高入彎咬合", "後輪胎壓較高，讓滑移更容易維持", "高差速鎖定讓油門角度更直接"],
  },
];

const raceGearMods = {
  technical: {
    firstRange: [64, 82],
    firstTarget: -2,
    topTargetMultiplier: 1.01,
    topRatio: 0.03,
    curvePower: -0.04,
    finalDriveBias: 0.06,
    note: "多彎賽道會縮短低檔並提高 1-3 檔密度，讓出彎後更快回到可用轉速。",
  },
  fast: {
    firstRange: [78, 95],
    firstTarget: 4,
    topTargetMultiplier: 1.08,
    topRatio: -0.07,
    curvePower: 0.08,
    finalDriveBias: -0.08,
    note: "少彎高速會拉長一檔與高檔，最高檔多保留一點尾速空間。",
  },
  rally: {
    firstRange: [68, 84],
    firstTarget: 1,
    topTargetMultiplier: 1.02,
    topRatio: 0.03,
    curvePower: -0.02,
    finalDriveBias: 0.05,
    note: "拉力賽需要低中檔反應，但一檔不會太短，避免鬆散路面補油空轉。",
  },
  crossCountry: {
    firstRange: [72, 88],
    firstTarget: 3,
    topTargetMultiplier: 1,
    topRatio: 0.04,
    curvePower: 0.06,
    finalDriveBias: 0.03,
    note: "越野賽會略放長低檔並保留高檔延展，減少草地、泥地和跳躍後的扭力突兀感。",
  },
  drag: {
    firstRange: [58, 74],
    firstTarget: -6,
    topTargetMultiplier: 1.04,
    topRatio: 0.02,
    curvePower: -0.12,
    finalDriveBias: 0.1,
    note: "直線加速會讓一檔紅線目標偏低，低檔更密，讓起步與 1-2 檔銜接優先。",
  },
  drift: {
    firstRange: [56, 76],
    firstTarget: -4,
    topTargetMultiplier: 0.98,
    topRatio: 0.05,
    curvePower: -0.08,
    finalDriveBias: 0.12,
    note: "甩尾會縮短低中檔並弱化尾速預留，讓油門角度和回正節奏更直接。",
  },
};

const tuneFocusTypes = [
  {
    id: "balanced",
    label: "平衡基準",
    subtitle: "泛用設定",
    mods: {},
    gearMods: {},
    reason: "不特別偏向某一項能力，適合先建立穩定基準後再依試車狀況微調。",
  },
  {
    id: "exitAcceleration",
    label: "出彎加速特化",
    subtitle: "慢彎早補油",
    mods: {
      tireRear: -0.25,
      finalDrive: 0.1,
      arbRear: -2,
      springRear: -2,
      reboundRear: -1,
      bumpRear: -1,
      diffRearAccel: -5,
      diffFrontAccel: -2,
      diffCenter: -2,
      aeroRear: 2,
    },
    gearMods: { firstTarget: -2, curvePower: -0.08 },
    reason: "讓中低速出彎更容易把動力落地，適合髮夾彎後需要早補油的賽道。",
  },
  {
    id: "brakeReLaunch",
    label: "減速後再加速特化",
    subtitle: "重煞後補油",
    mods: {
      tireFront: -0.1,
      tireRear: -0.15,
      finalDrive: 0.08,
      camberFront: -0.15,
      toeFront: 0.01,
      caster: 0.15,
      brakeBalance: -1,
      brakePressure: -2,
      diffRearAccel: -3,
      diffRearDecel: -3,
      diffFrontAccel: -2,
      reboundFront: 1,
      bumpFront: -1,
    },
    gearMods: { firstTarget: -4, curvePower: -0.05 },
    reason: "重煞後重新補油時需要前端肯轉、後端不突然打滑，適合山路與急減速彎。",
  },
  {
    id: "launch",
    label: "起步彈射特化",
    subtitle: "0-100 / 短衝刺",
    mods: {
      tireFront: -0.2,
      tireRear: -0.45,
      finalDrive: 0.22,
      arbRear: -3,
      springRear: -3,
      bumpRear: -2,
      diffFrontAccel: -5,
      diffRearAccel: -8,
      diffCenter: -5,
    },
    gearMods: { firstTarget: -8, topRatio: 0.04, curvePower: -0.08 },
    reason: "優先讓一、二檔動力不要空轉，適合 Drag、短衝刺和起步取向車。",
  },
  {
    id: "topSpeed",
    label: "高速尾速特化",
    subtitle: "長直線",
    mods: {
      finalDrive: -0.32,
      toeFront: -0.01,
      toeRear: 0.01,
      rideFront: -2,
      rideRear: -2,
      aeroFront: -14,
      aeroRear: -16,
      reboundFront: 1,
      reboundRear: 1,
      brakePressure: 1,
    },
    gearMods: { firstTarget: 8, topRatio: -0.08, topTargetMultiplier: 1.07, curvePower: 0.08 },
    reason: "降低阻力並拉長高檔，適合高速公路、長直線與最高速挑戰。",
  },
  {
    id: "highSpeedStability",
    label: "高速穩定特化",
    subtitle: "高速彎 / 高馬力",
    mods: {
      finalDrive: -0.08,
      toeRear: 0.04,
      caster: 0.2,
      aeroFront: 4,
      aeroRear: 10,
      reboundRear: 2,
      bumpRear: 1,
      brakeBalance: 1,
      diffRearAccel: -3,
      diffCenter: 3,
    },
    gearMods: { firstTarget: 4, topTargetMultiplier: 1.05, curvePower: 0.04 },
    reason: "提高高速彎和大馬力車的穩定容錯，避免齒比與底盤太激進。",
  },
  {
    id: "turnIn",
    label: "入彎轉向特化",
    subtitle: "改善推頭",
    mods: {
      tireFront: -0.25,
      camberFront: -0.25,
      toeFront: 0.03,
      caster: 0.3,
      arbFront: -3,
      springFront: -2,
      aeroFront: 4,
      brakeBalance: -1,
      diffRearDecel: -2,
    },
    gearMods: { firstTarget: -3, curvePower: -0.02 },
    reason: "讓前輪更願意咬進彎心，適合技術彎多或原本容易推頭的車。",
  },
  {
    id: "wetBumpyGrip",
    label: "濕滑/顛簸抓地特化",
    subtitle: "低抓地路面",
    mods: {
      tireFront: -0.35,
      tireRear: -0.45,
      finalDrive: -0.05,
      arbFront: -7,
      arbRear: -7,
      springFront: -9,
      springRear: -9,
      rideFront: 6,
      rideRear: 7,
      reboundFront: -4,
      reboundRear: -4,
      bumpFront: -6,
      bumpRear: -6,
      aeroFront: 3,
      aeroRear: 5,
      brakePressure: -5,
      diffFrontAccel: -5,
      diffRearAccel: -7,
      diffCenter: -4,
    },
    gearMods: { firstTarget: 2, topRatio: 0.03, curvePower: 0.05 },
    reason: "降低底盤和動力輸出的突兀感，讓濕滑、顛簸或低抓地路面更容易控制。",
  },
];

const engineCurves = [
  {
    id: "flatTorque",
    label: "平坦扭力型",
    subtitle: "寬廣輸出",
    mods: { finalDrive: -0.05, diffRearAccel: -2, diffFrontAccel: -1, brakePressure: 1 },
    gearMods: { firstTarget: 3, curvePower: 0.03 },
    principle: "可用轉速帶寬，終傳不用過短。",
  },
  {
    id: "highRpm",
    label: "高轉馬力型",
    subtitle: "越轉越有力",
    mods: { finalDrive: 0.18, reboundFront: 1, reboundRear: 1, diffRearAccel: 3 },
    gearMods: { firstTarget: -4, curvePower: -0.06 },
    principle: "終傳稍短，讓出彎後盡快回到高轉區。",
  },
  {
    id: "turboHit",
    label: "渦輪爆發型",
    subtitle: "中高轉突增",
    mods: { tireRear: -0.3, finalDrive: -0.02, springRear: -2, reboundRear: -2, diffRearAccel: -5, diffCenter: -3 },
    gearMods: { firstTarget: 5, curvePower: 0.07 },
    principle: "降低後端尖銳度，避免增壓上來時把車尾打開。",
  },
  {
    id: "supercharged",
    label: "機械增壓線性型",
    subtitle: "直接、可預期",
    mods: { finalDrive: 0.05, arbRear: 1, diffRearAccel: 2 },
    gearMods: { firstTarget: 0, curvePower: -0.02 },
    principle: "線性輸出能接受較直接的轉向與差速器反應。",
  },
  {
    id: "lowEnd",
    label: "低轉大扭力型",
    subtitle: "早段推力強",
    mods: { tireRear: -0.4, finalDrive: -0.18, springRear: -2, diffRearAccel: -4, diffCenter: -2 },
    gearMods: { firstTarget: 6, curvePower: 0.05 },
    principle: "終傳稍長，讓大扭力更容易落地。",
  },
  {
    id: "instant",
    label: "電動瞬間扭力型",
    subtitle: "零延遲輸出",
    mods: { tireFront: -0.1, tireRear: -0.5, finalDrive: -0.1, diffFrontAccel: -3, diffRearAccel: -7, diffCenter: -5, brakePressure: 3 },
    gearMods: { firstTarget: 3, curvePower: 0.04 },
    principle: "瞬間扭力需要保守差速器與更好的驅動輪抓地。",
  },
];

const driveTypes = [
  {
    id: "fwd",
    label: "前驅",
    subtitle: "FWD",
    mods: {
      tireFront: -0.4,
      tireRear: 0.3,
      camberFront: -0.25,
      camberRear: 0.1,
      toeFront: 0.02,
      arbFront: -8,
      arbRear: 10,
      springFront: -4,
      springRear: 5,
      aeroFront: 4,
      brakeBalance: 3,
      diffFrontAccel: 33,
      diffFrontDecel: 12,
      diffRearAccel: -58,
      diffRearDecel: -18,
      diffCenter: -65,
    },
    principle: "前輪同時轉向與輸出，前端要軟一點，後端幫忙轉。",
  },
  {
    id: "rwd",
    label: "後驅",
    subtitle: "RWD",
    mods: {
      tireRear: -0.4,
      camberRear: -0.1,
      toeRear: 0.03,
      arbFront: 1,
      arbRear: -3,
      springRear: -3,
      aeroRear: 5,
      brakeBalance: 1,
      diffRearAccel: 6,
      diffRearDecel: 4,
      diffCenter: -65,
    },
    principle: "後輪負責輸出，保留後端抓地比追求過度旋轉更重要。",
  },
  {
    id: "awd",
    label: "四驅",
    subtitle: "AWD",
    mods: {
      tireFront: -0.1,
      tireRear: -0.2,
      arbFront: -2,
      arbRear: 2,
      springFront: -1,
      springRear: -1,
      diffFrontAccel: 22,
      diffFrontDecel: 8,
      diffCenter: 2,
    },
    principle: "後偏扭力分配能減少四驅推頭，同時保留出彎牽引。",
  },
];

const issueTypes = [
  {
    id: "exit-flat",
    label: "出彎沒力",
    chip: "動力帶",
    steps: [
      ["終傳比", "增加 +0.10 到 +0.25，讓出彎轉速更快回到有效區。"],
      ["低檔齒比", "若 2、3 檔掉轉，先縮短該檔 3% 到 6%。"],
      ["差速器加速", "增加驅動輪 +3% 到 +6%，但若開始打滑就退回一半。"],
    ],
  },
  {
    id: "mid-corner-grip",
    label: "中彎沒抓地力",
    chip: "機械抓地",
    steps: [
      ["防傾桿", "前後一起降低 3% 到 6%，先從打滑那一端降。"],
      ["彈簧", "降低 2% 到 5%，讓輪胎在長彎中保持接地。"],
      ["外傾角", "前輪增加 -0.1 到 -0.3 度，後輪增加 -0.1 到 -0.2 度。"],
    ],
  },
  {
    id: "entry-understeer",
    label: "入彎推頭",
    chip: "入彎",
    steps: [
      ["前防傾桿", "降低 3% 到 6%，讓前輪更願意咬進彎心。"],
      ["前束", "加一點前束外八 +0.02 到 +0.05 度。"],
      ["煞車平衡", "往後移 1% 到 2%，若後輪不穩就退回。"],
    ],
  },
  {
    id: "exit-understeer",
    label: "出彎推頭",
    chip: "出彎",
    steps: [
      ["差速器加速", "前驅或四驅前差降低 3% 到 6%，後驅則檢查是否油門太早全開。"],
      ["後防傾桿", "增加 2% 到 4%，幫助車尾參與轉向。"],
      ["終傳比", "若轉速太低，增加 +0.05 到 +0.15；若輪胎叫太大聲，先別動終傳。"],
    ],
  },
  {
    id: "oversteer",
    label: "車尾太滑",
    chip: "穩定",
    steps: [
      ["後胎胎壓", "降低 0.02 到 0.05 BAR，先找回油門容錯。"],
      ["後防傾桿與後彈簧", "各降低 3% 到 6%，讓後輪更貼地。"],
      ["後差速器加速", "降低 4% 到 8%，渦輪爆發型可多降一點。"],
    ],
  },
  {
    id: "slow-steering",
    label: "方向反應過慢",
    chip: "反應",
    steps: [
      ["前束", "增加前束外八 +0.02 到 +0.05 度。"],
      ["前防傾桿", "增加 2% 到 4%，若開始推頭就改動後防傾桿。"],
      ["回彈阻尼", "前回彈增加 2% 到 4%，讓轉向輸入更快被車身接受。"],
    ],
  },
  {
    id: "nervous",
    label: "方向太神經",
    chip: "穩定",
    steps: [
      ["前束", "減少前束外八 0.02 到 0.05 度，或回到 0。"],
      ["後束", "增加後輪內八 +0.02 到 +0.05 度。"],
      ["後下壓", "增加 3% 到 7%，高速車款優先改這裡。"],
    ],
  },
  {
    id: "brake-unstable",
    label: "煞車不穩",
    chip: "煞車",
    steps: [
      ["煞車壓力", "降低 5% 到 10%，先避免鎖死。"],
      ["煞車平衡", "往前移 1% 到 3%，如果入彎推頭加重就回退一格。"],
      ["差速器減速", "後驅後差降低 3% 到 6%，四驅前後差都少量降低。"],
    ],
  },
  {
    id: "launch-spin",
    label: "起步打滑",
    chip: "牽引",
    steps: [
      ["驅動輪胎壓", "降低 0.03 到 0.08 BAR，直線加速先改後輪。"],
      ["終傳比", "降低 -0.08 到 -0.18，讓一檔不要太暴力。"],
      ["差速器加速", "降低 4% 到 8%，若是四驅可把中央分配往前 3% 到 5%。"],
    ],
  },
  {
    id: "top-speed",
    label: "尾速不夠",
    chip: "尾速",
    steps: [
      ["終傳比", "降低 -0.15 到 -0.35，讓最高檔能繼續拉。"],
      ["空力", "前後下壓各降低 5% 到 10%，若高速彎不穩就只降前下壓。"],
      ["前後束", "往 0 靠近，減少直線摩擦。"],
    ],
  },
  {
    id: "landing",
    label: "落地不穩",
    chip: "越野",
    steps: [
      ["車高", "前後提高 4% 到 8%，先避免觸底。"],
      ["壓縮阻尼", "降低 4% 到 8%，讓懸吊吸收落地。"],
      ["回彈阻尼", "降低 3% 到 6%，避免落地後彈跳。"],
    ],
  },
  {
    id: "drift-angle",
    label: "甩尾角度不夠",
    chip: "甩尾",
    steps: [
      ["前外傾", "增加 -0.2 到 -0.5 度，讓大角度時前輪仍有咬地。"],
      ["前束", "增加外八 +0.03 到 +0.08 度。"],
      ["後胎胎壓", "增加 0.02 到 0.06 BAR，讓車尾更容易維持滑移。"],
    ],
  },
];

const adviceTemplates = {
  steeringUndersteer: [
    ["前端抓地", "前防傾桿降低 3% 到 6%，前外傾增加 -0.1 到 -0.3 度。"],
    ["車尾輔助旋轉", "後防傾桿增加 2% 到 4%，但如果車尾開始滑就退回一半。"],
    ["差速器", "四驅或前驅先降低前差加速 3% 到 6%，減少補油推頭。"],
  ],
  steeringSlow: [
    ["前束", "增加前輪外八 +0.02 到 +0.05 度，讓初段反應更明顯。"],
    ["回彈阻尼", "前回彈增加 2% 到 4%，讓車身更快接受轉向輸入。"],
    ["主銷後傾", "增加 0.2 到 0.4 度，提升方向盤回正與前輪支撐。"],
  ],
  steeringNervous: [
    ["前束", "減少前輪外八 0.02 到 0.05 度，必要時回到 0。"],
    ["後束", "增加後輪內八 +0.02 到 +0.05 度，讓車尾穩住。"],
    ["高速支撐", "後下壓增加 3% 到 7%，高速車款優先改這裡。"],
  ],
  steeringOversteer: [
    ["後端機械抓地", "後防傾桿與後彈簧各降低 3% 到 6%。"],
    ["後胎胎壓", "降低 0.02 到 0.05 BAR，先找回滑移容錯。"],
    ["差速器", "後差加速或減速降低 4% 到 8%，依發生在補油或收油時調整。"],
  ],
  rearLoose: [
    ["後胎胎壓", "降低 0.02 到 0.06 BAR，讓後輪更容易咬地。"],
    ["後防傾桿", "降低 3% 到 7%，如果彎中才滑就優先改這裡。"],
    ["後差速器", "後差加速降低 4% 到 8%，收油甩尾則降低後差減速。"],
  ],
  rearFloat: [
    ["後下壓", "增加 4% 到 8%，高速漂浮感先從空力處理。"],
    ["後束", "增加後輪內八 +0.02 到 +0.06 度，提升直線與換線穩定。"],
    ["後回彈", "降低 2% 到 5%，避免車尾在路面起伏後彈跳。"],
  ],
  rearTooFast: [
    ["後防傾桿", "降低 3% 到 6%，讓車尾反應慢一點。"],
    ["後束", "增加後輪內八 +0.02 到 +0.05 度。"],
    ["差速器", "降低後差加速 3% 到 6%，避免補油時車尾太直接。"],
  ],
  gripFront: [
    ["前胎胎壓", "降低 0.01 到 0.03 BAR，熱胎目標仍控制在合理範圍。"],
    ["前外傾", "增加 -0.1 到 -0.3 度，改善彎中接地。"],
    ["前防傾桿", "降低 3% 到 6%，讓前輪在彎中更能貼地。"],
  ],
  gripRear: [
    ["後胎胎壓", "降低 0.02 到 0.05 BAR，先保住牽引。"],
    ["後彈簧與防傾桿", "各降低 3% 到 6%，讓後輪更貼地。"],
    ["後下壓", "高速或大馬力車增加後下壓 3% 到 8%。"],
  ],
  gripAll: [
    ["胎壓", "前後胎壓各降低 0.01 到 0.03 BAR，先觀察熱胎表現。"],
    ["彈簧與防傾桿", "前後一起降低 3% 到 6%，增加機械抓地。"],
    ["空力", "公路賽提高前後下壓 3% 到 7%；越野先別用空力解決。"],
  ],
  gripBump: [
    ["車高", "提高 4% 到 8%，避免路肩或顛簸時觸底。"],
    ["壓縮阻尼", "降低 4% 到 8%，讓懸吊吸收衝擊。"],
    ["回彈阻尼", "降低 3% 到 6%，避免彈開後輪胎離地。"],
  ],
  suspensionBoat: [
    ["防傾桿", "前後防傾桿增加 4% 到 8%，先控制側傾。"],
    ["回彈阻尼", "前後回彈增加 3% 到 6%，減少車身晃動。"],
    ["彈簧", "前後彈簧增加 3% 到 6%，但越野車不要一次加太多。"],
  ],
  suspensionBump: [
    ["車高", "提高 5% 到 10%，保留懸吊行程。"],
    ["壓縮阻尼", "降低 5% 到 10%，讓車不要被路面彈飛。"],
    ["防傾桿", "前後降低 5% 到 10%，爛路與路肩優先放軟。"],
  ],
  suspensionBottom: [
    ["車高", "提高 6% 到 12%，先避免高速壓縮到底。"],
    ["彈簧", "增加 4% 到 8%，讓車身有足夠支撐。"],
    ["壓縮阻尼", "增加 2% 到 5%，但如果變得會彈飛就回退。"],
  ],
  suspensionHard: [
    ["彈簧", "前後降低 4% 到 8%，讓車身姿態不要太死硬。"],
    ["防傾桿", "降低 3% 到 6%，改善彎中貼地感。"],
    ["阻尼", "壓縮與回彈各降低 2% 到 5%，優先改壓縮。"],
  ],
  brakeUnstable: [
    ["煞車壓力", "降低 5% 到 10%，先避免鎖死與晃動。"],
    ["煞車平衡", "往前移 1% 到 3%，如果入彎推頭加重就回退。"],
    ["差速器減速", "降低後差減速 3% 到 6%，收油或煞車甩尾時特別有效。"],
  ],
  brakeUndersteer: [
    ["煞車平衡", "往後移 1% 到 2%，讓入彎時前輪不要過度負擔。"],
    ["前防傾桿", "降低 3% 到 6%，增加煞車入彎前端抓地。"],
    ["Trail Braking", "如果車尾開始不穩，煞車平衡退回 1 格並降低壓力。"],
  ],
  brakeOversteer: [
    ["煞車平衡", "往前移 1% 到 3%，降低後輪鎖死機率。"],
    ["後差減速", "降低 4% 到 8%，讓收油煞車時車尾不要甩。"],
    ["後束", "增加後輪內八 +0.02 到 +0.05 度。"],
  ],
  brakeLock: [
    ["煞車壓力", "降低 8% 到 15%，先解決鎖死。"],
    ["煞車平衡", "依鎖死端調整，前輪鎖死往後，後輪鎖死往前。"],
    ["胎壓", "鎖死端胎壓降低 0.01 到 0.03 BAR。"],
  ],
  accelTraction: [
    ["驅動輪胎壓", "降低 0.03 到 0.07 BAR，先讓動力落地。"],
    ["差速器加速", "降低 4% 到 8%，一補油就滑時優先改。"],
    ["終傳比", "降低 -0.08 到 -0.18，讓低檔不要太暴力。"],
  ],
  accelUndersteer: [
    ["前差加速", "四驅或前驅降低前差加速 4% 到 8%。"],
    ["中央差速", "四驅中央分配往後 3% 到 6%，減少補油推頭。"],
    ["後防傾桿", "增加 2% 到 4%，讓出彎車尾幫忙轉。"],
  ],
  accelOversteer: [
    ["後差加速", "降低 5% 到 10%，讓補油不要直接把尾巴打開。"],
    ["後胎胎壓", "降低 0.03 到 0.06 BAR。"],
    ["後彈簧", "降低 3% 到 6%，讓後輪吃住地面。"],
  ],
  accelFloat: [
    ["後下壓", "增加 4% 到 8%，改善高速全油門漂浮。"],
    ["後束", "增加後輪內八 +0.02 到 +0.05 度。"],
    ["中央差速", "四驅中央分配往前 2% 到 4%，讓高速加速更穩。"],
  ],
  powerDelivery: [
    ["終傳比", "依掉轉或太暴力調整，掉轉就加 +0.08，太暴力就降 -0.08。"],
    ["低檔齒比", "只針對問題檔位縮短或拉長 3% 到 6%。"],
    ["差速器", "動力突兀時降低加速鎖定 3% 到 6%。"],
  ],
  highSpeedFloat: [
    ["空力", "前後下壓各增加 4% 到 8%，先保穩定再追尾速。"],
    ["車高", "公路車前後降低 2% 到 5%，但有顛簸就不要降太多。"],
    ["後束", "增加後輪內八 +0.02 到 +0.05 度。"],
  ],
  highSpeedBump: [
    ["車高", "提高 4% 到 8%，高速壓路肩或過坡先保行程。"],
    ["壓縮阻尼", "降低 4% 到 8%，讓輪胎不要被彈離地面。"],
    ["回彈阻尼", "降低 3% 到 6%，減少落地後晃動。"],
  ],
  highSpeedLine: [
    ["後下壓", "增加 4% 到 8%，改善換線與大彎穩定。"],
    ["前束", "減少前輪外八，往 0 靠近。"],
    ["防傾桿", "前後小幅增加 2% 到 4%，但若壓路肩變差就退回。"],
  ],
  fhMountain: [
    ["車高與阻尼", "車高提高 4% 到 8%，壓縮與回彈各降低 3% 到 6%。"],
    ["煞車", "下坡很難煞時降低煞車壓力 5% 到 10%，平衡往前 1% 到 2%。"],
    ["終傳", "山路出彎掉轉就增加 +0.08 到 +0.15。"],
  ],
  fhRough: [
    ["懸吊行程", "車高提高 6% 到 12%，避免坡道、爛路、跳台觸底。"],
    ["防傾桿", "前後降低 5% 到 10%，讓左右輪能各自處理路面。"],
    ["阻尼", "壓縮降低 5% 到 10%，回彈降低 3% 到 6%。"],
  ],
  fhTransition: [
    ["胎壓", "前後降低 0.02 到 0.04 BAR，讓柏油轉泥地時更寬容。"],
    ["差速器", "四驅前後差加速略降 3% 到 6%，避免切換路面時突然打滑。"],
    ["車高", "提高 3% 到 6%，處理高低差路面。"],
  ],
};

function symptom(id, label, chip, templateKey) {
  return { id, label, chip, steps: adviceTemplates[templateKey] };
}

const symptomCategories = [
  {
    id: "steering",
    label: "轉向類症狀",
    description: "入彎、彎中、出彎和方向盤反應相關問題。",
    symptoms: [
      symptom("steering-entry-understeer", "入彎不足（不願切進彎）", "入彎", "steeringUndersteer"),
      symptom("steering-entry-slow", "入彎反應慢", "反應", "steeringSlow"),
      symptom("steering-entry-push", "入彎推頭", "入彎", "steeringUndersteer"),
      symptom("steering-mid-push", "彎中推頭", "彎中", "steeringUndersteer"),
      symptom("steering-exit-push", "出彎推頭", "出彎", "accelUndersteer"),
      symptom("steering-fast-corner-not-turning", "高速大彎彎不過去", "高速", "highSpeedLine"),
      symptom("steering-dull", "方向太鈍", "反應", "steeringSlow"),
      symptom("steering-nervous", "方向太神經質", "敏感", "steeringNervous"),
      symptom("steering-small-correction-hard", "小角度修正困難", "修正", "steeringNervous"),
      symptom("steering-small-angle-weak", "小角度轉向不明顯", "反應", "steeringSlow"),
      symptom("steering-highspeed-float", "高速轉向飄", "高速", "highSpeedFloat"),
      symptom("steering-highspeed-unsafe", "高速轉向不安心", "高速", "highSpeedFloat"),
      symptom("steering-mid-sudden-oversteer", "彎中突然轉向過度", "過度", "steeringOversteer"),
      symptom("steering-mid-constant-correction", "彎中方向需要一直修正", "修正", "steeringNervous"),
      symptom("steering-delay", "轉向延遲", "反應", "steeringSlow"),
      symptom("steering-too-sensitive", "轉向過於敏感", "敏感", "steeringNervous"),
      symptom("steering-front-not-follow", "車頭不願意跟隨方向盤", "推頭", "steeringUndersteer"),
      symptom("steering-understeer", "轉向不足", "推頭", "steeringUndersteer"),
      symptom("steering-oversteer", "轉向過度", "過度", "steeringOversteer"),
    ],
  },
  {
    id: "rear",
    label: "車尾類症狀",
    description: "車尾穩定性、甩尾、滑動和左右晃動。",
    symptoms: [
      symptom("rear-fishtail", "車尾亂甩", "車尾", "rearLoose"),
      symptom("rear-floating", "車尾漂浮感", "漂浮", "rearFloat"),
      symptom("rear-sway", "車尾左右晃動", "晃動", "rearFloat"),
      symptom("rear-unstable", "車尾不穩", "穩定", "rearLoose"),
      symptom("rear-too-active", "車尾過度活躍", "過度", "rearTooFast"),
      symptom("rear-exit-drift", "出彎甩尾", "出彎", "accelOversteer"),
      symptom("rear-lift-off-drift", "收油甩尾", "收油", "steeringOversteer"),
      symptom("rear-highspeed-snap", "高速突然甩尾", "高速", "rearFloat"),
      symptom("rear-highspeed-direction-unstable", "高速變換方向不穩", "高速", "highSpeedLine"),
      symptom("rear-mid-slide", "彎中尾巴一直滑", "彎中", "rearLoose"),
      symptom("rear-throttle-slide", "補油後尾巴滑動", "補油", "accelOversteer"),
      symptom("rear-loses-grip", "車尾容易失去抓地", "抓地", "gripRear"),
      symptom("rear-wiggle", "車尾擺動", "晃動", "rearFloat"),
      symptom("rear-snap-death", "車尾暴斃", "突然", "rearLoose"),
      symptom("rear-too-quick", "車尾反應過快", "反應", "rearTooFast"),
      symptom("rear-lags-front", "車尾跟不上車頭", "協調", "suspensionBoat"),
    ],
  },
  {
    id: "grip",
    label: "抓地力類症狀",
    description: "前後輪、整體、路肩、顛簸與天候抓地。",
    symptoms: [
      symptom("grip-front-low", "前輪抓地不足", "前輪", "gripFront"),
      symptom("grip-rear-low", "後輪抓地不足", "後輪", "gripRear"),
      symptom("grip-all-low", "整體抓地不足", "整體", "gripAll"),
      symptom("grip-exit-low", "出彎抓不住", "出彎", "accelTraction"),
      symptom("grip-highspeed-low", "高速抓地不足", "高速", "highSpeedFloat"),
      symptom("grip-mid-low", "彎中抓地不足", "彎中", "gripAll"),
      symptom("grip-throttle-low", "補油抓地不足", "補油", "accelTraction"),
      symptom("grip-brake-low", "煞車抓地不足", "煞車", "brakeLock"),
      symptom("grip-curb-low", "路肩抓地不足", "路肩", "gripBump"),
      symptom("grip-bumpy-low", "顛簸路面抓地不足", "顛簸", "gripBump"),
      symptom("grip-rain-low", "雨天抓地不足（若有模擬）", "雨天", "gripAll"),
      symptom("grip-tire-slide", "輪胎容易滑動", "輪胎", "gripAll"),
      symptom("grip-limit-low", "輪胎極限太低", "輪胎", "gripAll"),
    ],
  },
  {
    id: "suspension",
    label: "懸吊與車身姿態",
    description: "車身晃動、跳動、觸底、死硬與離地。",
    symptoms: [
      symptom("suspension-boat", "車像船", "晃動", "suspensionBoat"),
      symptom("suspension-body-roll-too-much", "車身晃動過大", "晃動", "suspensionBoat"),
      symptom("suspension-jumpy", "車一直跳", "跳動", "suspensionBump"),
      symptom("suspension-curb-fly", "壓路肩會飛", "路肩", "suspensionBump"),
      symptom("suspension-bump-kick", "壓到凹凸路面會彈開", "顛簸", "suspensionBump"),
      symptom("suspension-crest-unstable", "過坡不穩", "過坡", "highSpeedBump"),
      symptom("suspension-highspeed-bottom", "高速壓縮到底", "觸底", "suspensionBottom"),
      symptom("suspension-landing-lost", "跳躍落地失控", "落地", "suspensionBump"),
      symptom("suspension-roll-large", "車身側傾過大", "側傾", "suspensionBoat"),
      symptom("suspension-left-right", "車身左右晃", "晃動", "suspensionBoat"),
      symptom("suspension-up-down", "車身上下晃", "晃動", "suspensionBump"),
      symptom("suspension-pitch", "車身俯仰過大", "俯仰", "suspensionBoat"),
      symptom("suspension-corner-stiff", "過彎姿態太僵硬", "死硬", "suspensionHard"),
      symptom("suspension-too-stiff", "車身過於死硬", "死硬", "suspensionHard"),
      symptom("suspension-travel-low", "懸吊行程不足", "行程", "suspensionBottom"),
      symptom("suspension-landing-rebound", "落地反彈過大", "反彈", "suspensionBump"),
      symptom("suspension-lift-easy", "車輛容易離地", "離地", "suspensionBump"),
    ],
  },
  {
    id: "brake",
    label: "煞車類症狀",
    description: "煞車推頭、甩尾、鎖死、距離過長與 Trail Braking。",
    symptoms: [
      symptom("brake-unstable", "煞車不穩", "煞車", "brakeUnstable"),
      symptom("brake-understeer", "煞車推頭", "推頭", "brakeUndersteer"),
      symptom("brake-oversteer", "煞車甩尾", "甩尾", "brakeOversteer"),
      symptom("brake-distance-long", "煞車距離過長", "距離", "brakeLock"),
      symptom("brake-entry-not-turning", "入彎煞車轉不進去", "入彎", "brakeUndersteer"),
      symptom("brake-body-wobble", "煞車時車身晃動", "晃動", "brakeUnstable"),
      symptom("brake-heavy-unstable", "重煞不穩", "重煞", "brakeUnstable"),
      symptom("brake-lock", "煞車鎖死", "鎖死", "brakeLock"),
      symptom("brake-trail-unstable", "Trail Braking 不穩", "Trail", "brakeUnstable"),
      symptom("brake-rear-move", "煞車後車尾亂動", "車尾", "brakeOversteer"),
      symptom("brake-highspeed-unstable", "高速煞車不穩", "高速", "brakeUnstable"),
    ],
  },
  {
    id: "acceleration",
    label: "加速類症狀",
    description: "起步、補油、全油門和出彎動力控制。",
    symptoms: [
      symptom("accel-launch-unstable", "起步不穩", "起步", "accelTraction"),
      symptom("launch-spin", "起步打滑", "起步", "accelTraction"),
      symptom("accel-exit-slide", "出彎滑動太多", "出彎", "accelOversteer"),
      symptom("accel-throttle-understeer", "一補油就推頭", "補油", "accelUndersteer"),
      symptom("accel-throttle-oversteer", "一補油就甩尾", "補油", "accelOversteer"),
      symptom("accel-full-throttle-hard", "全油門難控制", "全油門", "accelTraction"),
      symptom("accel-highspeed-float", "高速加速飄", "高速", "accelFloat"),
      symptom("accel-direction-pull", "加速時方向跑掉", "方向", "accelFloat"),
      symptom("accel-power-rough", "動力輸出不順", "動力", "powerDelivery"),
      symptom("accel-cannot-early-throttle", "出彎無法提早補油", "出彎", "accelTraction"),
      symptom("accel-body-unstable", "補油時車身不穩", "補油", "accelFloat"),
      symptom("accel-front-push-out", "補油後車頭往外推", "推頭", "accelUndersteer"),
    ],
  },
  {
    id: "highspeed",
    label: "高速穩定性症狀",
    description: "高速左右飄、過坡、換線、大彎與修正方向。",
    symptoms: [
      symptom("highspeed-left-right-float", "高速左右飄", "高速", "highSpeedFloat"),
      symptom("highspeed-steering-light", "高速方向太輕", "方向", "highSpeedFloat"),
      symptom("highspeed-floating", "高速像浮起來", "漂浮", "highSpeedFloat"),
      symptom("highspeed-road-jump", "高速壓到路面就跳", "顛簸", "highSpeedBump"),
      symptom("highspeed-line-unstable", "高速切線不穩", "切線", "highSpeedLine"),
      symptom("highspeed-fast-corner-unstable", "高速大彎不穩", "大彎", "highSpeedLine"),
      symptom("highspeed-lane-change-unstable", "高速換線不穩", "換線", "highSpeedLine"),
      symptom("highspeed-crest-unstable", "高速過坡不穩", "過坡", "highSpeedBump"),
      symptom("highspeed-curb-unstable", "高速壓路肩不穩", "路肩", "highSpeedBump"),
      symptom("highspeed-correction-hard", "高速修正方向困難", "修正", "highSpeedLine"),
      symptom("highspeed-body-wobble", "高速車身晃動", "晃動", "highSpeedFloat"),
      symptom("highspeed-float-feel", "高速漂浮感", "漂浮", "highSpeedFloat"),
    ],
  },
  {
    id: "fh",
    label: "FH 特有症狀",
    description: "山路、爛路、草地、跳台和路面切換。",
    symptoms: [
      symptom("fh-mountain-lost", "山路容易失控", "山路", "fhMountain"),
      symptom("fh-downhill-brake-hard", "下坡很難煞", "下坡", "fhMountain"),
      symptom("fh-s-corner-slow-correct", "連續彎修正慢", "連續彎", "steeringSlow"),
      symptom("fh-mountain-jump", "山路一直跳", "山路", "fhRough"),
      symptom("fh-rough-road-unstable", "FH 爛路不穩", "爛路", "fhRough"),
      symptom("fh-ramp-fly", "撞坡道就飛", "坡道", "fhRough"),
      symptom("fh-jump-landing-unstable", "跳台落地不穩", "跳台", "fhRough"),
      symptom("fh-grass-lost", "壓草地失控", "草地", "fhTransition"),
      symptom("fh-elevation-unstable", "高低差路面不穩", "高低差", "fhTransition"),
      symptom("fh-tarmac-dirt-unstable", "柏油轉泥地不穩", "路面切換", "fhTransition"),
      symptom("fh-mountain-throttle-unstable", "山路補油不穩", "補油", "accelTraction"),
      symptom("fh-mountain-highspeed-push", "山路高速推頭", "推頭", "steeringUndersteer"),
    ],
  },
  {
    id: "awd-common",
    label: "AWD 常見十大",
    description: "Horizon 四驅玩家最常遇到的快速入口。",
    symptoms: [
      symptom("steering-entry-understeer", "入彎不足", "AWD", "steeringUndersteer"),
      symptom("steering-mid-push", "彎中推頭", "AWD", "steeringUndersteer"),
      symptom("steering-exit-push", "出彎推頭", "AWD", "accelUndersteer"),
      symptom("steering-fast-corner-not-turning", "高速大彎彎不過去", "AWD", "highSpeedLine"),
      symptom("accel-throttle-understeer", "一補油就推頭", "AWD", "accelUndersteer"),
      symptom("rear-fishtail", "車尾亂甩", "AWD", "rearLoose"),
      symptom("rear-exit-drift", "出彎甩尾", "AWD", "accelOversteer"),
      symptom("highspeed-left-right-float", "高速左右飄", "AWD", "highSpeedFloat"),
      symptom("suspension-jumpy", "車一直跳", "AWD", "suspensionBump"),
      symptom("suspension-curb-fly", "壓路肩會飛", "AWD", "suspensionBump"),
    ],
  },
];

const allIssueTypes = Array.from(
  symptomCategories
    .flatMap((category) =>
      category.symptoms.map((issue) => ({
        ...issue,
        categoryId: category.id,
        categoryLabel: category.label,
      })),
    )
    .reduce((issues, issue) => (issues.has(issue.id) ? issues : issues.set(issue.id, issue)), new Map())
    .values(),
);

const settingCards = [
  ["前胎胎壓", "tireFront", "BAR", "熱胎後落在 2.20 到 2.35 BAR 附近為目標"],
  ["後胎胎壓", "tireRear", "BAR", "驅動輪可略低，換取出彎牽引"],
  ["終傳比", "finalDrive", "", "數值越高越偏加速，越低越偏尾速"],
  ["外傾角", "camber", "deg", "前輪通常比後輪更負"],
  ["前後束", "toe", "deg", "前外八提升反應，後內八提升穩定"],
  ["主銷後傾", "caster", "deg", "高角度提升回正與彎中支撐"],
  ["防傾桿", "arb", "%", "百分比是滑桿起點，非固定車種數值"],
  ["彈簧", "spring", "%", "越野偏軟，公路與高速偏硬"],
  ["車高", "ride", "%", "公路越低越穩，越野需要行程"],
  ["回彈阻尼", "rebound", "%", "控制車身轉移速度"],
  ["壓縮阻尼", "bump", "%", "通常低於回彈，避免車身太硬"],
  ["空力", "aero", "%", "下壓越高越穩，但會吃尾速"],
  ["煞車", "brake", "", "前煞比與壓力先保守，再依鎖死調整"],
  ["差速器", "diff", "%", "加速鎖定控制出彎牽引與旋轉"],
];

const ranges = {
  tireFront: [24, 34],
  tireRear: [24, 34],
  finalDrive: [2.4, 5.2],
  camberFront: [-5, 0],
  camberRear: [-4, 0],
  toeFront: [-0.2, 0.35],
  toeRear: [-0.15, 0.35],
  caster: [4, 7],
  arbFront: [1, 100],
  arbRear: [1, 100],
  springFront: [1, 100],
  springRear: [1, 100],
  rideFront: [1, 100],
  rideRear: [1, 100],
  reboundFront: [1, 100],
  reboundRear: [1, 100],
  bumpFront: [1, 100],
  bumpRear: [1, 100],
  aeroFront: [0, 100],
  aeroRear: [0, 100],
  brakeBalance: [40, 60],
  brakePressure: [80, 130],
  diffFrontAccel: [0, 100],
  diffFrontDecel: [0, 100],
  diffRearAccel: [0, 100],
  diffRearDecel: [0, 100],
  diffCenter: [0, 100],
};

function createAdjustmentRanges() {
  return Object.fromEntries(
    Object.entries(DEFAULT_ADJUSTMENT_RANGES).map(([groupId, values]) => [groupId, { ...values }]),
  );
}

function formatAdjustmentNumber(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  if (Object.is(rounded, -0)) return "0";
  if (Math.abs(rounded - Math.round(rounded)) < 0.005) return Math.round(rounded).toString();
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

function adjustmentValueInRange(value) {
  return value >= adjustmentRangeValueLimits[0] && value <= adjustmentRangeValueLimits[1];
}

function normalizeAdjustmentRange(groupId, shouldMutate = false) {
  const defaults = DEFAULT_ADJUSTMENT_RANGES[groupId];
  if (!defaults) return null;

  const current = state.adjustmentRanges[groupId] ?? defaults;
  const normalized = {};
  Object.keys(defaults).forEach((field) => {
    const value = Number(current[field]);
    normalized[field] = clampNumber(
      Number.isFinite(value) ? value : defaults[field],
      adjustmentRangeValueLimits[0],
      adjustmentRangeValueLimits[1],
    );
  });

  if (normalized.frontMin > normalized.frontMax) {
    [normalized.frontMin, normalized.frontMax] = [normalized.frontMax, normalized.frontMin];
  }

  if (normalized.rearMin > normalized.rearMax) {
    [normalized.rearMin, normalized.rearMax] = [normalized.rearMax, normalized.rearMin];
  }

  if (shouldMutate) {
    state.adjustmentRanges[groupId] = normalized;
  }

  return normalized;
}

function adjustmentRangeSummary(groupId) {
  const range = normalizeAdjustmentRange(groupId);
  if (!range) return "";
  return `前 ${formatAdjustmentNumber(range.frontMin)}-${formatAdjustmentNumber(range.frontMax)} / 後 ${formatAdjustmentNumber(
    range.rearMin,
  )}-${formatAdjustmentNumber(range.rearMax)}`;
}

function mappedAdjustmentValue(tuneKey, value) {
  const meta = adjustableTuneKeyMeta[tuneKey];
  if (!meta) return value;

  const baseRange = ranges[tuneKey];
  const customRange = normalizeAdjustmentRange(meta.groupId);
  if (!baseRange || !customRange) return value;

  const [baseMin, baseMax] = baseRange;
  const ratio = baseMax === baseMin ? 0 : clampNumber((value - baseMin) / (baseMax - baseMin), 0, 1);
  const min = customRange[`${meta.side}Min`];
  const max = customRange[`${meta.side}Max`];
  return min + ratio * (max - min);
}

function adjustmentValuePair(frontKey, rearKey, tune) {
  return valuePair(
    formatAdjustmentNumber(mappedAdjustmentValue(frontKey, tune[frontKey])),
    formatAdjustmentNumber(mappedAdjustmentValue(rearKey, tune[rearKey])),
  );
}

function optionById(collection, id) {
  return collection.find((item) => item.id === id);
}

const raceRecommendations = {
  technical: {
    engine: "flatTorque",
    engineWhy: "多彎路線需要彎中與出彎都可控，平坦扭力比較不會突然破壞抓地。",
    drive: "awd",
    driveWhy: "AWD 能提高低速出彎牽引，適合頻繁加減速與連續彎。",
  },
  fast: {
    engine: "highRpm",
    engineWhy: "高速路線需要延伸轉速與尾速，高轉型設定比較容易守住長直線速度。",
    drive: "rwd",
    driveWhy: "RWD 傳動損失較低，車身也更輕快，適合高速公路型配置。",
  },
  rally: {
    engine: "lowEnd",
    engineWhy: "拉力賽常在低中速與鬆散路面補油，低轉扭力能讓車更容易拉出彎。",
    drive: "awd",
    driveWhy: "AWD 在砂石、泥地和跳躍落地後最穩，能減少單軸打滑。",
  },
  crossCountry: {
    engine: "lowEnd",
    engineWhy: "越野路面阻力大，低轉扭力能處理爬坡、落地後再加速和長行程懸吊帶來的速度損失。",
    drive: "awd",
    driveWhy: "AWD 能分散扭力到四輪，越野起伏和混合路面更容易維持牽引。",
  },
  drag: {
    engine: "turboHit",
    engineWhy: "直線加速可以利用渦輪爆發換取中後段推力，但需要用胎壓與差速器壓住打滑。",
    drive: "awd",
    driveWhy: "AWD 起步抓地較好，能把高馬力更快轉成直線加速。",
  },
  drift: {
    engine: "supercharged",
    engineWhy: "甩尾需要可預期的油門反應，機械增壓比突兀渦輪更容易控制角度。",
    drive: "rwd",
    driveWhy: "RWD 最容易用油門控制後輪滑移，是甩尾配置的主要選擇。",
  },
};

function addMods(tune, mods) {
  Object.entries(mods).forEach(([key, value]) => {
    tune[key] = (tune[key] ?? 0) + value;
  });
}

function clampTune(tune) {
  Object.entries(ranges).forEach(([key, [min, max]]) => {
    tune[key] = Math.min(max, Math.max(min, tune[key]));
  });
  return tune;
}

function normalizeVehicleSpecs() {
  const weight = Number(state.carWeight);
  const frontWeight = Number(state.frontWeightPercent);
  const power = Number(state.powerKw);
  const torque = Number(state.torqueNm);
  state.carWeight = clampNumber(Number.isFinite(weight) ? weight : 1500, ...vehicleSpecLimits.carWeight);
  state.frontWeightPercent = Math.round(
    clampNumber(Number.isFinite(frontWeight) ? frontWeight : 52, ...vehicleSpecLimits.frontWeightPercent),
  );
  state.powerKw = Math.round(clampNumber(Number.isFinite(power) ? power : 400, ...vehicleSpecLimits.powerKw));
  state.torqueNm = Math.round(clampNumber(Number.isFinite(torque) ? torque : 650, ...vehicleSpecLimits.torqueNm));
}

function vehicleWeightIndex() {
  return clampNumber((state.carWeight - 1500) / 500, -1.6, 3);
}

function frontWeightIndex() {
  return clampNumber((state.frontWeightPercent - 52) / 10, -1.7, 1.7);
}

function powerIndex() {
  return clampNumber((state.powerKw - 400) / 300, -1.2, 3);
}

function torqueIndex() {
  return clampNumber((state.torqueNm - 650) / 350, -1.2, 3);
}

function vehicleDynamicsMods() {
  normalizeVehicleSpecs();
  const weight = vehicleWeightIndex();
  const frontBias = frontWeightIndex();
  const rearHeavy = Math.max(0, -frontBias);

  return {
    tireFront: weight * 0.35 + frontBias * 0.25,
    tireRear: weight * 0.3 - frontBias * 0.15,
    finalDrive: weight * 0.05,
    arbFront: weight * 2.5 - frontBias * 3,
    arbRear: weight * 2 + frontBias * 5,
    springFront: weight * 7 + frontBias * 8,
    springRear: weight * 6 - frontBias * 4,
    rideFront: weight * 2 + Math.max(0, weight) * 0.5,
    rideRear: weight * 2 + Math.max(0, weight) * 0.5,
    reboundFront: weight * 4 + frontBias * 3,
    reboundRear: weight * 4 - frontBias * 2,
    bumpFront: weight * 3 + frontBias * 2,
    bumpRear: weight * 3 - frontBias * 1.5,
    aeroFront: frontBias * 5,
    aeroRear: -frontBias * 2 + rearHeavy * 4,
    brakeBalance: frontBias * 3.5,
    brakePressure: weight * 4 + Math.abs(frontBias),
    diffFrontAccel: state.drive === "fwd" ? frontBias * 3 : -frontBias,
    diffRearAccel: state.drive === "rwd" ? -frontBias * 3 : frontBias * 2,
    diffCenter: state.drive === "awd" ? frontBias * 5 : 0,
  };
}

function powertrainDynamicsMods() {
  normalizeVehicleSpecs();
  const power = powerIndex();
  const torque = torqueIndex();
  const tractionLoad = Math.max(power, torque);
  const launchLoad = Math.max(0, torque);

  return {
    tireFront: Math.max(0, power) * 0.08,
    tireRear: -Math.max(0, torque) * 0.18,
    finalDrive: -power * 0.04,
    springFront: Math.max(0, power) * 1.2,
    springRear: Math.max(0, torque) * 2.4,
    reboundRear: Math.max(0, torque) * 1.8,
    bumpRear: Math.max(0, torque) * 1.2,
    aeroRear: Math.max(0, power) * 3,
    brakePressure: Math.max(0, power) * 2.5,
    diffRearAccel: state.drive !== "fwd" ? -launchLoad * 2.5 : 0,
    diffFrontAccel: state.drive !== "rwd" ? -launchLoad * 1.5 : 0,
    diffCenter: state.drive === "awd" ? -tractionLoad * 2 : 0,
  };
}

function buildTune() {
  const tune = { ...BASE_TUNE };
  const race = optionById(raceTypes, state.race);
  const tuneFocus = optionById(tuneFocusTypes, state.tuneFocus);
  const engine = optionById(engineCurves, state.engine);
  const drive = optionById(driveTypes, state.drive);
  addMods(tune, race.mods);
  addMods(tune, tuneFocus.mods);
  addMods(tune, engine.mods);
  addMods(tune, drive.mods);
  addMods(tune, vehicleDynamicsMods());
  addMods(tune, powertrainDynamicsMods());

  if (state.race === "drift") {
    tune.diffRearAccel = Math.max(tune.diffRearAccel, 88);
    tune.diffRearDecel = Math.max(tune.diffRearDecel, 72);
    if (state.drive === "awd") tune.diffCenter = 82;
  }

  if (state.race === "drag") {
    tune.camberFront = Math.max(-0.3, tune.camberFront);
    tune.camberRear = Math.max(-0.2, tune.camberRear);
    tune.toeFront = 0;
    tune.toeRear = 0;
    if (state.drive === "fwd") {
      tune.tireFront -= 1.4;
      tune.tireRear += 1.1;
    }
  }

  if ((state.race === "rally" || state.race === "crossCountry") && state.drive !== "awd") {
    tune.diffRearAccel += state.drive === "rwd" ? 4 : 0;
    tune.diffFrontAccel += state.drive === "fwd" ? 4 : 0;
  }

  return clampTune(tune);
}

function renderOptions(containerId, options, groupName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = options
    .map(
      (option) => `
        <div class="option-card">
          <input type="radio" id="${groupName}-${option.id}" name="${groupName}" value="${option.id}" ${
            state[groupName] === option.id ? "checked" : ""
          }>
          <label for="${groupName}-${option.id}">
            <span class="option-title">${option.label}</span>
            <span class="option-subtitle">${option.subtitle}</span>
          </label>
        </div>
      `,
    )
    .join("");

  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      state[groupName] = event.target.value;
      renderSummary();
      renderSelectionPreview();
    });
  });
}

function renderConfigSelect(selectId, options, selectedId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = options
    .map((option) => {
      const selected = option.id === selectedId ? "selected" : "";
      return `<option value="${option.id}" ${selected}>${option.label} - ${option.subtitle}</option>`;
    })
    .join("");
}

function syncConfigControls() {
  renderConfigSelect("raceSelect", raceTypes, state.race);
  renderConfigSelect("tuneFocusSelect", tuneFocusTypes, state.tuneFocus);
  renderConfigSelect("engineSelect", engineCurves, state.engine);
  renderConfigSelect("driveSelect", driveTypes, state.drive);
  syncVehicleInputs();
}

function updateLiveTune() {
  renderResult();
}

function bindConfigSelects() {
  [
    ["raceSelect", "race"],
    ["tuneFocusSelect", "tuneFocus"],
    ["engineSelect", "engine"],
    ["driveSelect", "drive"],
  ].forEach(([selectId, stateKey]) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener("change", () => {
      state[stateKey] = select.value;
      updateLiveTune();
    });
  });
}

function activeIssueCategory() {
  return optionById(symptomCategories, state.activeIssueCategory) ?? symptomCategories[0];
}

function renderIssueCategories() {
  const categoryGrid = document.getElementById("issueCategoryGrid");
  categoryGrid.innerHTML = symptomCategories
    .map((category) => {
      const selectedCount = category.symptoms.filter((issue) => state.issues.has(issue.id)).length;
      return `
        <button class="category-button ${category.id === state.activeIssueCategory ? "is-active" : ""}" type="button" data-category="${category.id}">
          <span>${category.label}</span>
          <span class="category-button-count">${selectedCount}</span>
        </button>
      `;
    })
    .join("");

  categoryGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeIssueCategory = button.dataset.category;
      renderIssueCategories();
      renderIssues();
    });
  });
}

function renderIssues() {
  const category = activeIssueCategory();
  const issueGrid = document.getElementById("issueGrid");
  document.getElementById("activeCategoryLabel").textContent = category.label;
  document.getElementById("activeCategoryDescription").textContent = category.description;
  issueGrid.innerHTML = category.symptoms
    .map(
      (issue) => `
        <div class="issue-card">
          <input type="checkbox" id="issue-${issue.id}" value="${issue.id}" ${
            state.issues.has(issue.id) ? "checked" : ""
          }>
          <label for="issue-${issue.id}">${issue.label}</label>
        </div>
      `,
    )
    .join("");

  issueGrid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      if (event.target.checked) {
        state.issues.add(event.target.value);
      } else {
        state.issues.delete(event.target.value);
      }
      renderIssueCategories();
      renderSelectedIssues();
      renderAdvice();
    });
  });
}

function renderSelectedIssues() {
  const issueLookup = new Map(allIssueTypes.map((issue) => [issue.id, issue]));
  const selected = [...state.issues].map((id) => issueLookup.get(id)).filter(Boolean);
  document.getElementById("selectedIssueCount").textContent = `已選 ${selected.length}`;
  document.getElementById("selectedIssues").innerHTML = selected
    .map((issue) => `<span class="selected-issue-chip">${issue.label}</span>`)
    .join("");
}

function selectedOptions() {
  return {
    race: optionById(raceTypes, state.race),
    tuneFocus: optionById(tuneFocusTypes, state.tuneFocus),
    engine: optionById(engineCurves, state.engine),
    drive: optionById(driveTypes, state.drive),
  };
}

function formatSpecPercent(value) {
  return Math.round(value).toString();
}

function vehicleSpecLabel() {
  normalizeVehicleSpecs();
  return `車重 ${Math.round(state.carWeight)} kg / 前配重 ${formatSpecPercent(state.frontWeightPercent)}% / ${state.powerKw} kW / ${state.torqueNm} N.m`;
}

function vehicleSpecCopyLines() {
  normalizeVehicleSpecs();
  return [
    `車重: ${Math.round(state.carWeight)} kg`,
    `重心 / 前配重: ${formatSpecPercent(state.frontWeightPercent)}%`,
    `後配重: ${formatSpecPercent(100 - state.frontWeightPercent)}%`,
    `馬力: ${state.powerKw} kW`,
    `扭力: ${state.torqueNm} N.m`,
  ];
}

function renderSummary() {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  document.getElementById("summaryRace").textContent = race.label;
  document.getElementById("summaryFocus").textContent = tuneFocus.label;
  document.getElementById("summaryEngine").textContent = engine.label;
  document.getElementById("summaryDrive").textContent = `${drive.label} ${drive.subtitle}`;
  document.getElementById("summaryVehicle").textContent = vehicleSpecLabel();
  document.getElementById("setupTitle").textContent = race.title;
}

function renderSelectionPreview() {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const html = [race.label, tuneFocus.label, engine.label, `${drive.label} ${drive.subtitle}`, vehicleSpecLabel()]
    .map((text) => `<span>${text}</span>`)
    .join("");
  document.getElementById("selectionPreview").innerHTML = html;
  document.getElementById("resultTags").innerHTML = html;
  document.getElementById("liveConfigTags").innerHTML = html;
  document.getElementById("gearTags").innerHTML = html;
  document.getElementById("symptomTags").innerHTML = html;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function recommendationMarkup(option, reason) {
  if (!option) return "";
  return `
    <span>推薦：${escapeHtml(option.label)}</span>
    <span class="recommendation-help" tabindex="0" aria-label="${escapeHtml(reason)}" title="${escapeHtml(reason)}" data-tooltip="${escapeHtml(reason)}">?</span>
  `;
}

function renderRecommendationHints() {
  const recommendation = raceRecommendations[state.race];
  const engineHint = document.getElementById("engineRecommendation");
  const driveHint = document.getElementById("driveRecommendation");

  if (!recommendation) {
    if (engineHint) engineHint.innerHTML = "";
    if (driveHint) driveHint.innerHTML = "";
    return;
  }

  if (engineHint) {
    engineHint.innerHTML = recommendationMarkup(optionById(engineCurves, recommendation.engine), recommendation.engineWhy);
  }

  if (driveHint) {
    driveHint.innerHTML = recommendationMarkup(optionById(driveTypes, recommendation.drive), recommendation.driveWhy);
  }
}

function renderAdjustmentRangeControls() {
  const grid = document.getElementById("adjustmentRangeGrid");
  if (!grid) return;

  grid.innerHTML = adjustmentRangeGroups
    .map((group) => {
      const range = normalizeAdjustmentRange(group.id, true);
      const fields = adjustmentRangeFields
        .map(([field, label]) => {
          const inputId = `adjustment-${group.id}-${field}`;
          return `
            <label class="adjustment-field" for="${inputId}">
              <span>${label}</span>
              <input
                id="${inputId}"
                type="text"
                inputmode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value="${formatAdjustmentNumber(range[field])}"
                data-range-group="${group.id}"
                data-range-field="${field}"
                aria-label="${group.label} ${label}"
              />
            </label>
          `;
        })
        .join("");

      return `
        <article class="adjustment-range-card">
          <div class="adjustment-range-title">${group.label}</div>
          <div class="adjustment-field-grid">${fields}</div>
        </article>
      `;
    })
    .join("");
}

function syncAdjustmentRangeInputs(skipInputId = "") {
  adjustmentRangeGroups.forEach((group) => {
    const range = normalizeAdjustmentRange(group.id, true);
    if (!range) return;

    adjustmentRangeFields.forEach(([field]) => {
      const input = document.getElementById(`adjustment-${group.id}-${field}`);
      if (input && input.id !== skipInputId) input.value = formatAdjustmentNumber(range[field]);
    });
  });
}

function bindAdjustmentRangeInputs() {
  const grid = document.getElementById("adjustmentRangeGrid");
  if (!grid) return;

  grid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("focus", () => input.select());

    input.addEventListener("input", () => {
      if (input.value === "") return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || !adjustmentValueInRange(value)) return;

      const groupId = input.dataset.rangeGroup;
      const field = input.dataset.rangeField;
      state.adjustmentRanges[groupId][field] = value;
      updateLiveTune();
    });

    input.addEventListener("change", () => {
      const groupId = input.dataset.rangeGroup;
      const field = input.dataset.rangeField;
      const defaults = DEFAULT_ADJUSTMENT_RANGES[groupId];
      const value = Number(input.value);
      state.adjustmentRanges[groupId][field] = Number.isFinite(value)
        ? clampNumber(value, adjustmentRangeValueLimits[0], adjustmentRangeValueLimits[1])
        : defaults[field];
      normalizeAdjustmentRange(groupId, true);
      syncAdjustmentRangeInputs();
      updateLiveTune();
    });
  });

  const resetButton = document.getElementById("resetAdjustmentRangesButton");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      state.adjustmentRanges = createAdjustmentRanges();
      syncAdjustmentRangeInputs();
      updateLiveTune();
    });
  }
}

function syncVehicleInputs(skipInputId = "") {
  normalizeVehicleSpecs();
  const weightInput = document.getElementById("carWeightInput");
  const inlineWeightInput = document.getElementById("inlineCarWeightInput");
  const powerKwInput = document.getElementById("powerKwInput");
  const torqueNmInput = document.getElementById("torqueNmInput");
  const frontWeightInput = document.getElementById("frontWeightInput");
  const frontWeightSlider = document.getElementById("frontWeightSlider");
  const frontWeightOutput = document.getElementById("frontWeightOutput");
  const rearWeightOutput = document.getElementById("rearWeightOutput");

  if (weightInput && skipInputId !== "carWeightInput") weightInput.value = Math.round(state.carWeight);
  if (inlineWeightInput && skipInputId !== "inlineCarWeightInput") inlineWeightInput.value = Math.round(state.carWeight);
  if (powerKwInput && skipInputId !== "powerKwInput") powerKwInput.value = state.powerKw;
  if (torqueNmInput && skipInputId !== "torqueNmInput") torqueNmInput.value = state.torqueNm;
  if (frontWeightInput && skipInputId !== "frontWeightInput") frontWeightInput.value = formatSpecPercent(state.frontWeightPercent);
  if (frontWeightSlider && skipInputId !== "frontWeightSlider") frontWeightSlider.value = formatSpecPercent(state.frontWeightPercent);
  if (frontWeightOutput) frontWeightOutput.textContent = `${formatSpecPercent(state.frontWeightPercent)}%`;
  if (rearWeightOutput) rearWeightOutput.textContent = `後配重 ${formatSpecPercent(100 - state.frontWeightPercent)}%`;
}

function specValueInRange(stateKey, value) {
  const [min, max] = vehicleSpecLimits[stateKey] ?? [-Infinity, Infinity];
  return value >= min && value <= max;
}

function defaultSpecValue(stateKey) {
  return {
    carWeight: 1500,
    frontWeightPercent: 52,
    powerKw: 400,
    torqueNm: 650,
  }[stateKey];
}

function bindVehicleInputs() {
  [
    ["carWeightInput", "carWeight"],
    ["inlineCarWeightInput", "carWeight"],
    ["powerKwInput", "powerKw"],
    ["torqueNmInput", "torqueNm"],
    ["frontWeightInput", "frontWeightPercent"],
    ["frontWeightSlider", "frontWeightPercent"],
  ].forEach(([inputId, stateKey]) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "text") {
      input.addEventListener("focus", () => input.select());
    }

    input.addEventListener("input", () => {
      if (input.value === "") return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (input.type !== "range" && !specValueInRange(stateKey, value)) return;
      state[stateKey] = value;
      normalizeVehicleSpecs();
      syncVehicleInputs(input.type === "range" ? "" : inputId);
      updateLiveTune();
    });

    input.addEventListener("change", () => {
      const value = Number(input.value);
      state[stateKey] = Number.isFinite(value) ? value : defaultSpecValue(stateKey);
      syncVehicleInputs();
      updateLiveTune();
    });
  });
}

function gearboxDefaultValue(key) {
  if (key === "gearCount") return 6;
  if (key === "finalDrive") return Number(buildTune().finalDrive.toFixed(2));
  return "";
}

function gearNumber(key) {
  const value = Number(state.gearbox[key]);
  return Number.isFinite(value) ? value : NaN;
}

function gearboxValueInRange(key, value) {
  const [min, max] = gearboxLimits[key] ?? [-Infinity, Infinity];
  return value >= min && value <= max;
}

function formatGearRatio(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}

function syncGearboxInputs(skipInputId = "") {
  const fieldMap = [
    ["gearCountInput", "gearCount"],
    ["gearTopSpeedInput", "topSpeedKmh"],
    ["gearAccel97Input", "accel97"],
    ["gearAccel161Input", "accel161"],
    ["gearFinalDriveInput", "finalDrive"],
  ];

  fieldMap.forEach(([inputId, key]) => {
    const input = document.getElementById(inputId);
    if (!input || inputId === skipInputId) return;
    const value = state.gearbox[key];
    input.value = value === "" ? "" : key === "gearCount" ? Math.round(value) : formatGearRatio(Number(value));
  });
}

function gearboxReady() {
  const values = ["gearCount", "topSpeedKmh", "accel97", "accel161", "finalDrive"].map((key) => gearNumber(key));
  return values.every((value) => Number.isFinite(value) && value > 0) && gearNumber("accel161") > gearNumber("accel97");
}

function combinedGearMod(name, ...sources) {
  return sources.reduce((total, source) => total + (Number(source?.[name]) || 0), 0);
}

function combinedGearMultiplier(baseValue, name, ...sources) {
  return sources.reduce((total, source) => {
    const value = Number(source?.[name]);
    return total + (Number.isFinite(value) ? value - 1 : 0);
  }, baseValue);
}

function raceGearProfile(raceId) {
  return raceGearMods[raceId] ?? raceGearMods.technical;
}

function recommendedGearFinalDrive(tune = buildTune()) {
  const raceGearMod = raceGearProfile(state.race);
  return clampNumber(tune.finalDrive + (Number(raceGearMod.finalDriveBias) || 0), ...gearboxLimits.finalDrive);
}

function prepareGearCalculator() {
  const tune = buildTune();
  state.gearbox.finalDrive = Number(recommendedGearFinalDrive(tune).toFixed(2));
  syncGearboxInputs();
  renderGearCalculator(tune);
}

function focusFirstGearRange(focusId, raceGearMod = {}) {
  const ranges = {
    balanced: [70, 84],
    exitAcceleration: [70, 85],
    brakeReLaunch: [65, 80],
    launch: [60, 75],
    topSpeed: [80, 95],
    highSpeedStability: [76, 90],
    turnIn: [66, 82],
    wetBumpyGrip: [72, 86],
  };
  const focusRange = ranges[focusId] ?? ranges.balanced;
  const raceRange = raceGearMod.firstRange ?? focusRange;
  const raceWeight = 0.58;
  const minTarget = clampNumber(focusRange[0] * (1 - raceWeight) + raceRange[0] * raceWeight, 55, 96);
  const maxTarget = clampNumber(focusRange[1] * (1 - raceWeight) + raceRange[1] * raceWeight, minTarget + 8, 100);
  return [minTarget, maxTarget];
}

function estimateFirstGearTarget({ tuneFocus, engine, accel97, highPullIndex, raceGearMod, focusGearMods, engineGearMods }) {
  const [minTarget, maxTarget] = focusFirstGearRange(tuneFocus.id, raceGearMod);
  const midpoint = (minTarget + maxTarget) / 2;
  const launchPaceAdjust = clampNumber((3.8 - accel97) * 3, -8, 8);
  const highPullAdjust = clampNumber((1.05 - highPullIndex) * 4, -7, 5);
  const profileAdjust = combinedGearMod("firstTarget", raceGearMod, focusGearMods, engineGearMods);
  const engineWindowAdjust = engine.id === "highRpm" ? -2 : engine.id === "lowEnd" ? 2 : 0;
  return clampNumber(midpoint + launchPaceAdjust + highPullAdjust + profileAdjust + engineWindowAdjust, minTarget, maxTarget);
}

function calculateGearRatios() {
  const race = optionById(raceTypes, state.race) ?? raceTypes[0];
  const tuneFocus = optionById(tuneFocusTypes, state.tuneFocus) ?? tuneFocusTypes[0];
  const engine = optionById(engineCurves, state.engine) ?? engineCurves[0];
  const raceGearMod = raceGearProfile(race.id);
  const focusGearMods = tuneFocus.gearMods ?? {};
  const engineGearMods = engine.gearMods ?? {};
  const gearCount = Math.round(clampNumber(gearNumber("gearCount"), ...gearboxLimits.gearCount));
  const topSpeed = clampNumber(gearNumber("topSpeedKmh"), ...gearboxLimits.topSpeedKmh);
  const accel97 = clampNumber(gearNumber("accel97"), ...gearboxLimits.accel97);
  const accel161 = clampNumber(gearNumber("accel161"), ...gearboxLimits.accel161);
  const finalDrive = clampNumber(gearNumber("finalDrive"), ...gearboxLimits.finalDrive);
  const accelGap = Math.max(0.2, accel161 - accel97);
  const highPullIndex = clampNumber(accelGap / Math.max(accel97, 0.1), 0.45, 3.2);
  const highGearAdjust = clampNumber((highPullIndex - 1.05) * 0.18, -0.25, 0.5);
  const gearCountAdjust = gearCount <= 5 ? 0.35 : gearCount >= 8 ? -0.2 : 0;
  const topTargetMultiplier = clampNumber(
    combinedGearMultiplier(1.03, "topTargetMultiplier", raceGearMod, focusGearMods, engineGearMods),
    0.96,
    1.14,
  );
  const topTarget = topSpeed * topTargetMultiplier;
  const firstGearTarget = estimateFirstGearTarget({
    tuneFocus,
    engine,
    accel97,
    highPullIndex,
    raceGearMod,
    focusGearMods,
    engineGearMods,
  });
  const spread = clampNumber(topTarget / firstGearTarget + gearCountAdjust * 0.08, 3.05, 5.35);
  const topRatio = clampNumber(
    (3.05 / finalDrive) * Math.pow(260 / topSpeed, 0.32) +
      combinedGearMod("topRatio", raceGearMod, focusGearMods, engineGearMods),
    0.56,
    1.28,
  );
  const curvePower = clampNumber(
    1 + highGearAdjust * 0.45 + combinedGearMod("curvePower", raceGearMod, focusGearMods, engineGearMods),
    0.78,
    1.35,
  );
  const ratios = [];

  for (let gear = 1; gear <= gearCount; gear += 1) {
    const position = (gearCount - gear) / Math.max(1, gearCount - 1);
    const ratio = topRatio * Math.pow(spread, Math.pow(position, curvePower));
    const shiftKmh = topTarget * (topRatio / ratio);
    ratios.push({ gear, ratio, shiftKmh });
  }

  return {
    gearCount,
    finalDrive,
    spread,
    topTarget,
    firstGearTarget,
    raceLabel: race.label,
    raceNote: raceGearMod.note,
    engineLabel: engine.label,
    tuneFocusLabel: tuneFocus.label,
    ratios,
    note:
      highPullIndex > 1.35
        ? "中高速加速偏慢，高檔齒比會排得更密。"
        : accel97 < 3.2
          ? "低速加速很快，1-2 檔略放長避免補油打滑。"
          : `齒比分布以${tuneFocus.label}為主。`,
  };
}

function renderGearCalculator(tune = buildTune()) {
  const summaryGrid = document.getElementById("gearSummaryGrid");
  const ratioGrid = document.getElementById("gearRatioGrid");
  const finalChip = document.getElementById("gearFinalChip");
  if (!summaryGrid || !ratioGrid || !finalChip) return;

  const finalDrive = Number.isFinite(gearNumber("finalDrive")) ? gearNumber("finalDrive") : recommendedGearFinalDrive(tune);
  finalChip.textContent = `終傳比 ${formatGearRatio(finalDrive)}`;

  if (!gearboxReady()) {
    summaryGrid.innerHTML = `
      <div class="gear-empty">
        填入檔位數、目前極速、1-97 km/h 和 0-161 km/h 秒數後，這裡會用目前建議終傳比重新計算各檔齒比。
      </div>
    `;
    ratioGrid.innerHTML = "";
    return;
  }

  const plan = calculateGearRatios();
  summaryGrid.innerHTML = `
    <article class="gear-summary-card">
      <span>建議終傳比</span>
      <strong>${formatGearRatio(plan.finalDrive)}</strong>
    </article>
    <article class="gear-summary-card">
      <span>最高檔目標</span>
      <strong>${Math.round(plan.topTarget)} km/h</strong>
    </article>
    <article class="gear-summary-card">
      <span>1 檔紅線目標</span>
      <strong>${Math.round(plan.firstGearTarget)} km/h</strong>
    </article>
    <article class="gear-summary-card">
      <span>齒比跨度</span>
      <strong>${formatGearRatio(plan.spread)}</strong>
    </article>
    <article class="gear-summary-card wide">
      <span>判斷</span>
      <strong>${plan.note} ${plan.raceLabel}策略：${plan.raceNote} ${plan.engineLabel}引擎曲線已計入。</strong>
    </article>
  `;

  ratioGrid.innerHTML = plan.ratios
    .map(
      (ratio) => `
        <article class="gear-ratio-card">
          <span>第 ${ratio.gear} 檔</span>
          <strong>${formatGearRatio(ratio.ratio)}</strong>
          <small>約 ${Math.round(ratio.shiftKmh)} km/h 換檔</small>
        </article>
      `,
    )
    .join("");
}

function bindGearboxInputs() {
  [
    ["gearCountInput", "gearCount"],
    ["gearTopSpeedInput", "topSpeedKmh"],
    ["gearAccel97Input", "accel97"],
    ["gearAccel161Input", "accel161"],
    ["gearFinalDriveInput", "finalDrive"],
  ].forEach(([inputId, key]) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("focus", () => input.select());

    input.addEventListener("input", () => {
      if (input.value === "") {
        state.gearbox[key] = "";
        renderGearCalculator();
        return;
      }

      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) return;
      const value = key === "gearCount" ? Math.round(parsed) : parsed;
      if (!gearboxValueInRange(key, value)) return;
      state.gearbox[key] = value;
      renderGearCalculator();
    });

    input.addEventListener("change", () => {
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) {
        state.gearbox[key] = gearboxDefaultValue(key);
      } else {
        const [min, max] = gearboxLimits[key];
        const value = key === "gearCount" ? Math.round(parsed) : parsed;
        state.gearbox[key] = clampNumber(value, min, max);
      }

      syncGearboxInputs();
      renderGearCalculator();
    });
  });
}

function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
  document.getElementById("configPage").classList.toggle("is-hidden", view !== "config");
  document.getElementById("resultPage").classList.toggle("is-hidden", view !== "result");
  document.getElementById("gearPage").classList.toggle("is-hidden", view !== "gear");
  document.getElementById("symptomPage").classList.toggle("is-hidden", view !== "symptoms");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function valuePair(front, rear) {
  return `前 ${front} / 後 ${rear}`;
}

function psiToBar(value) {
  return value * PSI_TO_BAR;
}

function formatValue(key, value) {
  if (key === "tireFront" || key === "tireRear") return psiToBar(value).toFixed(2);
  if (key === "caster") return value.toFixed(1);
  if (key === "finalDrive") return value.toFixed(2);
  if (Math.abs(value) < 1) return value.toFixed(2);
  return Math.round(value).toString();
}

function settingValue(card, tune) {
  switch (card[1]) {
    case "camber":
      return valuePair(tune.camberFront.toFixed(1), tune.camberRear.toFixed(1));
    case "toe":
      return valuePair(tune.toeFront.toFixed(2), tune.toeRear.toFixed(2));
    case "arb":
      return adjustmentValuePair("arbFront", "arbRear", tune);
    case "spring":
      return adjustmentValuePair("springFront", "springRear", tune);
    case "ride":
      return valuePair(Math.round(tune.rideFront), Math.round(tune.rideRear));
    case "rebound":
      return adjustmentValuePair("reboundFront", "reboundRear", tune);
    case "bump":
      return adjustmentValuePair("bumpFront", "bumpRear", tune);
    case "aero":
      return adjustmentValuePair("aeroFront", "aeroRear", tune);
    case "brake":
      return `前 ${Math.round(tune.brakeBalance)}% / 壓力 ${Math.round(tune.brakePressure)}%`;
    case "diff":
      return diffLabel(tune);
    default:
      return formatValue(card[1], tune[card[1]]);
  }
}

function settingUnit(card) {
  return adjustableSettingIds.has(card[1]) ? "" : card[2];
}

function diffLabel(tune) {
  if (state.drive === "fwd") {
    return `前 ${Math.round(tune.diffFrontAccel)} / ${Math.round(tune.diffFrontDecel)}`;
  }

  if (state.drive === "rwd") {
    return `後 ${Math.round(tune.diffRearAccel)} / ${Math.round(tune.diffRearDecel)}`;
  }

  return `前 ${Math.round(tune.diffFrontAccel)}/${Math.round(tune.diffFrontDecel)} 後 ${Math.round(
    tune.diffRearAccel,
  )}/${Math.round(tune.diffRearDecel)} 中 ${Math.round(tune.diffCenter)} 後偏`;
}

function settingExplanation(card, tune) {
  const [label, key, , note] = card;
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const context = `${race.label}、${tuneFocus.label}、${engine.label}、${drive.label}${drive.subtitle ? ` ${drive.subtitle}` : ""}`;
  const specs = `車重 ${Math.round(state.carWeight)} kg、前配重 ${formatSpecPercent(state.frontWeightPercent)}%、${state.powerKw} kW、${state.torqueNm} N.m`;
  const unit = settingUnit(card);
  const rangeText = adjustableSettingIds.has(key) ? `，已依可調範圍 ${adjustmentRangeSummary(key)} 換算` : "";
  const value = `${settingValue(card, tune)}${unit ? ` ${unit}` : ""}${rangeText}，目前調校取向為 ${tuneFocus.label}`;

  switch (key) {
    case "tireFront":
      return `${label} 建議 ${value}，因為 ${context} 搭配 ${specs} 時，前輪需要兼顧轉向反應與熱胎後接地；${note}。`;
    case "tireRear":
      return `${label} 建議 ${value}，因為扭力與驅動配置會影響出彎打滑，後胎壓用來平衡牽引、轉向與滑移容錯；${note}。`;
    case "finalDrive":
      return `${label} 建議 ${value}，因為 ${race.label} 的速度區間、${engine.label} 的出力方式，以及 ${state.powerKw} kW 馬力會一起決定加速與尾速取捨；${note}。`;
    case "camber":
      return `${label} 建議 ${value}，因為 ${race.label} 的彎速與車身重心會改變輪胎接地角度，這個值用來讓彎中外側輪胎更穩定工作；${note}。`;
    case "toe":
      return `${label} 建議 ${value}，因為 ${drive.label} ${drive.subtitle} 需要在入彎反應和高速穩定之間取平衡；${note}。`;
    case "caster":
      return `${label} 建議 ${value}，因為目前配置需要足夠回正力與彎中前輪支撐，同時避免低速轉向太鈍；${note}。`;
    case "arb":
      return `${label} 建議 ${value}，因為 ${race.label}、前配重 ${formatSpecPercent(state.frontWeightPercent)}% 和 ${drive.label} ${drive.subtitle} 會改變前後輪負載轉移，防傾桿用來調整轉向和車尾穩定。`;
    case "spring":
      return `${label} 建議 ${value}，因為車重 ${Math.round(state.carWeight)} kg 與 ${state.torqueNm} N.m 扭力會影響加速蹲伏、落地和彎中支撐；${note}。`;
    case "ride":
      return `${label} 建議 ${value}，因為 ${race.label} 對離地高度和車身穩定需求不同，車重越高也越需要保留壓縮行程；${note}。`;
    case "rebound":
      return `${label} 建議 ${value}，因為目前車重、扭力和賽道類型會影響車身轉移速度，回彈用來控制重心回復節奏；${note}。`;
    case "bump":
      return `${label} 建議 ${value}，因為壓縮阻尼要吸收路面起伏、煞車點頭和加速重心轉移，避免輪胎被頂離地面；${note}。`;
    case "aero":
      return `${label} 建議 ${value}，因為 ${state.powerKw} kW 馬力、${race.label} 的速度區間與驅動配置會影響高速穩定和尾速取捨；${note}。`;
    case "brake":
      return `${label} 建議 ${value}，因為車重 ${Math.round(state.carWeight)} kg、前配重 ${formatSpecPercent(state.frontWeightPercent)}% 和馬力會改變煞車負載，先用保守比例避免鎖死與車尾不穩；${note}。`;
    case "diff":
      return `${label} 建議 ${value}，因為 ${drive.label} ${drive.subtitle}、${engine.label} 與 ${state.torqueNm} N.m 扭力會決定出彎鎖定量，差速器用來控制牽引、推頭和車尾旋轉；${note}。`;
    default:
      return `${label} 建議 ${value}，因為目前配置為 ${context}，並納入 ${specs} 後需要這個起始值；${note}。`;
  }
}

function renderSetup(tune) {
  document.getElementById("setupGrid").innerHTML = settingCards
    .map((card) => {
      const [label, key, , note] = card;
      const unit = settingUnit(card);
      const wide = key === "diff" || key === "brake" ? " wide" : "";
      const explanation = settingExplanation(card, tune);
      const unitMarkup = unit ? `<span class="setting-unit">${unit}</span>` : "";
      return `
        <article class="setting-card${wide}">
          <div>
            <div class="setting-label">${label}</div>
            <div class="setting-value">
              <span>${settingValue(card, tune)}</span>
              ${unitMarkup}
              <span class="setting-help" tabindex="0" aria-label="${escapeHtml(explanation)}" title="${escapeHtml(explanation)}" data-tooltip="${escapeHtml(explanation)}">?</span>
            </div>
          </div>
          <p class="setting-note">${note}</p>
        </article>
      `;
    })
    .join("");
}

function metricValue(name, tune) {
  const weight = vehicleWeightIndex();
  const frontBias = frontWeightIndex();

  switch (name) {
    case "cornerGrip":
      return clampNumber(
        42 + (tune.aeroFront + tune.aeroRear) / 5 - (tune.tireFront + tune.tireRear - 56) * 1.4 - weight * 3 - Math.abs(frontBias) * 2,
        10,
        96,
      );
    case "rotation":
      return clampNumber(
        50 + (tune.arbRear - tune.arbFront) * 0.45 + tune.toeFront * 120 - tune.toeRear * 40 - frontBias * 7 - Math.max(0, weight) * 1.5,
        5,
        96,
      );
    case "launch":
      return clampNumber(
        45 +
          (tune.diffRearAccel + tune.diffFrontAccel) * 0.22 +
          (56 - tune.tireRear - tune.tireFront) * 1.8 -
          Math.max(0, weight) * 2 -
          (state.drive === "rwd" ? Math.max(0, frontBias) * 4 : 0),
        6,
        98,
      );
    case "stability":
      return clampNumber(
        42 + tune.aeroRear * 0.38 + tune.toeRear * 120 - Math.max(0, tune.arbRear - tune.arbFront) * 0.2 + Math.max(0, weight) * 2 - Math.abs(frontBias) * 1.5,
        10,
        98,
      );
    default:
      return 50;
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderMeters(tune) {
  const meters = [
    ["cornerGrip", "彎中抓地"],
    ["rotation", "轉向旋轉"],
    ["launch", "出彎牽引"],
    ["stability", "高速穩定"],
  ];

  document.getElementById("meterGrid").innerHTML = meters
    .map(([key, label]) => {
      const value = Math.round(metricValue(key, tune));
      return `
        <div class="meter">
          <div class="meter-header">
            <span>${label}</span>
            <span class="meter-value">${value}</span>
          </div>
          <div class="meter-track">
            <div class="meter-fill" style="--value: ${value}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPrinciples() {
  const { race, engine, drive } = selectedOptions();
  const principles = [race.principles[0], engine.principle, drive.principle];
  document.getElementById("principleStrip").innerHTML = principles.map((principle) => `<div class="principle">${principle}</div>`).join("");
}

function renderAdvice() {
  const adviceList = document.getElementById("adviceList");
  const selected = issueTypes.filter((issue) => state.issues.has(issue.id));

  if (!selected.length) {
    adviceList.innerHTML = `<div class="advice-empty">選取試車狀況後，這裡會整理成調整順序。</div>`;
    return;
  }

  adviceList.innerHTML = selected
    .map((issue) => {
      const steps = contextualSteps(issue)
        .slice(0, 3)
        .map(([target, text]) => `<li><strong>${target}</strong>：${text}</li>`)
        .join("");
      return `
        <article class="advice-card">
          <h3>
            <span>${issue.label}</span>
            <span class="advice-chip">${issue.chip}</span>
          </h3>
          <ol>${steps}</ol>
        </article>
      `;
    })
    .join("");
}

function contextualSteps(issue) {
  const steps = [...issue.steps];

  if (issue.id === "exit-flat" && state.engine === "turboHit") {
    steps.push(["渦輪遲滯", "把終傳縮短前先試縮短低檔，避免高檔尾速被犧牲太多。"]);
  }

  if (issue.id === "oversteer" && state.drive === "rwd") {
    steps.push(["油門容錯", "後驅車先保住後胎胎壓與後差速器，再調防傾桿。"]);
  }

  if (issue.id === "entry-understeer" && state.drive === "fwd") {
    steps.push(["前驅補救", "若入彎仍推，前差減速降低 2% 到 4%，讓收油時前輪更願意轉。"]);
  }

  if (issue.id === "top-speed" && state.race === "technical") {
    steps.push(["賽道取捨", "多彎賽道不要一次降太多終傳，先用 -0.08 小步測。"]);
  }

  if (issue.id === "drift-angle" && state.race !== "drift") {
    steps.push(["模式確認", "若目標不是甩尾，先只小幅調胎壓與前束，避免破壞正賽穩定。"]);
  }

  return steps;
}

function renderResult() {
  const tune = buildTune();
  renderSummary();
  renderSelectionPreview();
  renderRecommendationHints();
  renderMeters(tune);
  renderPrinciples();
  renderSetup(tune);
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${tuneFocus.label} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...vehicleSpecCopyLines(),
    ...settingCards.map((card) => `${card[0]}: ${settingValue(card, tune)} ${settingUnit(card)}`.trim()),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => flashButton("copyButton", "已複製"))
    .catch(() => flashButton("copyButton", "複製失敗"));
}

function flashButton(id, label) {
  const button = document.getElementById(id);
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1300);
}

function resetAll() {
  state.view = "result";
  state.race = "technical";
  state.tuneFocus = "balanced";
  state.engine = "flatTorque";
  state.drive = "awd";
  state.carWeight = 1500;
  state.frontWeightPercent = 52;
  state.powerKw = 400;
  state.torqueNm = 650;
  state.gearbox = {
    gearCount: 6,
    topSpeedKmh: "",
    accel97: "",
    accel161: "",
    finalDrive: BASE_TUNE.finalDrive,
  };
  state.adjustmentRanges = createAdjustmentRanges();
  state.issues.clear();
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssues();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncVehicleInputs();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");
}

function init() {
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  bindConfigSelects();
  bindVehicleInputs();
  bindGearboxInputs();
  renderAdjustmentRangeControls();
  bindAdjustmentRangeInputs();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncVehicleInputs();
  renderIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");

  document.getElementById("confirmButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("startTestButton").addEventListener("click", () => {
    renderIssueCategories();
    renderIssues();
    renderSelectedIssues();
    renderAdvice();
    setView("symptoms");
  });

  document.getElementById("gearButton").addEventListener("click", () => {
    prepareGearCalculator();
    setView("gear");
  });

  document.getElementById("backButton").addEventListener("click", () => {
    setView("result");
  });

  document.getElementById("backFromGearButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("backToResultButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("resetButton").addEventListener("click", resetAll);

  document.getElementById("clearIssuesButton").addEventListener("click", () => {
    state.issues.clear();
    renderIssues();
    renderAdvice();
  });
}

function renderAdvice() {
  const adviceList = document.getElementById("adviceList");
  const issueLookup = new Map(allIssueTypes.map((issue) => [issue.id, issue]));
  const selected = [...state.issues].map((id) => issueLookup.get(id)).filter(Boolean);

  if (!selected.length) {
    adviceList.innerHTML = `<div class="advice-empty">選取試車狀況後，這裡會整理成調整順序。</div>`;
    return;
  }

  adviceList.innerHTML = selected
    .map((issue) => {
      const steps = contextualSteps(issue)
        .map(([target, text]) => `<li><strong>${target}</strong>：${text}</li>`)
        .join("");
      return `
        <article class="advice-card">
          <h3>
            <span>${issue.label}</span>
            <span class="advice-chip">${issue.chip}</span>
          </h3>
          <ol>${steps}</ol>
        </article>
      `;
    })
    .join("");
}

function contextualSteps(issue) {
  const steps = [...issue.steps];

  if ((issue.id === "exit-flat" || issue.id === "accel-power-rough") && state.engine === "turboHit") {
    steps.push(["渦輪遲滯", "把終傳縮短前先試縮短低檔，避免高檔尾速被犧牲太多。"]);
  }

  if ((issue.id.includes("oversteer") || issue.id.includes("rear")) && state.drive === "rwd") {
    steps.push(["後驅容錯", "後驅車先保住後胎胎壓與後差速器，再調防傾桿。"]);
  }

  if ((issue.id.includes("understeer") || issue.id.includes("push")) && state.drive === "fwd") {
    steps.push(["前驅補救", "若入彎仍推，前差減速降低 2% 到 4%，讓收油時前輪更願意轉。"]);
  }

  if (issue.id.includes("highspeed") && state.race === "technical") {
    steps.push(["賽道取捨", "多彎賽道不要一次犧牲太多尾速或下壓，先用小幅調整測試。"]);
  }

  if (issue.label.includes("甩尾") && state.race !== "drift") {
    steps.push(["模式確認", "若目標不是甩尾，先只小幅調胎壓與前束，避免破壞正賽穩定。"]);
  }

  return steps;
}

function renderResult() {
  const tune = buildTune();
  renderSummary();
  renderSelectionPreview();
  renderRecommendationHints();
  renderMeters(tune);
  renderPrinciples();
  renderSetup(tune);
  renderIssueCategories();
  renderSelectedIssues();
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${tuneFocus.label} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...vehicleSpecCopyLines(),
    ...settingCards.map((card) => `${card[0]}: ${settingValue(card, tune)} ${settingUnit(card)}`.trim()),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => flashButton("copyButton", "已複製"))
    .catch(() => flashButton("copyButton", "複製失敗"));
}

function resetAll() {
  state.view = "result";
  state.race = "technical";
  state.tuneFocus = "balanced";
  state.engine = "flatTorque";
  state.drive = "awd";
  state.carWeight = 1500;
  state.frontWeightPercent = 52;
  state.powerKw = 400;
  state.torqueNm = 650;
  state.gearbox = {
    gearCount: 6,
    topSpeedKmh: "",
    accel97: "",
    accel161: "",
    finalDrive: BASE_TUNE.finalDrive,
  };
  state.adjustmentRanges = createAdjustmentRanges();
  state.activeIssueCategory = "steering";
  state.issues.clear();
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncVehicleInputs();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");
}

function init() {
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  bindConfigSelects();
  bindVehicleInputs();
  bindGearboxInputs();
  renderAdjustmentRangeControls();
  bindAdjustmentRangeInputs();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncVehicleInputs();
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");

  document.getElementById("confirmButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("startTestButton").addEventListener("click", () => {
    renderIssueCategories();
    renderIssues();
    renderSelectedIssues();
    renderAdvice();
    setView("symptoms");
  });

  document.getElementById("gearButton").addEventListener("click", () => {
    prepareGearCalculator();
    setView("gear");
  });

  document.getElementById("backButton").addEventListener("click", () => {
    setView("result");
  });

  document.getElementById("backFromGearButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("backToResultButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("resetButton").addEventListener("click", resetAll);

  document.getElementById("clearIssuesButton").addEventListener("click", () => {
    state.issues.clear();
    renderIssueCategories();
    renderIssues();
    renderSelectedIssues();
    renderAdvice();
  });
}

init();
