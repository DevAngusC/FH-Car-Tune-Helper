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

const state = {
  view: "config",
  race: "technical",
  engine: "flatTorque",
  drive: "awd",
  activeIssueCategory: "steering",
  issues: new Set(),
};

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

const engineCurves = [
  {
    id: "flatTorque",
    label: "平坦扭力型",
    subtitle: "寬廣輸出",
    mods: { finalDrive: -0.05, diffRearAccel: -2, diffFrontAccel: -1, brakePressure: 1 },
    principle: "可用轉速帶寬，終傳不用過短。",
  },
  {
    id: "highRpm",
    label: "高轉馬力型",
    subtitle: "越轉越有力",
    mods: { finalDrive: 0.18, reboundFront: 1, reboundRear: 1, diffRearAccel: 3 },
    principle: "終傳稍短，讓出彎後盡快回到高轉區。",
  },
  {
    id: "turboHit",
    label: "渦輪爆發型",
    subtitle: "中高轉突增",
    mods: { tireRear: -0.3, finalDrive: -0.02, springRear: -2, reboundRear: -2, diffRearAccel: -5, diffCenter: -3 },
    principle: "降低後端尖銳度，避免增壓上來時把車尾打開。",
  },
  {
    id: "supercharged",
    label: "機械增壓線性型",
    subtitle: "直接、可預期",
    mods: { finalDrive: 0.05, arbRear: 1, diffRearAccel: 2 },
    principle: "線性輸出能接受較直接的轉向與差速器反應。",
  },
  {
    id: "lowEnd",
    label: "低轉大扭力型",
    subtitle: "早段推力強",
    mods: { tireRear: -0.4, finalDrive: -0.18, springRear: -2, diffRearAccel: -4, diffCenter: -2 },
    principle: "終傳稍長，讓大扭力更容易落地。",
  },
  {
    id: "instant",
    label: "電動瞬間扭力型",
    subtitle: "零延遲輸出",
    mods: { tireFront: -0.1, tireRear: -0.5, finalDrive: -0.1, diffFrontAccel: -3, diffRearAccel: -7, diffCenter: -5, brakePressure: 3 },
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
      ["後胎胎壓", "降低 0.3 到 0.7 PSI，先找回油門容錯。"],
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
      ["驅動輪胎壓", "降低 0.5 到 1.2 PSI，直線加速先改後輪。"],
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
      ["後胎胎壓", "增加 0.3 到 0.8 PSI，讓車尾更容易維持滑移。"],
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
    ["後胎胎壓", "降低 0.3 到 0.7 PSI，先找回滑移容錯。"],
    ["差速器", "後差加速或減速降低 4% 到 8%，依發生在補油或收油時調整。"],
  ],
  rearLoose: [
    ["後胎胎壓", "降低 0.3 到 0.8 PSI，讓後輪更容易咬地。"],
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
    ["前胎胎壓", "降低 0.2 到 0.5 PSI，熱胎目標仍控制在合理範圍。"],
    ["前外傾", "增加 -0.1 到 -0.3 度，改善彎中接地。"],
    ["前防傾桿", "降低 3% 到 6%，讓前輪在彎中更能貼地。"],
  ],
  gripRear: [
    ["後胎胎壓", "降低 0.3 到 0.7 PSI，先保住牽引。"],
    ["後彈簧與防傾桿", "各降低 3% 到 6%，讓後輪更貼地。"],
    ["後下壓", "高速或大馬力車增加後下壓 3% 到 8%。"],
  ],
  gripAll: [
    ["胎壓", "前後胎壓各降低 0.2 到 0.5 PSI，先觀察熱胎表現。"],
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
    ["胎壓", "鎖死端胎壓降低 0.2 到 0.4 PSI。"],
  ],
  accelTraction: [
    ["驅動輪胎壓", "降低 0.5 到 1.0 PSI，先讓動力落地。"],
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
    ["後胎胎壓", "降低 0.4 到 0.8 PSI。"],
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
    ["胎壓", "前後降低 0.3 到 0.6 PSI，讓柏油轉泥地時更寬容。"],
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
  ["前胎胎壓", "tireFront", "PSI", "熱胎後落在 32 到 34 PSI 附近為目標"],
  ["後胎胎壓", "tireRear", "PSI", "驅動輪可略低，換取出彎牽引"],
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

function optionById(collection, id) {
  return collection.find((item) => item.id === id);
}

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

function buildTune() {
  const tune = { ...BASE_TUNE };
  const race = optionById(raceTypes, state.race);
  const engine = optionById(engineCurves, state.engine);
  const drive = optionById(driveTypes, state.drive);
  addMods(tune, race.mods);
  addMods(tune, engine.mods);
  addMods(tune, drive.mods);

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
    engine: optionById(engineCurves, state.engine),
    drive: optionById(driveTypes, state.drive),
  };
}

function renderSummary() {
  const { race, engine, drive } = selectedOptions();
  document.getElementById("summaryRace").textContent = race.label;
  document.getElementById("summaryEngine").textContent = engine.label;
  document.getElementById("summaryDrive").textContent = `${drive.label} ${drive.subtitle}`;
  document.getElementById("setupTitle").textContent = race.title;
}

function renderSelectionPreview() {
  const { race, engine, drive } = selectedOptions();
  const html = [race.label, engine.label, `${drive.label} ${drive.subtitle}`].map((text) => `<span>${text}</span>`).join("");
  document.getElementById("selectionPreview").innerHTML = html;
  document.getElementById("resultTags").innerHTML = html;
  document.getElementById("symptomTags").innerHTML = html;
}

function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
  document.getElementById("configPage").classList.toggle("is-hidden", view !== "config");
  document.getElementById("resultPage").classList.toggle("is-hidden", view !== "result");
  document.getElementById("symptomPage").classList.toggle("is-hidden", view !== "symptoms");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function valuePair(front, rear) {
  return `前 ${front} / 後 ${rear}`;
}

function formatValue(key, value) {
  if (key === "tireFront" || key === "tireRear" || key === "caster") return value.toFixed(1);
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
      return valuePair(Math.round(tune.arbFront), Math.round(tune.arbRear));
    case "spring":
      return valuePair(Math.round(tune.springFront), Math.round(tune.springRear));
    case "ride":
      return valuePair(Math.round(tune.rideFront), Math.round(tune.rideRear));
    case "rebound":
      return valuePair(Math.round(tune.reboundFront), Math.round(tune.reboundRear));
    case "bump":
      return valuePair(Math.round(tune.bumpFront), Math.round(tune.bumpRear));
    case "aero":
      return valuePair(Math.round(tune.aeroFront), Math.round(tune.aeroRear));
    case "brake":
      return `前 ${Math.round(tune.brakeBalance)}% / 壓力 ${Math.round(tune.brakePressure)}%`;
    case "diff":
      return diffLabel(tune);
    default:
      return formatValue(card[1], tune[card[1]]);
  }
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

function renderSetup(tune) {
  document.getElementById("setupGrid").innerHTML = settingCards
    .map((card) => {
      const [label, key, unit, note] = card;
      const wide = key === "diff" || key === "brake" ? " wide" : "";
      return `
        <article class="setting-card${wide}">
          <div>
            <div class="setting-label">${label}</div>
            <div class="setting-value">
              <span>${settingValue(card, tune)}</span>
              <span class="setting-unit">${unit}</span>
            </div>
          </div>
          <p class="setting-note">${note}</p>
        </article>
      `;
    })
    .join("");
}

function metricValue(name, tune) {
  switch (name) {
    case "cornerGrip":
      return clampNumber(42 + (tune.aeroFront + tune.aeroRear) / 5 - (tune.tireFront + tune.tireRear - 56) * 1.4, 10, 96);
    case "rotation":
      return clampNumber(50 + (tune.arbRear - tune.arbFront) * 0.45 + tune.toeFront * 120 - tune.toeRear * 40, 5, 96);
    case "launch":
      return clampNumber(
        45 + (tune.diffRearAccel + tune.diffFrontAccel) * 0.22 + (56 - tune.tireRear - tune.tireFront) * 1.8,
        6,
        98,
      );
    case "stability":
      return clampNumber(42 + tune.aeroRear * 0.38 + tune.toeRear * 120 - Math.max(0, tune.arbRear - tune.arbFront) * 0.2, 10, 98);
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
  renderMeters(tune);
  renderPrinciples();
  renderSetup(tune);
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...settingCards.map((card) => `${card[0]}: ${settingValue(card, tune)} ${card[2]}`.trim()),
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
  state.view = "config";
  state.race = "technical";
  state.engine = "flatTorque";
  state.drive = "awd";
  state.issues.clear();
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  setView("config");
}

function init() {
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  setView("config");

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

  document.getElementById("backButton").addEventListener("click", () => {
    setView("config");
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
  renderMeters(tune);
  renderPrinciples();
  renderSetup(tune);
  renderIssueCategories();
  renderSelectedIssues();
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...settingCards.map((card) => `${card[0]}: ${settingValue(card, tune)} ${card[2]}`.trim()),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => flashButton("copyButton", "已複製"))
    .catch(() => flashButton("copyButton", "複製失敗"));
}

function resetAll() {
  state.view = "config";
  state.race = "technical";
  state.engine = "flatTorque";
  state.drive = "awd";
  state.activeIssueCategory = "steering";
  state.issues.clear();
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  setView("config");
}

function init() {
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  setView("config");

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

  document.getElementById("backButton").addEventListener("click", () => {
    setView("config");
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
