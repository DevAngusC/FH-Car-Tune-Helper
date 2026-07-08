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

const TUNE_KEYS = Object.keys(BASE_TUNE);
const TUNE_DELTA_EPSILON = 0.0001;

const DEFAULT_GEARBOX = {
  terminalMode: "powerBand",
  spacingMode: "balanced",
  gearCount: 6,
  redlineRpm: 7000,
  peakHpRpm: 6500,
  topSpeedKmh: 312,
  finalDrive: BASE_TUNE.finalDrive,
};

function createDefaultGearbox(overrides = {}) {
  return {
    ...DEFAULT_GEARBOX,
    ...overrides,
  };
}

const DEFAULT_ADJUSTMENT_RANGES = {
  arb: { frontMin: 1, frontMax: 65, rearMin: 1, rearMax: 65 },
  spring: { frontMin: 1, frontMax: 100, rearMin: 1, rearMax: 100 },
  rebound: { frontMin: 1, frontMax: 20, rearMin: 1, rearMax: 20 },
  bump: { frontMin: 1, frontMax: 20, rearMin: 1, rearMax: 20 },
  aero: { frontMin: 0, frontMax: 100, rearMin: 0, rearMax: 100 },
};

const adjustmentRangeGroups = [
  { id: "arb", label: "防傾桿", frontKey: "arbFront", rearKey: "arbRear" },
  { id: "spring", label: "彈簧", frontKey: "springFront", rearKey: "springRear" },
  { id: "rebound", label: "回彈阻尼", frontKey: "reboundFront", rearKey: "reboundRear" },
  { id: "bump", label: "壓縮阻尼", frontKey: "bumpFront", rearKey: "bumpRear" },
  { id: "aero", label: "空力", frontKey: "aeroFront", rearKey: "aeroRear" },
];

const configurableAdjustmentRangeIds = new Set(["spring", "aero"]);
const configurableAdjustmentRangeGroups = adjustmentRangeGroups.filter((group) =>
  configurableAdjustmentRangeIds.has(group.id),
);

const adjustmentRangeFields = [
  ["frontMin", "前最低"],
  ["frontMax", "前最高"],
  ["rearMin", "後最低"],
  ["rearMax", "後最高"],
];

const adjustmentRangeValueLimits = [0, 9999];
const DEFAULT_SPRING_RANGE_LINKED = false;
const adjustableSettingIds = new Set(adjustmentRangeGroups.map((group) => group.id));
const adjustableTuneKeyMeta = Object.fromEntries(
  adjustmentRangeGroups.flatMap((group) => [
    [group.frontKey, { groupId: group.id, side: "front" }],
    [group.rearKey, { groupId: group.id, side: "rear" }],
  ]),
);

const availabilityGroups = [
  {
    id: "alignment",
    label: "定位角",
    tuneKeys: ["camberFront", "camberRear", "toeFront", "toeRear", "caster"],
    settingKeys: ["camber", "toe", "caster"],
    fallbackTargets: ["tire", "antiRoll", "aero"],
  },
  {
    id: "frontArb",
    label: "前防傾桿",
    tuneKeys: ["arbFront"],
    settingKeys: ["arb"],
    fallbackTargets: ["tire", "suspension", "aero"],
  },
  {
    id: "rearArb",
    label: "後防傾桿",
    tuneKeys: ["arbRear"],
    settingKeys: ["arb"],
    fallbackTargets: ["tire", "suspension", "aero", "diff"],
  },
  {
    id: "suspension",
    label: "懸吊",
    tuneKeys: ["springFront", "springRear", "rideFront", "rideRear", "reboundFront", "reboundRear", "bumpFront", "bumpRear"],
    settingKeys: ["spring", "ride", "rebound", "bump"],
    fallbackTargets: ["tire", "antiRoll", "aero"],
  },
  {
    id: "frontAero",
    label: "前空力",
    tuneKeys: ["aeroFront"],
    settingKeys: ["aero"],
    fallbackTargets: ["suspension", "antiRoll", "alignment"],
  },
  {
    id: "rearAero",
    label: "後空力",
    tuneKeys: ["aeroRear"],
    settingKeys: ["aero"],
    fallbackTargets: ["suspension", "antiRoll", "alignment"],
  },
  {
    id: "brake",
    label: "煞車",
    tuneKeys: ["brakeBalance", "brakePressure"],
    settingKeys: ["brake"],
    fallbackTargets: ["tire", "suspension", "diff"],
  },
  {
    id: "diff",
    label: "差速器",
    tuneKeys: ["diffFrontAccel", "diffFrontDecel", "diffRearAccel", "diffRearDecel", "diffCenter"],
    settingKeys: ["diff"],
    fallbackTargets: ["tire", "antiRoll", "suspension", "gearbox"],
  },
  {
    id: "gearbox",
    label: "齒輪箱",
    tuneKeys: ["finalDrive"],
    settingKeys: ["finalDrive"],
    fallbackTargets: ["tire", "diff", "antiRoll", "aero", "suspension"],
  },
];

const availabilityById = Object.fromEntries(availabilityGroups.map((group) => [group.id, group]));
const tuneKeyAvailabilityGroup = Object.fromEntries(
  availabilityGroups.flatMap((group) => group.tuneKeys.map((key) => [key, group.id])),
);
const settingAvailabilityGroups = availabilityGroups.reduce((groups, group) => {
  group.settingKeys.forEach((key) => {
    groups[key] = [...(groups[key] ?? []), group.id];
  });
  return groups;
}, {});
const compensationTargetGroups = {
  tire: [],
  alignment: ["alignment"],
  antiRoll: ["frontArb", "rearArb"],
  suspension: ["suspension"],
  aero: ["frontAero", "rearAero"],
  brake: ["brake"],
  diff: ["diff"],
  gearbox: ["gearbox"],
};

function createAvailability() {
  return Object.fromEntries(availabilityGroups.map((group) => [group.id, true]));
}

const state = {
  view: "config",
  race: "road",
  trackType: 55,
  cornerProfile: "mixed",
  tuneFocus: "balanced",
  tuneFocusIntensity: 100,
  engine: "flatTorque",
  drive: "awd",
  vehicleName: "",
  carWeight: 1500,
  frontWeightPercent: 52,
  frontTireSpec: "245/35R19",
  rearTireSpec: "265/35R19",
  frontTireSizeMm: 245,
  rearTireSizeMm: 265,
  powerKw: 400,
  torqueNm: 650,
  theme: "light",
  language: "zh",
  gearbox: createDefaultGearbox(),
  adjustmentRanges: createAdjustmentRanges(),
  springRangeLinked: DEFAULT_SPRING_RANGE_LINKED,
  availability: createAvailability(),
  symptomMode: "linked",
  activeIssueCategory: "steering",
  issues: new Set(),
  solutionActiveIssueCategory: "steering",
  solutionIssues: new Set(),
  activeEncyclopediaPart: "frontTirePressure",
  appliedSymptomAdjustments: [],
  appliedSymptomAdjustmentSeq: 0,
};

const vehicleSpecLimits = {
  carWeight: [600, 3000],
  frontWeightPercent: [35, 65],
  frontTireSizeMm: [135, 405],
  rearTireSizeMm: [135, 405],
  tireAspectRatio: [20, 80],
  tireWheelInch: [12, 24],
  powerKw: [50, 1500],
  torqueNm: [100, 2500],
};

const routeShapeLimits = {
  trackType: [0, 100],
};

const gearboxLimits = {
  gearCount: [4, 10],
  redlineRpm: [3000, 12000],
  peakHpRpm: [2500, 12000],
  topSpeedKmh: [80, 600],
  finalDrive: [2.2, 6.5],
  gearRatio: [0.48, 6],
};

const tuneFocusIntensityLimits = [0, 150];
const PSI_TO_BAR = 0.0689476;
const LANGUAGE_STORAGE_KEY = "fh6-tune-lab-language";
const SETUP_SAVE_SCHEMA = "fh6-tune-lab-setup";
const SETUP_SAVE_SCHEMA_VERSION = 1;
const SETUP_SAVE_APP_VERSION = "v0.8";

const translations = {
  zh: {
    languageLabel: "語言",
    themeToDark: "切換深色模式",
    themeToLight: "切換淺色模式",
    configIntroTitle: "先選你的車輛配置",
    configIntroCopy: "選好目標比賽、引擎曲線和驅動類型後，按下確認才會產生完整的基礎改車數值。",
    labelRace: "目標比賽",
    labelTrackType: "賽道型態",
    labelCornerProfile: "彎型分布",
    labelEngine: "引擎曲線",
    labelDrive: "驅動類型",
    labelVehicleName: "車輛名稱",
    labelWeightBalance: "車重與重心",
    labelWeight: "車重",
    labelFrontBalance: "重心 / 前配重",
    labelTuneFocus: "調校取向",
    labelFocusIntensity: "取向強度",
    labelPower: "馬力",
    labelTorque: "扭力",
    labelFrontTireSize: "前胎規格",
    labelRearTireSize: "後胎規格",
    configSpecNote: "以車頭承重比例輸入，例如 52 代表前 52% / 後 48%。胎規格請輸入 Forza 顯示格式，例如 265/35R19。",
    buttonGenerate: "產生基礎數值",
    buttonBackConfig: "返回配置",
    buttonStartTest: "車況調校",
    buttonTuneSolutions: "調校應對方案",
    buttonGearCalculator: "齒比計算器",
    buttonCopy: "複製數值",
    buttonSaveJson: "儲存設定",
    buttonLoadJson: "載入設定",
    buttonReset: "重置",
    buttonResetRange: "重設範圍",
    buttonResetAvailability: "全部可調",
    buttonBackBase: "返回基礎數值",
    buttonClearIssues: "清除狀況",
    baseConfigTitle: "基礎配置",
    availabilityTitle: "可調項目",
    availabilityHint: "關閉遊戲中無法調整的項目，工具會改用其他可調項目做保守補償。",
    availabilityOn: "可調",
    availabilityOff: "無法調整",
    rangeTitle: "彈簧 / 空力範圍",
    springRangeLinkLabel: "前後連動",
    springRangeLinkHint: "開啟時前後彈簧範圍會同步。",
    gearTitle: "齒比計算器",
    labelGearCount: "總共有幾個檔位",
    labelRedlineRpm: "紅線 RPM",
    labelPeakHpRpm: "最高馬力 RPM",
    labelTopSpeed: "目標終端速度",
    labelGearSpacingMode: "齒比分布方式",
    gearSpacingTraction: "抓地優先",
    gearSpacingBalanced: "回速銜接",
    gearSpacingRecovery: "快速回速",
    gearSpacingTopSpeed: "馬力帶優先",
    labelTerminalMode: "終端檔位目標",
    terminalModeRedline: "終端上限模式",
    terminalModePowerBand: "延伸餘裕模式",
    labelFinalDrive: "終傳比",
    unitSecond: "秒",
    roadTestTitle: "車況調校",
    solutionTitle: "調校應對方案",
    solutionModeChip: "獨立應對方案",
    symptomGroupLabel: "症狀大項",
    adjustmentDirectionLabel: "修改方向",
    linkedTunePanelLabel: "優化建議數值",
    symptomAdviceHint: "勾選症狀後，這裡會顯示依目前基礎數值優化後的建議。",
    solutionAdviceHint: "勾選你遇到的狀況，這裡會顯示通用調整方向。",
    advicePlanTitle: "修改方向與原因",
    adviceRiskTitle: "可能副作用與風險",
    adviceAdjustmentLabel: "修改",
    adviceReasonLabel: "原因",
    placeholderExample80: "例如 80",
    placeholderExample312: "例如 312",
    placeholderExample6500: "例如 6500",
    placeholderExample7000: "例如 7000",
    placeholderVehicleName: "輸入車輛名稱",
    recommendationPrefix: "推薦：",
    rearBalance: "後配重",
    frontShort: "前",
    rearShort: "後",
    centerShort: "中",
    rearBias: "後偏",
    brakePressure: "壓力",
    tuneFocusNone: "不套用取向",
    tuneFocusLight: "輕度取向",
    tuneFocusStandard: "標準取向",
    tuneFocusStrong: "強化取向",
    tuneFocusAggressive: "激進取向",
    adjustableRange: "可調範圍",
    fixedRange: "固定範圍",
    rangeScaledPrefix: "，已依",
    rangeScaledSuffix: "換算",
    vehicleSpecName: "車輛名稱",
    vehicleSpecWeight: "車重",
    vehicleSpecFront: "前配重",
    vehicleSpecRear: "後配重",
    vehicleSpecPower: "馬力",
    vehicleSpecTorque: "扭力",
    vehicleSpecFrontTire: "前胎",
    vehicleSpecRearTire: "後胎",
    tireSizePrinciple: "前後胎規格會影響機械抓地、承載能力與齒比換算。胎寬會修正基礎調校，胎徑會用來計算驅動輪周長。",
    tuneFocusCopyIntensity: "調校取向強度",
    routeShapeCopy: "賽道型態",
    cornerProfileCopy: "彎型分布",
    cornerProfileStraight: "直線",
    trackTypeValue: "彎道 {value}%",
    trackTypeStraight: "直線多",
    trackTypeCorner: "彎道多",
    copySuccess: "已複製",
    copyFail: "複製失敗",
    saveJsonSuccess: "已下載設定檔",
    loadJsonSuccess: "已載入設定檔",
    loadJsonFail: "設定檔格式無法讀取",
    copyUnavailable: "無法調整",
    settingUnavailable: "無法調整",
    settingPartUnavailable: "部分無法調整",
    settingUnavailableExplanation: "目前標記為無法調整，工具已改用其他可調項目做保守補償。",
    compensationPrefix: "已改用",
    compensationSuffix: "保守補償",
    compensationLimited: "目前可補償項目有限，建議值只能作為保守起點。",
    selectedCount: "已選 {count}",
    adviceEmpty: "選取試車狀況後，這裡會整理成調整順序。",
    linkedTuneEmpty: "勾選車況後，這裡會顯示依目前基礎數值優化後的建議數值。",
    buttonApplySymptomAdjustment: "應用修改",
    applySymptomAdjustmentHint: "套用後會清空目前勾選，並保留已應用症狀標籤。",
    appliedSymptomAdjustmentHint: "目前數值已包含已應用修改。",
    removeAppliedSymptomAdjustment: "取消這次修改：{label}",
    adviceAlternativeTarget: "替代：{target}",
    adviceAlternativeText: "原本可調整「{target}」，但目前標記為不可調。先改用 {fallbacks} 小幅補償，試車後再微調。",
    gearboxUnavailableMessage: "齒輪箱目前標記為不可調，無法產生終傳比或各檔齒比。請先使用其他仍可調項目做保守補償。",
    gearRpmNote: "紅線決定各檔最大拉轉速度，最高馬力 RPM 用來校準升檔後落點與延伸餘裕。",
    gearTopSpeedNote: "輸入你希望最高檔支援的目標速度，再用下方模式決定要貼近紅線或保留動力帶餘裕。",
    gearSpacingModeNote: "進入齒比頁時會先套入目前設定建議方案，可再自行切換。",
    gearTerminalModeNote: "終端上限會讓目標速度碰到紅線；延伸餘裕會讓目標速度落在最高馬力 RPM 到紅線之間。",
    gearEmpty: "填入檔位數、紅線 RPM、最高馬力 RPM 與目標終端速度後，這裡會依基礎配置、建議終傳比與胎規格自動計算齒比。",
    gearSummaryFinal: "建議終傳比",
    gearSummaryTop: "最高檔紅線速度",
    gearSummaryUsable: "目標終端 RPM",
    gearSummaryUsableValue: "動力帶 {percent}%",
    gearSummaryFirst: "1 檔紅線目標",
    gearSummaryRpmWindow: "馬力轉速區",
    gearSummaryShiftDrop: "升檔落點",
    gearSummaryTireCirc: "驅動輪周長",
    gearSummarySpread: "齒比跨度",
    gearSummaryGoal: "自動策略",
    gearDrivenFront: "前輪",
    gearDrivenRear: "後輪",
    gearDrivenAwd: "AWD 混合",
    gearAutoStrategyBalanced: "平衡泛用",
    gearAutoStrategyCorner: "彎道回速",
    gearAutoStrategyLaunch: "起步牽引",
    gearAutoStrategyTopSpeed: "高檔延伸",
    gearAutoStrategyGrip: "抓地穩定",
    gearAutoApplied: "{strategy}已自動套用。",
    gearLabel: "第 {gear} 檔",
    gearShift: "約 {speed} km/h 換檔",
    gearRatioSuggested: "建議 {value}",
    gearTopRedlineSpeed: "最高檔紅線約 {speed} km/h",
    gearBandTarget: "回速目標",
    gearBandRoleLaunch: "起步抓地",
    gearBandRoleCornerTarget: "指定回速檔",
    gearBandRoleLowMid: "出彎回速",
    gearBandRoleMid: "檔位銜接",
    gearBandRoleHigh: "中高速拉伸",
    gearBandRoleTop: "尾速保留",
    gearCornerNote: "彎道回速以 {speed} km/h、{gear} 檔為核心，目標約 {rev}% 紅線區。",
    gearSlowHighPull: "中高速加速偏慢，高檔齒比會排得更密。",
    gearQuickLowSpeed: "低速加速很快，1-2 檔略放長避免補油打滑。",
    gearDefaultNote: "自動策略採用{strategy}，齒比分布以{focus}與 RPM 落點為主。",
    settingExplanationCurrentFocus: "目前調校取向為",
  },
  en: {
    languageLabel: "Language",
    themeToDark: "Switch to dark mode",
    themeToLight: "Switch to light mode",
    configIntroTitle: "Choose Your Car Setup",
    configIntroCopy: "Pick the target event, engine curve, and drivetrain, then generate a base tune.",
    labelRace: "Target Event",
    labelTrackType: "Route Shape",
    labelCornerProfile: "Corner Mix",
    labelEngine: "Engine Curve",
    labelDrive: "Drivetrain",
    labelVehicleName: "Vehicle Name",
    labelWeightBalance: "Weight & Balance",
    labelWeight: "Weight",
    labelFrontBalance: "Front Weight",
    labelTuneFocus: "Tune Focus",
    labelFocusIntensity: "Focus Strength",
    labelPower: "Power",
    labelTorque: "Torque",
    labelFrontTireSize: "Front Tire Spec",
    labelRearTireSize: "Rear Tire Spec",
    configSpecNote: "Use front weight percentage, for example 52 means 52% front / 48% rear. Enter the Forza tire format, for example 265/35R19.",
    buttonGenerate: "Generate Base Tune",
    buttonBackConfig: "Back to Setup",
    buttonStartTest: "Condition Tuning",
    buttonTuneSolutions: "Tuning Response Guide",
    buttonGearCalculator: "Gear Calculator",
    buttonCopy: "Copy Values",
    buttonSaveJson: "Save Setup",
    buttonLoadJson: "Load Setup",
    buttonReset: "Reset",
    buttonResetRange: "Reset Range",
    buttonResetAvailability: "All Adjustable",
    buttonBackBase: "Back to Base Tune",
    buttonClearIssues: "Clear Issues",
    baseConfigTitle: "Base Setup",
    availabilityTitle: "Adjustable Items",
    availabilityHint: "Turn off parts that cannot be adjusted in-game; the tool will compensate conservatively with other adjustable items.",
    availabilityOn: "Adjustable",
    availabilityOff: "Locked",
    rangeTitle: "Spring / Aero Range",
    springRangeLinkLabel: "Link F/R",
    springRangeLinkHint: "Keeps front and rear spring ranges synced.",
    gearTitle: "Gear Ratio Calculator",
    labelGearCount: "Number of Gears",
    labelRedlineRpm: "Redline RPM",
    labelPeakHpRpm: "Peak HP RPM",
    labelTopSpeed: "Target Terminal Speed",
    labelGearSpacingMode: "Gear Spacing Pattern",
    gearSpacingTraction: "Grip priority",
    gearSpacingBalanced: "Recovery balance",
    gearSpacingRecovery: "Quick recovery",
    gearSpacingTopSpeed: "Power-band priority",
    labelTerminalMode: "Terminal Gear Target",
    terminalModeRedline: "Terminal Limit",
    terminalModePowerBand: "Extension Reserve",
    labelFinalDrive: "Final Drive",
    unitSecond: "sec",
    roadTestTitle: "Condition Tuning",
    solutionTitle: "Tuning Response Guide",
    solutionModeChip: "Standalone Guide",
    symptomGroupLabel: "Issue Group",
    adjustmentDirectionLabel: "Adjustment Direction",
    linkedTunePanelLabel: "Optimized Values",
    symptomAdviceHint: "Select issues to show optimized values based on the current base tune.",
    solutionAdviceHint: "Select the issue you are seeing to show general tuning responses.",
    advicePlanTitle: "Adjustment Direction and Reason",
    adviceRiskTitle: "Possible Side Effects and Risks",
    adviceAdjustmentLabel: "Adjustment",
    adviceReasonLabel: "Reason",
    placeholderExample80: "e.g. 80",
    placeholderExample312: "e.g. 312",
    placeholderExample6500: "e.g. 6500",
    placeholderExample7000: "e.g. 7000",
    placeholderVehicleName: "Enter vehicle name",
    recommendationPrefix: "Recommended: ",
    rearBalance: "Rear",
    frontShort: "Front",
    rearShort: "Rear",
    centerShort: "Center",
    rearBias: "rear bias",
    brakePressure: "pressure",
    tuneFocusNone: "No focus",
    tuneFocusLight: "Light focus",
    tuneFocusStandard: "Standard focus",
    tuneFocusStrong: "Strong focus",
    tuneFocusAggressive: "Aggressive focus",
    adjustableRange: "adjustable range",
    fixedRange: "fixed range",
    rangeScaledPrefix: ", scaled to ",
    rangeScaledSuffix: "",
    vehicleSpecName: "Vehicle Name",
    vehicleSpecWeight: "Weight",
    vehicleSpecFront: "Front",
    vehicleSpecRear: "Rear",
    vehicleSpecPower: "Power",
    vehicleSpecTorque: "Torque",
    vehicleSpecFrontTire: "Front Tire",
    vehicleSpecRearTire: "Rear Tire",
    tireSizePrinciple: "Front and rear tire specs affect mechanical grip, load capacity, and gear-ratio conversion. Width adjusts the base tune, while tire diameter calculates driven-wheel circumference.",
    tuneFocusCopyIntensity: "Tune focus strength",
    routeShapeCopy: "Route shape",
    cornerProfileCopy: "Corner mix",
    cornerProfileStraight: "Straight-line",
    trackTypeValue: "{value}% corners",
    trackTypeStraight: "More straights",
    trackTypeCorner: "More corners",
    copySuccess: "Copied",
    copyFail: "Copy failed",
    saveJsonSuccess: "Setup file downloaded",
    loadJsonSuccess: "Setup file loaded",
    loadJsonFail: "Could not read setup file",
    copyUnavailable: "locked",
    settingUnavailable: "Locked",
    settingPartUnavailable: "Partially locked",
    settingUnavailableExplanation: "This item is marked as locked, so the tool is compensating conservatively through other adjustable items.",
    compensationPrefix: "Compensating with",
    compensationSuffix: "",
    compensationLimited: "Available compensation is limited, so use this as a conservative starting point.",
    selectedCount: "{count} selected",
    adviceEmpty: "Select road-test issues and the adjustment order will appear here.",
    linkedTuneEmpty: "Select conditions to show optimized values based on the current base tune.",
    buttonApplySymptomAdjustment: "Apply Changes",
    applySymptomAdjustmentHint: "Applying clears the current selection and keeps the applied issue tags.",
    appliedSymptomAdjustmentHint: "Current values include applied changes.",
    removeAppliedSymptomAdjustment: "Remove this applied change: {label}",
    adviceAlternativeTarget: "Alternative: {target}",
    adviceAlternativeText: "{target} is currently locked. Start by compensating lightly with {fallbacks}, then road-test again.",
    gearboxUnavailableMessage: "The gearbox is marked as locked, so final drive and per-gear ratios cannot be generated. Use other adjustable items for conservative compensation.",
    gearRpmNote: "Redline sets each gear's maximum pull; Peak HP RPM calibrates shift recovery and top-gear reserve.",
    gearTopSpeedNote: "Enter the target speed you want top gear to support, then choose whether it should reach redline or keep power-band reserve.",
    gearSpacingModeNote: "The calculator starts with the recommended pattern for the current setup, then you can switch it manually.",
    gearTerminalModeNote: "Terminal Limit puts the target speed at redline. Extension Reserve puts the target speed between Peak HP RPM and redline.",
    gearEmpty: "Enter gear count, redline RPM, Peak HP RPM, and target terminal speed. The calculator will infer ratios from the base setup, suggested final drive, and tire specs.",
    gearSummaryFinal: "Suggested Final Drive",
    gearSummaryTop: "Top-Gear Redline Speed",
    gearSummaryUsable: "Terminal RPM",
    gearSummaryUsableValue: "Power band {percent}%",
    gearSummaryFirst: "1st-Gear Redline",
    gearSummaryRpmWindow: "HP RPM Window",
    gearSummaryShiftDrop: "Shift Recovery",
    gearSummaryTireCirc: "Driven Tire Circumference",
    gearSummarySpread: "Ratio Spread",
    gearSummaryGoal: "Auto Strategy",
    gearDrivenFront: "front tire",
    gearDrivenRear: "rear tire",
    gearDrivenAwd: "blended AWD tire",
    gearAutoStrategyBalanced: "Balanced general use",
    gearAutoStrategyCorner: "Corner recovery",
    gearAutoStrategyLaunch: "Launch traction",
    gearAutoStrategyTopSpeed: "Upper-gear extension",
    gearAutoStrategyGrip: "Grip stability",
    gearAutoApplied: "{strategy} is applied automatically.",
    gearLabel: "Gear {gear}",
    gearShift: "Shift around {speed} km/h",
    gearRatioSuggested: "Suggested {value}",
    gearTopRedlineSpeed: "Top gear redline around {speed} km/h",
    gearBandTarget: "Recovery target",
    gearBandRoleLaunch: "Launch grip",
    gearBandRoleCornerTarget: "Target recovery gear",
    gearBandRoleLowMid: "Corner-exit recovery",
    gearBandRoleMid: "Gear-to-gear spacing",
    gearBandRoleHigh: "Mid-high pull",
    gearBandRoleTop: "Top-speed reserve",
    gearCornerNote: "Corner recovery centers on {speed} km/h in gear {gear}, targeting about {rev}% of redline.",
    gearSlowHighPull: "Mid-high speed acceleration is slow, so upper gears are packed tighter.",
    gearQuickLowSpeed: "Low-speed acceleration is already quick, so 1st-2nd are slightly longer to reduce wheelspin.",
    gearDefaultNote: "Auto strategy uses {strategy}; ratio spacing mainly follows {focus} and RPM recovery.",
    settingExplanationCurrentFocus: "current tune focus",
  },
};

Object.assign(translations.zh, {
  labelTopSpeed: "目標終端速度",
  gearRpmNote: "紅線決定各檔最大拉轉速度，最高馬力 RPM 用來校準升檔後落點與延伸餘裕。",
  gearTopSpeedNote: "輸入你希望最高檔支援的目標速度，再用下方模式決定要貼近紅線或保留動力帶餘裕。",
  gearEmpty: "填入檔位數、紅線 RPM、最高馬力 RPM 與目標終端速度後，這裡會依基礎配置、建議終傳比與胎規格自動計算齒比。",
  gearSummaryTop: "最高檔齒比上限",
  gearSummaryUsable: "目標終端 RPM",
  gearSummaryUsableValue: "動力帶 {percent}%",
  gearTerminalLong: "終端檔偏長，目標速度時 RPM 低於最高馬力區。",
  gearTerminalShort: "終端檔偏短，目標速度前可能太早接近紅線。",
  gearTerminalOk: "終端檔已對齊最高馬力 RPM 到紅線之間。",
});

Object.assign(translations.en, {
  labelTopSpeed: "Target Terminal Speed",
  gearRpmNote: "Redline sets each gear's maximum pull; Peak HP RPM calibrates shift recovery and top-gear reserve.",
  gearTopSpeedNote: "Enter the target speed you want top gear to support, then choose whether it should reach redline or keep power-band reserve.",
  gearEmpty: "Enter gear count, redline RPM, Peak HP RPM, and target terminal speed. The calculator will infer ratios from the base setup, suggested final drive, and tire specs.",
  gearSummaryTop: "Top-Gear Redline Speed",
  gearSummaryUsable: "Terminal RPM",
  gearSummaryUsableValue: "Power band {percent}%",
  gearTerminalLong: "Top gear is too long; target speed is below the Peak HP range.",
  gearTerminalShort: "Top gear is too short; the car may reach redline before the target speed.",
  gearTerminalOk: "Top gear is aligned between Peak HP RPM and redline.",
});

Object.assign(translations.zh, {
  buttonTuneEncyclopedia: "調校百科",
  encyclopediaEyebrow: "調校百科",
  encyclopediaTitle: "調校百科",
  encyclopediaIntro: "選擇右側部件，查看數值增加或減少會如何影響車輛動態。",
  encyclopediaPartsLabel: "改車部件",
  encyclopediaIncrease: "增加數值",
  encyclopediaDecrease: "減少數值",
  encyclopediaVehicleContext: "車型影響",
  encyclopediaEngineContext: "引擎類型影響",
  encyclopediaPartInteractions: "部件互相影響",
  encyclopediaTireTemperature: "胎溫判讀",
  tireTempCold: "冷",
  tireTempOverheated: "過熱",
  tireTempRead: "判讀",
  tireTempAdjust: "調整",
  encyclopediaAdjustmentTiming: "調整時機",
  encyclopediaCommonMistakes: "常見誤區",
});

Object.assign(translations.en, {
  buttonTuneEncyclopedia: "Tune Wiki",
  encyclopediaEyebrow: "Tune Wiki",
  encyclopediaTitle: "Tuning Encyclopedia",
  encyclopediaIntro: "Select a part on the right to see how increasing or decreasing the value changes vehicle behavior.",
  encyclopediaPartsLabel: "Tuning Parts",
  encyclopediaIncrease: "Increase Value",
  encyclopediaDecrease: "Decrease Value",
  encyclopediaVehicleContext: "Vehicle Layout Impact",
  encyclopediaEngineContext: "Engine Type Impact",
  encyclopediaPartInteractions: "Part Interactions",
  encyclopediaTireTemperature: "Tire Temperature Reading",
  tireTempCold: "Cold",
  tireTempOverheated: "Overheated",
  tireTempRead: "Read",
  tireTempAdjust: "Adjust",
  encyclopediaAdjustmentTiming: "When to Adjust",
  encyclopediaCommonMistakes: "Common Mistakes",
});

const optionTranslations = {
  en: {
    raceTypes: {
      road: {
        label: "Road",
        subtitle: "Asphalt / street / highway mix",
        title: "Road Base Tune",
        principles: ["A road setup keeps a usable balance between corner grip, exit traction, and speed reserve."],
      },
      rally: {
        label: "Rally",
        subtitle: "Mixed surface and jumps",
        title: "Rally Base Tune",
        principles: ["Softer suspension and usable low-end response help the tires stay connected."],
      },
      offroad: {
        label: "Off-road",
        subtitle: "Grass, dirt, and large elevation changes",
        title: "Off-road Base Tune",
        principles: ["Longer low gears and extra travel make throttle easier on rough surfaces."],
      },
      dragQuarter: {
        label: "Quarter-Mile Drag",
        subtitle: "Launch and short sprint",
        title: "Quarter Mile Drag Base Tune",
        principles: ["Dense low gears prioritize launch, traction, and the 1-2 shift."],
      },
      dragHalf: {
        label: "Half-Mile Drag",
        subtitle: "Mid-to-long acceleration",
        title: "Half Mile Drag Base Tune",
        principles: ["Longer upper gears reserve more speed while keeping launch traction usable."],
      },
      drift: {
        label: "Drift",
        subtitle: "Angle, throttle, and recovery",
        title: "Drift Base Tune",
        principles: ["Shorter low-mid gears make throttle angle and recovery more immediate."],
      },
    },
    cornerProfileTypes: {
      mixed: {
        label: "Mixed",
        subtitle: "Balanced corner spread",
        principle: "Mixed corners keep the setup neutral so it can handle different corner speeds.",
      },
      large: {
        label: "Big-Corner Bias",
        subtitle: "High-speed sweepers",
        principle: "Big corners need stability, aero support, and a little more top-speed reserve.",
      },
      medium: {
        label: "Medium-Corner Bias",
        subtitle: "Mid-speed bends",
        principle: "Medium corners reward balanced rotation and low-mid gear recovery.",
      },
      small: {
        label: "Small-Corner Bias",
        subtitle: "Hairpins / tight turns",
        principle: "Small corners need stronger turn-in and shorter recovery gearing.",
      },
    },
    tuneFocusTypes: {
      balanced: { label: "Balanced Baseline", subtitle: "General setup" },
      stability: { label: "Stability", subtitle: "High-speed and braking confidence" },
      agility: { label: "Agility", subtitle: "Faster turn-in response" },
      exit: { label: "Corner Exit", subtitle: "Earlier throttle application" },
      topSpeed: { label: "Top Speed", subtitle: "Long straights" },
      grip: { label: "Grip", subtitle: "Low-grip / bumpy stability" },
    },
    engineCurves: {
      flatTorque: {
        label: "Flat Torque",
        subtitle: "Wide power band",
        principle: "A wide usable rev range does not need an overly short final drive.",
      },
      highRpm: {
        label: "High-RPM Power",
        subtitle: "Stronger near redline",
        principle: "Slightly shorter gearing helps exits climb back into the high-RPM range.",
      },
      turboHit: {
        label: "Turbo Hit",
        subtitle: "Mid-high RPM surge",
        principle: "Softer rear response reduces snap when boost arrives.",
      },
      supercharged: {
        label: "Linear Supercharged",
        subtitle: "Direct and predictable",
        principle: "Linear delivery can accept more direct steering and differential response.",
      },
      lowEnd: {
        label: "Low-End Torque",
        subtitle: "Strong early pull",
        principle: "Slightly longer gearing helps big torque reach the ground.",
      },
      instant: {
        label: "Instant Electric Torque",
        subtitle: "Zero-delay output",
        principle: "Instant torque needs conservative diffs and better driven-wheel grip.",
      },
    },
    driveTypes: {
      fwd: {
        label: "FWD",
        subtitle: "Front-wheel drive",
        principle: "Front tires must steer and pull, so the front needs compliance and the rear helps rotation.",
      },
      rwd: {
        label: "RWD",
        subtitle: "Rear-wheel drive",
        principle: "Rear grip is more valuable than chasing too much rotation.",
      },
      awd: {
        label: "AWD",
        subtitle: "All-wheel drive",
        principle: "Rear-biased torque split reduces AWD understeer while keeping exit traction.",
      },
    },
    availabilityGroups: {
      alignment: "Alignment",
      frontArb: "Front Anti-Roll Bar",
      rearArb: "Rear Anti-Roll Bar",
      suspension: "Suspension",
      frontAero: "Front Aero",
      rearAero: "Rear Aero",
      brake: "Brakes",
      diff: "Differential",
      gearbox: "Gearbox",
    },
    compensationTargets: {
      tire: "tire pressure",
      alignment: "alignment",
      antiRoll: "anti-roll bars",
      suspension: "suspension",
      aero: "aero",
      brake: "brakes",
      diff: "differential",
      gearbox: "gearbox",
    },
    adjustmentRangeGroups: {
      arb: "Anti-Roll Bars",
      spring: "Springs",
      rebound: "Rebound Damping",
      bump: "Bump Damping",
      aero: "Aero",
    },
    adjustmentRangeFields: {
      frontMin: "Front Min",
      frontMax: "Front Max",
      rearMin: "Rear Min",
      rearMax: "Rear Max",
    },
    settingCards: {
      tireFront: ["Front Tire Pressure", "Warm tire target around 1.90-2.05 BAR."],
      tireRear: ["Rear Tire Pressure", "Balances traction, rotation, and slide tolerance."],
      finalDrive: ["Final Drive", "Shorter improves acceleration; longer protects top speed."],
      camber: ["Camber", "Keeps the outside tires working through corners."],
      toe: ["Toe", "Fine-tunes turn-in response and straight-line stability."],
      caster: ["Caster", "Adds self-aligning feel and front-end support."],
      arb: ["Anti-Roll Bars", "Uses the fixed 1-65 scale."],
      spring: ["Springs", "Scaled to your adjustable spring range."],
      ride: ["Ride Height", "Keeps enough travel for bumps and landings."],
      rebound: ["Rebound Damping", "Uses the fixed 1-20 scale."],
      bump: ["Bump Damping", "Uses the fixed 1-20 scale."],
      aero: ["Aero", "Trades high-speed grip against top-speed drag."],
      brake: ["Brakes", "Starts conservative to avoid lock-up and rear instability."],
      diff: ["Differential", "Controls traction, understeer, and rear rotation."],
    },
    meters: {
      cornerGrip: "Mid-Corner Grip",
      rotation: "Rotation",
      launch: "Exit Traction",
      stability: "High-Speed Stability",
    },
    raceGearNotes: {
      road: "Keeps low-mid response and upper-gear reserve balanced for mixed road routes.",
      rally: "Keeps low-mid response without making 1st too short on loose surfaces.",
      offroad: "Slightly lengthens low gears and keeps upper stretch for rough terrain.",
      dragQuarter: "Targets a lower 1st-gear redline and denser low gears for launch priority.",
      dragHalf: "Adds upper-gear reserve so the car can keep accelerating deeper into the run.",
      drift: "Shortens low-mid gears and reduces top-speed reserve for throttle rhythm.",
    },
  },
};

const symptomCategoryTranslations = {
  en: {
    steering: {
      label: "Steering Issues",
      description: "Corner entry, mid-corner, exit, and steering-wheel response issues.",
    },
    rear: {
      label: "Rear-End Issues",
      description: "Rear stability, drifting, sliding, and side-to-side movement.",
    },
    grip: {
      label: "Grip Issues",
      description: "Front, rear, overall, curb, bump, and weather-related grip.",
    },
    suspension: {
      label: "Suspension & Body",
      description: "Body roll, bouncing, bottoming out, stiffness, and airtime.",
    },
    brake: {
      label: "Brake Issues",
      description: "Brake understeer, oversteer, lock-up, distance, and trail braking.",
    },
    acceleration: {
      label: "Acceleration Issues",
      description: "Launch, throttle pickup, full throttle, and corner-exit power control.",
    },
    highspeed: {
      label: "High-Speed Stability",
      description: "Floating, crests, lane changes, fast bends, and steering corrections.",
    },
    fh: {
      label: "Horizon-Specific Issues",
      description: "Mountain roads, rough roads, grass, jumps, and surface changes.",
    },
    "awd-common": {
      label: "Common AWD Issues",
      description: "Quick picks for common Horizon AWD behavior.",
    },
  },
};

const symptomChipTranslations = {
  en: {
    入彎: "Entry",
    彎中: "Mid-corner",
    出彎: "Exit",
    高速: "High speed",
    反應: "Response",
    敏感: "Sensitive",
    修正: "Correction",
    過度: "Oversteer",
    推頭: "Understeer",
    車尾: "Rear",
    漂浮: "Float",
    晃動: "Sway",
    穩定: "Stability",
    收油: "Lift-off",
    補油: "Throttle",
    抓地: "Grip",
    突然: "Snap",
    協調: "Balance",
    前輪: "Front",
    後輪: "Rear",
    整體: "Overall",
    煞車: "Brake",
    路肩: "Curb",
    顛簸: "Bumpy",
    雨天: "Wet",
    輪胎: "Tire",
    跳動: "Bounce",
    過坡: "Crest",
    觸底: "Bottoming",
    落地: "Landing",
    側傾: "Roll",
    俯仰: "Pitch",
    死硬: "Stiff",
    行程: "Travel",
    反彈: "Rebound",
    離地: "Airtime",
    甩尾: "Drift",
    距離: "Distance",
    重煞: "Heavy braking",
    鎖死: "Lock-up",
    起步: "Launch",
    全油門: "Full throttle",
    動力: "Power",
    方向: "Direction",
    切線: "Line",
    換線: "Lane change",
    大彎: "Fast bend",
    山路: "Mountain",
    下坡: "Downhill",
    連續彎: "Linked corners",
    爛路: "Rough",
    坡道: "Ramp",
    跳台: "Jump",
    草地: "Grass",
    高低差: "Elevation",
    路面切換: "Surface change",
    AWD: "AWD",
    Trail: "Trail",
  },
};

const symptomLabelTranslations = {
  en: {
    "steering-entry-understeer": "Entry understeer",
    "steering-entry-slow": "Slow turn-in response",
    "steering-entry-push": "Pushes wide on entry",
    "steering-mid-push": "Mid-corner understeer",
    "steering-exit-push": "Exit understeer",
    "steering-fast-corner-not-turning": "Won't turn through fast bends",
    "steering-dull": "Steering feels dull",
    "steering-nervous": "Steering feels nervous",
    "steering-small-correction-hard": "Small corrections are difficult",
    "steering-small-angle-weak": "Small steering inputs feel weak",
    "steering-highspeed-float": "Steering floats at high speed",
    "steering-highspeed-unsafe": "Steering feels unsafe at high speed",
    "steering-mid-sudden-oversteer": "Sudden mid-corner oversteer",
    "steering-mid-constant-correction": "Constant mid-corner corrections",
    "steering-delay": "Delayed steering response",
    "steering-too-sensitive": "Steering is too sensitive",
    "steering-front-not-follow": "Front end won't follow steering input",
    "steering-understeer": "Understeer",
    "steering-oversteer": "Oversteer",
    "rear-fishtail": "Rear fishtailing",
    "rear-floating": "Rear feels floaty",
    "rear-sway": "Rear sways side to side",
    "rear-unstable": "Unstable rear end",
    "rear-too-active": "Rear is too active",
    "rear-exit-drift": "Exit oversteer",
    "rear-lift-off-drift": "Lift-off oversteer",
    "rear-highspeed-snap": "High-speed rear snap",
    "rear-highspeed-direction-unstable": "Unstable direction changes at high speed",
    "rear-mid-slide": "Rear keeps sliding mid-corner",
    "rear-throttle-slide": "Rear slides on throttle",
    "rear-loses-grip": "Rear loses grip easily",
    "rear-wiggle": "Rear end wiggles",
    "rear-snap-death": "Rear snaps suddenly",
    "rear-too-quick": "Rear reacts too quickly",
    "rear-lags-front": "Rear lags behind the front end",
    "grip-front-low": "Low front grip",
    "grip-rear-low": "Low rear grip",
    "grip-all-low": "Low overall grip",
    "grip-exit-low": "Poor corner-exit grip",
    "grip-highspeed-low": "Low high-speed grip",
    "grip-mid-low": "Low mid-corner grip",
    "grip-throttle-low": "Low grip on throttle",
    "grip-brake-low": "Low grip under braking",
    "grip-curb-low": "Low grip over curbs",
    "grip-bumpy-low": "Low grip on bumpy roads",
    "grip-rain-low": "Low wet grip",
    "grip-tire-slide": "Tires slide easily",
    "grip-limit-low": "Tire grip limit feels too low",
    "suspension-boat": "Boat-like body motion",
    "suspension-body-roll-too-much": "Too much body movement",
    "suspension-jumpy": "Car keeps bouncing",
    "suspension-curb-fly": "Car gets launched off curbs",
    "suspension-bump-kick": "Bumps kick the car off line",
    "suspension-crest-unstable": "Unstable over crests",
    "suspension-highspeed-bottom": "High-speed bottoming out",
    "suspension-landing-lost": "Loss of control on landing",
    "suspension-roll-large": "Excessive body roll",
    "suspension-left-right": "Body sways side to side",
    "suspension-up-down": "Body bounces vertically",
    "suspension-pitch": "Excessive pitch",
    "suspension-corner-stiff": "Too stiff through corners",
    "suspension-too-stiff": "Body feels too stiff",
    "suspension-travel-low": "Not enough suspension travel",
    "suspension-landing-rebound": "Too much rebound after landing",
    "suspension-lift-easy": "Car gets airborne too easily",
    "brake-unstable": "Unstable braking",
    "brake-understeer": "Understeer under braking",
    "brake-oversteer": "Oversteer under braking",
    "brake-distance-long": "Braking distance is too long",
    "brake-entry-not-turning": "Won't turn while braking into corners",
    "brake-body-wobble": "Body wobbles under braking",
    "brake-heavy-unstable": "Unstable under heavy braking",
    "brake-lock": "Brake lock-up",
    "brake-trail-unstable": "Unstable trail braking",
    "brake-rear-move": "Rear moves around under braking",
    "brake-highspeed-unstable": "Unstable high-speed braking",
    "accel-launch-unstable": "Unstable launch",
    "launch-spin": "Launch wheelspin",
    "accel-exit-slide": "Too much exit slide",
    "accel-throttle-understeer": "Understeer on throttle",
    "accel-throttle-oversteer": "Oversteer on throttle",
    "accel-full-throttle-hard": "Full throttle is hard to control",
    "accel-highspeed-float": "Floats under high-speed acceleration",
    "accel-direction-pull": "Pulls off line under acceleration",
    "accel-power-rough": "Rough power delivery",
    "accel-cannot-early-throttle": "Cannot apply throttle early on exit",
    "accel-body-unstable": "Body unstable under throttle",
    "accel-front-push-out": "Front pushes wide on throttle",
    "highspeed-left-right-float": "Floats left and right at high speed",
    "highspeed-steering-light": "Steering feels light at speed",
    "highspeed-floating": "Car feels like it is floating",
    "highspeed-road-jump": "Car hops over road bumps at high speed",
    "highspeed-line-unstable": "Line is unstable at high speed",
    "highspeed-fast-corner-unstable": "Unstable in fast bends",
    "highspeed-lane-change-unstable": "Unstable high-speed lane changes",
    "highspeed-crest-unstable": "Unstable over high-speed crests",
    "highspeed-curb-unstable": "Unstable over high-speed curbs",
    "highspeed-correction-hard": "Hard to correct steering at high speed",
    "highspeed-body-wobble": "High-speed body wobble",
    "highspeed-float-feel": "Floaty feel at high speed",
    "fh-mountain-lost": "Easy to lose control on mountain roads",
    "fh-downhill-brake-hard": "Hard to brake downhill",
    "fh-s-corner-slow-correct": "Slow correction through linked corners",
    "fh-mountain-jump": "Car keeps hopping on mountain roads",
    "fh-rough-road-unstable": "Unstable on rough Horizon roads",
    "fh-ramp-fly": "Car launches when hitting ramps",
    "fh-jump-landing-unstable": "Unstable after jump landings",
    "fh-grass-lost": "Loses control when touching grass",
    "fh-elevation-unstable": "Unstable over elevation changes",
    "fh-tarmac-dirt-unstable": "Unstable transitioning from tarmac to dirt",
    "fh-mountain-throttle-unstable": "Unstable under throttle on mountain roads",
    "fh-mountain-highspeed-push": "High-speed understeer on mountain roads",
  },
};

const recommendationReasonTranslations = {
  en: {
    road: {
      engineWhy: "Road routes mix straights and corners, so a broad torque band stays predictable across more speeds.",
      driveWhy: "AWD gives a safe baseline for mixed road layouts and repeated corner exits.",
    },
    rally: {
      engineWhy: "Loose mixed surfaces need early torque and quick recovery after bumps.",
      driveWhy: "AWD gives the most consistent traction when surface grip changes.",
    },
    offroad: {
      engineWhy: "Off-road routes need low-end torque to recover from grass, dirt, jumps, and elevation changes.",
      driveWhy: "AWD gives control over uneven surfaces and landing traction.",
    },
    dragQuarter: {
      engineWhy: "A turbo-hit curve prioritizes hard acceleration once boost is loaded.",
      driveWhy: "AWD launches harder and reduces wheelspin during the first shift.",
    },
    dragHalf: {
      engineWhy: "High-RPM power keeps pulling deeper into the half-mile run.",
      driveWhy: "RWD reduces drivetrain loss once launch traction is under control.",
    },
    drift: {
      engineWhy: "Linear supercharged delivery makes throttle angle easier to hold.",
      driveWhy: "RWD gives predictable rotation and easier angle control.",
    },
  },
};

function localizedSymptomCategory(category) {
  const translated = symptomCategoryTranslations[currentLanguage()]?.[category.id];
  if (!translated) return category;
  return { ...category, ...translated };
}

function localizedSymptom(issue) {
  const language = currentLanguage();
  if (language !== "en") return issue;

  return {
    ...issue,
    label: symptomLabelTranslations.en[issue.id] ?? issue.label,
    chip: symptomChipTranslations.en[issue.chip] ?? issue.chip,
  };
}

function localizedRecommendationReason(reasonKey, fallbackReason) {
  return recommendationReasonTranslations[currentLanguage()]?.[state.race]?.[reasonKey] ?? fallbackReason;
}

const raceTypes = [
  {
    id: "road",
    label: "公路",
    subtitle: "柏油 / 街道 / 高速混合",
    title: "公路基礎值",
    defaultTrackType: 55,
    defaultCornerProfile: "mixed",
    mods: {
      tireFront: -0.12,
      tireRear: -0.08,
      finalDrive: 0.06,
      camberFront: -0.16,
      camberRear: -0.1,
      toeRear: 0.01,
      caster: 0.12,
      arbFront: -1,
      arbRear: 1,
      springFront: 1,
      springRear: 1,
      rideFront: -3,
      rideRear: -3,
      reboundFront: 1,
      reboundRear: 1,
      aeroFront: 2,
      aeroRear: 3,
      brakePressure: 1,
    },
    principles: ["公路設定先保留平衡基準", "賽道型態拉桿決定直線與彎道權重", "彎型分布再細分高速彎或低速彎需求"],
  },
  {
    id: "rally",
    label: "拉力",
    subtitle: "柏油 / 砂石混合",
    title: "拉力基礎值",
    defaultTrackType: 65,
    defaultCornerProfile: "medium",
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
    id: "offroad",
    label: "越野",
    subtitle: "草地、泥地、大落差",
    title: "越野基礎值",
    defaultTrackType: 45,
    defaultCornerProfile: "mixed",
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
    id: "dragQuarter",
    label: "直線 Quarter Mile",
    subtitle: "短直線 / 起步優先",
    title: "直線 Quarter Mile 基礎值",
    defaultTrackType: 0,
    defaultCornerProfile: "mixed",
    mods: {
      tireFront: 1.0,
      tireRear: -1.8,
      finalDrive: 0.42,
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
      diffRearAccel: 34,
      diffRearDecel: -8,
    },
    principles: ["起步與 1-2 檔銜接優先", "驅動輪低胎壓換起步抓地", "空力阻力壓低，差速器加速鎖定提高"],
  },
  {
    id: "dragHalf",
    label: "直線 Half Mile",
    subtitle: "中後段延伸",
    title: "直線 Half Mile 基礎值",
    defaultTrackType: 0,
    defaultCornerProfile: "mixed",
    mods: {
      tireFront: 0.8,
      tireRear: -1.25,
      finalDrive: -0.02,
      camberFront: 1.55,
      camberRear: 1.05,
      toeFront: 0,
      toeRear: -0.03,
      caster: -0.35,
      arbFront: -4,
      arbRear: -10,
      springFront: 7,
      springRear: -6,
      rideFront: -2,
      rideRear: -6,
      reboundFront: 7,
      reboundRear: -6,
      bumpFront: -4,
      bumpRear: -6,
      aeroFront: -32,
      aeroRear: -28,
      brakePressure: -5,
      diffRearAccel: 26,
      diffRearDecel: -6,
    },
    principles: ["中後段拉伸與尾速優先", "低阻力與穩定直線姿態比短齒更重要", "驅動輪仍保留起步抓地餘量"],
  },
  {
    id: "drift",
    label: "甩尾",
    subtitle: "角度、油門、回正",
    title: "甩尾基礎值",
    defaultTrackType: 60,
    defaultCornerProfile: "mixed",
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

const cornerProfileTypes = [
  {
    id: "mixed",
    label: "混合",
    subtitle: "大中小彎平均",
    mods: {},
    gearMods: {},
    principle: "彎型混合時保留中性配置，讓賽道型態拉桿主導直線與彎道取捨。",
  },
  {
    id: "large",
    label: "大彎多",
    subtitle: "高速長彎",
    mods: {
      finalDrive: -0.08,
      camberFront: -0.08,
      camberRear: -0.08,
      toeFront: -0.01,
      toeRear: 0.03,
      caster: 0.15,
      arbFront: 2,
      arbRear: 1,
      springFront: 3,
      springRear: 3,
      rideFront: -2,
      rideRear: -2,
      reboundFront: 2,
      reboundRear: 2,
      aeroFront: 4,
      aeroRear: 8,
      diffRearAccel: -2,
      diffCenter: 2,
    },
    gearMods: { firstTarget: 3, topTargetMultiplier: 1.04, topRatio: -0.03, curvePower: 0.04, finalDriveBias: -0.04 },
    principle: "大彎多時優先高速穩定、長時間側向支撐與尾速延伸。",
  },
  {
    id: "medium",
    label: "中彎多",
    subtitle: "中速連續彎",
    mods: {
      tireFront: -0.1,
      tireRear: -0.08,
      finalDrive: 0.04,
      camberFront: -0.12,
      camberRear: -0.08,
      toeFront: 0.01,
      caster: 0.12,
      arbFront: -1,
      arbRear: 1,
      aeroFront: 3,
      aeroRear: 4,
      diffRearAccel: 1,
    },
    gearMods: { firstTarget: -1, topTargetMultiplier: 1.01, topRatio: 0.01, curvePower: -0.02, finalDriveBias: 0.02 },
    principle: "中彎多時維持轉向、彎中抓地與出彎牽引的平均平衡。",
  },
  {
    id: "small",
    label: "小彎多",
    subtitle: "低速急彎 / 髮夾彎",
    mods: {
      tireFront: -0.22,
      tireRear: -0.12,
      finalDrive: 0.18,
      camberFront: -0.22,
      toeFront: 0.03,
      caster: 0.22,
      arbFront: -3,
      arbRear: 3,
      springFront: -2,
      reboundFront: -1,
      aeroFront: 3,
      aeroRear: 2,
      brakeBalance: -1,
      brakePressure: -2,
      diffRearAccel: -3,
      diffFrontAccel: -3,
      diffCenter: -3,
    },
    gearMods: { firstTarget: -5, topTargetMultiplier: 0.99, topRatio: 0.04, curvePower: -0.08, finalDriveBias: 0.06 },
    principle: "小彎多時優先入彎反應、低速旋轉與出彎回速。",
  },
];

const raceGearMods = {
  road: {
    firstRange: [70, 86],
    firstTarget: 0,
    topTargetMultiplier: 1.03,
    topRatio: -0.01,
    curvePower: 0,
    finalDriveBias: 0.01,
    note: "公路會保留平衡齒比，再依賽道型態與彎型分布決定低檔密度和高檔延伸。",
  },
  rally: {
    firstRange: [68, 84],
    firstTarget: 1,
    topTargetMultiplier: 1.02,
    topRatio: 0.03,
    curvePower: -0.02,
    finalDriveBias: 0.05,
    note: "拉力需要低中檔反應，但一檔不會太短，避免鬆散路面補油空轉。",
  },
  offroad: {
    firstRange: [72, 88],
    firstTarget: 3,
    topTargetMultiplier: 1,
    topRatio: 0.04,
    curvePower: 0.06,
    finalDriveBias: 0.03,
    note: "越野會略放長低檔並保留高檔延展，減少草地、泥地和跳躍後的扭力突兀感。",
  },
  dragQuarter: {
    firstRange: [56, 72],
    firstTarget: -8,
    topTargetMultiplier: 1.02,
    topRatio: 0.04,
    curvePower: -0.14,
    finalDriveBias: 0.14,
    note: "Quarter Mile 會讓一檔紅線目標偏低，低檔更密，讓起步與 1-2 檔銜接優先。",
  },
  dragHalf: {
    firstRange: [70, 88],
    firstTarget: 3,
    topTargetMultiplier: 1.1,
    topRatio: -0.09,
    curvePower: 0.1,
    finalDriveBias: -0.09,
    note: "Half Mile 會拉長高檔並提高尾速預留，中後段延伸比短距離起步更重要。",
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
    label: "平衡",
    subtitle: "泛用設定",
    mods: {},
    gearMods: {},
    reason: "不特別偏向某一項能力，適合先建立穩定基準後再依試車狀況微調。",
  },
  {
    id: "stability",
    label: "穩定",
    subtitle: "高速與重煞容錯",
    mods: {
      finalDrive: -0.04,
      toeFront: -0.01,
      toeRear: 0.04,
      caster: 0.18,
      arbRear: -3,
      springRear: -1,
      aeroFront: 3,
      aeroRear: 8,
      brakeBalance: 1,
      brakePressure: -2,
      diffRearAccel: -4,
      diffRearDecel: -3,
      diffCenter: 3,
    },
    gearMods: { firstTarget: 3, topTargetMultiplier: 1.03, topRatio: -0.02, curvePower: 0.04, finalDriveBias: -0.03 },
    reason: "提高高速、重煞和補油時的容錯，適合大馬力或原本容易飄的車。",
  },
  {
    id: "agility",
    label: "靈活",
    subtitle: "轉向反應",
    mods: {
      tireFront: -0.22,
      camberFront: -0.22,
      toeFront: 0.03,
      caster: 0.25,
      arbFront: -3,
      arbRear: 4,
      springFront: -2,
      aeroFront: 3,
      brakeBalance: -1,
      diffFrontAccel: -3,
      diffRearDecel: -2,
    },
    gearMods: { firstTarget: -3, topRatio: 0.02, curvePower: -0.05, finalDriveBias: 0.03 },
    reason: "讓前端更願意進彎並提升變向反應，適合小彎或原本轉向偏鈍的車。",
  },
  {
    id: "exit",
    label: "出彎",
    subtitle: "早補油牽引",
    mods: {
      tireRear: -0.28,
      finalDrive: 0.1,
      arbRear: -3,
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
    id: "topSpeed",
    label: "極速",
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
    id: "grip",
    label: "抓地",
    subtitle: "低抓地 / 顛簸容錯",
    mods: {
      tireFront: -0.35,
      tireRear: -0.45,
      finalDrive: -0.03,
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

const adviceTemplateTranslations = {
  en: {
    steeringUndersteer: [
      ["Front grip", "Lower the front anti-roll bar by 3% to 6%, and add -0.1 to -0.3 deg front camber."],
      ["Rear rotation help", "Raise the rear anti-roll bar by 2% to 4%, but back off halfway if the rear starts sliding."],
      ["Differential", "For AWD or FWD, first lower front accel diff by 3% to 6% to reduce throttle understeer."],
    ],
    steeringSlow: [
      ["Front toe", "Add +0.02 to +0.05 deg front toe-out to make the initial response clearer."],
      ["Rebound damping", "Raise front rebound by 2% to 4% so the body accepts steering input sooner."],
      ["Caster", "Add 0.2 to 0.4 deg caster for stronger self-aligning feel and front support."],
    ],
    steeringNervous: [
      ["Front toe", "Reduce front toe-out by 0.02 to 0.05 deg, or return it to 0 if needed."],
      ["Rear toe", "Add +0.02 to +0.05 deg rear toe-in to settle the rear."],
      ["High-speed support", "Add 3% to 7% rear downforce; prioritize this on fast cars."],
    ],
    steeringOversteer: [
      ["Rear mechanical grip", "Lower rear anti-roll bar and rear spring by 3% to 6% each."],
      ["Rear tire pressure", "Lower 0.02 to 0.05 BAR to regain slide tolerance first."],
      ["Differential", "Lower rear accel or decel diff by 4% to 8%, depending on whether it happens on throttle or lift-off."],
    ],
    rearLoose: [
      ["Rear tire pressure", "Lower 0.02 to 0.06 BAR so the rear tires bite more easily."],
      ["Rear anti-roll bar", "Lower 3% to 7%; prioritize this if the slide starts mid-corner."],
      ["Rear differential", "Lower rear accel diff by 4% to 8%; for lift-off oversteer, lower rear decel diff."],
    ],
    rearFloat: [
      ["Rear downforce", "Add 4% to 8%; high-speed floating should start with aero."],
      ["Rear toe", "Add +0.02 to +0.06 deg rear toe-in for straight-line and lane-change stability."],
      ["Rear rebound", "Lower 2% to 5% to keep the rear from bouncing after surface changes."],
    ],
    rearTooFast: [
      ["Rear anti-roll bar", "Lower 3% to 6% to slow rear response."],
      ["Rear toe", "Add +0.02 to +0.05 deg rear toe-in."],
      ["Differential", "Lower rear accel diff by 3% to 6% so throttle does not rotate the rear too sharply."],
    ],
    gripFront: [
      ["Front tire pressure", "Lower 0.01 to 0.03 BAR while keeping the warm tire target reasonable."],
      ["Front camber", "Add -0.1 to -0.3 deg to improve mid-corner contact."],
      ["Front anti-roll bar", "Lower 3% to 6% so the front tires stay planted mid-corner."],
    ],
    gripRear: [
      ["Rear tire pressure", "Lower 0.02 to 0.05 BAR to preserve traction first."],
      ["Rear spring and anti-roll bar", "Lower both by 3% to 6% so the rear tires stay planted."],
      ["Rear downforce", "Add 3% to 8% on high-speed or high-power builds."],
    ],
    gripAll: [
      ["Tire pressure", "Lower front and rear by 0.01 to 0.03 BAR, then watch warm tire behavior."],
      ["Springs and anti-roll bars", "Lower front and rear by 3% to 6% to add mechanical grip."],
      ["Aero", "Raise front and rear downforce by 3% to 7% for road racing; do not use aero as the first fix off-road."],
    ],
    gripBump: [
      ["Ride height", "Raise 4% to 8% to avoid bottoming over curbs or bumps."],
      ["Bump damping", "Lower 4% to 8% so the suspension can absorb impacts."],
      ["Rebound damping", "Lower 3% to 6% so the tire does not skip after extending."],
    ],
    suspensionBoat: [
      ["Anti-roll bars", "Raise front and rear anti-roll bars by 4% to 8% to control roll first."],
      ["Rebound damping", "Raise front and rear rebound by 3% to 6% to reduce body movement."],
      ["Springs", "Raise front and rear springs by 3% to 6%, but do not add too much at once on off-road builds."],
    ],
    suspensionBump: [
      ["Ride height", "Raise 5% to 10% to preserve suspension travel."],
      ["Bump damping", "Lower 5% to 10% so the car is not kicked off the surface."],
      ["Anti-roll bars", "Lower front and rear by 5% to 10%; soften first for rough roads and curbs."],
    ],
    suspensionBottom: [
      ["Ride height", "Raise 6% to 12% to stop high-speed bottoming first."],
      ["Springs", "Raise 4% to 8% so the body has enough support."],
      ["Bump damping", "Raise 2% to 5%, but back off if the car starts bouncing away from the surface."],
    ],
    suspensionHard: [
      ["Springs", "Lower front and rear by 4% to 8% so the platform does not feel locked up."],
      ["Anti-roll bars", "Lower 3% to 6% to improve mid-corner contact."],
      ["Damping", "Lower bump and rebound by 2% to 5%, prioritizing bump first."],
    ],
    brakeUnstable: [
      ["Brake pressure", "Lower 5% to 10% to avoid lock-up and wobble first."],
      ["Brake balance", "Move 1% to 3% forward; if entry understeer gets worse, step it back."],
      ["Differential decel", "Lower rear decel diff by 3% to 6%; this helps most with lift-off or braking oversteer."],
    ],
    brakeUndersteer: [
      ["Brake balance", "Move 1% to 2% rearward so the front tires are not overloaded on entry."],
      ["Front anti-roll bar", "Lower 3% to 6% to add front grip while braking into corners."],
      ["Trail braking", "If the rear becomes unstable, move brake balance back 1 click and lower pressure."],
    ],
    brakeOversteer: [
      ["Brake balance", "Move 1% to 3% forward to reduce rear lock-up risk."],
      ["Rear diff decel", "Lower 4% to 8% so the rear does not swing on lift-off braking."],
      ["Rear toe", "Add +0.02 to +0.05 deg rear toe-in."],
    ],
    brakeLock: [
      ["Brake pressure", "Lower 8% to 15% to solve lock-up first."],
      ["Brake balance", "Adjust toward the unlocked end: rearward for front lock-up, forward for rear lock-up."],
      ["Tire pressure", "Lower the locking end by 0.01 to 0.03 BAR."],
    ],
    accelTraction: [
      ["Driven tire pressure", "Lower 0.03 to 0.07 BAR to help the power reach the ground first."],
      ["Differential accel", "Lower 4% to 8%; prioritize this when the car slides as soon as throttle is applied."],
      ["Final drive", "Reduce by 0.08 to 0.18 so the low gears are less violent."],
    ],
    accelUndersteer: [
      ["Front diff accel", "For AWD or FWD, lower front accel diff by 4% to 8%."],
      ["Center differential", "Move AWD center balance 3% to 6% rearward to reduce throttle understeer."],
      ["Rear anti-roll bar", "Raise 2% to 4% so the rear helps rotate on exit."],
    ],
    accelOversteer: [
      ["Rear diff accel", "Lower 5% to 10% so throttle does not open the rear immediately."],
      ["Rear tire pressure", "Lower 0.03 to 0.06 BAR."],
      ["Rear springs", "Lower 3% to 6% so the rear tires stay loaded."],
    ],
    accelFloat: [
      ["Rear downforce", "Add 4% to 8% to reduce high-speed full-throttle float."],
      ["Rear toe", "Add +0.02 to +0.05 deg rear toe-in."],
      ["Center differential", "Move AWD center balance 2% to 4% forward for more stable high-speed acceleration."],
    ],
    powerDelivery: [
      ["Final drive", "Adjust by symptom: add 0.08 if RPM drops, or reduce by 0.08 if delivery is too violent."],
      ["Low gear ratios", "Only shorten or lengthen the problem gear by 3% to 6%."],
      ["Differential", "Lower accel lock by 3% to 6% if power delivery feels abrupt."],
    ],
    highSpeedFloat: [
      ["Aero", "Add 4% to 8% front and rear downforce; stabilize first, then chase top speed."],
      ["Ride height", "Lower road cars by 2% to 5% front and rear, but avoid going too low on bumpy routes."],
      ["Rear toe", "Add +0.02 to +0.05 deg rear toe-in."],
    ],
    highSpeedBump: [
      ["Ride height", "Raise 4% to 8% to preserve travel over high-speed curbs or crests."],
      ["Bump damping", "Lower 4% to 8% so tires are not kicked off the surface."],
      ["Rebound damping", "Lower 3% to 6% to reduce movement after landing."],
    ],
    highSpeedLine: [
      ["Rear downforce", "Add 4% to 8% to improve lane changes and fast-bend stability."],
      ["Front toe", "Reduce front toe-out toward 0."],
      ["Anti-roll bars", "Raise front and rear slightly by 2% to 4%, but step back if curb behavior gets worse."],
    ],
    fhMountain: [
      ["Ride height and damping", "Raise ride height 4% to 8%, and lower bump and rebound by 3% to 6%."],
      ["Brakes", "If downhill braking is difficult, lower brake pressure 5% to 10% and move balance 1% to 2% forward."],
      ["Final drive", "If RPM drops on mountain exits, add 0.08 to 0.15."],
    ],
    fhRough: [
      ["Suspension travel", "Raise ride height 6% to 12% to avoid bottoming on slopes, rough roads, and jumps."],
      ["Anti-roll bars", "Lower front and rear by 5% to 10% so each side can handle the surface independently."],
      ["Damping", "Lower bump by 5% to 10%, and lower rebound by 3% to 6%."],
    ],
    fhTransition: [
      ["Tire pressure", "Lower front and rear by 0.02 to 0.04 BAR to make tarmac-to-dirt transitions more forgiving."],
      ["Differential", "For AWD, lower front and rear accel diff slightly by 3% to 6% to avoid sudden surface-change slides."],
      ["Ride height", "Raise 3% to 6% to handle elevation changes."],
    ],
  },
};

const contextualAdviceStepTranslations = {
  en: {
    "渦輪遲滯|把終傳縮短前先試縮短低檔，避免高檔尾速被犧牲太多。": [
      "Turbo lag",
      "Before shortening final drive, try shortening the low gears so upper-gear top speed is not sacrificed too much.",
    ],
    "後驅容錯|後驅車先保住後胎胎壓與後差速器，再調防傾桿。": [
      "RWD tolerance",
      "On RWD cars, protect rear tire pressure and rear differential behavior first, then tune anti-roll bars.",
    ],
    "前驅補救|若入彎仍推，前差減速降低 2% 到 4%，讓收油時前輪更願意轉。": [
      "FWD fix",
      "If entry push remains, lower front decel diff by 2% to 4% so the front tires rotate better on lift-off.",
    ],
    "賽道取捨|多彎賽道不要一次犧牲太多尾速或下壓，先用小幅調整測試。": [
      "Track tradeoff",
      "On corner-heavy road routes, do not sacrifice too much top speed or downforce at once; test with small steps first.",
    ],
    "模式確認|若目標不是甩尾，先只小幅調胎壓與前束，避免破壞正賽穩定。": [
      "Mode check",
      "If the goal is not drifting, only adjust tire pressure and front toe lightly so race stability is not ruined.",
    ],
  },
};

const adviceKnowledgeEntries = [
  {
    match: ["前端抓地", "front grip"],
    reason: {
      zh: "轉向不足多半代表前輪在入彎或彎中已經承受太多側向負荷。放軟前端支撐或增加前輪有效接地，可以讓外側前輪在車身側傾後更願意咬住路面，車頭才會跟著方向盤進彎。",
      en: "Understeer usually means the front tires are already overloaded during entry or mid-corner. Adding usable front contact and softening front support helps the outside front tire stay loaded so the nose follows steering input.",
    },
    risks: {
      zh: ["前端抓地加太多可能讓車尾變得更活躍，出彎補油時更容易甩。", "前後抓地差距太大時，車輛會從推頭變成突然轉向過度。"],
      en: ["Too much front grip can make the rear more active and easier to slide on exit.", "A large front-rear grip mismatch can turn understeer into sudden oversteer."],
    },
  },
  {
    match: ["車尾輔助旋轉", "rear rotation"],
    reason: {
      zh: "車頭不願意轉時，除了增加前輪抓地，也可以讓後軸稍微更願意跟著旋轉。小幅提高後端抗側傾或調整差速，可以讓車尾幫忙改變車身角度，減少車頭一路往外推。",
      en: "When the nose refuses to rotate, you can also ask the rear axle to help the car rotate. Slightly increasing rear roll resistance or adjusting diff behavior helps the rear change the car angle instead of letting the front push wide.",
    },
    risks: {
      zh: ["後端旋轉加太多會讓出彎穩定性下降。", "高速彎使用太激進時，車尾可能比車頭更早失去抓地。"],
      en: ["Too much rear rotation reduces exit stability.", "Aggressive rear rotation can make the rear lose grip before the front in fast corners."],
    },
  },
  {
    match: ["前胎胎壓", "後胎胎壓", "驅動輪胎壓", "胎壓", "front tire pressure", "rear tire pressure", "driven tire pressure", "tire pressure"],
    reason: {
      zh: "胎壓會改變輪胎接地形狀與熱胎後的抓地容錯。小幅降低胎壓通常能增加接地面積與牽引容錯，對抓地不足、補油打滑或路面切換不穩特別直接。",
      en: "Tire pressure changes the contact patch shape and warm-tire tolerance. Lowering it slightly usually increases contact area and traction margin, which directly helps low grip, throttle spin, and surface transitions.",
    },
    risks: {
      zh: ["胎壓過低會讓轉向反應變慢，車身感覺變鈍。", "胎壓過低也可能讓胎溫上升太快，長距離會失去穩定抓地。"],
      en: ["Too little pressure slows steering response and makes the car feel dull.", "Very low pressure can overheat the tire and reduce consistency over longer runs."],
    },
  },
  {
    match: ["前外傾", "外傾", "front camber", "camber"],
    reason: {
      zh: "過彎時車身側傾會讓外側輪胎逐漸站直或往外翻。增加負外傾是為了讓外側輪在承受側向 G 力時仍能保持有效接地面積，提升彎中支撐與前輪指向性。",
      en: "Body roll changes the outside tire angle during cornering. More negative camber helps the loaded outside tire keep a better contact patch under lateral G, improving mid-corner support and steering bite.",
    },
    risks: {
      zh: ["負外傾過多會犧牲直線煞車接地，煞車距離可能變長。", "內側胎溫過高時代表外傾可能已經過量。"],
      en: ["Too much negative camber reduces straight-line braking contact and can lengthen braking distance.", "High inner tire temperature usually means camber may be excessive."],
    },
  },
  {
    match: ["前束", "後束", "toe"],
    reason: {
      zh: "前束影響方向盤初段反應，後束影響車尾自我穩定。前輪外八會讓車頭更快開始轉向；後輪內八會讓後軸在直線、煞車與高速換線時比較願意保持穩定。",
      en: "Front toe affects initial steering response, while rear toe affects rear self-stability. Front toe-out helps the nose start turning sooner; rear toe-in helps the rear stay settled in straights, braking, and lane changes.",
    },
    risks: {
      zh: ["前輪外八太多會讓高速直線變飄，修正方向變忙。", "後輪內八太多會讓車變穩但轉向反應變慢，也可能吃掉尾速。"],
      en: ["Too much front toe-out makes high-speed straights nervous.", "Too much rear toe-in calms the car but slows rotation and can cost top speed."],
    },
  },
  {
    match: ["主銷後傾", "caster"],
    reason: {
      zh: "主銷後傾會增加轉向時的動態外傾與方向盤回正力。提高後傾可以讓前輪在打方向時獲得更多支撐，特別適合方向感模糊或彎中前端支撐不足的車。",
      en: "Caster adds dynamic camber and stronger self-aligning force while steering. More caster gives the front tires extra support during steering, especially when the front feels vague or weak mid-corner.",
    },
    risks: {
      zh: ["後傾太高會讓方向盤變重，小角度修正可能變慢。", "已經很敏感的車再加後傾，可能讓高速修正更緊張。"],
      en: ["Too much caster can make steering heavier and small corrections slower.", "On already nervous cars, extra caster can make high-speed corrections tense."],
    },
  },
  {
    match: ["前防傾", "後防傾", "防傾桿", "anti-roll"],
    reason: {
      zh: "防傾桿決定左右輪連動程度，也會改變前後軸在彎中的負荷分配。放軟某一端通常能讓該端輪胎更貼地；加硬某一端則會讓該端反應更快，但也更容易先到抓地極限。",
      en: "Anti-roll bars control left-right coupling and change front-rear load transfer. Softening one end usually lets that end stay planted; stiffening one end sharpens response but also moves it closer to the grip limit.",
    },
    risks: {
      zh: ["防傾加太硬會讓路肩與顛簸表現變差。", "後防傾太硬可能讓出彎或高速彎車尾突然滑。"],
      en: ["Overly stiff anti-roll bars hurt curb and bump behavior.", "Too much rear bar can make the rear slide suddenly on exit or in fast corners."],
    },
  },
  {
    match: ["彈簧", "springs", "spring"],
    reason: {
      zh: "彈簧控制車身支撐與重量轉移速度。放軟能增加機械抓地和路面貼合；加硬能減少俯仰與側傾，讓車身平台更穩，適合高速或重煞車支撐不足的情況。",
      en: "Springs control body support and how quickly weight transfers. Softer springs add mechanical grip and surface compliance; stiffer springs reduce pitch and roll, stabilizing the platform for speed or heavy braking.",
    },
    risks: {
      zh: ["彈簧太軟會讓車身晃動、反應延遲，甚至高速觸底。", "彈簧太硬會讓輪胎不貼地，彎中和爛路抓地下降。"],
      en: ["Too soft can cause body float, delayed response, or high-speed bottoming.", "Too stiff can make tires skip and reduce grip mid-corner or on rough roads."],
    },
  },
  {
    match: ["車高", "懸吊行程", "ride height", "suspension travel"],
    reason: {
      zh: "車高影響懸吊剩餘行程和底盤是否觸底。提高車高是為了讓車在路肩、跳台、坡頂或高速壓縮時還有空間吸收路面，避免輪胎突然離地或底盤刮地失控。",
      en: "Ride height affects remaining suspension travel and bottoming. Raising it gives the car room to absorb curbs, jumps, crests, or high-speed compression without suddenly unloading tires or scraping the chassis.",
    },
    risks: {
      zh: ["車高太高會提高重心，快速變換方向時更容易晃。", "公路高速車太高會降低空力效率，方向感也可能變浮。"],
      en: ["Too much height raises the center of gravity and increases body movement.", "On fast road cars, excessive height can reduce aero efficiency and make steering feel floaty."],
    },
  },
  {
    match: ["壓縮阻尼", "回彈阻尼", "阻尼", "bump damping", "rebound damping", "damping", "dampers"],
    reason: {
      zh: "阻尼控制彈簧壓縮與回彈的速度。壓縮太硬會讓路面把車彈開；回彈太硬會讓輪胎伸展不回去。正確的阻尼是讓輪胎跟著路面動，而不是讓車身一直晃或讓輪胎離地。",
      en: "Damping controls how quickly springs compress and extend. Too much bump kicks the car off the surface; too much rebound prevents the tire from extending back. Good damping lets tires follow the road without endless body motion.",
    },
    risks: {
      zh: ["阻尼太軟會讓車身連續晃動，轉向節奏變慢。", "阻尼太硬會讓輪胎跳動，路肩、爛路與落地穩定性變差。"],
      en: ["Too little damping causes repeated body movement and slower response.", "Too much damping makes tires skip, hurting curbs, rough roads, and landings."],
    },
  },
  {
    match: ["前下壓", "後下壓", "空力", "downforce", "aero"],
    reason: {
      zh: "空力會在速度越高時提供越多輪胎垂直負荷。增加下壓能改善高速彎、換線與全油門穩定，因為輪胎在高速下有更多壓力貼住路面。",
      en: "Aero adds vertical tire load as speed rises. More downforce improves fast corners, lane changes, and full-throttle stability because the tires are pressed harder into the road at speed.",
    },
    risks: {
      zh: ["下壓太高會犧牲尾速與加速延伸。", "前後下壓比例不對時，可能造成高速推頭或高速甩尾。"],
      en: ["Too much downforce costs top speed and high-speed acceleration.", "Wrong front-rear aero balance can create high-speed understeer or oversteer."],
    },
  },
  {
    match: ["煞車壓力", "煞車平衡", "煞車", "brake pressure", "brake balance", "brakes"],
    reason: {
      zh: "煞車設定會改變煞車時前後輪的負荷與鎖死順序。降低壓力能提升可控性；調整平衡則是在前輪轉向能力與後輪穩定之間取捨。",
      en: "Brake setup changes front-rear load and lock-up order under braking. Lower pressure improves controllability; balance changes the tradeoff between front turning capacity and rear stability.",
    },
    risks: {
      zh: ["煞車壓力太低會讓煞車距離變長。", "煞車平衡太前會推頭，太後會讓車尾在重煞時亂動。"],
      en: ["Too little brake pressure lengthens stopping distance.", "Too much front bias causes push; too much rear bias makes the rear unstable under heavy braking."],
    },
  },
  {
    match: ["差速", "前差", "後差", "中央差速", "differential", "diff"],
    reason: {
      zh: "差速器決定左右輪或前後軸在補油、收油時鎖定多少。降低鎖定能讓車輪轉速差更自由，通常會提升容錯；提高鎖定則能讓動力更直接，但也更容易把推頭或甩尾放大。",
      en: "Differentials decide how strongly wheels or axles lock under throttle or lift-off. Less lock gives wheel-speed difference more freedom and usually more tolerance; more lock delivers power directly but can amplify push or oversteer.",
    },
    risks: {
      zh: ["差速鎖定太低會讓出彎動力不夠直接。", "差速鎖定太高會讓補油推頭、補油甩尾或收油甩尾更明顯。"],
      en: ["Too little lock can make exit drive feel weak.", "Too much lock can worsen throttle understeer, throttle oversteer, or lift-off oversteer."],
    },
  },
  {
    match: ["終傳", "齒比", "低檔齒比", "final drive", "gear ratio", "low gear"],
    reason: {
      zh: "齒比會改變同一車速下的引擎轉速與輪上扭力。縮短齒比能改善出彎回速和渦輪掉轉；拉長齒比能降低低檔暴力感，讓大馬力車更容易把動力放到地面。",
      en: "Gear ratios change engine RPM and wheel torque at a given speed. Shorter gearing improves corner-exit recovery and turbo response; taller gearing calms low-gear torque so high-power cars can put power down.",
    },
    risks: {
      zh: ["齒比太短會提早撞紅線，尾速和換檔節奏變差。", "齒比太長會出彎掉轉，車會感覺沒力。"],
      en: ["Too short hits redline early and hurts top speed or shift rhythm.", "Too tall drops RPM on exit and makes the car feel weak."],
    },
  },
  {
    match: ["Trail Braking", "trail braking"],
    reason: {
      zh: "Trail Braking 是用逐漸釋放煞車，把前輪負荷留到入彎前段。若設定正確，前輪會有更多垂直負荷幫助轉向；若車尾不穩，代表煞車或減速差速讓後輪負荷太少。",
      en: "Trail braking keeps some load on the front tires as you begin turning. Correct setup gives the front more vertical load for rotation; rear instability means brake or decel diff behavior is unloading the rear too much.",
    },
    risks: {
      zh: ["Trail Braking 調太激進會讓車尾在入彎煞車時突然擺動。", "如果前輪已經鎖死，再往後調煞車平衡會讓車更難控制。"],
      en: ["Aggressive trail-brake setup can make the rear swing on corner entry.", "If the front already locks, moving bias rearward can make the car harder to control."],
    },
  },
];

function adviceKnowledgeFor(target, text) {
  const haystack = `${target} ${text}`.toLowerCase();
  return adviceKnowledgeEntries.find((entry) => entry.match.some((keyword) => haystack.includes(keyword.toLowerCase())));
}

function fallbackAdviceKnowledge() {
  return {
    reason: {
      zh: "這個調整會把車輛行為往目前症狀的反方向推，但建議用小幅度測試。調校不是單一數字越多越好，而是在抓地、反應速度與穩定性之間找平衡。",
      en: "This adjustment pushes vehicle behavior away from the current symptom, but it should be tested in small steps. Tuning is not about maximizing one value; it is a balance between grip, response, and stability.",
    },
    risks: {
      zh: ["一次調太多可能把問題轉移到另一個階段，例如入彎變好但出彎變差。", "如果新症狀出現，先回退一半再重新試車。"],
      en: ["Changing too much at once can move the problem to another phase, such as improving entry but hurting exit.", "If a new symptom appears, back the change off halfway and test again."],
    },
  };
}

function standaloneAdviceStep(issue, step, index) {
  const [target, text] = localizedAdviceStep(issue, step, index);
  const knowledge = adviceKnowledgeFor(target, text) ?? fallbackAdviceKnowledge();
  const language = currentLanguage() === "en" ? "en" : "zh";
  return {
    target,
    text,
    reason: knowledge.reason[language],
    risks: knowledge.risks[language],
  };
}

function symptom(id, label, chip, templateKey) {
  return { id, label, chip, templateKey, steps: adviceTemplates[templateKey] };
}

function localizedAdviceStep(issue, step, index) {
  if (currentLanguage() !== "en") return step;

  const templateStep = adviceTemplateTranslations.en[issue.templateKey]?.[index];
  if (templateStep) return templateStep;

  const contextualStep = contextualAdviceStepTranslations.en[step.join("|")];
  return contextualStep ?? step;
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
      symptom("grip-rain-low", "雨天抓地不足", "雨天", "gripAll"),
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

const tuningEncyclopediaItems = [
  {
    id: "frontTirePressure",
    category: "tire",
    zh: {
      title: "前胎壓",
      categoryLabel: "車胎壓",
      summary: "前胎壓主要影響轉向初段、前輪抓地與煞車時的前端穩定。",
      increase: ["轉向反應會變快，但前輪接地面可能變小。", "高速直線阻力略降，但彎中前抓地可能下降。", "過高時容易推頭、煞車進彎變飄。"],
      decrease: ["前輪接地感增加，低速入彎抓地較好。", "過低時胎壁變形變多，轉向會變鈍。", "太低會讓前輪升溫、拖速，甚至產生模糊的推頭。"],
      tips: ["一次調整 0.02 到 0.05 BAR。", "如果只有入彎推頭，先小幅降低前胎壓；如果轉向太神經質，再提高一點。"],
    },
    en: {
      title: "Front Tire Pressure",
      categoryLabel: "Tire Pressure",
      summary: "Front pressure mainly changes initial steering response, front grip, and braking stability.",
      increase: ["Sharper initial response, but the contact patch may shrink.", "Slightly less rolling drag, but less front grip mid-corner.", "Too high can cause entry understeer and a floaty brake-in feel."],
      decrease: ["More front bite and better low-speed entry grip.", "Too low makes the tire sidewall feel lazy.", "Excessively low pressure adds heat, drag, and vague understeer."],
      tips: ["Adjust in 0.02 to 0.05 BAR steps.", "For entry understeer, lower front pressure slightly; for nervous steering, raise it slightly."],
    },
  },
  {
    id: "rearTirePressure",
    category: "tire",
    zh: {
      title: "後胎壓",
      categoryLabel: "車胎壓",
      summary: "後胎壓主要影響出彎牽引、車尾穩定與高速轉向時的後輪支撐。",
      increase: ["車尾反應變快，出彎比較容易旋轉。", "高速阻力略降，但後輪抓地會變少。", "過高時容易出彎打滑或高速車尾不安定。"],
      decrease: ["後輪接地感和出彎牽引會增加。", "車尾會更穩，但轉向可能變得比較鈍。", "太低會拖慢加速，車尾回饋會變模糊。"],
      tips: ["後驅大馬力車通常比前胎更敏感。", "出彎打滑先小幅降低後胎壓；轉向不足太重時不要只靠後胎壓解決。"],
    },
    en: {
      title: "Rear Tire Pressure",
      categoryLabel: "Tire Pressure",
      summary: "Rear pressure mainly affects exit traction, rear stability, and high-speed rear support.",
      increase: ["The rear rotates more quickly.", "Slightly less rolling drag, but less rear grip.", "Too high can cause exit wheelspin or high-speed rear instability."],
      decrease: ["More rear contact feel and better throttle traction.", "The rear becomes calmer, but rotation may slow down.", "Too low can hurt acceleration and make rear feedback vague."],
      tips: ["High-power RWD cars are especially sensitive to rear pressure.", "For exit wheelspin, lower rear pressure slightly before making big differential changes."],
    },
  },
  {
    id: "finalDrive",
    category: "gearing",
    zh: {
      title: "終傳比",
      categoryLabel: "齒比",
      summary: "終傳比會同時縮短或放長所有檔位，是加速與尾速取捨的核心設定。",
      increase: ["所有檔位變短，加速和回速更快。", "更容易讓引擎保持在動力帶內。", "過高會讓低檔打滑、最高檔太早碰轉速上限。"],
      decrease: ["所有檔位變長，尾速和高速延伸更好。", "低檔輸出變溫和，較容易控油。", "過低會讓出彎回速慢，最後幾檔可能拉不起來。"],
      tips: ["先用終傳比定大方向，再微調單檔齒比。", "如果最後兩檔常用不到，通常終傳或高檔齒比太長。"],
    },
    en: {
      title: "Final Drive",
      categoryLabel: "Gearing",
      summary: "Final drive shortens or lengthens every gear at once, making it the main acceleration vs top-speed control.",
      increase: ["All gears become shorter for stronger acceleration and recovery.", "The engine stays in the power band more easily.", "Too high causes wheelspin and early redline in top gear."],
      decrease: ["All gears become longer for more top-speed extension.", "Low-gear torque becomes easier to manage.", "Too low hurts corner-exit recovery and can make upper gears unreachable."],
      tips: ["Set the broad direction with final drive, then refine individual gears.", "If the last two gears are rarely reachable, final drive or upper gears are probably too long."],
    },
  },
  {
    id: "frontCamber",
    category: "alignment",
    zh: {
      title: "前外傾角",
      categoryLabel: "定位",
      summary: "前外傾角影響前輪在彎中的接地角度，是中高速轉向抓地的重要來源。",
      increase: ["更多負外傾可增加彎中前輪抓地。", "高速彎前端支撐會更好。", "過多會降低直線煞車和低速接地。"],
      decrease: ["直線煞車和低速接地更平均。", "輪胎磨耗和溫度更容易穩定。", "過少會讓彎中前輪外側撐不住，產生推頭。"],
      tips: ["FH 中通常不要為了彎中抓地把外傾拉到極端。", "如果入彎正常但彎中推頭，可小幅增加前負外傾。"],
    },
    en: {
      title: "Front Camber",
      categoryLabel: "Alignment",
      summary: "Front camber changes how the front tire sits in a corner and strongly affects mid-corner grip.",
      increase: ["More negative camber can add mid-corner front grip.", "High-speed front support improves.", "Too much reduces straight braking and low-speed contact."],
      decrease: ["More even contact for braking and low speed.", "Tire temperature and wear are easier to stabilize.", "Too little camber causes the outside front to overload mid-corner."],
      tips: ["Avoid extreme camber values for general FH use.", "If entry is fine but mid-corner pushes wide, add a little front negative camber."],
    },
  },
  {
    id: "rearCamber",
    category: "alignment",
    zh: {
      title: "後外傾角",
      categoryLabel: "定位",
      summary: "後外傾角影響後輪彎中支撐、出彎牽引與車尾穩定。",
      increase: ["更多負外傾會讓高速彎後輪支撐更強。", "車尾在長彎中比較穩。", "過多會犧牲直線加速接地，出彎較容易打滑。"],
      decrease: ["出彎牽引和直線加速接地更好。", "車尾旋轉會更容易。", "過少時高速彎後輪支撐不足，車尾可能漂。"],
      tips: ["後驅車若出彎打滑，先避免後外傾過大。", "高速彎車尾浮動時，可小幅增加後負外傾。"],
    },
    en: {
      title: "Rear Camber",
      categoryLabel: "Alignment",
      summary: "Rear camber affects rear support, exit traction, and rear stability.",
      increase: ["More negative camber improves rear support in fast corners.", "The rear feels calmer in long bends.", "Too much hurts straight-line traction and exit drive."],
      decrease: ["Better straight-line and exit traction.", "The rear rotates more easily.", "Too little rear camber can make the rear float in fast corners."],
      tips: ["For RWD exit wheelspin, make sure rear camber is not excessive.", "For high-speed rear float, add rear negative camber in small steps."],
    },
  },
  {
    id: "frontToe",
    category: "alignment",
    zh: {
      title: "前束角",
      categoryLabel: "定位",
      summary: "前束角主要改變轉向靈敏度和直線穩定，是很敏感的小幅調整項。",
      increase: ["偏前束外會讓轉向更快、更願意入彎。", "低速反應會變活。", "過多會讓直線不穩、拖速並增加輪胎溫度。"],
      decrease: ["轉向會更穩、更不神經質。", "直線穩定和高速可控性較好。", "過度偏內會讓入彎反應變慢。"],
      tips: ["前束通常只需要非常小的數值。", "如果高速左右飄，先把前束往保守方向收。"],
    },
    en: {
      title: "Front Toe",
      categoryLabel: "Alignment",
      summary: "Front toe changes steering sharpness and straight-line stability. It is very sensitive.",
      increase: ["More toe-out sharpens turn-in.", "Low-speed response feels more alive.", "Too much causes wander, drag, and tire heat."],
      decrease: ["Steering becomes calmer and less nervous.", "Straight-line and high-speed stability improve.", "Too much toe-in slows turn-in response."],
      tips: ["Front toe usually needs tiny changes only.", "If the car wanders at speed, reduce aggressive front toe first."],
    },
  },
  {
    id: "rearToe",
    category: "alignment",
    zh: {
      title: "後束角",
      categoryLabel: "定位",
      summary: "後束角影響車尾跟隨性、出彎穩定與高速方向穩定。",
      increase: ["偏後束內會讓車尾更穩，出彎比較不甩。", "高速直線和高速彎更安心。", "過多會讓車子不願意旋轉並拖慢速度。"],
      decrease: ["車尾會更願意旋轉，轉向更靈活。", "低速彎更容易把車頭帶進彎。", "過少或偏外會讓車尾不安定。"],
      tips: ["後束比前束更容易影響車尾安全感。", "高速車尾晃動時，先保守增加一點後束內。"],
    },
    en: {
      title: "Rear Toe",
      categoryLabel: "Alignment",
      summary: "Rear toe affects rear tracking, exit stability, and high-speed confidence.",
      increase: ["More rear toe-in makes the rear calmer.", "Exit and high-speed stability improve.", "Too much makes the car reluctant to rotate and adds drag."],
      decrease: ["The rear rotates more willingly.", "The car turns into slow corners more easily.", "Too little or toe-out can make the rear unstable."],
      tips: ["Rear toe has a strong effect on rear confidence.", "For high-speed rear wiggle, add a small amount of rear toe-in."],
    },
  },
  {
    id: "caster",
    category: "alignment",
    zh: {
      title: "主銷後傾",
      categoryLabel: "定位",
      summary: "主銷後傾影響方向盤回正、彎中外傾增益與高速穩定。",
      increase: ["方向盤回正更強，高速穩定更好。", "轉向時會產生更多動態外傾，彎中前抓地可能增加。", "過高會讓轉向變重，低速反應變慢。"],
      decrease: ["低速轉向更輕、更直接。", "車頭初段反應可能更快。", "過低會讓高速穩定和彎中支撐下降。"],
      tips: ["主銷後傾適合用來微調轉向重量和高速信心。", "不要把它當成修正嚴重推頭的主要手段。"],
    },
    en: {
      title: "Caster",
      categoryLabel: "Alignment",
      summary: "Caster affects steering self-centering, dynamic camber gain, and high-speed stability.",
      increase: ["Stronger self-centering and better high-speed stability.", "More dynamic camber while steering can help mid-corner front grip.", "Too much makes steering heavy and slow at low speed."],
      decrease: ["Lighter and more direct low-speed steering.", "Initial response can feel quicker.", "Too little hurts high-speed confidence and corner support."],
      tips: ["Use caster to tune steering weight and confidence.", "Do not rely on caster alone to fix major understeer."],
    },
  },
  {
    id: "frontArb",
    category: "suspension",
    zh: {
      title: "前防傾桿",
      categoryLabel: "防傾桿",
      summary: "前防傾桿控制前軸側傾與左右輪負載轉移，直接影響轉向與前輪抓地。",
      increase: ["車頭反應更快，側傾更少。", "高速變線更俐落。", "過硬會減少前輪彎中抓地，造成推頭。"],
      decrease: ["前輪在彎中更容易貼地，機械抓地增加。", "低抓地路面更穩。", "過軟會讓反應變慢、車身晃動變多。"],
      tips: ["入彎推頭通常不要先加硬前防傾。", "車頭太慢但不推頭時，可小幅加硬前防傾。"],
    },
    en: {
      title: "Front Anti-Roll Bar",
      categoryLabel: "Anti-Roll Bars",
      summary: "The front ARB controls front roll and lateral load transfer, directly changing steering and front grip.",
      increase: ["Sharper front response and less roll.", "Cleaner high-speed direction changes.", "Too stiff reduces mid-corner front grip and causes understeer."],
      decrease: ["The front tires can stay planted more easily.", "Better stability on low-grip surfaces.", "Too soft makes response slow and body movement larger."],
      tips: ["For entry understeer, avoid stiffening the front ARB first.", "If the nose is lazy but not pushing, add a little front ARB."],
    },
  },
  {
    id: "rearArb",
    category: "suspension",
    zh: {
      title: "後防傾桿",
      categoryLabel: "防傾桿",
      summary: "後防傾桿控制後軸側傾與旋轉，是調整轉向不足/過度的重要項目。",
      increase: ["車尾更願意旋轉，減少推頭。", "中低速轉向更靈活。", "過硬會讓出彎打滑、車尾突然甩出。"],
      decrease: ["車尾更穩，出彎牽引更好。", "高速彎更不容易甩尾。", "過軟會讓車子轉不進去，推頭變重。"],
      tips: ["AWD 推頭常會用後防傾桿幫忙旋轉。", "後驅出彎甩尾時，先小幅放軟後防傾。"],
    },
    en: {
      title: "Rear Anti-Roll Bar",
      categoryLabel: "Anti-Roll Bars",
      summary: "The rear ARB controls rear roll and rotation. It is a key understeer/oversteer lever.",
      increase: ["More rotation and less understeer.", "Better agility in slow and medium corners.", "Too stiff causes exit oversteer or snap rotation."],
      decrease: ["A calmer rear and better exit traction.", "More stability in fast corners.", "Too soft makes the car reluctant to rotate."],
      tips: ["AWD understeer is often helped by a slightly stiffer rear ARB.", "For RWD exit oversteer, soften the rear ARB slightly."],
    },
  },
  {
    id: "frontSpring",
    category: "suspension",
    zh: {
      title: "前彈簧",
      categoryLabel: "彈簧",
      summary: "前彈簧影響前軸支撐、煞車重心轉移和路面吸收能力。",
      increase: ["煞車和轉向時車頭支撐更強。", "高速壓縮和大起伏更不容易到底。", "過硬會讓前輪吃不住路面，低速推頭或跳動。"],
      decrease: ["前輪更容易吸收路面，機械抓地增加。", "入彎重量轉移更明顯。", "過軟會讓車頭下沉太多，反應變慢。"],
      tips: ["重車或高速車需要足夠前彈簧支撐。", "顛簸路線不要只追求硬彈簧。"],
    },
    en: {
      title: "Front Springs",
      categoryLabel: "Springs",
      summary: "Front springs affect front support, braking weight transfer, and bump absorption.",
      increase: ["More front support under braking and steering.", "Less bottoming over fast compression and large bumps.", "Too stiff makes the front skip and understeer on rough surfaces."],
      decrease: ["More front mechanical grip and bump absorption.", "More obvious entry weight transfer.", "Too soft makes the nose dive and response slow."],
      tips: ["Heavy or high-speed cars need enough front spring support.", "On bumpy routes, do not chase stiffness alone."],
    },
  },
  {
    id: "rearSpring",
    category: "suspension",
    zh: {
      title: "後彈簧",
      categoryLabel: "彈簧",
      summary: "後彈簧影響出彎牽引、車尾支撐與加速時的姿態。",
      increase: ["車尾支撐更好，轉向更願意旋轉。", "高速壓縮更穩。", "過硬會降低出彎牽引，容易打滑。"],
      decrease: ["後輪更容易貼地，出彎牽引增加。", "車尾更穩、更容易控油。", "過軟會讓車尾晃動或加速時蹲太多。"],
      tips: ["大扭力後驅若出彎滑，先檢查後彈簧是否太硬。", "車尾慢半拍又晃時，可能是後彈簧或阻尼太軟。"],
    },
    en: {
      title: "Rear Springs",
      categoryLabel: "Springs",
      summary: "Rear springs affect exit traction, rear support, and acceleration posture.",
      increase: ["More rear support and rotation.", "More stable over high-speed compression.", "Too stiff reduces exit traction and causes wheelspin."],
      decrease: ["The rear tires stay planted more easily.", "A calmer rear and smoother throttle application.", "Too soft can make the rear float or squat too much."],
      tips: ["For high-torque RWD exit slip, check if rear springs are too stiff.", "If the rear reacts late and floats, rear spring or damping may be too soft."],
    },
  },
  {
    id: "frontRideHeight",
    category: "suspension",
    zh: {
      title: "前車高",
      categoryLabel: "車高",
      summary: "前車高影響重心、前端空氣效率、壓縮行程與入彎姿態。",
      increase: ["前端更不容易觸底，顛簸容錯更好。", "重心略升，轉向反應可能變慢。", "過高會降低穩定和空力效率。"],
      decrease: ["重心降低，鋪裝路面反應更直接。", "高速穩定和前端貼地感可能增加。", "過低會觸底，反而失去抓地。"],
      tips: ["低車高只在不觸底時才有幫助。", "跳台、路肩或越野路線要保留行程。"],
    },
    en: {
      title: "Front Ride Height",
      categoryLabel: "Ride Height",
      summary: "Front ride height affects center of gravity, front aero efficiency, compression travel, and entry posture.",
      increase: ["More clearance and bump tolerance.", "Slightly higher center of gravity and slower response.", "Too high reduces stability and aero efficiency."],
      decrease: ["Lower center of gravity and sharper paved-road response.", "More high-speed front planted feel.", "Too low bottoms out and loses grip."],
      tips: ["Low ride height only helps when the car does not bottom out.", "Jumps, curbs, and dirt need travel reserve."],
    },
  },
  {
    id: "rearRideHeight",
    category: "suspension",
    zh: {
      title: "後車高",
      categoryLabel: "車高",
      summary: "後車高影響車尾穩定、出彎牽引和高速空力姿態。",
      increase: ["車尾行程增加，顛簸和跳躍容錯更好。", "可能增加車頭指向感。", "過高會讓高速車尾漂、重心升高。"],
      decrease: ["車尾更貼地，高速穩定可能增加。", "出彎姿態更低更穩。", "過低會觸底，後輪抓地突然流失。"],
      tips: ["前後車高差會改變車身姿態，不要只看單一端。", "高速尾部不穩時，先確認後車高沒有太高或太低到底。"],
    },
    en: {
      title: "Rear Ride Height",
      categoryLabel: "Ride Height",
      summary: "Rear ride height affects rear stability, exit traction, and aero posture.",
      increase: ["More rear travel and bump tolerance.", "Can make the nose feel more eager.", "Too high raises CG and can make the rear float at speed."],
      decrease: ["More rear planted feel and high-speed stability.", "Lower, calmer exit posture.", "Too low bottoms out and suddenly loses rear grip."],
      tips: ["Front-to-rear rake matters, so do not tune one end in isolation.", "For high-speed rear instability, check that rear height is not too high or bottoming out."],
    },
  },
  {
    id: "frontRebound",
    category: "damping",
    zh: {
      title: "前回彈阻尼",
      categoryLabel: "回彈阻尼",
      summary: "前回彈控制前懸吊伸長速度，影響煞車放開、轉向接續與路面貼合。",
      increase: ["車頭回彈較慢，轉向姿態更穩。", "快速左右切換時前端較不晃。", "過高會讓前輪無法快速貼回路面，產生跳動或推頭。"],
      decrease: ["前輪更快貼回地面，顛簸抓地更好。", "轉向重量轉移更自然。", "過低會讓車頭浮動、連續彎支撐不足。"],
      tips: ["回彈通常比壓縮更敏感。", "如果路面顛簸時前端彈跳，先降低前回彈。"],
    },
    en: {
      title: "Front Rebound Damping",
      categoryLabel: "Rebound Damping",
      summary: "Front rebound controls how quickly the front suspension extends after compression.",
      increase: ["Slower front extension and a steadier steering platform.", "Less front movement in quick transitions.", "Too high keeps the front tire from returning to the road and causes skip or understeer."],
      decrease: ["The front tire returns to the road faster over bumps.", "Weight transfer feels more natural.", "Too low makes the nose float and lose support in linked corners."],
      tips: ["Rebound is usually more sensitive than bump.", "If the front skips over rough roads, reduce front rebound first."],
    },
  },
  {
    id: "rearRebound",
    category: "damping",
    zh: {
      title: "後回彈阻尼",
      categoryLabel: "回彈阻尼",
      summary: "後回彈控制後懸吊伸長速度，影響出彎牽引、車尾穩定與轉向後段。",
      increase: ["車尾姿態更穩，連續彎較不晃。", "出彎時後軸支撐更明確。", "過高會讓後輪遇到顛簸時抓地中斷，容易甩。"],
      decrease: ["後輪更快貼回地面，顛簸牽引更好。", "車尾更柔和，出彎比較好控。", "過低會讓車尾上下晃，轉向後段不穩。"],
      tips: ["後驅出彎遇顛簸打滑，常常是後回彈太高。", "高速車尾浮動則可能需要略加後回彈。"],
    },
    en: {
      title: "Rear Rebound Damping",
      categoryLabel: "Rebound Damping",
      summary: "Rear rebound controls rear suspension extension and affects exit traction and rear stability.",
      increase: ["A steadier rear platform in linked corners.", "Clearer rear support on exit.", "Too high interrupts rear grip over bumps and can cause oversteer."],
      decrease: ["Rear tires return to the road faster over bumps.", "A softer, more manageable rear on throttle.", "Too low makes the rear float and oscillate."],
      tips: ["RWD exit slip over bumps often points to excessive rear rebound.", "High-speed rear float may need a little more rear rebound."],
    },
  },
  {
    id: "frontBump",
    category: "damping",
    zh: {
      title: "前壓縮阻尼",
      categoryLabel: "壓縮阻尼",
      summary: "前壓縮控制前懸吊被壓縮的速度，影響煞車、入彎與撞路肩反應。",
      increase: ["煞車點頭較少，前端支撐更硬。", "高速壓縮時比較穩。", "過高會讓前輪撞到顛簸時彈開，失去抓地。"],
      decrease: ["前輪更能吸收路肩和顛簸。", "入彎時重量轉移更柔和。", "過低會讓車頭下沉太快，反應變慢。"],
      tips: ["壓縮阻尼不宜高過回彈太多。", "常壓路肩的車要保留前壓縮吸收能力。"],
    },
    en: {
      title: "Front Bump Damping",
      categoryLabel: "Bump Damping",
      summary: "Front bump controls how quickly the front suspension compresses under braking, entry, and curbs.",
      increase: ["Less brake dive and firmer front support.", "More stable during high-speed compression.", "Too high makes the front bounce off bumps and lose grip."],
      decrease: ["Better curb and bump absorption.", "Smoother entry weight transfer.", "Too low lets the nose dive too quickly."],
      tips: ["Bump should usually stay lower than rebound.", "Cars that use curbs need enough front bump compliance."],
    },
  },
  {
    id: "rearBump",
    category: "damping",
    zh: {
      title: "後壓縮阻尼",
      categoryLabel: "壓縮阻尼",
      summary: "後壓縮控制後懸吊被壓縮的速度，影響加速蹲伏、路肩吸收與車尾支撐。",
      increase: ["加速時車尾支撐更強，不容易蹲太多。", "高速壓縮更穩。", "過高會降低後輪吸收能力，出彎容易滑。"],
      decrease: ["後輪更能吸收顛簸，牽引較好。", "加速姿態更柔和。", "過低會讓車尾蹲太多，方向變慢。"],
      tips: ["大扭力車可略加後壓縮控制蹲伏。", "越野或顛簸路線要避免後壓縮過硬。"],
    },
    en: {
      title: "Rear Bump Damping",
      categoryLabel: "Bump Damping",
      summary: "Rear bump controls rear compression, affecting squat, curb absorption, and rear support.",
      increase: ["More rear support under acceleration.", "More stable during high-speed compression.", "Too high reduces rear absorption and can cause exit slip."],
      decrease: ["Better bump absorption and rear traction.", "Smoother acceleration posture.", "Too low lets the rear squat too much and slows response."],
      tips: ["High-torque cars may need slightly more rear bump to control squat.", "Avoid excessive rear bump on rough or off-road routes."],
    },
  },
  {
    id: "frontAero",
    category: "aero",
    zh: {
      title: "前空力",
      categoryLabel: "空力",
      summary: "前空力增加高速前輪下壓力，主要影響高速入彎和高速彎指向。",
      increase: ["高速前端抓地增加，推頭減少。", "高速入彎更有信心。", "過高會增加阻力，並可能讓車尾相對變輕。"],
      decrease: ["尾速和加速延伸較好。", "高速前端反應會變鈍。", "過低時高速彎容易推頭。"],
      tips: ["前空力要和後空力一起看。", "高速推頭可加前空力，但要注意尾速損失。"],
    },
    en: {
      title: "Front Aero",
      categoryLabel: "Aero",
      summary: "Front aero adds high-speed front downforce, mainly changing fast entry and fast-corner direction.",
      increase: ["More high-speed front grip and less understeer.", "More confidence on fast entry.", "Too much adds drag and can make the rear feel relatively light."],
      decrease: ["Better top-speed and acceleration extension.", "Slower high-speed front response.", "Too low causes fast-corner understeer."],
      tips: ["Front aero must be considered together with rear aero.", "For high-speed understeer, add front aero but watch top-speed loss."],
    },
  },
  {
    id: "rearAero",
    category: "aero",
    zh: {
      title: "後空力",
      categoryLabel: "空力",
      summary: "後空力增加高速後輪下壓力，主要影響高速穩定和車尾安全感。",
      increase: ["高速車尾更穩，出彎高速段更安心。", "高速煞車和變線更穩。", "過高會犧牲尾速，並可能加重高速推頭。"],
      decrease: ["尾速和高速加速更好。", "車尾更靈活。", "過低會讓高速車尾飄或過度轉向。"],
      tips: ["高速尾部不穩先加後空力。", "如果車子高速太推，可能是後空力相對前空力太多。"],
    },
    en: {
      title: "Rear Aero",
      categoryLabel: "Aero",
      summary: "Rear aero adds high-speed rear downforce and mainly affects stability and rear confidence.",
      increase: ["A calmer rear at high speed.", "More stable high-speed braking and lane changes.", "Too much costs top speed and can add high-speed understeer."],
      decrease: ["Better top speed and high-speed acceleration.", "A more agile rear.", "Too little makes the rear float or oversteer at speed."],
      tips: ["For high-speed rear instability, add rear aero first.", "If the car pushes at high speed, rear aero may be too high relative to front aero."],
    },
  },
  {
    id: "brakeBalance",
    category: "brake",
    zh: {
      title: "煞車平衡",
      categoryLabel: "煞車",
      summary: "煞車平衡決定煞車力偏前或偏後，影響入彎穩定和煞車旋轉。",
      increase: ["更偏前輪，煞車時較穩。", "後輪比較不容易鎖死。", "過度偏前會增加入彎推頭。"],
      decrease: ["更偏後輪，煞車時車尾更願意旋轉。", "可改善入彎轉不進去。", "過度偏後會讓煞車不穩或甩尾。"],
      tips: ["高速車通常需要較保守的前偏。", "入彎煞車尾巴甩，先把平衡往前調。"],
    },
    en: {
      title: "Brake Balance",
      categoryLabel: "Brakes",
      summary: "Brake balance shifts braking force front or rear, changing entry stability and rotation.",
      increase: ["More front-biased and more stable under braking.", "Rear lockup is less likely.", "Too much front bias adds entry understeer."],
      decrease: ["More rear-biased and more rotation under braking.", "Can help a car that refuses to turn on entry.", "Too much rear bias makes braking unstable or oversteery."],
      tips: ["High-speed cars usually need conservative front bias.", "If the rear steps out while braking, move balance forward."],
    },
  },
  {
    id: "brakePressure",
    category: "brake",
    zh: {
      title: "煞車壓力",
      categoryLabel: "煞車",
      summary: "煞車壓力影響最大煞車力和鎖死敏感度。",
      increase: ["煞車力更強，煞車距離可能縮短。", "踏板反應更敏感。", "過高會更容易鎖死或觸發 ABS，入彎不穩。"],
      decrease: ["煞車更容易細膩控制。", "鎖死機率降低。", "過低會讓煞車距離變長。"],
      tips: ["如果常鎖死或 ABS 介入太多，降低壓力。", "如果煞車距離太長且可控，再逐步提高。"],
    },
    en: {
      title: "Brake Pressure",
      categoryLabel: "Brakes",
      summary: "Brake pressure changes maximum braking force and lockup sensitivity.",
      increase: ["Stronger braking and potentially shorter stopping distance.", "More sensitive pedal response.", "Too high locks tires or triggers ABS too easily."],
      decrease: ["More progressive braking control.", "Lower lockup risk.", "Too low increases stopping distance."],
      tips: ["If ABS or lockup appears too often, reduce pressure.", "If braking is stable but too weak, raise pressure gradually."],
    },
  },
  {
    id: "frontDiffAccel",
    category: "diff",
    zh: {
      title: "前差速器加速",
      categoryLabel: "差速器",
      summary: "前差加速影響前輪帶動車頭的能力，主要用於 FWD/AWD 出彎。",
      increase: ["出彎前輪拉力更強。", "AWD/FWD 低速出彎更有推進感。", "過高會讓車頭推直，油門一踩就轉不進去。"],
      decrease: ["油門下轉向更自然。", "前輪較不會互相拉扯。", "過低會讓內側前輪打滑，出彎效率下降。"],
      tips: ["FWD 推頭常和前差加速過高有關。", "AWD 想要更強出彎牽引時可小幅提高。"],
    },
    en: {
      title: "Front Diff Accel",
      categoryLabel: "Differential",
      summary: "Front accel lock changes how strongly the front axle pulls the car on throttle.",
      increase: ["Stronger front pull on exit.", "More drive in AWD/FWD low-speed exits.", "Too high makes the nose push wide under throttle."],
      decrease: ["More natural steering on throttle.", "Less front tire binding.", "Too low lets the inside front spin and hurts exit efficiency."],
      tips: ["FWD power understeer is often linked to excessive front accel lock.", "For AWD exit drive, increase it in small steps."],
    },
  },
  {
    id: "frontDiffDecel",
    category: "diff",
    zh: {
      title: "前差速器減速",
      categoryLabel: "差速器",
      summary: "前差減速影響收油和煞車入彎時前軸的穩定與轉向。",
      increase: ["入彎時前軸更穩，方向較不亂。", "高速煞車更安定。", "過高會讓車頭不願意轉。"],
      decrease: ["收油入彎更靈活。", "車頭更容易指向彎心。", "過低會讓前軸不穩或內輪鎖定感變強。"],
      tips: ["入彎推頭可小幅降低前差減速。", "煞車時車頭晃動可略加。"],
    },
    en: {
      title: "Front Diff Decel",
      categoryLabel: "Differential",
      summary: "Front decel lock affects front-axle behavior while lifting or braking into a corner.",
      increase: ["More stable front axle on entry.", "Calmer high-speed braking.", "Too high makes the nose reluctant to turn."],
      decrease: ["More agile lift-off entry.", "The nose points into the corner more easily.", "Too low can make the front axle feel unstable."],
      tips: ["For entry understeer, lower front decel slightly.", "For braking instability, add a little."],
    },
  },
  {
    id: "rearDiffAccel",
    category: "diff",
    zh: {
      title: "後差速器加速",
      categoryLabel: "差速器",
      summary: "後差加速影響後輪出彎鎖定，是 RWD/AWD 出彎牽引和甩尾傾向的關鍵。",
      increase: ["出彎兩側後輪更一起推，牽引更直接。", "車尾更願意用油門旋轉。", "過高會打滑、甩尾或外拋。"],
      decrease: ["出彎更柔和，較不容易突然甩。", "低抓地路面更容易控油。", "過低會讓內側後輪空轉，推進力下降。"],
      tips: ["後驅出彎太滑，先降低後差加速。", "如果出彎沒力但不打滑，可小幅提高。"],
    },
    en: {
      title: "Rear Diff Accel",
      categoryLabel: "Differential",
      summary: "Rear accel lock is a key RWD/AWD exit traction and throttle-rotation setting.",
      increase: ["Both rear tires drive together more strongly.", "More throttle rotation.", "Too high causes wheelspin, oversteer, or power push."],
      decrease: ["Smoother exit and less sudden oversteer.", "Easier throttle control on low grip.", "Too low lets the inside rear spin and hurts drive."],
      tips: ["For RWD exit oversteer, lower rear accel lock first.", "If exit drive is weak but stable, increase slightly."],
    },
  },
  {
    id: "rearDiffDecel",
    category: "diff",
    zh: {
      title: "後差速器減速",
      categoryLabel: "差速器",
      summary: "後差減速影響收油、煞車和入彎時車尾是否穩定。",
      increase: ["入彎車尾更穩，不容易突然旋轉。", "高速煞車更安心。", "過高會讓車子轉不進彎，推頭加重。"],
      decrease: ["收油入彎更願意旋轉。", "可幫助車頭指向彎心。", "過低會讓車尾過度靈活，煞車入彎容易甩。"],
      tips: ["入彎甩尾通常要提高後差減速。", "入彎太死、轉不進去時可小幅降低。"],
    },
    en: {
      title: "Rear Diff Decel",
      categoryLabel: "Differential",
      summary: "Rear decel lock changes rear stability while lifting, braking, and entering corners.",
      increase: ["A calmer rear on entry.", "More confidence under high-speed braking.", "Too high makes the car refuse to rotate and adds understeer."],
      decrease: ["More lift-off rotation.", "Helps the nose point into the corner.", "Too low makes the rear too lively under braking."],
      tips: ["For entry oversteer, raise rear decel.", "If entry is too dead, lower it slightly."],
    },
  },
  {
    id: "centerDiff",
    category: "diff",
    zh: {
      title: "中央差速器",
      categoryLabel: "差速器",
      summary: "中央差速器決定 AWD 動力偏前或偏後，影響出彎推頭、車尾旋轉和高速穩定。",
      increase: ["更偏後驅，車尾更願意旋轉。", "出彎可用油門幫助轉向。", "過高會讓車尾更容易滑。"],
      decrease: ["更偏前驅，直線牽引和穩定感增加。", "車尾較不容易甩。", "過低會加重油門推頭。"],
      tips: ["AWD 想減少推頭通常會稍微往後調。", "雨天、越野或高馬力不穩時，可以往前收一點。"],
    },
    en: {
      title: "Center Differential",
      categoryLabel: "Differential",
      summary: "The center diff sets AWD front/rear torque split, changing throttle understeer, rotation, and stability.",
      increase: ["More rear-biased and more rotation.", "Throttle can help point the car on exit.", "Too much rear bias makes the rear slide more easily."],
      decrease: ["More front-biased with more straight traction and stability.", "The rear is less likely to step out.", "Too much front bias adds throttle understeer."],
      tips: ["To reduce AWD understeer, move slightly rearward.", "For rain, dirt, or unstable high-power cars, move slightly forward."],
    },
  },
];

const encyclopediaVehicleContextNotes = {
  zh: {
    default: ["同一個調整在不同車重、配重、驅動形式與引擎位置上反應會不同，先判斷車子主要負載在哪一端，再決定調整幅度。"],
    frontTirePressure: [
      "前置或前配重高的車，前胎承受煞車與入彎負載更大，胎壓過高會更容易推頭。",
      "FWD 和 AWD 前輪同時負責轉向與輸出，前胎壓太低會讓反應變鈍，太高則會降低出彎前輪抓地。",
      "重車通常需要更保守的小幅調整，避免胎壓變化同時放大煞車和轉向不穩。",
    ],
    rearTirePressure: [
      "RWD、後置或後配重高的車，後胎壓會直接影響出彎牽引和高速車尾安定。",
      "中置車後胎壓太高時，車尾可能變得很快但不容易接住；太低則會讓車尾反應慢半拍。",
      "高扭力車若出彎容易空轉，通常先小幅降低後胎壓，再動差速器或後彈簧。",
    ],
    finalDrive: [
      "低扭力或高轉馬力車常需要較短齒比讓轉速保持在出力區；大扭力車齒比太短會更容易打滑。",
      "RWD 起步和低速出彎比 AWD 更容易受齒比影響，終傳太高會把輪上扭力放大到超過後胎可承受範圍。",
      "高速賽道與重車要確認高檔仍拉得動，齒比太長看似有尾速，但可能進不到有效轉速區。",
    ],
    frontAlignment: [
      "前置或前配重高的車，前輪更容易在入彎和煞車時過載，需要用外傾角與前束保留前端支撐。",
      "中置車前端較敏感，前束或外傾改太多會讓車頭很銳利，但可控範圍變窄。",
      "FWD 前輪同時負責拉車與轉向，過度激進的前束會增加輪胎熱與直線拖滯。",
    ],
    rearAlignment: [
      "後置或後配重高的車，後輪定位會強烈影響高速安全感，後束太少或後外傾不足都可能讓車尾漂。",
      "中置車車尾慣性集中，後輪定位改動會很直接，通常需要比前置車更小步調整。",
      "RWD 出彎牽引不足時，先確認後外傾沒有過多，否則直線接地和油門牽引會被犧牲。",
    ],
    caster: [
      "前置重車加高後傾能提升高速回正和彎中支撐，但低速轉向會更重。",
      "中置與輕量車本來反應快，後傾過高可能讓前端變得太積極，連續彎需要更細膩控制。",
      "FWD 若前輪負擔很高，後傾可以幫助彎中支撐，但不能取代胎壓、外傾角與防傾桿調整。",
    ],
    frontArb: [
      "前置或前配重高的車，前防傾太硬會把更多橫向負載壓在外側前輪，推頭會更明顯。",
      "重車加硬前防傾能壓住側傾，但若路面顛簸或連續彎多，前輪機械抓地會被犧牲。",
      "中置車前防傾加太多會讓指向很快，但前端極限來得突然，需要配合後防傾一起看。",
    ],
    rearArb: [
      "AWD 和前置車常用較高後防傾幫助車尾旋轉，但過高會讓出彎車尾突然滑。",
      "RWD 高馬力車後防傾太硬時，油門一開會更容易把後輪抓地打破。",
      "中置或後置車的後防傾非常敏感，小幅增加就可能明顯改變車尾反應。",
    ],
    frontSpring: [
      "重車或前配重高的車，前彈簧需要足夠支撐，否則煞車點頭和入彎慣性會放大。",
      "前置引擎車前彈簧太硬容易推頭；中置車前彈簧過硬會讓指向很尖，但抓地窗口變窄。",
      "顛簸、越野或路肩多的路線要保留吸收能力，前彈簧過硬會讓輪胎離地。",
    ],
    rearSpring: [
      "RWD、高扭力、後置或後配重高的車，後彈簧太硬會直接降低出彎牽引。",
      "中置車後彈簧過硬會讓車尾反應變快，極限附近比較突然；過軟則會讓車尾延遲和晃動。",
      "重車後彈簧太軟會加速蹲伏過多，出彎方向會慢，且高速壓縮時車尾支撐不足。",
    ],
    frontRideHeight: [
      "前置重車若前車高太低，煞車或路肩壓縮時容易觸底，前輪抓地會突然消失。",
      "高速車降低前車高可提升前端貼地感，但需要確認彈簧與阻尼能支撐住壓縮行程。",
      "越野和拉力車前端需要行程，低車高帶來的反應提升通常不值得犧牲吸收能力。",
    ],
    rearRideHeight: [
      "後置或後配重高的車，後車高太高會讓高速車尾漂，太低則可能壓縮到底後突然失去抓地。",
      "RWD 高扭力車需要足夠後端行程吸收加速蹲伏，否則出彎抓地會不穩定。",
      "中置車前後車高差會明顯影響轉向姿態，後端變化不宜一次調太多。",
    ],
    frontRebound: [
      "前置重車需要更多前回彈控制車頭回升，但太高會讓前輪在顛簸後貼不回路面。",
      "中置車前端負載較輕，前回彈過高會讓連續彎前輪支撐變硬且失去流暢感。",
      "FWD 若前回彈太高，出彎補油時前輪可能更難維持貼地和轉向。",
    ],
    rearRebound: [
      "RWD、後置或中置車的後回彈會強烈影響出彎牽引，太高會讓後輪在顛簸後抓地中斷。",
      "後配重高的車需要足夠後回彈穩住車尾，但過量會讓車尾在極限附近突然鬆開。",
      "重車若後回彈太低，連續彎會有車尾上下晃和慢半拍的感覺。",
    ],
    frontBump: [
      "前置重車煞車時前壓縮負擔大，前壓縮太低會點頭太多，太高則會撞開路面抓地。",
      "路肩多或顛簸路線需要較柔和前壓縮，讓前輪能吃進路面而不是彈開。",
      "中置車前端反應快，前壓縮過硬會讓入彎初段變尖銳且容錯下降。",
    ],
    rearBump: [
      "RWD 和高扭力車可用後壓縮控制加速蹲伏，但過高會犧牲後輪吸收能力和出彎牽引。",
      "後置或後配重高的車，後壓縮太硬會讓車尾在顛簸和路肩上更容易跳動。",
      "越野、拉力或路面起伏大時，後壓縮要保留行程，避免落地或補油時突然滑動。",
    ],
    frontAero: [
      "高速車或前端偏輕的車，加前空力能改善高速入彎推頭，但會增加阻力。",
      "中置和後置車若前端高速變輕，前空力可以補指向，但要避免讓車尾相對太輕。",
      "低速多彎賽道前空力效果有限，機械抓地、彈簧和防傾通常更優先。",
    ],
    rearAero: [
      "後置、中置或高馬力 RWD 車常需要更多後空力穩住高速車尾。",
      "後空力太多會讓高速更穩，但也可能讓前端相對不足，形成高速推頭。",
      "高速長彎和重車更依賴後空力穩定姿態；短小彎則要注意不要犧牲太多尾速。",
    ],
    brake: [
      "前置或前配重高的車煞車時前輪負載更大，通常可以承受較多前煞比例。",
      "中置與後置車煞車時後軸仍有較多負載，煞車太偏前會浪費後輪抓地，太偏後則容易入彎甩。",
      "重車需要更保守的煞車壓力調整，因為鎖死或 ABS 介入會更明顯破壞入彎姿態。",
    ],
    frontDiff: [
      "FWD 的前差會同時影響牽引和轉向，鎖定太高會油門推頭，太低會內側前輪空轉。",
      "AWD 前差加速過高會讓車頭在出彎被拉直，需要配合中央差速器和後差一起看。",
      "前置高扭力車更容易把前輪推到抓地極限，前差調整要比低馬力車更保守。",
    ],
    rearDiff: [
      "RWD 和 AWD 的後差會決定油門下車尾是穩定推進，還是用油門旋轉。",
      "後置或中置車後軸負載高，後差加速太高時出彎滑動會更突然。",
      "高扭力車後差要保守起步，先確定後胎、後彈簧和後阻尼沒有讓牽引不足。",
    ],
    centerDiff: [
      "AWD 中央差速越偏後，越像 RWD，出彎旋轉更好但車尾更容易滑。",
      "前置 AWD 若推頭明顯，可以逐步往後偏；高馬力或低抓地時則需要保留前軸牽引。",
      "中置或後置 AWD 往後偏會很有效，但也更容易讓高速和出彎變得敏感。",
    ],
  },
  en: {
    default: ["The same adjustment reacts differently across weight, weight balance, drivetrain, and engine position. Identify which axle carries the main load before choosing the adjustment size."],
    frontTirePressure: [
      "Front-engine or front-heavy cars load the front tires heavily under braking and entry, so high front pressure can make understeer worse.",
      "FWD and AWD front tires steer and drive the car, so pressure that is too low dulls response, while pressure that is too high reduces exit grip.",
      "Heavy cars usually need smaller pressure steps because braking and steering stability change together.",
    ],
    rearTirePressure: [
      "RWD, rear-engine, and rear-heavy cars are very sensitive to rear pressure because it controls exit traction and high-speed rear confidence.",
      "Mid-engine cars can feel quick but hard to catch when rear pressure is too high; too low can make the rear respond late.",
      "On high-torque cars with exit wheelspin, lower rear pressure slightly before making large differential or rear spring changes.",
    ],
    finalDrive: [
      "Low-torque or high-RPM cars often need shorter gearing to stay in the power range; high-torque cars can spin tires if gearing is too short.",
      "RWD starts and slow exits are more sensitive to final drive than AWD, because short gearing multiplies rear-wheel torque quickly.",
      "On fast tracks and heavy cars, make sure the upper gears are still reachable. A long ratio may show more top speed but fail to pull into the useful RPM range.",
    ],
    frontAlignment: [
      "Front-engine or front-heavy cars overload the front tires more under braking and entry, so camber and toe must preserve front support.",
      "Mid-engine cars react quickly to front alignment changes. Too much toe or camber can make the nose sharp but narrow the control window.",
      "FWD front tires must steer and drive, so aggressive front toe adds heat, drag, and power-on instability.",
    ],
    rearAlignment: [
      "Rear-engine or rear-heavy cars rely heavily on rear alignment for high-speed confidence. Too little rear toe or rear camber can make the rear float.",
      "Mid-engine cars have concentrated rear inertia, so rear alignment changes are direct and should be made in small steps.",
      "If a RWD car lacks exit traction, check that rear camber is not excessive before changing power settings.",
    ],
    caster: [
      "Front-heavy cars can use more caster for self-centering and mid-corner support, but low-speed steering gets heavier.",
      "Mid-engine and light cars already respond quickly, so high caster can make the front end too eager in linked corners.",
      "On FWD cars, caster can help front support, but it does not replace tire pressure, camber, and anti-roll tuning.",
    ],
    frontArb: [
      "Front-engine or front-heavy cars can understeer more when the front anti-roll bar is too stiff, because the outside front tire takes more lateral load.",
      "Heavy cars may need front roll control, but too much stiffness sacrifices mechanical grip on bumps and linked corners.",
      "Mid-engine cars can become very sharp with more front bar, but the front limit arrives more suddenly.",
    ],
    rearArb: [
      "AWD and front-engine cars often use more rear bar to help rotation, but too much can make the rear step out on exit.",
      "High-power RWD cars lose rear traction quickly when the rear bar is too stiff under throttle.",
      "Mid-engine and rear-engine cars are very sensitive to rear bar changes, so small increases can noticeably change rear behavior.",
    ],
    frontSpring: [
      "Heavy or front-heavy cars need enough front spring support, otherwise brake dive and entry inertia become larger.",
      "Front-engine cars can understeer when front springs are too stiff. Mid-engine cars can become sharp but narrow in grip window.",
      "Bumpy, rally, and curb-heavy routes need compliance. Too much front spring can lift the tire off the surface.",
    ],
    rearSpring: [
      "RWD, high-torque, rear-engine, and rear-heavy cars lose exit traction quickly when rear springs are too stiff.",
      "Mid-engine cars react quickly to rear spring stiffness. Too stiff feels sudden near the limit; too soft creates delay and rear float.",
      "Heavy cars with rear springs that are too soft can squat too much and lose rear support in fast compression.",
    ],
    frontRideHeight: [
      "Front-heavy cars that sit too low can bottom under braking or curbs, causing sudden front grip loss.",
      "Lower front height can improve fast-road front confidence, but only if springs and damping keep enough compression travel.",
      "Rally and off-road cars need front travel. The sharper response from low ride height is usually not worth losing compliance.",
    ],
    rearRideHeight: [
      "Rear-engine or rear-heavy cars can float at speed if the rear is too high, or lose grip suddenly if it bottoms out.",
      "High-torque RWD cars need enough rear travel to absorb squat, otherwise exit traction becomes inconsistent.",
      "Mid-engine cars respond clearly to rake changes, so rear height should not be moved too much at once.",
    ],
    frontRebound: [
      "Front-heavy cars need enough front rebound to control nose rise, but too much keeps the front tire from returning to the road over bumps.",
      "Mid-engine cars carry less front load, so excessive front rebound can make linked-corner support feel harsh and less fluid.",
      "On FWD cars, too much front rebound can reduce front tire contact during power-on exit.",
    ],
    rearRebound: [
      "RWD, rear-engine, and mid-engine cars are sensitive to rear rebound because it affects exit traction after bumps.",
      "Rear-heavy cars need enough rear rebound to calm the platform, but too much can make the rear release suddenly near the limit.",
      "Heavy cars with rear rebound that is too low can feel floaty and delayed through linked corners.",
    ],
    frontBump: [
      "Front-heavy cars put large compression load into the front under braking. Too little front bump dives, too much bounces off the road.",
      "Curb-heavy and bumpy routes need softer front bump so the tire absorbs the surface instead of skipping.",
      "Mid-engine cars already have quick front response, so excessive front bump makes entry sharp with less margin.",
    ],
    rearBump: [
      "RWD and high-torque cars can use rear bump to control squat, but too much costs rear absorption and exit grip.",
      "Rear-engine or rear-heavy cars can hop more over curbs and bumps when rear bump is too stiff.",
      "Off-road, rally, and rough routes need rear compression travel to avoid sudden slide after landings or throttle inputs.",
    ],
    frontAero: [
      "Fast cars or cars with a light front end can use front aero to reduce high-speed understeer, but drag increases.",
      "Mid-engine and rear-engine cars may need front aero when the nose gets light at speed, but too much can make the rear feel relatively light.",
      "On low-speed technical tracks, front aero has limited effect, so mechanical grip, springs, and anti-roll bars usually come first.",
    ],
    rearAero: [
      "Rear-engine, mid-engine, and high-power RWD cars often need more rear aero for high-speed rear stability.",
      "Too much rear aero calms the rear but can make the front feel weak, creating high-speed understeer.",
      "Fast sweepers and heavy cars rely more on rear aero stability. Tight tracks should avoid giving away too much top speed.",
    ],
    brake: [
      "Front-engine or front-heavy cars load the front tires heavily under braking and can usually use more front bias.",
      "Mid-engine and rear-engine cars keep more rear load while braking. Too much front bias wastes rear grip, too much rear bias causes entry oversteer.",
      "Heavy cars need conservative pressure steps because lockup or ABS intervention disrupts corner entry more strongly.",
    ],
    frontDiff: [
      "On FWD cars, front diff settings affect traction and steering at the same time. Too much lock causes power understeer; too little spins the inside tire.",
      "On AWD cars, high front accel lock pulls the nose wide on exit, so it must be considered with center and rear diff settings.",
      "Front-engine high-torque cars reach front tire grip limits sooner, so front diff changes should be conservative.",
    ],
    rearDiff: [
      "RWD and AWD rear diff settings decide whether throttle gives stable drive or throttle rotation.",
      "Rear-engine and mid-engine cars carry more rear load, so excessive rear accel lock can make exit slides more sudden.",
      "High-torque cars should start conservative, after confirming rear tires, rear springs, and rear damping are not causing the traction issue.",
    ],
    centerDiff: [
      "More rear-biased AWD behaves closer to RWD, improving rotation but making the rear easier to slide.",
      "Front-engine AWD cars with understeer can move rearward gradually. High-power or low-grip builds should keep enough front drive.",
      "Mid-engine or rear-engine AWD responds strongly to rear bias and can become sensitive at speed and on exit.",
    ],
  },
};

const encyclopediaVehicleContextAliases = {
  frontCamber: "frontAlignment",
  frontToe: "frontAlignment",
  rearCamber: "rearAlignment",
  rearToe: "rearAlignment",
  brakeBalance: "brake",
  brakePressure: "brake",
  frontDiffAccel: "frontDiff",
  frontDiffDecel: "frontDiff",
  rearDiffAccel: "rearDiff",
  rearDiffDecel: "rearDiff",
};

function encyclopediaVehicleContextFor(item) {
  const language = currentLanguage();
  const notes = encyclopediaVehicleContextNotes[language] ?? encyclopediaVehicleContextNotes.zh;
  const key = encyclopediaVehicleContextAliases[item.id] ?? item.id;
  return notes[key] ?? notes[item.category] ?? notes.default ?? [];
}

const encyclopediaEngineContextNotes = {
  zh: {
    default: ["引擎類型會改變扭力來得早晚、油門是否突然，以及車子在出彎和高速延伸時需要的穩定程度。"],
    tirePressure: [
      "渦輪爆發型、低轉大扭力型和電動瞬間扭力型容易在補油瞬間打破輪胎抓地，驅動輪胎壓通常要用較小步調調整。",
      "高轉馬力型與平坦扭力型輸出較線性，胎壓主要用來修正轉向反應和高速支撐，不需要過度依賴胎壓壓制打滑。",
    ],
    finalDrive: [
      "高轉馬力型通常需要齒比讓轉速留在高轉輸出區；低轉大扭力型可以承受較長齒比，避免低檔輪上扭力過大。",
      "渦輪爆發型要避免升檔後掉出增壓區；電動瞬間扭力型則常需要較長或較保守齒比，讓起步和低速出彎不要過度打滑。",
    ],
    frontAlignment: [
      "高轉馬力型與平坦扭力型前端負載變化較可預期，前定位可以偏向彎中支撐和轉向精準度。",
      "渦輪爆發型、低轉大扭力型或電動瞬間扭力型在補油時更容易把車頭推出去，FWD/AWD 前束與外傾不宜過度激進。",
    ],
    rearAlignment: [
      "高扭力或渦輪爆發型車若出彎滑，後外傾過多會讓直線接地不足，後束也要保留足夠穩定。",
      "高轉馬力型通常可以更重視高速彎後輪支撐；平坦扭力型則比較適合用小幅定位修正手感。",
    ],
    caster: [
      "高轉馬力型和高速取向車可用較高後傾增加彎中支撐和高速回正。",
      "低轉大扭力、渦輪爆發或電動瞬間扭力車若低速補油已經很敏感，後傾不宜讓前端反應過度尖銳。",
    ],
    frontArb: [
      "高轉馬力型高速彎負載較高，前防傾可以用來控制車身側傾，但過硬會犧牲彎中前輪抓地。",
      "低轉大扭力、渦輪爆發或電動瞬間扭力型出彎推頭時，不要只加硬前防傾，應先確認驅動輪牽引和差速器設定。",
    ],
    rearArb: [
      "渦輪爆發、低轉大扭力和電動瞬間扭力型若後防傾太硬，補油時車尾會更容易突然滑開。",
      "高轉馬力型和機械增壓線性型可用後防傾提高中高速旋轉，但仍要留意高速彎車尾安定。",
    ],
    frontSpring: [
      "高轉馬力型高速負載和煞車速度較高，前彈簧需要足夠支撐車頭。",
      "渦輪爆發或低轉大扭力車若出彎一補油就推頭，前彈簧過硬可能讓前輪更難貼地。",
    ],
    rearSpring: [
      "低轉大扭力、渦輪爆發和電動瞬間扭力型最怕後彈簧過硬，因為補油瞬間會直接破壞後輪牽引。",
      "高轉馬力型可用稍高後彈簧支撐高速姿態，但如果出彎轉速掉太多，後端太硬仍會拖慢回速。",
    ],
    frontRideHeight: [
      "高轉馬力型和高速取向車對前端空力與壓縮行程更敏感，前車高太低觸底會讓高速前端突然失效。",
      "低轉大扭力或渦輪爆發型低速出彎負載轉移明顯，前車高要保留足夠行程避免補油時車頭浮動。",
    ],
    rearRideHeight: [
      "高扭力與電動瞬間扭力型加速蹲伏明顯，後車高太低容易壓縮到底，太高則高速車尾不穩。",
      "高轉馬力型長時間高速負載較多，後車高要兼顧空力姿態和壓縮行程。",
    ],
    frontRebound: [
      "高轉馬力型連續高速彎需要穩定前端平台，但前回彈過高會讓前輪在顛簸後貼不回地面。",
      "低轉大扭力、渦輪爆發或電動瞬間扭力型出彎補油時，前回彈太高可能讓車頭更難重新抓住路面。",
    ],
    rearRebound: [
      "渦輪爆發、低轉大扭力和電動瞬間扭力型對後回彈很敏感，太高會在補油和顛簸時中斷後輪牽引。",
      "高轉馬力型可以用後回彈穩住高速車尾，但過高會讓連續彎後段變得僵硬。",
    ],
    frontBump: [
      "高轉馬力型高速煞車與高速壓縮較強，前壓縮要支撐車頭但不能硬到彈開路面。",
      "渦輪爆發或低轉大扭力型如果低速彎一補油就推頭，前壓縮過硬可能讓前輪更難吸收轉移。",
    ],
    rearBump: [
      "低轉大扭力、渦輪爆發和電動瞬間扭力型可用後壓縮控制加速蹲伏，但過硬會直接犧牲出彎牽引。",
      "機械增壓線性型和平坦扭力型較容易用後壓縮細修姿態，不需要一次下太重。",
    ],
    frontAero: [
      "高轉馬力型和高速延伸車更依賴前空力維持高速入彎指向。",
      "低轉大扭力或渦輪爆發型若主要問題在低速補油推頭，前空力幫助有限，應優先看機械抓地與差速器。",
    ],
    rearAero: [
      "高馬力、高轉或半英里取向車需要後空力穩住高速尾部，但過多會吃掉尾速。",
      "渦輪爆發、低轉大扭力和電動瞬間扭力型若高速補油車尾不安定，後空力可以增加安全感，但低速打滑仍要靠機械抓地處理。",
    ],
    brake: [
      "高轉馬力型通常進彎速度高，煞車壓力和前後平衡要保守，避免高速入彎不穩。",
      "低轉大扭力、渦輪爆發或電動瞬間扭力型出彎速度變化大，煞車設定要避免讓車尾在重煞後接補油時過度敏感。",
    ],
    frontDiff: [
      "FWD/AWD 搭配渦輪爆發或低轉大扭力時，前差加速太高會讓補油推頭非常明顯。",
      "平坦扭力或機械增壓線性型較容易承受較高前差鎖定；電動瞬間扭力型則要更保守避免前輪拉扯。",
    ],
    rearDiff: [
      "低轉大扭力、渦輪爆發和電動瞬間扭力型通常需要較保守後差加速，避免油門一開就雙輪一起滑。",
      "高轉馬力型可接受較積極後差來維持高速出彎推進，但仍要確認低檔不會突然甩尾。",
    ],
    centerDiff: [
      "渦輪爆發、低轉大扭力和電動瞬間扭力 AWD 若太偏後，補油時會更像 RWD，車尾更容易滑。",
      "高轉馬力型 AWD 可以用較後偏的中央差速提升旋轉和高速出彎，但低速彎仍要保留牽引餘裕。",
    ],
  },
  en: {
    default: ["Engine type changes when torque arrives, how abrupt throttle response feels, and how much stability the car needs on exit or at speed."],
    tirePressure: [
      "Turbo-hit, low-end torque, and instant-torque builds can break tire grip as soon as throttle is applied, so driven tire pressure should move in smaller steps.",
      "High-RPM and flat-torque engines are more predictable, so tire pressure mainly trims steering response and high-speed support instead of masking wheelspin.",
    ],
    finalDrive: [
      "High-RPM engines usually need gearing that keeps RPM in the upper power range. Low-end torque engines can use longer gearing to avoid excessive wheel torque.",
      "Turbo-hit engines should avoid falling below boost after shifts. Instant-torque builds often need longer or calmer gearing for launch and slow exits.",
    ],
    frontAlignment: [
      "High-RPM and flat-torque engines have more predictable front load changes, so front alignment can prioritize mid-corner support and precision.",
      "Turbo-hit, low-end torque, and instant-torque builds can push the nose wide under throttle, especially on FWD/AWD, so aggressive front toe and camber need care.",
    ],
    rearAlignment: [
      "On high-torque or turbo-hit cars, excessive rear camber can reduce straight-line contact and worsen exit traction, while rear toe should preserve stability.",
      "High-RPM cars can prioritize fast-corner rear support. Flat-torque cars usually respond well to smaller alignment trims.",
    ],
    caster: [
      "High-RPM and high-speed builds can use more caster for mid-corner support and self-centering.",
      "Low-end torque, turbo-hit, and instant-torque cars may already feel sharp on throttle, so caster should not make the front end overly eager.",
    ],
    frontArb: [
      "High-RPM cars carry more speed into fast corners, so front ARB can control roll, but excessive stiffness sacrifices mid-corner front grip.",
      "If a low-end torque, turbo-hit, or instant-torque car pushes on exit, do not only stiffen the front ARB. Check traction and diff behavior first.",
    ],
    rearArb: [
      "Turbo-hit, low-end torque, and instant-torque cars can snap the rear loose if rear ARB is too stiff on throttle.",
      "High-RPM and linear supercharged builds can use rear ARB for mid/high-speed rotation, but high-speed rear stability still matters.",
    ],
    frontSpring: [
      "High-RPM cars often brake and corner faster, so front springs need enough support.",
      "On turbo-hit or low-end torque cars that push when throttle is added, overly stiff front springs can make it harder for the front tires to stay loaded.",
    ],
    rearSpring: [
      "Low-end torque, turbo-hit, and instant-torque builds dislike overly stiff rear springs because throttle arrives hard and breaks rear traction.",
      "High-RPM builds can use slightly firmer rear springs for speed support, but if RPM drops too far on exit, an overly stiff rear still hurts recovery.",
    ],
    frontRideHeight: [
      "High-RPM and high-speed builds are more sensitive to front aero posture and compression travel. Bottoming makes the front suddenly lose effectiveness.",
      "Low-end torque and turbo-hit builds create strong load transfer on exit, so front height needs enough travel to avoid nose lift and vague steering.",
    ],
    rearRideHeight: [
      "High-torque and instant-torque builds squat harder. Rear height that is too low can bottom, while too high can make the rear unstable at speed.",
      "High-RPM cars carry more sustained high-speed load, so rear height must balance aero posture and compression travel.",
    ],
    frontRebound: [
      "High-RPM cars need a steady front platform in fast linked corners, but too much front rebound keeps the tire from returning over bumps.",
      "On low-end torque, turbo-hit, or instant-torque cars, excessive front rebound can make the front end harder to regain under power.",
    ],
    rearRebound: [
      "Turbo-hit, low-end torque, and instant-torque builds are very sensitive to rear rebound. Too much interrupts rear traction over bumps and throttle inputs.",
      "High-RPM builds can use rear rebound for high-speed rear stability, but too much makes linked-corner behavior stiff.",
    ],
    frontBump: [
      "High-RPM cars create stronger high-speed braking and compression loads, so front bump must support the nose without skipping off the road.",
      "If a turbo-hit or low-end torque car pushes on slow exit, overly stiff front bump can stop the front tires from absorbing load transfer.",
    ],
    rearBump: [
      "Low-end torque, turbo-hit, and instant-torque builds can use rear bump to control squat, but too much directly reduces exit traction.",
      "Linear supercharged and flat-torque engines are easier to trim with rear bump because throttle arrival is more progressive.",
    ],
    frontAero: [
      "High-RPM and high-speed builds rely more on front aero for fast-corner direction.",
      "If a low-end torque or turbo-hit build mainly pushes on slow throttle exits, front aero has limited effect. Mechanical grip and diff behavior come first.",
    ],
    rearAero: [
      "High-power, high-RPM, or half-mile builds often need rear aero for high-speed rear stability, but too much costs terminal speed.",
      "Turbo-hit, low-end torque, and instant-torque builds can use rear aero for high-speed throttle confidence, but low-speed wheelspin still needs mechanical grip.",
    ],
    brake: [
      "High-RPM builds usually arrive with higher entry speed, so brake pressure and balance should stay conservative enough for stable high-speed entry.",
      "Low-end torque, turbo-hit, and instant-torque builds have large speed changes between braking and throttle, so avoid brake setups that make the rear nervous before power is applied.",
    ],
    frontDiff: [
      "On FWD/AWD turbo-hit or low-end torque builds, too much front accel lock creates strong power understeer.",
      "Flat-torque and linear supercharged builds tolerate more front lock. Instant-torque builds should stay conservative to avoid front tire binding.",
    ],
    rearDiff: [
      "Low-end torque, turbo-hit, and instant-torque builds usually need conservative rear accel lock so both rear tires do not slide together immediately.",
      "High-RPM builds can accept more rear lock for fast exit drive, but low-gear snap oversteer still needs checking.",
    ],
    centerDiff: [
      "Turbo-hit, low-end torque, and instant-torque AWD cars become more RWD-like when biased rearward, making the rear easier to slide on throttle.",
      "High-RPM AWD builds can use more rear bias for rotation and fast exits, but slow corners still need traction reserve.",
    ],
  },
};

const encyclopediaEngineContextAliases = {
  frontTirePressure: "tirePressure",
  rearTirePressure: "tirePressure",
  frontCamber: "frontAlignment",
  frontToe: "frontAlignment",
  rearCamber: "rearAlignment",
  rearToe: "rearAlignment",
  frontRideHeight: "frontRideHeight",
  rearRideHeight: "rearRideHeight",
  brakeBalance: "brake",
  brakePressure: "brake",
  frontDiffAccel: "frontDiff",
  frontDiffDecel: "frontDiff",
  rearDiffAccel: "rearDiff",
  rearDiffDecel: "rearDiff",
};

function encyclopediaEngineContextFor(item) {
  const language = currentLanguage();
  const notes = encyclopediaEngineContextNotes[language] ?? encyclopediaEngineContextNotes.zh;
  const key = encyclopediaEngineContextAliases[item.id] ?? item.id;
  return notes[key] ?? notes[item.category] ?? notes.default ?? [];
}

const encyclopediaInteractionNotes = {
  zh: {
    default: [
      "單一部件通常不會獨立造成完整手感，真正影響車輛的是輪胎、懸吊、空力、煞車、齒比和差速器之間的平衡。",
      "調整時先找主要症狀，再判斷是哪一組部件在同一個時機互相放大或互相抵消。",
    ],
    tirePressure: [
      "胎壓會改變接地面與胎壁支撐，所以外傾角、防傾桿、彈簧或車高改過後，都應重新確認熱胎胎壓。",
      "驅動輪胎壓會放大或緩和齒比與差速器造成的輪上扭力；出彎打滑時不要只看差速器。",
    ],
    finalDrive: [
      "終傳比會把引擎扭力轉成輪上扭力，會直接放大胎壓、差速器和驅動形式帶來的牽引問題。",
      "輪胎外徑、終傳比、紅線 RPM 和目標終端速度是一整條鏈；換輪胎尺寸後，實際齒比感受也會一起變。",
    ],
    frontAlignment: [
      "前外傾與前束會改變前胎接地方式，若前防傾或前彈簧太硬，定位調整可能只是把前輪過載掩蓋起來。",
      "煞車平衡偏前時，前輪定位會更影響入彎穩定；前束太激進會讓煞車時車頭更不安定。",
    ],
    rearAlignment: [
      "後外傾與後束會和後彈簧、後防傾、後差速器一起決定車尾是穩定跟上，還是突然旋轉。",
      "如果後胎牽引不足，過多後外傾、太硬後彈簧和過高後差鎖定常會一起放大問題。",
    ],
    caster: [
      "後傾會增加轉向時的動態外傾，會和前外傾角、前胎壓、前防傾一起影響彎中前端支撐。",
      "後傾提高後，方向盤回正和高速穩定會變強，但前束或前防傾太激進時也可能讓車頭反應過尖。",
    ],
    frontArb: [
      "前防傾和後防傾是一組平衡，單純加硬前防傾通常會提高反應，但也可能減少前輪機械抓地。",
      "前防傾需要和前彈簧、前回彈與前胎壓一起看；若路面顛簸，太硬會讓前輪更容易離地。",
    ],
    rearArb: [
      "後防傾會影響車尾旋轉，會和後彈簧、後回彈、後胎壓與後差速器一起決定出彎穩定。",
      "當後差速器已經很積極時，再加硬後防傾可能讓油門一開就變成突然甩尾。",
    ],
    spring: [
      "彈簧決定車身平台支撐，阻尼決定車身移動速度，車高決定可用行程，防傾桿負責左右側傾分配。",
      "如果彈簧基礎太硬或太軟，胎壓、外傾角和阻尼常只能短暫修飾，無法真正修正抓地窗口。",
    ],
    rideHeight: [
      "車高會同時影響懸吊行程、觸底風險和空力姿態；太低會讓彈簧、阻尼和空力表現變得不穩定。",
      "前後車高差會改變重量轉移感，調整後通常要回頭檢查彈簧、壓縮阻尼和空力平衡。",
    ],
    rebound: [
      "回彈阻尼控制彈簧被壓縮後回復的速度，會直接影響連續彎、路肩和出彎後輪是否貼地。",
      "回彈要和彈簧硬度、壓縮阻尼和車高一起看；太高會讓輪胎伸不回地面，太低會讓車身晃動拖慢反應。",
    ],
    bump: [
      "壓縮阻尼控制煞車點頭、撞路肩、落地和加速蹲伏時車身吸收路面的速度。",
      "壓縮太高會把輪胎彈離路面，太低會讓車身行程用太快，因此要搭配彈簧、車高和回彈一起調整。",
    ],
    aero: [
      "空力下壓會增加高速輪胎負載，所以車高、彈簧和阻尼要支撐得住，否則高速時可能觸底或姿態飄移。",
      "前後空力平衡會改變高速推頭或甩尾，若只加一端，通常需要回頭修正車高、彈簧或防傾桿。",
    ],
    brake: [
      "煞車平衡會和前胎胎壓、前彈簧、前壓縮阻尼一起決定煞車入彎時前輪能不能承受負載。",
      "後煞比例提高會幫助入彎旋轉，但也會和後差速器減速、後束與後胎壓一起影響車尾穩定。",
    ],
    frontDiff: [
      "前差速器會和前胎胎壓、前束、終傳比及中央差速器一起決定補油時車頭是拉出去還是推出去。",
      "前差鎖定提高後，如果前防傾或前彈簧太硬，前輪更容易同時失去轉向與牽引。",
    ],
    rearDiff: [
      "後差速器會和後胎胎壓、後彈簧、後防傾與終傳比一起決定出彎時後輪是抓住還是一起滑。",
      "後差加速太高時，降低齒比攻擊性、放軟後端支撐或調整後胎壓，可能比單純降低差速器更有效。",
    ],
    centerDiff: [
      "中央差速器會把 AWD 的牽引分配到前後軸，會同時影響前差、後差、前後防傾和胎壓調整結果。",
      "往後偏會提高旋轉但也放大後輪負擔；如果後端已經不穩，應先看後胎、後彈簧和後差速器。",
    ],
  },
  en: {
    default: [
      "A single part rarely creates the full handling feel by itself. The car reacts to the balance between tires, suspension, aero, brakes, gearing, and differentials.",
      "Start from the main symptom, then identify which parts are amplifying or cancelling each other at the same moment.",
    ],
    tirePressure: [
      "Tire pressure changes contact patch and sidewall support, so recheck warm pressure after camber, anti-roll bar, spring, or ride-height changes.",
      "Driven tire pressure can amplify or calm the wheel torque created by gearing and differential settings. Do not blame only the diff for exit wheelspin.",
    ],
    finalDrive: [
      "Final drive converts engine torque into wheel torque, so it directly magnifies traction issues from tire pressure, differentials, and drivetrain layout.",
      "Tire diameter, final drive, redline RPM, and target terminal speed are one chain. Changing tire size changes how the gearing feels.",
    ],
    frontAlignment: [
      "Front camber and toe change how the front tires contact the road. If front ARB or front springs are too stiff, alignment may only hide front overload.",
      "With more front brake bias, front alignment affects entry stability more. Aggressive front toe can make the nose nervous under braking.",
    ],
    rearAlignment: [
      "Rear camber and toe work with rear springs, rear ARB, and rear diff to decide whether the rear follows calmly or rotates suddenly.",
      "When rear traction is weak, excessive rear camber, stiff rear springs, and high rear diff lock often amplify the same problem.",
    ],
    caster: [
      "Caster adds dynamic camber while steering, so it interacts with front camber, front pressure, and front ARB for mid-corner support.",
      "More caster improves self-centering and speed confidence, but aggressive toe or front ARB can make the nose too sharp.",
    ],
    frontArb: [
      "Front and rear anti-roll bars are a balance pair. Stiffening the front often improves response but can reduce front mechanical grip.",
      "Front ARB should be judged with front springs, front rebound, and front tire pressure. On bumps, too much stiffness makes the front skip.",
    ],
    rearArb: [
      "Rear ARB affects rotation and works with rear springs, rear rebound, rear pressure, and rear diff to decide exit stability.",
      "If the rear diff is already aggressive, stiffening the rear ARB can turn throttle application into snap oversteer.",
    ],
    spring: [
      "Springs set platform support, damping controls body-motion speed, ride height sets available travel, and anti-roll bars distribute roll stiffness.",
      "If spring rate is fundamentally too hard or too soft, pressure, camber, and damping can only mask the grip-window issue.",
    ],
    rideHeight: [
      "Ride height affects suspension travel, bottoming risk, and aero posture. Too low makes spring, damping, and aero behavior inconsistent.",
      "Front/rear ride-height split changes weight-transfer feel, so spring, bump damping, and aero balance should be checked after height changes.",
    ],
    rebound: [
      "Rebound controls how quickly the spring extends after compression, affecting linked corners, curbs, and whether tires return to the road on exit.",
      "Rebound must match spring rate, bump damping, and ride height. Too high keeps the tire from extending; too low lets the body float.",
    ],
    bump: [
      "Bump damping controls how the car absorbs brake dive, curbs, landings, and throttle squat.",
      "Too much bump bounces the tire off the road, while too little uses travel too quickly, so it must match springs, ride height, and rebound.",
    ],
    aero: [
      "Aero adds high-speed tire load, so ride height, springs, and damping must support it or the car can bottom or lose posture at speed.",
      "Front/rear aero balance changes high-speed understeer or oversteer. If only one end changes, ride height, springs, or ARBs may need review.",
    ],
    brake: [
      "Brake balance works with front pressure, front springs, and front bump damping to decide whether the front tires can carry entry load.",
      "More rear bias can help entry rotation, but it also interacts with rear diff decel, rear toe, and rear pressure for rear stability.",
    ],
    frontDiff: [
      "Front diff works with front pressure, front toe, final drive, and center diff to decide whether throttle pulls the nose or pushes it wide.",
      "With more front lock, stiff front ARB or front springs can make the front tires lose steering and drive at the same time.",
    ],
    rearDiff: [
      "Rear diff works with rear pressure, rear springs, rear ARB, and final drive to decide whether rear tires hook up or slide together.",
      "When rear accel lock is too high, calmer gearing, softer rear support, or pressure changes may help more than only lowering diff lock.",
    ],
    centerDiff: [
      "Center diff distributes AWD traction between axles, so it changes the result of front diff, rear diff, ARB, and pressure adjustments.",
      "More rear bias improves rotation but adds rear-tire load. If the rear is already unstable, check rear tires, rear springs, and rear diff first.",
    ],
  },
};

const encyclopediaInteractionAliases = {
  frontTirePressure: "tirePressure",
  rearTirePressure: "tirePressure",
  frontCamber: "frontAlignment",
  frontToe: "frontAlignment",
  rearCamber: "rearAlignment",
  rearToe: "rearAlignment",
  frontSpring: "spring",
  rearSpring: "spring",
  frontRideHeight: "rideHeight",
  rearRideHeight: "rideHeight",
  frontRebound: "rebound",
  rearRebound: "rebound",
  frontBump: "bump",
  rearBump: "bump",
  frontAero: "aero",
  rearAero: "aero",
  brakeBalance: "brake",
  brakePressure: "brake",
  frontDiffAccel: "frontDiff",
  frontDiffDecel: "frontDiff",
  rearDiffAccel: "rearDiff",
  rearDiffDecel: "rearDiff",
};

function encyclopediaInteractionFor(item) {
  const language = currentLanguage();
  const notes = encyclopediaInteractionNotes[language] ?? encyclopediaInteractionNotes.zh;
  const key = encyclopediaInteractionAliases[item.id] ?? item.id;
  return notes[key] ?? notes[item.category] ?? notes.default ?? [];
}

const encyclopediaTireTemperatureNotes = {
  zh: {
    shared: {
      summary:
        "胎溫要看外側、中央、內側的相對溫度，而不是只看單一數字。冷代表輪胎沒有被有效使用，工作溫度代表負載分布接近合理，過熱代表該區域長時間超出抓地窗口。",
      zones: [
        {
          label: "外側",
          cold: "外側偏冷通常代表過彎時外肩沒有被充分壓上，可能入彎負載不足或外傾角過多。",
          hot: "外側偏熱多半出現在入彎與彎中，常見原因是外傾角不足、胎壓偏低、側傾過大或防傾/彈簧支撐不足。",
          adjust: "優先檢查外傾角與胎壓，再看防傾桿、彈簧和回彈阻尼是否讓車身側傾太多。",
        },
        {
          label: "中央",
          cold: "中央偏冷且兩側較熱時，胎面可能被胎壁變形吃掉，常見於胎壓偏低。",
          hot: "中央偏熱通常代表胎壓偏高，接地面集中在中間，轉向或出彎會變銳但抓地窗口變窄。",
          adjust: "先修胎壓；如果中央溫度正常但兩側過熱，再回頭檢查外傾角和車身支撐。",
        },
        {
          label: "內側",
          cold: "內側偏冷可能代表外傾角不足，彎中外側胎肩負擔較重。",
          hot: "內側偏熱常見於外傾角過多或束角拖磨，直線、煞車或出彎接地面可能不足。",
          adjust: "檢查外傾角與束角；如果只在長直線後內側熱，通常先減少外傾或束角，而不是改彈簧。",
        },
      ],
      adjustmentOrder: [
        "先看胎壓：中央過熱先降壓，兩側比中央熱先升壓或檢查胎壁變形。",
        "再看外傾角：外側長期過熱多半需要更多負外傾，內側長期過熱則可能負外傾過多。",
        "接著看支撐：同一側外肩過熱又伴隨側傾，才檢查防傾桿、彈簧、回彈與車高。",
        "最後看動力與煞車：後胎出彎過熱看差速器與齒比，前胎煞車過熱看煞車平衡與前端壓縮支撐。",
      ],
    },
    front: {
      title: "前胎重點",
      focus: "前胎胎溫主要用來判斷煞車、入彎、彎中推頭與轉向反應。讀取時要特別注意煞車後到入彎、以及彎中長時間負載的溫度變化。",
      moments: [
        {
          label: "煞車時",
          read: "前中央或內側快速升溫，可能是胎壓偏高、前外傾過多或煞車平衡太偏前。",
          adjust: "先檢查前胎壓與前外傾，再微調煞車平衡、前壓縮阻尼和前彈簧支撐。",
        },
        {
          label: "入彎時",
          read: "前外側快速過熱且車頭推，通常代表前輪被外肩吃住。",
          adjust: "可增加前負外傾、略降前胎壓，或用後防傾/後彈簧增加旋轉，避免只加硬前端。",
        },
        {
          label: "彎中時",
          read: "前外側持續過熱代表長時間側向負載過高；前內側過熱則可能是外傾角太多，低速彎接地不足。",
          adjust: "外側熱先看外傾與側傾控制；內側熱先減少外傾或束角，再看前防傾是否過硬。",
        },
        {
          label: "出彎加速時",
          read: "FWD/AWD 前胎整體升溫且推頭，常是前輪同時負責轉向和輸出，輪上扭力過大。",
          adjust: "檢查前胎壓、前差速器加速鎖定、終傳比與前束；不要只用胎壓壓制油門推頭。",
        },
      ],
    },
    rear: {
      title: "後胎重點",
      focus: "後胎胎溫主要用來判斷出彎牽引、車尾穩定與高速姿態。RWD/AWD 要特別看補油後溫度是否瞬間升高。",
      moments: [
        {
          label: "入彎收油 / 重煞時",
          read: "後內側或整體溫度突然升高且車尾不穩，可能是後束太少、後外傾過多或後差減速太低。",
          adjust: "先檢查後束與後外傾，再看後差速器減速鎖定、煞車平衡與後回彈。",
        },
        {
          label: "彎中時",
          read: "後外側過熱且車尾慢慢滑開，常見於後防傾或後彈簧太硬、後胎壓偏低或後外傾不足。",
          adjust: "先修後胎壓與後外傾，再檢查後防傾、後彈簧和後回彈是否讓外側後輪過載。",
        },
        {
          label: "出彎加速時",
          read: "後中央或整體快速過熱，通常是輪上扭力太大或後胎接地不足，車尾會空轉或滑動。",
          adjust: "檢查後胎壓、後差加速鎖定、低檔齒比與後彈簧；高扭力車要避免只靠加大後差鎖定。",
        },
        {
          label: "高速長彎時",
          read: "後胎外側或整體過熱且車尾漂，可能是後空力不足、後車高姿態不穩或後端支撐不合理。",
          adjust: "檢查後空力、後車高、後回彈和後彈簧；如果前端太強，也可能需要重新平衡前後空力。",
        },
      ],
    },
  },
  en: {
    shared: {
      summary:
        "Read tire temperature by comparing the outer, center, and inner bands rather than chasing one number. Cold means that section is not being used enough, working temperature means load is reasonably distributed, and overheated means that section has stayed beyond the grip window.",
      zones: [
        {
          label: "Outer",
          cold: "A cold outer band usually means the shoulder is not being loaded enough in corners, often from too much camber or low corner load.",
          hot: "A hot outer band usually appears on entry and mid-corner from too little camber, low pressure, excessive roll, or weak platform support.",
          adjust: "Check camber and pressure first, then anti-roll bars, springs, and rebound if the car rolls too much.",
        },
        {
          label: "Center",
          cold: "A cold center with hotter shoulders usually points to low pressure and sidewall deformation.",
          hot: "A hot center usually means pressure is too high, concentrating load in the middle and narrowing the grip window.",
          adjust: "Adjust pressure first. If the center is normal but both shoulders overheat, then inspect camber and platform support.",
        },
        {
          label: "Inner",
          cold: "A cold inner band may mean there is not enough camber and the outside shoulder is carrying most of the corner load.",
          hot: "A hot inner band often means too much camber or toe scrub, reducing straight-line, braking, or exit contact.",
          adjust: "Check camber and toe. If the inner band heats mainly after straights, reduce camber or toe before changing springs.",
        },
      ],
      adjustmentOrder: [
        "Start with pressure: hot center usually means lower pressure; hot shoulders with a cold center usually means raise pressure or reduce carcass flex.",
        "Then check camber: long-term outer heat usually needs more negative camber, while long-term inner heat may mean too much negative camber.",
        "Then inspect support: if outer shoulder heat comes with body roll, check ARBs, springs, rebound, and ride height.",
        "Finally check torque and braking: rear exit heat points to diff and gearing; front braking heat points to brake balance and front compression support.",
      ],
    },
    front: {
      title: "Front Tire Focus",
      focus: "Front tire temperature is best for reading braking, turn-in, mid-corner understeer, and steering response. Watch the change from braking into entry, then through sustained mid-corner load.",
      moments: [
        {
          label: "Under Braking",
          read: "Fast center or inner front heat can mean high pressure, too much front camber, or too much front brake bias.",
          adjust: "Check front pressure and camber first, then brake balance, front bump damping, and front spring support.",
        },
        {
          label: "On Entry",
          read: "Fast outer-front overheating with understeer usually means the tire is leaning onto the outside shoulder.",
          adjust: "Add front negative camber, lower front pressure slightly, or add rear rotation with rear ARB/spring instead of only stiffening the front.",
        },
        {
          label: "Mid-Corner",
          read: "Sustained outer-front heat means high lateral load. Inner-front heat can mean too much camber and poor low-speed contact.",
          adjust: "For outer heat, check camber and roll control. For inner heat, reduce camber or toe, then inspect if front ARB is too stiff.",
        },
        {
          label: "On Exit",
          read: "On FWD/AWD, front tires heating as a pair with power understeer means the front axle is steering and driving beyond its grip window.",
          adjust: "Check front pressure, front diff accel lock, final drive, and front toe. Do not use pressure alone to hide power understeer.",
        },
      ],
    },
    rear: {
      title: "Rear Tire Focus",
      focus: "Rear tire temperature is best for reading exit traction, rear stability, and high-speed posture. On RWD/AWD, watch whether temperature spikes right after throttle.",
      moments: [
        {
          label: "Lift / Heavy Braking",
          read: "Inner-rear or full-rear heat with instability can point to too little rear toe, too much rear camber, or low rear diff decel.",
          adjust: "Check rear toe and camber first, then rear diff decel, brake balance, and rear rebound.",
        },
        {
          label: "Mid-Corner",
          read: "Outer-rear overheating with the rear slowly sliding usually means rear ARB/spring is too stiff, pressure is low, or rear camber is insufficient.",
          adjust: "Correct rear pressure and camber first, then check rear ARB, rear springs, and rear rebound for outside-rear overload.",
        },
        {
          label: "On Exit",
          read: "Center or full-rear heat rising quickly usually means too much wheel torque or not enough rear contact, causing wheelspin or slide.",
          adjust: "Check rear pressure, rear diff accel lock, low-gear ratio, and rear springs. High-torque cars should not rely only on more diff lock.",
        },
        {
          label: "Fast Sweepers",
          read: "Outer or full-rear overheating with rear float can mean weak rear aero, unstable rear ride height, or poor rear support.",
          adjust: "Check rear aero, rear ride height, rear rebound, and rear springs. If the front is too strong, rebalance front/rear aero.",
        },
      ],
    },
  },
};

function encyclopediaTireTemperatureFor(item) {
  if (item.id !== "frontTirePressure" && item.id !== "rearTirePressure") return null;
  const language = currentLanguage();
  const notes = encyclopediaTireTemperatureNotes[language] ?? encyclopediaTireTemperatureNotes.zh;
  const axleKey = item.id === "frontTirePressure" ? "front" : "rear";
  return {
    shared: notes.shared,
    axle: notes[axleKey],
  };
}

const encyclopediaLearningNotes = {
  zh: {
    default: {
      timing: ["當症狀穩定重複出現，且輪胎、路線和駕駛輸入都排除後，再調整這個部件。"],
      mistakes: ["一次改太多項目會讓你不知道真正有效的是哪一個調整。"],
      related: ["胎壓", "防傾桿", "彈簧", "阻尼"],
    },
    tirePressure: {
      timing: ["用來做第一層手感微調，特別是轉向初段、出彎牽引、熱胎後抓地感不穩定時。", "適合在大改彈簧、防傾或差速器之前先做小幅修正。"],
      mistakes: ["把胎壓當成萬用解法，結果用過低胎壓掩蓋懸吊或差速器問題。", "冷胎數值看起來正常，但熱胎後壓力過高或過低才是真正問題。"],
      related: ["外傾角", "前後束", "防傾桿", "差速器", "彈簧"],
    },
    finalDrive: {
      timing: ["當車輛出彎轉速太低、直線拉不動、或最後一檔用不到時，才優先檢查齒比。", "適合先決定終端速度與主要檔位區間，再細修單檔銜接。"],
      mistakes: ["只看尾速數字而把齒比拉太長，實際賽道上反而進不到有效轉速。", "低檔太短會讓起步或慢彎出彎打滑，不能只用加速感判斷好壞。"],
      related: ["紅線 RPM", "最高馬力 RPM", "輪胎尺寸", "差速器", "後胎胎壓"],
    },
    frontAlignment: {
      timing: ["當入彎和彎中前輪抓地不足，但胎壓和防傾桿已接近合理時，再微調前輪定位。", "適合修正轉向初段、彎中推頭、直線穩定和前輪溫度分布。"],
      mistakes: ["用過多外傾角修正推頭，導致煞車和低速彎接地變差。", "前束調太多會讓車很靈敏，但高速飄、拖速和胎溫都會惡化。"],
      related: ["前胎胎壓", "主銷後傾", "前防傾桿", "前彈簧", "煞車平衡"],
    },
    rearAlignment: {
      timing: ["當高速車尾漂、出彎牽引不足或車尾旋轉太突然時，檢查後輪定位。", "適合用來建立車尾安全感，尤其是 RWD、中置和後置車。"],
      mistakes: ["後束太少讓車尾靈活，但高速和重煞入彎會變得不安心。", "後外傾過多會看起來穩，實際卻犧牲直線接地和出彎牽引。"],
      related: ["後胎胎壓", "後防傾桿", "後彈簧", "後回彈阻尼", "後差速器"],
    },
    caster: {
      timing: ["當你想微調方向盤回正、彎中前輪支撐和高速信心時再調後傾。", "適合在外傾角和胎壓大致正確後，用來修飾前端手感。"],
      mistakes: ["把後傾當成解決推頭的主要工具，忽略胎壓、前防傾和外傾角。", "後傾過高會讓低速轉向變重，車頭反應不一定更快。"],
      related: ["前外傾角", "前束", "前胎胎壓", "前防傾桿"],
    },
    frontArb: {
      timing: ["當車身側傾太多、轉向初段太慢，或需要控制前端平台時使用。", "如果問題是彎中推頭，通常先避免繼續加硬前防傾。"],
      mistakes: ["以為加硬前防傾一定會更會轉，實際上前輪抓地常會下降。", "在顛簸路線加太硬，會讓前輪更容易跳離路面。"],
      related: ["後防傾桿", "前彈簧", "前回彈阻尼", "前外傾角", "前胎胎壓"],
    },
    rearArb: {
      timing: ["當車輛彎中或出彎太推、車尾太穩、需要更多旋轉時使用。", "適合微調 AWD 或前置車的轉向意願，但要觀察出彎車尾。"],
      mistakes: ["後防傾加太多會讓車尾突然滑，不等於真正增加抓地。", "用後防傾修正所有推頭，可能掩蓋前輪抓地或差速器問題。"],
      related: ["前防傾桿", "後彈簧", "後回彈阻尼", "後胎胎壓", "後差速器"],
    },
    spring: {
      timing: ["當車身支撐、煞車點頭、加速蹲伏或大起伏到底明顯時，再調彈簧。", "適合用來決定車輛平台基調，之後再用阻尼修飾速度。"],
      mistakes: ["以為越硬越穩，但過硬會讓輪胎離地、彎中抓地下降。", "只調彈簧不調阻尼，容易出現支撐變了但車身回復速度不對。"],
      related: ["車高", "回彈阻尼", "壓縮阻尼", "防傾桿", "胎壓"],
    },
    rideHeight: {
      timing: ["當車輛觸底、高速姿態不穩、或越野跳躍落地不穩時檢查車高。", "適合搭配彈簧和阻尼一起看，不能只追求最低。"],
      mistakes: ["把車高降到最低就以為一定最快，實際觸底會瞬間失去抓地。", "只調一端車高會改變車身姿態，可能同時影響入彎和出彎。"],
      related: ["彈簧", "壓縮阻尼", "回彈阻尼", "空力", "輪胎尺寸"],
    },
    rebound: {
      timing: ["當車身在壓縮後回復太快或太慢、連續彎晃動、顛簸後貼地不足時調回彈。", "適合在彈簧硬度確定後，用來修飾車身轉移速度。"],
      mistakes: ["回彈調太高會讓輪胎伸不回地面，看似穩定但實際抓地變差。", "用回彈壓住所有晃動，可能讓車在路肩和顛簸上失去接地。"],
      related: ["彈簧", "壓縮阻尼", "車高", "防傾桿", "胎壓"],
    },
    bump: {
      timing: ["當煞車點頭、撞路肩、落地、加速蹲伏或高速壓縮太明顯時調壓縮阻尼。", "適合控制輪胎遇到路面輸入時的吸收速度。"],
      mistakes: ["壓縮阻尼太高會讓車彈開路面，不是所有不穩都該加硬。", "壓縮高過回彈太多，常會讓車在連續顛簸中失去節奏。"],
      related: ["回彈阻尼", "彈簧", "車高", "路肩/路面", "胎壓"],
    },
    aero: {
      timing: ["當問題出現在高速彎、高速煞車或尾速段穩定時，空力才是優先工具。", "低速彎推頭或出彎打滑通常先看機械抓地，不要先加空力。"],
      mistakes: ["用空力修低速問題，結果增加阻力但症狀沒有改善。", "只加後空力會讓高速更穩，但可能讓前端相對不足而推頭。"],
      related: ["車高", "彈簧", "高速穩定", "齒比", "前後空力平衡"],
    },
    brake: {
      timing: ["當煞車距離、入彎穩定、ABS 介入或煞車時車尾反應不對時調煞車。", "適合在輪胎和車身支撐大致正確後再細修。"],
      mistakes: ["只加煞車壓力追求短距離，結果更容易鎖死或破壞入彎姿態。", "平衡太偏後會幫助旋轉，但也可能讓重煞入彎很危險。"],
      related: ["前胎胎壓", "前彈簧", "前壓縮阻尼", "後差速器減速", "前後配重"],
    },
    frontDiff: {
      timing: ["FWD/AWD 補油推頭、內側前輪空轉或出彎拉力不足時，檢查前差速器。", "適合在齒比和前胎抓地合理後再調整。"],
      mistakes: ["前差加速太高會讓車頭被油門拉直，不一定代表前輪抓地不夠。", "前差太低會讓內側前輪空轉，出彎看似安全但效率變差。"],
      related: ["前胎胎壓", "前束", "終傳比", "中央差速器", "前防傾桿"],
    },
    rearDiff: {
      timing: ["RWD/AWD 出彎打滑、油門旋轉不足或入彎收油車尾不穩時，檢查後差速器。", "適合在後胎、後彈簧和齒比合理後再細修。"],
      mistakes: ["後差加速太高會讓兩側後輪一起滑，不等於牽引更好。", "後差減速太低會讓入彎很會轉，但重煞時車尾可能不安全。"],
      related: ["後胎胎壓", "後彈簧", "後回彈阻尼", "終傳比", "中央差速器"],
    },
    centerDiff: {
      timing: ["AWD 出彎推頭、車尾不願意旋轉，或高馬力補油不穩時調中央差速器。", "適合先決定車子要偏安全牽引還是偏後驅旋轉。"],
      mistakes: ["過度後偏會讓 AWD 失去穩定優勢，變成容易甩的 RWD 感。", "過度前偏雖然穩，但油門推頭會明顯加重。"],
      related: ["前差速器", "後差速器", "前後防傾桿", "後胎胎壓", "齒比"],
    },
  },
  en: {
    default: {
      timing: ["Adjust this part only after the symptom repeats consistently and tire state, route, and driving input are not the main cause."],
      mistakes: ["Changing too many parts at once makes it impossible to know which change actually helped."],
      related: ["Tire pressure", "Anti-roll bars", "Springs", "Damping"],
    },
    tirePressure: {
      timing: ["Use it as the first layer of feel tuning, especially for initial steering, exit traction, or inconsistent warm-tire grip.", "It is often worth a small pressure change before large spring, ARB, or diff changes."],
      mistakes: ["Using very low pressure to hide suspension or differential problems.", "Judging only cold pressure when the real issue appears after tires warm up."],
      related: ["Camber", "Toe", "Anti-roll bars", "Differential", "Springs"],
    },
    finalDrive: {
      timing: ["Check gearing when exit RPM is too low, straights feel flat, or top gear is never usable.", "Set target terminal speed and key gear range first, then refine spacing."],
      mistakes: ["Making gearing too long because the displayed top speed looks better, even though the car cannot pull into the useful RPM range.", "Making low gears too short can create launch or slow-exit wheelspin."],
      related: ["Redline RPM", "Peak HP RPM", "Tire size", "Differential", "Rear tire pressure"],
    },
    frontAlignment: {
      timing: ["Tune front alignment when entry or mid-corner front grip is lacking after pressure and ARB are already reasonable.", "Use it to refine turn-in, mid-corner push, straight stability, and front tire loading."],
      mistakes: ["Adding too much camber to fix understeer, then losing braking and low-speed contact.", "Using too much front toe for sharpness, which adds wander, drag, and tire heat."],
      related: ["Front tire pressure", "Caster", "Front anti-roll bar", "Front springs", "Brake balance"],
    },
    rearAlignment: {
      timing: ["Check rear alignment when the rear floats at speed, lacks exit traction, or rotates too suddenly.", "It is especially important for RWD, mid-engine, and rear-engine stability."],
      mistakes: ["Too little rear toe can feel agile but unsafe under fast braking and high speed.", "Too much rear camber may look stable but hurts straight contact and exit drive."],
      related: ["Rear tire pressure", "Rear anti-roll bar", "Rear springs", "Rear rebound damping", "Rear differential"],
    },
    caster: {
      timing: ["Use caster to refine self-centering, mid-corner front support, and high-speed confidence.", "It works best after camber and tire pressure are already close."],
      mistakes: ["Treating caster as the main fix for understeer while ignoring pressure, front ARB, and camber.", "Too much caster can make low-speed steering heavy without making the car faster."],
      related: ["Front camber", "Front toe", "Front tire pressure", "Front anti-roll bar"],
    },
    frontArb: {
      timing: ["Use it when roll is excessive, initial response is lazy, or the front platform needs control.", "If the main issue is mid-corner understeer, avoid stiffening the front first."],
      mistakes: ["Assuming a stiffer front bar always turns better, when it often reduces front grip.", "Too much front bar on bumpy routes makes the front tire skip."],
      related: ["Rear anti-roll bar", "Front springs", "Front rebound damping", "Front camber", "Front tire pressure"],
    },
    rearArb: {
      timing: ["Use it when the car pushes mid-corner or exit, feels too safe at the rear, or needs more rotation.", "It is useful for AWD or front-engine rotation, but watch exit stability."],
      mistakes: ["Too much rear bar creates sudden oversteer instead of real grip.", "Using rear bar to fix every understeer case can hide front grip or diff issues."],
      related: ["Front anti-roll bar", "Rear springs", "Rear rebound damping", "Rear tire pressure", "Rear differential"],
    },
    spring: {
      timing: ["Adjust springs when platform support, brake dive, squat, or bottoming is clearly visible.", "Use springs to set the platform, then damping to tune the speed of motion."],
      mistakes: ["Believing stiffer always means more stable. Too stiff lifts tires and reduces corner grip.", "Changing springs without damping often fixes support but leaves the body motion wrong."],
      related: ["Ride height", "Rebound damping", "Bump damping", "Anti-roll bars", "Tire pressure"],
    },
    rideHeight: {
      timing: ["Check ride height when the car bottoms, feels unstable at speed, or lands poorly off-road.", "It should be judged together with springs and damping, not simply minimized."],
      mistakes: ["Dropping height to minimum because lower seems faster, then losing grip from bottoming.", "Changing only one end alters rake and can affect both entry and exit."],
      related: ["Springs", "Bump damping", "Rebound damping", "Aero", "Tire size"],
    },
    rebound: {
      timing: ["Adjust rebound when the body returns too fast or too slowly, linked corners feel floaty, or tires do not return after bumps.", "Use it after spring rate is close to tune weight-transfer speed."],
      mistakes: ["Too much rebound keeps the tire from extending back to the road, feeling stable but losing grip.", "Using rebound to suppress all motion can make curbs and bumps worse."],
      related: ["Springs", "Bump damping", "Ride height", "Anti-roll bars", "Tire pressure"],
    },
    bump: {
      timing: ["Adjust bump damping for brake dive, curb hits, landings, squat, and high-speed compression.", "It controls how the tire absorbs surface input."],
      mistakes: ["Too much bump makes the car bounce off the road. Not every instability needs more stiffness.", "Bump that is too high relative to rebound can ruin rhythm over repeated bumps."],
      related: ["Rebound damping", "Springs", "Ride height", "Road surface", "Tire pressure"],
    },
    aero: {
      timing: ["Use aero first when the problem happens in fast corners, fast braking, or top-speed stability.", "For low-speed understeer or exit wheelspin, mechanical grip usually comes first."],
      mistakes: ["Using aero to fix low-speed problems adds drag without solving the cause.", "Adding only rear aero calms the rear but can create relative front weakness and high-speed understeer."],
      related: ["Ride height", "Springs", "High-speed stability", "Gearing", "Front/rear aero balance"],
    },
    brake: {
      timing: ["Tune brakes when stopping distance, entry stability, ABS intervention, or rear behavior under braking feels wrong.", "Refine it after tires and platform support are close."],
      mistakes: ["Raising pressure only for shorter stopping distance can increase lockup and damage entry posture.", "Too much rear bias helps rotation but can make heavy braking dangerous."],
      related: ["Front tire pressure", "Front springs", "Front bump damping", "Rear diff decel", "Weight distribution"],
    },
    frontDiff: {
      timing: ["On FWD/AWD, check front diff for power understeer, inside-front spin, or weak exit pull.", "Adjust it after gearing and front tire grip are reasonable."],
      mistakes: ["Too much front accel lock pulls the nose straight under throttle.", "Too little front lock can spin the inside tire and waste exit drive."],
      related: ["Front tire pressure", "Front toe", "Final drive", "Center differential", "Front anti-roll bar"],
    },
    rearDiff: {
      timing: ["On RWD/AWD, check rear diff for exit wheelspin, weak throttle rotation, or lift-off/braking rear instability.", "Tune it after rear tires, rear springs, and gearing are reasonable."],
      mistakes: ["Too much rear accel lock makes both rear tires slide together instead of adding traction.", "Too little rear decel can rotate well on entry but become unsafe under braking."],
      related: ["Rear tire pressure", "Rear springs", "Rear rebound damping", "Final drive", "Center differential"],
    },
    centerDiff: {
      timing: ["On AWD, tune center diff for exit understeer, reluctant rotation, or unstable high-power throttle.", "Decide whether the car should favor safe traction or rear-drive rotation."],
      mistakes: ["Too much rear bias removes much of AWD's stability advantage.", "Too much front bias is safe but increases power understeer."],
      related: ["Front differential", "Rear differential", "Anti-roll bars", "Rear tire pressure", "Gearing"],
    },
  },
};

const encyclopediaLearningAliases = {
  frontTirePressure: "tirePressure",
  rearTirePressure: "tirePressure",
  frontCamber: "frontAlignment",
  frontToe: "frontAlignment",
  rearCamber: "rearAlignment",
  rearToe: "rearAlignment",
  frontSpring: "spring",
  rearSpring: "spring",
  frontRideHeight: "rideHeight",
  rearRideHeight: "rideHeight",
  frontRebound: "rebound",
  rearRebound: "rebound",
  frontBump: "bump",
  rearBump: "bump",
  frontAero: "aero",
  rearAero: "aero",
  brakeBalance: "brake",
  brakePressure: "brake",
  frontDiffAccel: "frontDiff",
  frontDiffDecel: "frontDiff",
  rearDiffAccel: "rearDiff",
  rearDiffDecel: "rearDiff",
};

function encyclopediaLearningFor(item) {
  const language = currentLanguage();
  const notes = encyclopediaLearningNotes[language] ?? encyclopediaLearningNotes.zh;
  const key = encyclopediaLearningAliases[item.id] ?? item.id;
  return notes[key] ?? notes[item.category] ?? notes.default;
}

const settingCards = [
  ["前胎胎壓", "tireFront", "BAR", "熱胎後落在 2.20 到 2.35 BAR 附近為目標"],
  ["後胎胎壓", "tireRear", "BAR", "驅動輪可略低，換取出彎牽引"],
  ["終傳比", "finalDrive", "", "數值越高越偏加速，越低越偏尾速"],
  ["外傾角", "camber", "度", "前輪通常比後輪更負"],
  ["前後束", "toe", "度", "前外八提升反應，後內八提升穩定"],
  ["主銷後傾", "caster", "度", "高角度提升回正與彎中支撐"],
  ["防傾桿", "arb", "", "統一換算為 1 到 65 的遊戲可調數值"],
  ["彈簧", "spring", "%", "越野偏軟，公路與高速偏硬"],
  ["車高", "ride", "%", "公路越低越穩，越野需要行程"],
  ["回彈阻尼", "rebound", "", "統一換算為 1 到 20，控制車身轉移速度"],
  ["壓縮阻尼", "bump", "", "統一換算為 1 到 20，通常低於回彈"],
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

function springRangeLinked() {
  return state.springRangeLinked === true;
}

function linkedSpringRangeField(field) {
  const linkedFields = {
    frontMin: "rearMin",
    frontMax: "rearMax",
    rearMin: "frontMin",
    rearMax: "frontMax",
  };
  return linkedFields[field] ?? "";
}

function syncSpringRangeFromFront() {
  const range = normalizeAdjustmentRange("spring", true);
  if (!range) return;
  range.rearMin = range.frontMin;
  range.rearMax = range.frontMax;
  state.adjustmentRanges.spring = range;
}

function syncLinkedSpringRangeValue(field, value) {
  if (!springRangeLinked()) return;
  const linkedField = linkedSpringRangeField(field);
  if (!linkedField) return;
  state.adjustmentRanges.spring[linkedField] = value;
}

function adjustmentRangeSummary(groupId) {
  const range = normalizeAdjustmentRange(groupId);
  if (!range) return "";
  return `${t("frontShort")} ${formatAdjustmentNumber(range.frontMin)}-${formatAdjustmentNumber(
    range.frontMax,
  )} / ${t("rearShort")} ${formatAdjustmentNumber(range.rearMin)}-${formatAdjustmentNumber(range.rearMax)}`;
}

function adjustmentRangeText(groupId) {
  if (!adjustableSettingIds.has(groupId)) return "";
  const label = configurableAdjustmentRangeIds.has(groupId) ? t("adjustableRange") : t("fixedRange");
  return `${t("rangeScaledPrefix")}${label} ${adjustmentRangeSummary(groupId)} ${t("rangeScaledSuffix")}`.trimEnd();
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

function currentLanguage() {
  return "zh";
}

function t(key, values = {}) {
  const language = currentLanguage();
  const template = translations[language]?.[key] ?? translations.zh[key] ?? key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  );
}

function preferredLanguage() {
  return "zh";
}

function translatedValue(groupKey, id) {
  return optionTranslations[currentLanguage()]?.[groupKey]?.[id] ?? null;
}

function localizedOption(groupKey, option) {
  if (!option) return option;
  const translated = translatedValue(groupKey, option.id);
  if (!translated) return option;
  return { ...option, ...translated };
}

function localizedAdjustmentRangeGroup(group) {
  const label = optionTranslations[currentLanguage()]?.adjustmentRangeGroups?.[group.id] ?? group.label;
  return { ...group, label };
}

function localizedAdjustmentRangeField(field, fallbackLabel) {
  return optionTranslations[currentLanguage()]?.adjustmentRangeFields?.[field] ?? fallbackLabel;
}

function localizedSettingCard(card) {
  const [label, key, unit, note] = card;
  const translated = optionTranslations[currentLanguage()]?.settingCards?.[key];
  if (!translated) return card;
  return [translated[0] ?? label, key, unit, translated[1] ?? note];
}

function localizedAvailabilityGroup(group) {
  return optionTranslations[currentLanguage()]?.availabilityGroups?.[group.id] ?? group.label;
}

function localizedCompensationTarget(targetId) {
  const zhTargets = {
    tire: "胎壓",
    alignment: "定位角",
    antiRoll: "防傾桿",
    suspension: "懸吊",
    aero: "空力",
    brake: "煞車",
    diff: "差速器",
    gearbox: "齒輪箱",
  };
  return optionTranslations[currentLanguage()]?.compensationTargets?.[targetId] ?? zhTargets[targetId] ?? targetId;
}

function localizedMeterLabel(key, fallbackLabel) {
  return optionTranslations[currentLanguage()]?.meters?.[key] ?? fallbackLabel;
}

function localizedRaceGearNote(raceId, fallbackNote) {
  return optionTranslations[currentLanguage()]?.raceGearNotes?.[raceId] ?? fallbackNote;
}

function availabilityEnabled(groupId) {
  return state.availability?.[groupId] !== false;
}

function tuneKeyAdjustable(key) {
  const groupId = tuneKeyAvailabilityGroup[key];
  return !groupId || availabilityEnabled(groupId);
}

function settingAvailabilityStatus(settingKey) {
  const groupIds = settingAvailabilityGroups[settingKey] ?? [];
  if (!groupIds.length) return "available";
  const disabledCount = groupIds.filter((groupId) => !availabilityEnabled(groupId)).length;
  if (!disabledCount) return "available";
  return disabledCount === groupIds.length ? "unavailable" : "partial";
}

function compensationTargetAvailable(targetId) {
  const groupIds = compensationTargetGroups[targetId] ?? [];
  return groupIds.length === 0 || groupIds.some((groupId) => availabilityEnabled(groupId));
}

function fallbackTargetsForGroups(groupIds) {
  const targetIds = [
    ...new Set(
      groupIds
        .map((groupId) => availabilityById[groupId])
        .filter(Boolean)
        .flatMap((group) => group.fallbackTargets),
    ),
  ].filter(compensationTargetAvailable);
  return targetIds.map(localizedCompensationTarget);
}

function compensationNoteForSetting(settingKey) {
  const disabledGroups = (settingAvailabilityGroups[settingKey] ?? []).filter((groupId) => !availabilityEnabled(groupId));
  if (!disabledGroups.length) return "";
  const targets = fallbackTargetsForGroups(disabledGroups);
  if (!targets.length) return t("compensationLimited");
  return `${t("compensationPrefix")} ${targets.join(" / ")} ${t("compensationSuffix")}`.trim();
}

function unavailableLabelForStatus(status) {
  return status === "partial" ? t("settingPartUnavailable") : t("settingUnavailable");
}

function copyStatusText(status) {
  return status === "available" ? "" : ` (${unavailableLabelForStatus(status)})`;
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage() === "en" ? "en" : "zh-Hant";

  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    languageSelect.value = currentLanguage();
    languageSelect.setAttribute("aria-label", t("languageLabel"));
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
}

function refreshLanguageUi() {
  applyStaticTranslations();
  applyTheme(state.theme);
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  syncConfigControls();
  renderAvailabilityControls();
  renderAdjustmentRangeControls();
  bindAdjustmentRangeInputs();
  syncAdjustmentRangeInputs();
  syncGearStrategyControls();
  syncTrackTypeControls();
  syncVehicleInputs();
  syncTuneFocusIntensityInput();
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderEncyclopedia();
  renderResult();
  renderGearCalculator();
}

function setLanguage(language) {
  state.language = "zh";
  refreshLanguageUi();
}

function bindLanguageSelect() {
  state.language = "zh";
  applyStaticTranslations();
}

const raceRecommendations = {
  road: {
    engine: "flatTorque",
    engineWhy: "公路路線會同時遇到直線、彎道與連續出彎，平坦扭力能提供最穩定的泛用基準。",
    drive: "awd",
    driveWhy: "AWD 能提供混合路線較穩定的出彎牽引，也能降低高馬力車突然打滑的風險。",
  },
  rally: {
    engine: "lowEnd",
    engineWhy: "拉力賽常在低中速與鬆散路面補油，低轉扭力能讓車更容易拉出彎。",
    drive: "awd",
    driveWhy: "AWD 在砂石、泥地和跳躍落地後最穩，能減少單軸打滑。",
  },
  offroad: {
    engine: "lowEnd",
    engineWhy: "越野路面阻力大，低轉扭力能處理爬坡、落地後再加速和長行程懸吊帶來的速度損失。",
    drive: "awd",
    driveWhy: "AWD 能分散扭力到四輪，越野起伏和混合路面更容易維持牽引。",
  },
  dragQuarter: {
    engine: "turboHit",
    engineWhy: "Quarter Mile 更重視起步到中段的爆發，渦輪型輸出可以提供短距離加速衝刺。",
    drive: "awd",
    driveWhy: "AWD 起步抓地較好，能把高馬力更快轉成短距離直線加速。",
  },
  dragHalf: {
    engine: "highRpm",
    engineWhy: "Half Mile 需要中後段延伸，高轉型輸出比較容易在較長距離維持速度成長。",
    drive: "rwd",
    driveWhy: "RWD 傳動損失較低，當起步已能控制時，中後段加速和尾速會更乾淨。",
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

function normalizeTuneFocusIntensity() {
  const value = Number(state.tuneFocusIntensity);
  const normalized = Number.isFinite(value) ? value : 100;
  state.tuneFocusIntensity = Math.round(clampNumber(normalized, ...tuneFocusIntensityLimits) / 5) * 5;
  return state.tuneFocusIntensity;
}

function tuneFocusIntensityMultiplier() {
  return normalizeTuneFocusIntensity() / 100;
}

function scaledMods(mods = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(mods).map(([key, value]) => [key, (Number(value) || 0) * multiplier]),
  );
}

function scaledGearMods(gearMods = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(gearMods).map(([key, value]) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return [key, 0];
      if (key === "topTargetMultiplier") return [key, 1 + (numeric - 1) * multiplier];
      return [key, numeric * multiplier];
    }),
  );
}

const dragRaceIds = new Set(["dragQuarter", "dragHalf"]);

function routeShapeEnabled(raceId = state.race) {
  return !dragRaceIds.has(raceId);
}

function normalizeTrackType() {
  const value = Number(state.trackType);
  const normalized = Number.isFinite(value) ? value : 55;
  if (!routeShapeEnabled()) {
    state.trackType = 0;
    return 0;
  }
  state.trackType = Math.round(clampNumber(normalized, ...routeShapeLimits.trackType) / 5) * 5;
  return state.trackType;
}

function trackTypeRatio() {
  return normalizeTrackType() / 100;
}

function formatTrackTypeLabel() {
  return routeShapeEnabled() ? t("trackTypeValue", { value: normalizeTrackType() }) : t("trackTypeStraight");
}

function formatTrackTypeOutputLabel() {
  return `${normalizeTrackType()}%`;
}

function selectedCornerProfile() {
  return optionById(cornerProfileTypes, state.cornerProfile) ?? cornerProfileTypes[0];
}

function formatCornerProfileLabel() {
  return routeShapeEnabled() ? localizedOption("cornerProfileTypes", selectedCornerProfile()).label : t("cornerProfileStraight");
}

function trackTypeMods() {
  if (!routeShapeEnabled()) {
    state.trackType = 0;
    return {};
  }
  const ratio = trackTypeRatio();
  const corner = clampNumber((ratio - 0.5) * 2, 0, 1);
  const straight = clampNumber((0.5 - ratio) * 2, 0, 1);

  return {
    tireFront: -0.25 * corner + 0.08 * straight,
    tireRear: -0.15 * corner + 0.12 * straight,
    finalDrive: 0.24 * corner - 0.24 * straight,
    camberFront: -0.3 * corner + 0.18 * straight,
    camberRear: -0.16 * corner + 0.12 * straight,
    toeFront: 0.025 * corner - 0.012 * straight,
    toeRear: 0.025 * straight,
    caster: 0.18 * corner,
    arbFront: -3 * corner + 2 * straight,
    arbRear: 3 * corner - 1 * straight,
    springFront: -2 * corner + 3 * straight,
    springRear: -1 * corner + 2 * straight,
    rideFront: -2 * straight,
    rideRear: -2 * straight,
    reboundFront: -1 * corner + 2 * straight,
    reboundRear: -1 * corner + 2 * straight,
    aeroFront: 9 * corner - 10 * straight,
    aeroRear: 10 * corner - 12 * straight,
    brakePressure: -2 * corner + 1 * straight,
    diffFrontAccel: -3 * corner,
    diffRearAccel: -3 * corner,
    diffCenter: -2 * corner,
  };
}

function trackTypeGearMods() {
  if (!routeShapeEnabled()) {
    state.trackType = 0;
    return {};
  }
  const ratio = trackTypeRatio();
  const corner = clampNumber((ratio - 0.5) * 2, 0, 1);
  const straight = clampNumber((0.5 - ratio) * 2, 0, 1);

  return {
    firstTarget: -5 * corner + 5 * straight,
    topTargetMultiplier: 1 + 0.03 * straight - 0.015 * corner,
    topRatio: 0.035 * corner - 0.055 * straight,
    curvePower: -0.07 * corner + 0.07 * straight,
    finalDriveBias: 0.08 * corner - 0.08 * straight,
  };
}

function cornerProfileMods() {
  return routeShapeEnabled() ? selectedCornerProfile().mods ?? {} : {};
}

function cornerProfileGearMods() {
  return routeShapeEnabled() ? selectedCornerProfile().gearMods ?? {} : {};
}

function formatTuneFocusIntensity() {
  return `${normalizeTuneFocusIntensity()}%`;
}

function tuneFocusIntensityHint() {
  const intensity = normalizeTuneFocusIntensity();
  if (intensity === 0) return t("tuneFocusNone");
  if (intensity < 75) return t("tuneFocusLight");
  if (intensity === 100) return t("tuneFocusStandard");
  if (intensity < 125) return t("tuneFocusStrong");
  return t("tuneFocusAggressive");
}

function tuneFocusUsesIntensity(tuneFocus = optionById(tuneFocusTypes, state.tuneFocus)) {
  return false;
}

function formatTuneFocusLabel(tuneFocus = optionById(tuneFocusTypes, state.tuneFocus)) {
  const option = localizedOption("tuneFocusTypes", tuneFocus ?? tuneFocusTypes[0]);
  return tuneFocusUsesIntensity(tuneFocus) ? `${option.label} ${formatTuneFocusIntensity()}` : option.label;
}

function clampTune(tune) {
  Object.entries(ranges).forEach(([key, [min, max]]) => {
    tune[key] = Math.min(max, Math.max(min, tune[key]));
  });
  return tune;
}

function parseTireSpec(spec, fallbackSpec = "245/35R19") {
  const normalized = String(spec || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const match = normalized.match(/^(\d{3})\/(\d{2})R(\d{2})$/);
  const fallback = fallbackSpec === spec ? null : parseTireSpec(fallbackSpec, fallbackSpec);

  if (!match) return fallback;

  const widthMm = Number(match[1]);
  const aspectRatio = Number(match[2]);
  const wheelInch = Number(match[3]);
  const valid =
    widthMm >= vehicleSpecLimits.frontTireSizeMm[0] &&
    widthMm <= vehicleSpecLimits.frontTireSizeMm[1] &&
    aspectRatio >= vehicleSpecLimits.tireAspectRatio[0] &&
    aspectRatio <= vehicleSpecLimits.tireAspectRatio[1] &&
    wheelInch >= vehicleSpecLimits.tireWheelInch[0] &&
    wheelInch <= vehicleSpecLimits.tireWheelInch[1];

  if (!valid) return fallback;

  const sidewallMm = widthMm * (aspectRatio / 100);
  const wheelDiameterMm = wheelInch * 25.4;
  const diameterMm = wheelDiameterMm + sidewallMm * 2;
  const circumferenceMeters = (diameterMm / 1000) * Math.PI;

  return {
    spec: `${widthMm}/${aspectRatio}R${wheelInch}`,
    widthMm,
    aspectRatio,
    wheelInch,
    diameterMm,
    circumferenceMeters,
  };
}

function frontTireSpec() {
  return parseTireSpec(state.frontTireSpec, "245/35R19");
}

function rearTireSpec() {
  return parseTireSpec(state.rearTireSpec, "265/35R19");
}

function normalizeVehicleSpecs() {
  const weight = Number(state.carWeight);
  const frontWeight = Number(state.frontWeightPercent);
  const frontTire = frontTireSpec();
  const rearTire = rearTireSpec();
  const power = Number(state.powerKw);
  const torque = Number(state.torqueNm);
  state.carWeight = clampNumber(Number.isFinite(weight) ? weight : 1500, ...vehicleSpecLimits.carWeight);
  state.frontWeightPercent = Math.round(
    clampNumber(Number.isFinite(frontWeight) ? frontWeight : 52, ...vehicleSpecLimits.frontWeightPercent),
  );
  state.frontTireSpec = frontTire.spec;
  state.rearTireSpec = rearTire.spec;
  state.frontTireSizeMm = frontTire.widthMm;
  state.rearTireSizeMm = rearTire.widthMm;
  state.powerKw = Math.round(clampNumber(Number.isFinite(power) ? power : 400, ...vehicleSpecLimits.powerKw));
  state.torqueNm = Math.round(clampNumber(Number.isFinite(torque) ? torque : 650, ...vehicleSpecLimits.torqueNm));
}

function vehicleWeightIndex() {
  return clampNumber((state.carWeight - 1500) / 500, -1.6, 3);
}

function frontWeightIndex() {
  return clampNumber((state.frontWeightPercent - 52) / 10, -1.7, 1.7);
}

function tireSizeIndex(stateKey, defaultSize) {
  normalizeVehicleSpecs();
  return clampNumber((state[stateKey] - defaultSize) / 40, -2, 2);
}

function tireStaggerIndex() {
  normalizeVehicleSpecs();
  return clampNumber((state.rearTireSizeMm - state.frontTireSizeMm - 20) / 50, -2, 2);
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

function tireSizeDynamicsMods() {
  normalizeVehicleSpecs();
  const frontTire = tireSizeIndex("frontTireSizeMm", 245);
  const rearTire = tireSizeIndex("rearTireSizeMm", 265);
  const averageTire = (frontTire + rearTire) / 2;
  const stagger = tireStaggerIndex();

  return {
    tireFront: frontTire * 0.1,
    tireRear: rearTire * 0.1,
    camberFront: frontTire * 0.04,
    camberRear: rearTire * 0.035,
    arbFront: frontTire * 1.4 - stagger * 0.7,
    arbRear: rearTire * 1.4 + stagger * 0.8,
    springFront: frontTire * 2.6 + averageTire * 0.6,
    springRear: rearTire * 2.6 + averageTire * 0.6,
    reboundFront: frontTire * 1.2,
    reboundRear: rearTire * 1.2,
    bumpFront: frontTire * 0.8,
    bumpRear: rearTire * 0.8,
    aeroFront: -frontTire * 0.8,
    aeroRear: -rearTire * 0.8,
    brakeBalance: (frontTire - rearTire) * 0.45,
    brakePressure: averageTire * 1.4,
    diffFrontAccel: state.drive !== "rwd" ? frontTire * 1.1 : 0,
    diffRearAccel: state.drive !== "fwd" ? rearTire * 1.2 : 0,
    diffCenter: state.drive === "awd" ? (rearTire - frontTire) * 0.8 : 0,
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

function tuneDelta(desiredTune, key) {
  return (Number(desiredTune[key]) || 0) - (Number(BASE_TUNE[key]) || 0);
}

function averageTuneDelta(desiredTune, keys) {
  const values = keys.map((key) => tuneDelta(desiredTune, key));
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function addCompensation(tune, key, amount) {
  if (!Number.isFinite(amount) || !tuneKeyAdjustable(key)) return;
  tune[key] = (Number(tune[key]) || 0) + amount;
}

function applyCompensationForUnavailableGroup(tune, desiredTune, groupId) {
  switch (groupId) {
    case "alignment": {
      const turnIntent = clampNumber(
        -tuneDelta(desiredTune, "camberFront") * 1.2 + tuneDelta(desiredTune, "toeFront") * 24 + tuneDelta(desiredTune, "caster") * 0.9,
        -5,
        5,
      );
      const rearIntent = clampNumber(-tuneDelta(desiredTune, "camberRear") + tuneDelta(desiredTune, "toeRear") * 20, -4, 4);
      addCompensation(tune, "tireFront", -turnIntent * 0.05);
      addCompensation(tune, "tireRear", -rearIntent * 0.04);
      addCompensation(tune, "arbFront", -turnIntent * 0.55);
      addCompensation(tune, "arbRear", rearIntent * 0.45 + turnIntent * 0.25);
      addCompensation(tune, "aeroFront", turnIntent * 0.8);
      addCompensation(tune, "aeroRear", rearIntent * 0.7);
      break;
    }
    case "frontArb": {
      const delta = tuneDelta(desiredTune, "arbFront");
      addCompensation(tune, "springFront", delta * 0.35);
      addCompensation(tune, "reboundFront", delta * 0.18);
      addCompensation(tune, "aeroFront", delta * 0.28);
      addCompensation(tune, "tireFront", delta * 0.012);
      break;
    }
    case "rearArb": {
      const delta = tuneDelta(desiredTune, "arbRear");
      addCompensation(tune, "springRear", delta * 0.35);
      addCompensation(tune, "reboundRear", delta * 0.18);
      addCompensation(tune, "aeroRear", delta * 0.25);
      addCompensation(tune, "diffRearAccel", delta * 0.12);
      addCompensation(tune, "tireRear", delta * 0.012);
      break;
    }
    case "suspension": {
      const frontSupport = averageTuneDelta(desiredTune, ["springFront", "reboundFront", "bumpFront"]);
      const rearSupport = averageTuneDelta(desiredTune, ["springRear", "reboundRear", "bumpRear"]);
      const heightIntent = averageTuneDelta(desiredTune, ["rideFront", "rideRear"]);
      addCompensation(tune, "arbFront", frontSupport * 0.22);
      addCompensation(tune, "arbRear", rearSupport * 0.22);
      addCompensation(tune, "tireFront", -frontSupport * 0.01 - Math.max(0, heightIntent) * 0.01);
      addCompensation(tune, "tireRear", -rearSupport * 0.01 - Math.max(0, heightIntent) * 0.01);
      addCompensation(tune, "aeroFront", frontSupport * 0.18);
      addCompensation(tune, "aeroRear", rearSupport * 0.18);
      break;
    }
    case "frontAero": {
      const front = tuneDelta(desiredTune, "aeroFront");
      addCompensation(tune, "springFront", front * 0.26);
      addCompensation(tune, "arbFront", front * 0.16);
      addCompensation(tune, "tireFront", -front * 0.006);
      break;
    }
    case "rearAero": {
      const rear = tuneDelta(desiredTune, "aeroRear");
      addCompensation(tune, "springRear", rear * 0.26);
      addCompensation(tune, "arbRear", rear * 0.16);
      addCompensation(tune, "toeRear", rear > 0 ? 0.01 : -0.005);
      addCompensation(tune, "tireRear", -rear * 0.006);
      break;
    }
    case "brake": {
      const balance = tuneDelta(desiredTune, "brakeBalance");
      const pressure = tuneDelta(desiredTune, "brakePressure");
      addCompensation(tune, "tireFront", -pressure * 0.006 - balance * 0.01);
      addCompensation(tune, "tireRear", -pressure * 0.004 + balance * 0.008);
      addCompensation(tune, "reboundFront", balance * 0.25);
      addCompensation(tune, "diffRearDecel", -balance * 0.45);
      addCompensation(tune, "diffFrontDecel", balance * 0.25);
      break;
    }
    case "diff": {
      const rearAccel = tuneDelta(desiredTune, "diffRearAccel");
      const frontAccel = tuneDelta(desiredTune, "diffFrontAccel");
      const decel = averageTuneDelta(desiredTune, ["diffFrontDecel", "diffRearDecel"]);
      addCompensation(tune, "tireRear", -rearAccel * 0.006);
      addCompensation(tune, "tireFront", -frontAccel * 0.006);
      addCompensation(tune, "arbRear", -rearAccel * 0.08);
      addCompensation(tune, "arbFront", -frontAccel * 0.08);
      addCompensation(tune, "reboundRear", -rearAccel * 0.04);
      addCompensation(tune, "finalDrive", (rearAccel + frontAccel) * 0.002 - decel * 0.001);
      break;
    }
    case "gearbox": {
      const finalDrive = tuneDelta(desiredTune, "finalDrive");
      addCompensation(tune, "diffRearAccel", finalDrive * 9);
      addCompensation(tune, "diffFrontAccel", finalDrive * 5);
      addCompensation(tune, "tireRear", -finalDrive * 0.18);
      addCompensation(tune, "tireFront", -finalDrive * 0.08);
      addCompensation(tune, "arbRear", -finalDrive * 1.4);
      addCompensation(tune, "aeroRear", Math.abs(finalDrive) * 1.6);
      break;
    }
    default:
      break;
  }
}

function freezeUnavailableTuneKeys(tune, groupId) {
  const group = availabilityById[groupId];
  if (!group) return;
  group.tuneKeys.forEach((key) => {
    tune[key] = BASE_TUNE[key];
  });
}

function applyAvailabilityToTune(desiredTune) {
  const tune = { ...desiredTune };
  availabilityGroups.forEach((group) => {
    if (!availabilityEnabled(group.id)) applyCompensationForUnavailableGroup(tune, desiredTune, group.id);
  });
  availabilityGroups.forEach((group) => {
    if (!availabilityEnabled(group.id)) freezeUnavailableTuneKeys(tune, group.id);
  });
  return clampTune(tune);
}

function buildBaseTune() {
  const tune = { ...BASE_TUNE };
  const race = optionById(raceTypes, state.race);
  const tuneFocus = optionById(tuneFocusTypes, state.tuneFocus);
  const engine = optionById(engineCurves, state.engine);
  const drive = optionById(driveTypes, state.drive);
  const focusIntensity = tuneFocusIntensityMultiplier();
  addMods(tune, race.mods);
  addMods(tune, trackTypeMods());
  addMods(tune, cornerProfileMods());
  addMods(tune, scaledMods(tuneFocus.mods, focusIntensity));
  addMods(tune, engine.mods);
  addMods(tune, drive.mods);
  addMods(tune, vehicleDynamicsMods());
  addMods(tune, powertrainDynamicsMods());
  addMods(tune, tireSizeDynamicsMods());

  if (state.race === "drift") {
    tune.diffRearAccel = Math.max(tune.diffRearAccel, 88);
    tune.diffRearDecel = Math.max(tune.diffRearDecel, 72);
    if (state.drive === "awd") tune.diffCenter = 82;
  }

  if (dragRaceIds.has(state.race)) {
    tune.camberFront = Math.max(-0.3, tune.camberFront);
    tune.camberRear = Math.max(-0.2, tune.camberRear);
    tune.toeFront = 0;
    tune.toeRear = 0;
    if (state.drive === "fwd") {
      tune.tireFront -= 1.4;
      tune.tireRear += 1.1;
    }
  }

  if ((state.race === "rally" || state.race === "offroad") && state.drive !== "awd") {
    tune.diffRearAccel += state.drive === "rwd" ? 4 : 0;
    tune.diffFrontAccel += state.drive === "fwd" ? 4 : 0;
  }

  return applyAvailabilityToTune(clampTune(tune));
}

function addAppliedSymptomDelta(tune, key, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || !tuneKeyAdjustable(key)) return;
  tune[key] = (Number(tune[key]) || 0) + value;
}

function applyAppliedSymptomAdjustments(tune, adjustments = state.appliedSymptomAdjustments) {
  const adjustedTune = { ...tune };
  adjustments.forEach((adjustment) => {
    Object.entries(adjustment.deltaByKey ?? {}).forEach(([key, amount]) => {
      addAppliedSymptomDelta(adjustedTune, key, amount);
    });
  });
  return clampTune(adjustedTune);
}

function buildTune() {
  return applyAppliedSymptomAdjustments(buildBaseTune());
}

const symptomTuneMods = {
  steeringUndersteer: {
    tireFront: -0.25,
    camberFront: -0.15,
    toeFront: 0.02,
    arbFront: -3,
    arbRear: 2,
    aeroFront: 2,
    diffFrontAccel: -3,
    diffCenter: -3,
  },
  steeringSlow: {
    toeFront: 0.03,
    caster: 0.2,
    arbFront: 2,
    reboundFront: 2,
  },
  steeringNervous: {
    toeFront: -0.03,
    toeRear: 0.03,
    arbFront: -2,
    aeroRear: 3,
    reboundFront: -1,
  },
  steeringOversteer: {
    tireRear: -0.35,
    toeRear: 0.03,
    arbRear: -4,
    springRear: -3,
    aeroRear: 3,
    diffRearAccel: -5,
    diffRearDecel: -4,
  },
  rearLoose: {
    tireRear: -0.45,
    toeRear: 0.04,
    arbRear: -4,
    springRear: -3,
    aeroRear: 4,
    diffRearAccel: -6,
    diffRearDecel: -3,
  },
  rearFloat: {
    toeRear: 0.04,
    aeroRear: 5,
    reboundRear: -2,
    bumpRear: -2,
  },
  rearTooFast: {
    toeRear: 0.03,
    arbRear: -3,
    reboundRear: -2,
    diffRearAccel: -4,
  },
  gripFront: {
    tireFront: -0.3,
    camberFront: -0.18,
    arbFront: -3,
    aeroFront: 2,
  },
  gripRear: {
    tireRear: -0.45,
    springRear: -3,
    arbRear: -3,
    aeroRear: 3,
    diffRearAccel: -4,
  },
  gripAll: {
    tireFront: -0.25,
    tireRear: -0.3,
    arbFront: -3,
    arbRear: -3,
    springFront: -3,
    springRear: -3,
    aeroFront: 2,
    aeroRear: 2,
  },
  gripBump: {
    tireFront: -0.2,
    tireRear: -0.2,
    rideFront: 5,
    rideRear: 5,
    reboundFront: -3,
    reboundRear: -3,
    bumpFront: -5,
    bumpRear: -5,
  },
  suspensionBoat: {
    arbFront: 5,
    arbRear: 5,
    springFront: 4,
    springRear: 4,
    reboundFront: 4,
    reboundRear: 4,
  },
  suspensionBump: {
    rideFront: 7,
    rideRear: 7,
    arbFront: -5,
    arbRear: -5,
    reboundFront: -4,
    reboundRear: -4,
    bumpFront: -7,
    bumpRear: -7,
  },
  suspensionBottom: {
    rideFront: 8,
    rideRear: 8,
    springFront: 5,
    springRear: 5,
    bumpFront: 3,
    bumpRear: 3,
  },
  suspensionHard: {
    tireFront: -0.15,
    tireRear: -0.15,
    arbFront: -4,
    arbRear: -4,
    springFront: -5,
    springRear: -5,
    reboundFront: -3,
    reboundRear: -3,
    bumpFront: -3,
    bumpRear: -3,
  },
  brakeUnstable: {
    brakeBalance: 2,
    brakePressure: -8,
    reboundFront: -2,
    diffRearDecel: -4,
  },
  brakeUndersteer: {
    brakeBalance: -2,
    arbFront: -3,
    diffFrontDecel: -3,
  },
  brakeOversteer: {
    brakeBalance: 2,
    toeRear: 0.03,
    diffRearDecel: -5,
  },
  brakeLock: {
    tireFront: -0.15,
    tireRear: -0.15,
    brakePressure: -10,
  },
  accelTraction: {
    tireFront: -0.15,
    tireRear: -0.45,
    finalDrive: -0.08,
    diffFrontAccel: -4,
    diffRearAccel: -6,
    diffCenter: -4,
  },
  accelUndersteer: {
    tireFront: -0.2,
    arbRear: 3,
    diffFrontAccel: -6,
    diffCenter: -5,
  },
  accelOversteer: {
    tireRear: -0.45,
    springRear: -4,
    arbRear: -4,
    diffRearAccel: -7,
    aeroRear: 3,
  },
  accelFloat: {
    toeRear: 0.03,
    aeroRear: 5,
    diffCenter: 3,
  },
  powerDelivery: {
    finalDrive: 0.05,
    diffFrontAccel: -3,
    diffRearAccel: -4,
  },
  highSpeedFloat: {
    toeRear: 0.03,
    rideFront: -3,
    rideRear: -3,
    aeroFront: 5,
    aeroRear: 6,
  },
  highSpeedBump: {
    rideFront: 5,
    rideRear: 5,
    reboundFront: -3,
    reboundRear: -3,
    bumpFront: -5,
    bumpRear: -5,
  },
  highSpeedLine: {
    toeFront: -0.02,
    arbFront: 2,
    arbRear: 2,
    aeroRear: 5,
  },
  fhMountain: {
    finalDrive: 0.08,
    rideFront: 5,
    rideRear: 5,
    reboundFront: -4,
    reboundRear: -4,
    bumpFront: -4,
    bumpRear: -4,
    brakeBalance: 1,
    brakePressure: -6,
  },
  fhRough: {
    rideFront: 8,
    rideRear: 8,
    arbFront: -6,
    arbRear: -6,
    reboundFront: -4,
    reboundRear: -4,
    bumpFront: -7,
    bumpRear: -7,
  },
  fhTransition: {
    tireFront: -0.3,
    tireRear: -0.3,
    rideFront: 4,
    rideRear: 4,
    diffFrontAccel: -4,
    diffRearAccel: -4,
  },
};

function addSymptomMod(tune, key, amount, multiplier) {
  const value = Number(amount) * multiplier;
  if (!Number.isFinite(value) || !tuneKeyAdjustable(key)) return;
  tune[key] = (Number(tune[key]) || 0) + value;
}

function applySymptomTuneMods(tune, issue, multiplier) {
  const mods = symptomTuneMods[issue.templateKey];
  if (!mods) return;
  Object.entries(mods).forEach(([key, amount]) => addSymptomMod(tune, key, amount, multiplier));
}

function buildSymptomOptimizedTune(selectedIssues = [], baseTune = buildTune()) {
  const tune = { ...baseTune };
  if (!selectedIssues.length) return tune;
  const multiplier = clampNumber(1 / Math.sqrt(selectedIssues.length), 0.55, 1);
  selectedIssues.forEach((issue) => applySymptomTuneMods(tune, issue, multiplier));
  return clampTune(tune);
}

function tuneDeltaByKey(baseTune, optimizedTune) {
  return TUNE_KEYS.reduce((deltaByKey, key) => {
    const delta = (Number(optimizedTune[key]) || 0) - (Number(baseTune[key]) || 0);
    if (Math.abs(delta) > TUNE_DELTA_EPSILON) deltaByKey[key] = delta;
    return deltaByKey;
  }, {});
}

function issueObjectsFromSet(issueSet) {
  const issueLookup = new Map(allIssueTypes.map((issue) => [issue.id, issue]));
  return [...issueSet].map((id) => issueLookup.get(id)).filter(Boolean);
}

function nextAppliedSymptomAdjustmentId() {
  state.appliedSymptomAdjustmentSeq += 1;
  return `symptom-${Date.now()}-${state.appliedSymptomAdjustmentSeq}`;
}

function appliedSymptomAdjustmentLabel(adjustment) {
  const issueLookup = new Map(allIssueTypes.map((issue) => [issue.id, issue]));
  return (adjustment.issueIds ?? [])
    .map((id) => issueLookup.get(id))
    .filter(Boolean)
    .map((issue) => localizedSymptom(issue).label)
    .join(" / ");
}

function selectedSymptomDelta(selectedIssues, baseTune = buildTune()) {
  return tuneDeltaByKey(baseTune, buildSymptomOptimizedTune(selectedIssues, baseTune));
}

function applyCurrentSymptomAdjustment() {
  if (isStandaloneSymptomMode()) return;
  const selectedIssues = issueObjectsFromSet(state.issues);
  if (!selectedIssues.length) return;

  const baseTune = buildTune();
  const deltaByKey = selectedSymptomDelta(selectedIssues, baseTune);
  if (!Object.keys(deltaByKey).length) return;

  state.appliedSymptomAdjustments.push({
    id: nextAppliedSymptomAdjustmentId(),
    issueIds: selectedIssues.map((issue) => issue.id),
    deltaByKey,
    createdAt: Date.now(),
  });
  state.issues.clear();
  renderResult();
  renderIssues();
}

function removeAppliedSymptomAdjustment(adjustmentId) {
  const nextAdjustments = state.appliedSymptomAdjustments.filter((adjustment) => adjustment.id !== adjustmentId);
  if (nextAdjustments.length === state.appliedSymptomAdjustments.length) return;
  state.appliedSymptomAdjustments = nextAdjustments;
  renderResult();
  renderIssues();
}

function renderOptions(containerId, options, groupName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const optionGroupKey = {
    race: "raceTypes",
    tuneFocus: "tuneFocusTypes",
    engine: "engineCurves",
    drive: "driveTypes",
  }[groupName];
  container.innerHTML = options
    .map(
      (option) => {
        const localized = localizedOption(optionGroupKey, option);
        return `
        <div class="option-card">
          <input type="radio" id="${groupName}-${option.id}" name="${groupName}" value="${option.id}" ${
            state[groupName] === option.id ? "checked" : ""
          }>
          <label for="${groupName}-${option.id}">
            <span class="option-title">${localized.label}</span>
            <span class="option-subtitle">${localized.subtitle}</span>
          </label>
        </div>
      `;
      },
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

function renderConfigSelect(selectId, options, selectedId, groupKey) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = options
    .map((option) => {
      const localized = localizedOption(groupKey, option);
      const selected = option.id === selectedId ? "selected" : "";
      return `<option value="${option.id}" ${selected}>${localized.label} - ${localized.subtitle}</option>`;
    })
    .join("");
}

function syncConfigControls() {
  renderConfigSelect("raceSelect", raceTypes, state.race, "raceTypes");
  renderConfigSelect("cornerProfileSelect", cornerProfileTypes, state.cornerProfile, "cornerProfileTypes");
  renderConfigSelect("tuneFocusSelect", tuneFocusTypes, state.tuneFocus, "tuneFocusTypes");
  renderConfigSelect("engineSelect", engineCurves, state.engine, "engineCurves");
  renderConfigSelect("driveSelect", driveTypes, state.drive, "driveTypes");
  syncTrackTypeControls();
  syncTuneFocusIntensityInput();
  syncVehicleInputs();
}

function updateLiveTune() {
  renderResult();
}

function syncTuneFocusIntensityInput() {
  normalizeTuneFocusIntensity();
  const slider = document.getElementById("tuneFocusIntensitySlider");
  const output = document.getElementById("tuneFocusIntensityOutput");
  const hint = document.getElementById("tuneFocusIntensityHint");
  const field = document.getElementById("tuneFocusIntensityField");
  const usesIntensity = tuneFocusUsesIntensity();

  if (slider) slider.value = state.tuneFocusIntensity;
  if (slider) slider.disabled = !usesIntensity;
  if (output) output.textContent = formatTuneFocusIntensity();
  if (hint) hint.textContent = tuneFocusIntensityHint();
  if (field) field.classList.toggle("is-hidden", !usesIntensity);
}

function bindTuneFocusIntensityInput() {
  const slider = document.getElementById("tuneFocusIntensitySlider");
  if (!slider) return;

  slider.addEventListener("input", () => {
    state.tuneFocusIntensity = Number(slider.value);
    syncTuneFocusIntensityInput();
    updateLiveTune();
  });
}

function syncTrackTypeControls(skipInputId = "") {
  const value = normalizeTrackType();
  const slider = document.getElementById("trackTypeSlider");
  const output = document.getElementById("trackTypeOutput");
  const cornerSelect = document.getElementById("cornerProfileSelect");
  const disabled = !routeShapeEnabled();

  if (slider && skipInputId !== "trackTypeSlider") slider.value = value;
  if (slider) slider.disabled = disabled;
  if (output) output.textContent = formatTrackTypeOutputLabel();
  if (cornerSelect) cornerSelect.disabled = disabled;
}

function bindTrackTypeInput() {
  const slider = document.getElementById("trackTypeSlider");
  if (!slider) return;

  slider.addEventListener("input", () => {
    state.trackType = Number(slider.value);
    syncTrackTypeControls("trackTypeSlider");
    updateLiveTune();
  });
}

function bindConfigSelects() {
  [
    ["raceSelect", "race"],
    ["cornerProfileSelect", "cornerProfile"],
    ["tuneFocusSelect", "tuneFocus"],
    ["engineSelect", "engine"],
    ["driveSelect", "drive"],
  ].forEach(([selectId, stateKey]) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener("change", () => {
      state[stateKey] = select.value;
      if (stateKey === "race") {
        const race = optionById(raceTypes, state.race);
        state.trackType = race?.defaultTrackType ?? state.trackType;
        state.cornerProfile = race?.defaultCornerProfile ?? state.cornerProfile;
        syncConfigControls();
      }
      if (stateKey === "tuneFocus") syncTuneFocusIntensityInput();
      updateLiveTune();
    });
  });
}

function activeIssueCategory() {
  return optionById(symptomCategories, activeIssueCategoryId()) ?? symptomCategories[0];
}

function isStandaloneSymptomMode() {
  return state.symptomMode === "standalone";
}

function currentIssueSet() {
  return isStandaloneSymptomMode() ? state.solutionIssues : state.issues;
}

function activeIssueCategoryId() {
  return isStandaloneSymptomMode() ? state.solutionActiveIssueCategory : state.activeIssueCategory;
}

function setActiveIssueCategory(categoryId) {
  if (isStandaloneSymptomMode()) {
    state.solutionActiveIssueCategory = categoryId;
  } else {
    state.activeIssueCategory = categoryId;
  }
}

function renderSymptomModeHeader() {
  const title = document.getElementById("symptomPageTitle");
  const label = document.getElementById("symptomAdviceLabel");
  const hint = document.getElementById("symptomAdviceHintTitle");
  if (title) title.textContent = isStandaloneSymptomMode() ? t("solutionTitle") : t("roadTestTitle");
  if (label) label.textContent = isStandaloneSymptomMode() ? t("adjustmentDirectionLabel") : t("linkedTunePanelLabel");
  if (hint) hint.textContent = isStandaloneSymptomMode() ? t("solutionAdviceHint") : t("symptomAdviceHint");
}

function renderIssueCategories() {
  const categoryGrid = document.getElementById("issueCategoryGrid");
  renderSymptomModeHeader();
  const selectedIssues = currentIssueSet();
  categoryGrid.innerHTML = symptomCategories
    .map((category) => {
      const localizedCategory = localizedSymptomCategory(category);
      const selectedCount = category.symptoms.filter((issue) => selectedIssues.has(issue.id)).length;
      return `
        <button class="category-button ${category.id === activeIssueCategoryId() ? "is-active" : ""}" type="button" data-category="${category.id}">
          <span>${localizedCategory.label}</span>
          <span class="category-button-count">${selectedCount}</span>
        </button>
      `;
    })
    .join("");

  categoryGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveIssueCategory(button.dataset.category);
      renderIssueCategories();
      renderIssues();
    });
  });
}

function renderIssues() {
  const category = activeIssueCategory();
  const localizedCategory = localizedSymptomCategory(category);
  const issueGrid = document.getElementById("issueGrid");
  const selectedIssues = currentIssueSet();
  document.getElementById("activeCategoryLabel").textContent = localizedCategory.label;
  document.getElementById("activeCategoryDescription").textContent = localizedCategory.description;
  issueGrid.innerHTML = category.symptoms
    .map(
      (issue) => {
        const localizedIssue = localizedSymptom(issue);
        const isSelected = selectedIssues.has(issue.id);
        return `
        <div class="issue-card">
          <input type="checkbox" id="issue-${issue.id}" value="${issue.id}" ${isSelected ? "checked" : ""}>
          <label for="issue-${issue.id}">${localizedIssue.label}</label>
        </div>
      `;
      },
    )
    .join("");

  issueGrid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const issues = currentIssueSet();
      if (event.target.checked) {
        if (isStandaloneSymptomMode()) issues.clear();
        issues.add(event.target.value);
      } else {
        issues.delete(event.target.value);
      }
      renderIssueCategories();
      renderIssues();
      renderSelectedIssues();
      renderAdvice();
    });
  });
}

function renderSelectedIssues() {
  const container = document.getElementById("selectedIssues");
  const isStandalone = isStandaloneSymptomMode();
  container.classList.toggle("is-reserved", !isStandalone);
  if (isStandalone) {
    document.getElementById("selectedIssueCount").textContent = t("selectedCount", { count: state.solutionIssues.size });
    container.innerHTML = "";
    return;
  }

  const selected = issueObjectsFromSet(currentIssueSet());
  const appliedChips = state.appliedSymptomAdjustments.map((adjustment) => {
        const label = appliedSymptomAdjustmentLabel(adjustment);
        const escapedLabel = escapeHtml(label);
        return `
          <span class="selected-issue-chip is-applied">
            <span>${escapedLabel}</span>
            <button
              class="applied-issue-remove"
              type="button"
              data-applied-adjustment-id="${escapeHtml(adjustment.id)}"
              aria-label="${escapeHtml(t("removeAppliedSymptomAdjustment", { label }))}"
            >x</button>
          </span>
        `;
      });
  const selectedChips = selected.map((issue) => `<span class="selected-issue-chip">${escapeHtml(localizedSymptom(issue).label)}</span>`);
  document.getElementById("selectedIssueCount").textContent = t("selectedCount", { count: selected.length });
  container.innerHTML = [...appliedChips, ...selectedChips].join("");
  container.querySelectorAll("[data-applied-adjustment-id]").forEach((button) => {
    button.addEventListener("click", () => removeAppliedSymptomAdjustment(button.dataset.appliedAdjustmentId));
  });
}

function selectedOptions() {
  return {
    race: localizedOption("raceTypes", optionById(raceTypes, state.race)),
    cornerProfile: localizedOption("cornerProfileTypes", selectedCornerProfile()),
    tuneFocus: localizedOption("tuneFocusTypes", optionById(tuneFocusTypes, state.tuneFocus)),
    engine: localizedOption("engineCurves", optionById(engineCurves, state.engine)),
    drive: localizedOption("driveTypes", optionById(driveTypes, state.drive)),
  };
}

function formatSpecPercent(value) {
  return Math.round(value).toString();
}

function vehicleSpecLabel() {
  normalizeVehicleSpecs();
  return `${t("vehicleSpecWeight")} ${Math.round(state.carWeight)} kg / ${t("vehicleSpecFront")} ${formatSpecPercent(
    state.frontWeightPercent,
  )}% / ${state.powerKw} kW / ${state.torqueNm} N.m`;
}

function normalizedVehicleName() {
  return String(state.vehicleName || "").trim();
}

function vehicleNameLabel() {
  const name = normalizedVehicleName();
  return name ? `${t("vehicleSpecName")} ${name}` : "";
}

function tireSpecLabel() {
  normalizeVehicleSpecs();
  return `${t("vehicleSpecFrontTire")} ${state.frontTireSpec} / ${t("vehicleSpecRearTire")} ${state.rearTireSpec}`;
}

function vehicleSpecCopyLines() {
  normalizeVehicleSpecs();
  const lines = [
    ...(normalizedVehicleName() ? [`${t("vehicleSpecName")}: ${normalizedVehicleName()}`] : []),
    `${t("vehicleSpecWeight")}: ${Math.round(state.carWeight)} kg`,
    `${t("vehicleSpecFront")}: ${formatSpecPercent(state.frontWeightPercent)}%`,
    `${t("vehicleSpecRear")}: ${formatSpecPercent(100 - state.frontWeightPercent)}%`,
    `${t("vehicleSpecFrontTire")}: ${state.frontTireSpec}`,
    `${t("vehicleSpecRearTire")}: ${state.rearTireSpec}`,
    `${t("vehicleSpecPower")}: ${state.powerKw} kW`,
    `${t("vehicleSpecTorque")}: ${state.torqueNm} N.m`,
    `${t("routeShapeCopy")}: ${formatTrackTypeLabel()}`,
    `${t("cornerProfileCopy")}: ${formatCornerProfileLabel()}`,
  ];
  if (tuneFocusUsesIntensity()) lines.push(`${t("tuneFocusCopyIntensity")}: ${formatTuneFocusIntensity()}`);
  return lines;
}

const THEME_STORAGE_KEY = "fh6-tune-lab-theme";

function preferredTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  } catch {
    // Ignore storage access errors and fall back to the system preference.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  state.theme = normalizedTheme;
  document.body.dataset.theme = normalizedTheme;

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  const isDark = normalizedTheme === "dark";
  const label = toggle.closest(".theme-toggle");
  const nextThemeLabel = isDark ? t("themeToLight") : t("themeToDark");
  toggle.checked = isDark;
  toggle.title = nextThemeLabel;
  toggle.setAttribute("aria-label", nextThemeLabel);
  if (label) label.title = nextThemeLabel;
}

function setTheme(theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  } catch {
    // Theme persistence is optional; the UI can still switch immediately.
  }
}

function bindThemeToggle() {
  applyTheme(preferredTheme());

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    setTheme(toggle.checked ? "dark" : "light");
  });
}

function renderSummary() {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const summaryValues = {
    summaryRace: race.label,
    summaryFocus: formatTuneFocusLabel(tuneFocus),
    summaryEngine: engine.label,
    summaryDrive: `${drive.label} ${drive.subtitle}`,
    summaryVehicle: vehicleSpecLabel(),
  };
  Object.entries(summaryValues).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });
  const setupTitle = document.getElementById("setupTitle");
  if (setupTitle) setupTitle.textContent = race.title;
}

function renderSelectionPreview() {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const routeLabel = formatTrackTypeLabel();
  const html = [
    vehicleNameLabel(),
    race.label,
    routeLabel,
    formatCornerProfileLabel(),
    formatTuneFocusLabel(tuneFocus),
    engine.label,
    `${drive.label} ${drive.subtitle}`,
    vehicleSpecLabel(),
    tireSpecLabel(),
  ]
    .filter(Boolean)
    .map((text) => `<span>${text}</span>`)
    .join("");
  document.getElementById("selectionPreview").innerHTML = html;
  document.getElementById("resultTags").innerHTML = html;
  document.getElementById("liveConfigTags").innerHTML = html;
  document.getElementById("gearTags").innerHTML = html;
  document.getElementById("encyclopediaTags").innerHTML = html;
  document.getElementById("symptomTags").innerHTML = isStandaloneSymptomMode()
    ? `<span>${t("solutionModeChip")}</span>`
    : html;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function localizedEncyclopediaItem(item) {
  return {
    ...item,
    ...(item[currentLanguage()] ?? item.zh),
  };
}

function activeEncyclopediaItem() {
  const item = optionById(tuningEncyclopediaItems, state.activeEncyclopediaPart) ?? tuningEncyclopediaItems[0];
  state.activeEncyclopediaPart = item.id;
  return item;
}

function renderEncyclopediaList(activeId) {
  const list = document.getElementById("encyclopediaPartList");
  if (!list) return;

  list.innerHTML = tuningEncyclopediaItems
    .map((item) => {
      const localizedItem = localizedEncyclopediaItem(item);
      return `
        <button class="encyclopedia-part-button ${item.id === activeId ? "is-active" : ""}" type="button" data-part-id="${item.id}">
          <span>${escapeHtml(localizedItem.title)}</span>
          <small>${escapeHtml(localizedItem.categoryLabel)}</small>
        </button>
      `;
    })
    .join("");

  list.querySelectorAll("[data-part-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeEncyclopediaPart = button.dataset.partId;
      renderEncyclopedia();
    });
  });
}

function encyclopediaList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function encyclopediaLearningBlock(titleKey, items, modifier) {
  if (!items?.length) return "";
  return `
    <section class="encyclopedia-learning-block is-${modifier}">
      <h4>${escapeHtml(t(titleKey))}</h4>
      ${encyclopediaList(items)}
    </section>
  `;
}

function encyclopediaContextBlock(titleKey, items, className) {
  if (!items?.length) return "";
  return `
    <section class="${className}">
      <h4>${escapeHtml(t(titleKey))}</h4>
      ${encyclopediaList(items)}
    </section>
  `;
}

function encyclopediaTireTemperatureMarkup(item) {
  const tireTemperature = encyclopediaTireTemperatureFor(item);
  if (!tireTemperature) return "";

  const zoneMarkup = tireTemperature.shared.zones
    .map(
      (zone) => `
        <article class="tire-temp-card">
          <h5>${escapeHtml(zone.label)}</h5>
          <p><strong>${escapeHtml(t("tireTempCold"))}</strong>${escapeHtml(zone.cold)}</p>
          <p><strong>${escapeHtml(t("tireTempOverheated"))}</strong>${escapeHtml(zone.hot)}</p>
          <p><strong>${escapeHtml(t("tireTempAdjust"))}</strong>${escapeHtml(zone.adjust)}</p>
        </article>
      `,
    )
    .join("");
  const momentMarkup = tireTemperature.axle.moments
    .map(
      (moment) => `
        <article class="tire-temp-moment">
          <h5>${escapeHtml(moment.label)}</h5>
          <p><strong>${escapeHtml(t("tireTempRead"))}</strong>${escapeHtml(moment.read)}</p>
          <p><strong>${escapeHtml(t("tireTempAdjust"))}</strong>${escapeHtml(moment.adjust)}</p>
        </article>
      `,
    )
    .join("");

  return `
    <section class="encyclopedia-tire-temperature">
      <div class="tire-temp-head">
        <h4>${escapeHtml(t("encyclopediaTireTemperature"))}</h4>
        <p>${escapeHtml(tireTemperature.shared.summary)}</p>
      </div>
      <div class="tire-temp-zone-grid">
        ${zoneMarkup}
      </div>
      <div class="tire-temp-focus">
        <h5>${escapeHtml(tireTemperature.axle.title)}</h5>
        <p>${escapeHtml(tireTemperature.axle.focus)}</p>
        <div class="tire-temp-moment-grid">
          ${momentMarkup}
        </div>
      </div>
      <div class="tire-temp-order">
        <h5>${escapeHtml(t("encyclopediaAdjustmentTiming"))}</h5>
        ${encyclopediaList(tireTemperature.shared.adjustmentOrder)}
      </div>
    </section>
  `;
}

function encyclopediaDeepContentMarkup(item) {
  const vehicleContext = encyclopediaVehicleContextFor(item);
  const engineContext = encyclopediaEngineContextFor(item);
  const interactionContext = encyclopediaInteractionFor(item);
  const learningContext = encyclopediaLearningFor(item);

  return `
    <div class="encyclopedia-deep-content">
      ${encyclopediaContextBlock("encyclopediaVehicleContext", vehicleContext, "encyclopedia-context")}
      ${encyclopediaContextBlock("encyclopediaEngineContext", engineContext, "encyclopedia-engine-context")}
      ${encyclopediaContextBlock("encyclopediaPartInteractions", interactionContext, "encyclopedia-interaction")}
      ${encyclopediaTireTemperatureMarkup(item)}
      <div class="encyclopedia-learning-grid">
        ${encyclopediaLearningBlock("encyclopediaAdjustmentTiming", learningContext.timing, "timing")}
        ${encyclopediaLearningBlock("encyclopediaCommonMistakes", learningContext.mistakes, "mistakes")}
      </div>
    </div>
  `;
}

function renderEncyclopediaDetail(item) {
  const detail = document.getElementById("encyclopediaDetail");
  if (!detail) return;

  const localizedItem = localizedEncyclopediaItem(item);
  detail.innerHTML = `
    <article class="encyclopedia-info">
      <div class="encyclopedia-info-head">
        <div>
          <p class="picker-label">${escapeHtml(localizedItem.categoryLabel)}</p>
          <h3>${escapeHtml(localizedItem.title)}</h3>
        </div>
      </div>
      <p class="encyclopedia-summary">${escapeHtml(localizedItem.summary)}</p>
      <div class="encyclopedia-effect-grid">
        <section class="encyclopedia-effect-block is-increase">
          <h4>${escapeHtml(t("encyclopediaIncrease"))}</h4>
          ${encyclopediaList(localizedItem.increase)}
        </section>
        <section class="encyclopedia-effect-block is-decrease">
          <h4>${escapeHtml(t("encyclopediaDecrease"))}</h4>
          ${encyclopediaList(localizedItem.decrease)}
        </section>
      </div>
      ${encyclopediaDeepContentMarkup(item)}
    </article>
  `;
}

function renderEncyclopedia() {
  const item = activeEncyclopediaItem();
  renderEncyclopediaList(item.id);
  renderEncyclopediaDetail(item);
}

function recommendationMarkup(option, reason) {
  if (!option) return "";
  return `
    <span>${t("recommendationPrefix")}${escapeHtml(option.label)}</span>
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
    engineHint.innerHTML = recommendationMarkup(
      localizedOption("engineCurves", optionById(engineCurves, recommendation.engine)),
      localizedRecommendationReason("engineWhy", recommendation.engineWhy),
    );
  }

  if (driveHint) {
    driveHint.innerHTML = recommendationMarkup(
      localizedOption("driveTypes", optionById(driveTypes, recommendation.drive)),
      localizedRecommendationReason("driveWhy", recommendation.driveWhy),
    );
  }
}

function availabilityToggleMarkup(group, modifierClass = "") {
  const checked = availabilityEnabled(group.id);
  const inputId = `availability-${group.id}`;
  const classes = ["availability-toggle", modifierClass, checked ? "" : "is-disabled"].filter(Boolean).join(" ");

  return `
    <label class="${classes}" for="${inputId}">
      <input id="${inputId}" type="checkbox" ${checked ? "checked" : ""} data-availability-group="${group.id}" />
      <span class="availability-toggle-text">
        <span class="availability-toggle-title">${localizedAvailabilityGroup(group)}</span>
        <span class="availability-toggle-state">${checked ? t("availabilityOn") : t("availabilityOff")}</span>
      </span>
    </label>
  `;
}

function aeroAvailabilityPairMarkup() {
  const aeroGroups = ["frontAero", "rearAero"].map((id) => availabilityById[id]).filter(Boolean);
  const aeroLabel = localizedAdjustmentRangeGroup({ id: "aero", label: "Aero" }).label;

  return `
    <div class="availability-split" role="group" aria-label="${escapeHtml(aeroLabel)}">
      ${aeroGroups.map((group) => availabilityToggleMarkup(group, "is-compact")).join("")}
    </div>
  `;
}

function renderAvailabilityControls() {
  const grid = document.getElementById("availabilityGrid");
  if (!grid) return;

  grid.innerHTML = availabilityGroups
    .map((group) => {
      if (group.id === "frontAero") return aeroAvailabilityPairMarkup();
      if (group.id === "rearAero") return "";
      return availabilityToggleMarkup(group);
    })
    .join("");

  grid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      state.availability[input.dataset.availabilityGroup] = input.checked;
      renderAvailabilityControls();
      renderResult();
      renderGearCalculator();
    });
  });

  const resetButton = document.getElementById("resetAvailabilityButton");
  if (resetButton) {
    resetButton.onclick = () => {
      state.availability = createAvailability();
      renderAvailabilityControls();
      renderResult();
      renderGearCalculator();
    };
  }
}

function renderAdjustmentRangeControls() {
  const grid = document.getElementById("adjustmentRangeGrid");
  if (!grid) return;

  grid.innerHTML = configurableAdjustmentRangeGroups
    .map((group) => {
      const localizedGroup = localizedAdjustmentRangeGroup(group);
      const range = normalizeAdjustmentRange(group.id, true);
      const linkControl =
        group.id === "spring"
          ? `
            <label class="range-link-toggle" for="springRangeLinkedInput" title="${t("springRangeLinkHint")}">
              <input
                id="springRangeLinkedInput"
                type="checkbox"
                ${springRangeLinked() ? "checked" : ""}
              />
              <span>${t("springRangeLinkLabel")}</span>
            </label>
          `
          : "";
      const fields = adjustmentRangeFields
        .map(([field, label]) => {
          const localizedLabel = localizedAdjustmentRangeField(field, label);
          const inputId = `adjustment-${group.id}-${field}`;
          return `
            <label class="adjustment-field" for="${inputId}">
              <span>${localizedLabel}</span>
              <input
                id="${inputId}"
                type="text"
                inputmode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value="${formatAdjustmentNumber(range[field])}"
                data-range-group="${group.id}"
                data-range-field="${field}"
                aria-label="${localizedGroup.label} ${localizedLabel}"
              />
            </label>
          `;
        })
        .join("");

      return `
        <article class="adjustment-range-card">
          <div class="adjustment-range-card-header">
            <div class="adjustment-range-title">${localizedGroup.label}</div>
            ${linkControl}
          </div>
          <div class="adjustment-field-grid">${fields}</div>
        </article>
      `;
    })
    .join("");
}

function syncAdjustmentRangeInputs(skipInputId = "") {
  configurableAdjustmentRangeGroups.forEach((group) => {
    const range = normalizeAdjustmentRange(group.id, true);
    if (!range) return;

    adjustmentRangeFields.forEach(([field]) => {
      const input = document.getElementById(`adjustment-${group.id}-${field}`);
      if (input && input.id !== skipInputId) input.value = formatAdjustmentNumber(range[field]);
    });
  });

  const springLinkInput = document.getElementById("springRangeLinkedInput");
  if (springLinkInput) springLinkInput.checked = springRangeLinked();
}

function bindAdjustmentRangeInputs() {
  const grid = document.getElementById("adjustmentRangeGrid");
  if (!grid) return;

  grid.querySelectorAll("input[data-range-group]").forEach((input) => {
    input.addEventListener("focus", () => input.select());

    input.addEventListener("input", () => {
      if (input.value === "") return;
      const value = Number(input.value);
      if (!Number.isFinite(value) || !adjustmentValueInRange(value)) return;

      const groupId = input.dataset.rangeGroup;
      const field = input.dataset.rangeField;
      state.adjustmentRanges[groupId][field] = value;
      if (groupId === "spring") {
        syncLinkedSpringRangeValue(field, value);
        const linkedField = linkedSpringRangeField(field);
        const linkedInput = document.getElementById(`adjustment-spring-${linkedField}`);
        if (springRangeLinked() && linkedInput && linkedInput.id !== input.id) {
          linkedInput.value = input.value;
        }
      }
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
      if (groupId === "spring") {
        syncLinkedSpringRangeValue(field, state.adjustmentRanges[groupId][field]);
      }
      normalizeAdjustmentRange(groupId, true);
      syncAdjustmentRangeInputs();
      updateLiveTune();
    });
  });

  const springLinkInput = document.getElementById("springRangeLinkedInput");
  if (springLinkInput) {
    springLinkInput.addEventListener("change", () => {
      state.springRangeLinked = springLinkInput.checked;
      if (springRangeLinked()) syncSpringRangeFromFront();
      syncAdjustmentRangeInputs();
      updateLiveTune();
    });
  }

  const resetButton = document.getElementById("resetAdjustmentRangesButton");
  if (resetButton) {
    resetButton.onclick = () => {
      state.adjustmentRanges = createAdjustmentRanges();
      syncAdjustmentRangeInputs();
      updateLiveTune();
    };
  }
}

function syncVehicleInputs(skipInputId = "") {
  normalizeVehicleSpecs();
  const weightInput = document.getElementById("carWeightInput");
  const inlineWeightInput = document.getElementById("inlineCarWeightInput");
  const frontTireSizeInput = document.getElementById("frontTireSizeInput");
  const rearTireSizeInput = document.getElementById("rearTireSizeInput");
  const inlineFrontTireSizeInput = document.getElementById("inlineFrontTireSizeInput");
  const inlineRearTireSizeInput = document.getElementById("inlineRearTireSizeInput");
  const powerKwInput = document.getElementById("powerKwInput");
  const torqueNmInput = document.getElementById("torqueNmInput");
  const vehicleNameInput = document.getElementById("vehicleNameInput");
  const frontWeightInput = document.getElementById("frontWeightInput");
  const frontWeightSlider = document.getElementById("frontWeightSlider");
  const frontWeightOutput = document.getElementById("frontWeightOutput");
  const rearWeightOutput = document.getElementById("rearWeightOutput");

  if (weightInput && skipInputId !== "carWeightInput") weightInput.value = Math.round(state.carWeight);
  if (inlineWeightInput && skipInputId !== "inlineCarWeightInput") inlineWeightInput.value = Math.round(state.carWeight);
  if (frontTireSizeInput && skipInputId !== "frontTireSizeInput") frontTireSizeInput.value = state.frontTireSpec;
  if (rearTireSizeInput && skipInputId !== "rearTireSizeInput") rearTireSizeInput.value = state.rearTireSpec;
  if (inlineFrontTireSizeInput && skipInputId !== "inlineFrontTireSizeInput") {
    inlineFrontTireSizeInput.value = state.frontTireSpec;
  }
  if (inlineRearTireSizeInput && skipInputId !== "inlineRearTireSizeInput") {
    inlineRearTireSizeInput.value = state.rearTireSpec;
  }
  if (powerKwInput && skipInputId !== "powerKwInput") powerKwInput.value = state.powerKw;
  if (torqueNmInput && skipInputId !== "torqueNmInput") torqueNmInput.value = state.torqueNm;
  if (vehicleNameInput && skipInputId !== "vehicleNameInput") vehicleNameInput.value = state.vehicleName;
  if (frontWeightInput && skipInputId !== "frontWeightInput") frontWeightInput.value = formatSpecPercent(state.frontWeightPercent);
  if (frontWeightSlider && skipInputId !== "frontWeightSlider") frontWeightSlider.value = formatSpecPercent(state.frontWeightPercent);
  if (frontWeightOutput) frontWeightOutput.textContent = `${formatSpecPercent(state.frontWeightPercent)}%`;
  if (rearWeightOutput) rearWeightOutput.textContent = `${t("rearBalance")} ${formatSpecPercent(100 - state.frontWeightPercent)}%`;
}

function specValueInRange(stateKey, value) {
  const [min, max] = vehicleSpecLimits[stateKey] ?? [-Infinity, Infinity];
  return value >= min && value <= max;
}

function tireSpecStateKey(stateKey) {
  return stateKey === "frontTireSpec" || stateKey === "rearTireSpec";
}

function defaultSpecValue(stateKey) {
  return {
    carWeight: 1500,
    frontWeightPercent: 52,
    frontTireSpec: "245/35R19",
    rearTireSpec: "265/35R19",
    frontTireSizeMm: 245,
    rearTireSizeMm: 265,
    powerKw: 400,
    torqueNm: 650,
  }[stateKey];
}

function bindVehicleInputs() {
  const vehicleNameInput = document.getElementById("vehicleNameInput");
  if (vehicleNameInput) {
    vehicleNameInput.addEventListener("input", () => {
      state.vehicleName = vehicleNameInput.value;
      renderSelectionPreview();
    });
    vehicleNameInput.addEventListener("change", () => {
      state.vehicleName = vehicleNameInput.value.trim();
      syncVehicleInputs();
      renderSelectionPreview();
    });
  }

  [
    ["carWeightInput", "carWeight"],
    ["inlineCarWeightInput", "carWeight"],
    ["frontTireSizeInput", "frontTireSpec"],
    ["rearTireSizeInput", "rearTireSpec"],
    ["inlineFrontTireSizeInput", "frontTireSpec"],
    ["inlineRearTireSizeInput", "rearTireSpec"],
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
      if (tireSpecStateKey(stateKey)) {
        const parsed = parseTireSpec(input.value, defaultSpecValue(stateKey));
        if (!parsed || parsed.spec !== input.value.trim().toUpperCase().replace(/\s+/g, "")) return;
        state[stateKey] = parsed.spec;
        normalizeVehicleSpecs();
        syncVehicleInputs(inputId);
        updateLiveTune();
        return;
      }
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (input.type !== "range" && !specValueInRange(stateKey, value)) return;
      state[stateKey] = value;
      normalizeVehicleSpecs();
      syncVehicleInputs(input.type === "range" ? "" : inputId);
      updateLiveTune();
    });

    input.addEventListener("change", () => {
      if (tireSpecStateKey(stateKey)) {
        const parsed = parseTireSpec(input.value, defaultSpecValue(stateKey));
        state[stateKey] = parsed?.spec ?? defaultSpecValue(stateKey);
        syncVehicleInputs();
        updateLiveTune();
        return;
      }
      const value = Number(input.value);
      state[stateKey] = Number.isFinite(value) ? value : defaultSpecValue(stateKey);
      syncVehicleInputs();
      updateLiveTune();
    });
  });
}

function gearboxDefaultValue(key) {
  if (key === "finalDrive") return Number(recommendedGearFinalDrive(buildTune()).toFixed(2));
  const defaults = createDefaultGearbox();
  return defaults[key] ?? "";
}

function gearNumber(key) {
  const value = Number(state.gearbox[key]);
  return Number.isFinite(value) ? value : NaN;
}

function gearboxValueInRange(key, value) {
  const [min, max] = gearboxLimits[key] ?? [-Infinity, Infinity];
  return value >= min && value <= max;
}

function validTerminalMode(value) {
  return value === "redline" || value === "powerBand" ? value : DEFAULT_GEARBOX.terminalMode;
}

function validGearSpacingMode(value) {
  return ["traction", "balanced", "recovery", "topSpeed"].includes(value)
    ? value
    : recommendedGearSpacingMode();
}

function formatGearRatio(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}

function clampGearRatio(value) {
  return clampNumber(value, ...gearboxLimits.gearRatio);
}

function syncGearboxInputs(skipInputId = "") {
  const terminalModeSelect = document.getElementById("gearTerminalModeSelect");
  if (terminalModeSelect && skipInputId !== "gearTerminalModeSelect") {
    terminalModeSelect.value = validTerminalMode(state.gearbox.terminalMode);
  }
  const spacingModeSelect = document.getElementById("gearSpacingModeSelect");
  if (spacingModeSelect && skipInputId !== "gearSpacingModeSelect") {
    spacingModeSelect.value = validGearSpacingMode(state.gearbox.spacingMode);
  }

  const fieldMap = [
    ["gearCountInput", "gearCount"],
    ["gearRedlineRpmInput", "redlineRpm"],
    ["gearPeakHpRpmInput", "peakHpRpm"],
    ["gearTopSpeedInput", "topSpeedKmh"],
  ];

  fieldMap.forEach(([inputId, key]) => {
    const input = document.getElementById(inputId);
    if (!input || inputId === skipInputId) return;
    const value = state.gearbox[key];
    const isIntegerField = key === "gearCount" || key === "redlineRpm" || key === "peakHpRpm";
    input.value = value === "" ? "" : isIntegerField ? Math.round(value) : formatGearRatio(Number(value));
  });
}

function syncGearStrategyControls() {
  const redline = gearNumber("redlineRpm");
  const peakHp = gearNumber("peakHpRpm");
  if (Number.isFinite(redline) && Number.isFinite(peakHp) && peakHp > redline) {
    state.gearbox.peakHpRpm = redline;
    syncGearboxInputs();
  }
}

function gearboxReady() {
  const values = ["gearCount", "redlineRpm", "peakHpRpm", "topSpeedKmh", "finalDrive"].map((key) =>
    gearNumber(key),
  );
  const baseReady = values.every((value) => Number.isFinite(value) && value > 0);
  return baseReady && gearNumber("peakHpRpm") <= gearNumber("redlineRpm");
}

function combinedGearMod(name, ...sources) {
  return sources.reduce((total, source) => total + (Number(source?.[name]) || 0), 0);
}

function rpmPowerRatio(redlineRpm, peakHpRpm) {
  if (!Number.isFinite(redlineRpm) || !Number.isFinite(peakHpRpm) || redlineRpm <= 0) return 0.9;
  return clampNumber(peakHpRpm / redlineRpm, 0.55, 0.98);
}

function drivenTireProfile(tune = buildTune()) {
  normalizeVehicleSpecs();
  const front = frontTireSpec();
  const rear = rearTireSpec();
  const frontCircumference = front.circumferenceMeters;
  const rearCircumference = rear.circumferenceMeters;

  if (state.drive === "fwd") {
    return {
      circumference: frontCircumference,
      label: t("gearDrivenFront"),
      frontCircumference,
      rearCircumference,
      frontSpec: front,
      rearSpec: rear,
      rearBias: 0,
    };
  }

  if (state.drive === "rwd") {
    return {
      circumference: rearCircumference,
      label: t("gearDrivenRear"),
      frontCircumference,
      rearCircumference,
      frontSpec: front,
      rearSpec: rear,
      rearBias: 1,
    };
  }

  const rearBias = clampNumber((Number(tune?.diffCenter) || 65) / 100, 0.15, 0.85);
  return {
    circumference: frontCircumference * (1 - rearBias) + rearCircumference * rearBias,
    label: t("gearDrivenAwd"),
    frontCircumference,
    rearCircumference,
    frontSpec: front,
    rearSpec: rear,
    rearBias,
  };
}

function gearRatioForSpeed(rpm, speedKmh, finalDrive, tireCircumferenceMeters) {
  if (!Number.isFinite(rpm) || !Number.isFinite(speedKmh) || !Number.isFinite(finalDrive) || !Number.isFinite(tireCircumferenceMeters)) {
    return NaN;
  }
  if (rpm <= 0 || speedKmh <= 0 || finalDrive <= 0 || tireCircumferenceMeters <= 0) return NaN;
  return (rpm * tireCircumferenceMeters * 0.06) / (speedKmh * finalDrive);
}

function speedForGearRatio(rpm, ratio, finalDrive, tireCircumferenceMeters) {
  if (!Number.isFinite(rpm) || !Number.isFinite(ratio) || !Number.isFinite(finalDrive) || !Number.isFinite(tireCircumferenceMeters)) {
    return NaN;
  }
  if (rpm <= 0 || ratio <= 0 || finalDrive <= 0 || tireCircumferenceMeters <= 0) return NaN;
  return (rpm * tireCircumferenceMeters * 0.06) / (ratio * finalDrive);
}

function rpmForSpeedGearRatio(speedKmh, ratio, finalDrive, tireCircumferenceMeters) {
  if (!Number.isFinite(speedKmh) || !Number.isFinite(ratio) || !Number.isFinite(finalDrive) || !Number.isFinite(tireCircumferenceMeters)) {
    return NaN;
  }
  if (speedKmh <= 0 || ratio <= 0 || finalDrive <= 0 || tireCircumferenceMeters <= 0) return NaN;
  return (speedKmh * ratio * finalDrive) / (tireCircumferenceMeters * 0.06);
}

function engineShiftRecoveryBias(engineId) {
  const biases = {
    flatTorque: -0.04,
    highRpm: 0.035,
    turboHit: 0.015,
    supercharged: -0.015,
    lowEnd: -0.075,
    instant: -0.055,
  };
  return biases[engineId] ?? 0;
}

function targetShiftRecoveryFraction({ engine, raceId, tuneFocusId, trackRatio, powerRatio }) {
  const cornerBias = routeShapeEnabled(raceId) ? clampNumber((trackRatio - 0.55) * 0.08, -0.025, 0.045) : 0;
  const focusBias =
    tuneFocusId === "exit" || tuneFocusId === "agility"
      ? 0.025
      : tuneFocusId === "topSpeed"
        ? -0.02
        : tuneFocusId === "grip"
          ? -0.015
          : 0;
  const raceBias =
    raceId === "dragQuarter"
      ? 0.02
      : raceId === "dragHalf"
        ? -0.015
        : raceId === "drift"
          ? 0.015
          : 0;

  return clampNumber(powerRatio + engineShiftRecoveryBias(engine.id) + cornerBias + focusBias + raceBias, 0.62, 0.96);
}

function powerToWeightIndex() {
  normalizeVehicleSpecs();
  const powerToWeight = state.powerKw / Math.max(1, state.carWeight);
  return clampNumber((powerToWeight - 400 / 1500) / 0.16, -1.4, 2.4);
}

function targetTerminalBandPosition({ raceId, tuneFocusId, trackRatio, cornerProfileId, engineId }) {
  let position = 0.62;

  if (raceId === "dragHalf" || tuneFocusId === "topSpeed") position += 0.14;
  if (raceId === "dragQuarter") position += 0.08;
  if (raceId === "rally" || raceId === "offroad" || tuneFocusId === "grip") position -= 0.08;
  if (raceId === "drift") position -= 0.1;
  if (routeShapeEnabled(raceId)) position += clampNumber((0.45 - trackRatio) * 0.12, -0.04, 0.06);
  if (cornerProfileId === "large") position += 0.04;
  if (cornerProfileId === "small") position -= 0.05;
  if (tuneFocusId === "exit" || tuneFocusId === "agility") position -= 0.04;
  if (engineId === "highRpm") position += 0.08;
  if (engineId === "turboHit") position += 0.04;
  if (engineId === "lowEnd" || engineId === "instant") position -= 0.07;

  const weakPowerBias = clampNumber(-powerToWeightIndex() * 0.08, -0.08, 0.12);
  return clampNumber(position + weakPowerBias, 0.38, 0.9);
}

function targetTerminalRpm(peakHpRpm, redlineRpm, bandPosition) {
  const rpmWindow = Math.max(0, redlineRpm - peakHpRpm);
  return peakHpRpm + rpmWindow * clampNumber(bandPosition, 0, 1);
}

function terminalPowerBandPercent(terminalRpm, peakHpRpm, redlineRpm) {
  const rpmWindow = Math.max(1, redlineRpm - peakHpRpm);
  return clampNumber(((terminalRpm - peakHpRpm) / rpmWindow) * 100, 0, 100);
}

function terminalStatusKey(terminalRpm, peakHpRpm, redlineRpm) {
  if (terminalRpm < peakHpRpm * 0.99) return "gearTerminalLong";
  if (terminalRpm > redlineRpm * 1.005) return "gearTerminalShort";
  return "gearTerminalOk";
}

function gearAutoStrategyKey({ raceId, tuneFocusId, trackRatio, cornerProfileId }) {
  if (raceId === "dragQuarter") return "gearAutoStrategyLaunch";
  if (raceId === "dragHalf" || tuneFocusId === "topSpeed" || (!routeShapeEnabled(raceId) && raceId !== "dragQuarter")) {
    return "gearAutoStrategyTopSpeed";
  }
  if (tuneFocusId === "grip" || raceId === "rally" || raceId === "offroad") return "gearAutoStrategyGrip";
  if (tuneFocusId === "exit" || tuneFocusId === "agility" || trackRatio >= 0.65 || cornerProfileId === "small") {
    return "gearAutoStrategyCorner";
  }
  return "gearAutoStrategyBalanced";
}

function recommendedGearSpacingMode({
  raceId = state.race,
  tuneFocusId = state.tuneFocus,
  trackRatio = routeShapeEnabled(state.race) ? trackTypeRatio() : 0,
  cornerProfileId = selectedCornerProfile().id,
} = {}) {
  const strategyKey = gearAutoStrategyKey({ raceId, tuneFocusId, trackRatio, cornerProfileId });
  if (strategyKey === "gearAutoStrategyLaunch" || strategyKey === "gearAutoStrategyGrip") return "traction";
  if (strategyKey === "gearAutoStrategyCorner") return "recovery";
  if (strategyKey === "gearAutoStrategyTopSpeed") return "topSpeed";
  return "balanced";
}

function gearSpacingTranslationKey(modeId) {
  const keys = {
    traction: "gearSpacingTraction",
    balanced: "gearSpacingBalanced",
    recovery: "gearSpacingRecovery",
    topSpeed: "gearSpacingTopSpeed",
  };
  return keys[modeId] ?? "gearSpacingBalanced";
}

function gearSpacingDisplayLabel(modeId) {
  return t(gearSpacingTranslationKey(modeId));
}

function raceGearProfile(raceId) {
  return raceGearMods[raceId] ?? raceGearMods.road;
}

function recommendedGearFinalDrive(tune = buildTune()) {
  const raceGearMod = raceGearProfile(state.race);
  const trackGearMod = trackTypeGearMods();
  const cornerGearMod = cornerProfileGearMods();
  return clampNumber(
    tune.finalDrive +
      (Number(raceGearMod.finalDriveBias) || 0) +
      (Number(trackGearMod.finalDriveBias) || 0) +
      (Number(cornerGearMod.finalDriveBias) || 0),
    ...gearboxLimits.finalDrive,
  );
}

function refreshRecommendedGearFinalDrive() {
  state.gearbox.finalDrive = Number(recommendedGearFinalDrive(buildTune()).toFixed(2));
}

function prepareGearCalculator() {
  const tune = buildTune();
  state.gearbox.spacingMode = recommendedGearSpacingMode();
  state.gearbox.finalDrive = Number(recommendedGearFinalDrive(tune).toFixed(2));
  syncGearboxInputs();
  syncGearStrategyControls();
  renderGearCalculator(tune);
}

function focusFirstGearRange(focusId, raceGearMod = {}, intensityMultiplier = 1) {
  const ranges = {
    balanced: [70, 84],
    stability: [76, 90],
    agility: [66, 82],
    exit: [66, 82],
    topSpeed: [80, 95],
    grip: [72, 86],
  };
  const balancedRange = ranges.balanced;
  const focusRange = ranges[focusId] ?? balancedRange;
  const focusWeight = clampNumber(intensityMultiplier, 0, 1.5);
  const tunedFocusRange = [
    balancedRange[0] + (focusRange[0] - balancedRange[0]) * focusWeight,
    balancedRange[1] + (focusRange[1] - balancedRange[1]) * focusWeight,
  ];
  const raceRange = raceGearMod.firstRange ?? tunedFocusRange;
  const raceWeight = 0.58;
  const minTarget = clampNumber(tunedFocusRange[0] * (1 - raceWeight) + raceRange[0] * raceWeight, 55, 96);
  const maxTarget = clampNumber(tunedFocusRange[1] * (1 - raceWeight) + raceRange[1] * raceWeight, minTarget + 8, 100);
  return [minTarget, maxTarget];
}

function estimateFirstGearTarget({
  tuneFocus,
  engine,
  raceGearMod,
  trackGearMods,
  cornerGearMods,
  focusGearMods,
  engineGearMods,
  focusIntensity,
}) {
  const [minTarget, maxTarget] = focusFirstGearRange(tuneFocus.id, raceGearMod, focusIntensity);
  const midpoint = (minTarget + maxTarget) / 2;
  const vehiclePaceAdjust = clampNumber(powerToWeightIndex() * 4 + Math.max(0, torqueIndex()) * 1.8 - vehicleWeightIndex() * 1.5, -7, 8);
  const profileAdjust = combinedGearMod(
    "firstTarget",
    raceGearMod,
    trackGearMods,
    cornerGearMods,
    focusGearMods,
    engineGearMods,
  );
  const engineWindowAdjust = engine.id === "highRpm" ? -2 : engine.id === "lowEnd" ? 2 : 0;
  return clampNumber(midpoint + vehiclePaceAdjust + profileAdjust + engineWindowAdjust, minTarget, maxTarget);
}

function gearSpacingProfile(modeId) {
  const profiles = {
    traction: {
      lowDropRpm: 1850,
      midDropRpm: 760,
      highBandPosition: 0.14,
      blend: 0.64,
    },
    balanced: {
      lowDropRpm: 1400,
      midDropRpm: 260,
      highBandPosition: 0.3,
      blend: 0.58,
    },
    recovery: {
      lowDropRpm: 900,
      midDropRpm: -160,
      highBandPosition: 0.28,
      blend: 0.78,
    },
    topSpeed: {
      lowDropRpm: 1050,
      midDropRpm: -80,
      highBandPosition: 0.52,
      blend: 0.68,
    },
  };
  return profiles[modeId] ?? profiles.balanced;
}

function engineSpacingDropAdjust(engineId) {
  const adjustments = {
    flatTorque: 120,
    highRpm: -430,
    turboHit: -360,
    supercharged: -80,
    lowEnd: 520,
    instant: 460,
  };
  return adjustments[engineId] ?? 0;
}

function gearSpacingTargetFractions({
  modeId,
  gearCount,
  redlineRpm,
  peakHpRpm,
  engine,
  baseRecoveryFraction,
}) {
  const profile = gearSpacingProfile(modeId);
  const rpmWindow = Math.max(0, redlineRpm - peakHpRpm);
  const dropAdjust = engineSpacingDropAdjust(engine.id);
  const lowDrop = Math.max(0, profile.lowDropRpm + dropAdjust);
  const midDrop = profile.midDropRpm + dropAdjust * 0.55;
  const steps = Math.max(1, gearCount - 2);

  return Array.from({ length: Math.max(1, gearCount - 1) }, (_, index) => {
    const progress = index / steps;
    let targetRpm;

    if (progress < 0.68) {
      const localProgress = clampNumber(progress / 0.68, 0, 1);
      const easedProgress = 1 - Math.pow(1 - localProgress, 1.35);
      const drop = lowDrop * (1 - easedProgress) + midDrop * easedProgress;
      targetRpm = peakHpRpm - drop;
    } else {
      const localProgress = clampNumber((progress - 0.68) / 0.32, 0, 1);
      targetRpm = peakHpRpm + rpmWindow * profile.highBandPosition * localProgress;
    }

    const baseRecoveryRpm = redlineRpm * baseRecoveryFraction;
    const blendedTargetRpm = targetRpm * 0.78 + baseRecoveryRpm * 0.22;
    return clampNumber(blendedTargetRpm / redlineRpm, 0.54, 0.96);
  });
}

function applyGearSpacingPattern(
  ratios,
  {
    modeId,
    gearCount,
    redlineRpm,
    peakHpRpm,
    engine,
    baseRecoveryFraction,
    finalDrive,
    tireCircumference,
  },
) {
  if (!Array.isArray(ratios) || ratios.length < 3) {
    return { ratios, targetFractions: [], modeId };
  }

  const profile = gearSpacingProfile(modeId);
  const targetFractions = gearSpacingTargetFractions({
    modeId,
    gearCount,
    redlineRpm,
    peakHpRpm,
    engine,
    baseRecoveryFraction,
  });
  const firstRatio = ratios[0]?.ratio;
  const topRatio = ratios[ratios.length - 1]?.ratio;

  if (!Number.isFinite(firstRatio) || !Number.isFinite(topRatio) || firstRatio <= topRatio) {
    return { ratios, targetFractions, modeId };
  }

  const totalLogDrop = Math.max(0.01, Math.log(firstRatio / topRatio));
  const rawDrops = targetFractions.map((fraction) => Math.log(1 / clampNumber(fraction, 0.52, 0.98)));
  const rawDropTotal = Math.max(0.01, rawDrops.reduce((total, value) => total + value, 0));
  const scaledDrops = rawDrops.map((value) => value * (totalLogDrop / rawDropTotal));
  const shapedRatios = [{ ...ratios[0], ratio: firstRatio }];

  for (let index = 0; index < scaledDrops.length; index += 1) {
    const previousRatio = shapedRatios[index].ratio;
    shapedRatios[index + 1] = {
      ...ratios[index + 1],
      ratio: index === scaledDrops.length - 1 ? topRatio : previousRatio / Math.exp(scaledDrops[index]),
    };
  }

  const lastIndex = ratios.length - 1;
  const adjustedRatios = ratios.map((ratio, index) => {
    if (index === 0 || index === lastIndex) return { ...ratio };
    const position = index / lastIndex;
    const middleWeight = 1 - Math.abs(position - 0.52) * 0.34;
    const blend = clampNumber(profile.blend * middleWeight, 0.25, 0.82);
    return {
      ...ratio,
      ratio: ratio.ratio * (1 - blend) + shapedRatios[index].ratio * blend,
    };
  });

  for (let index = lastIndex - 1; index >= 1; index -= 1) {
    adjustedRatios[index].ratio = Math.max(adjustedRatios[index].ratio, adjustedRatios[index + 1].ratio * 1.06);
  }

  for (let index = 1; index < lastIndex; index += 1) {
    adjustedRatios[index].ratio = Math.min(adjustedRatios[index].ratio, adjustedRatios[index - 1].ratio * 0.94);
  }

  adjustedRatios.forEach((ratio) => {
    ratio.ratio = clampGearRatio(ratio.ratio);
    ratio.shiftKmh = speedForGearRatio(redlineRpm, ratio.ratio, finalDrive, tireCircumference);
  });

  return { ratios: adjustedRatios, targetFractions, modeId };
}

function gearShiftRecoveryRpms(ratios, redlineRpm) {
  if (!Array.isArray(ratios) || ratios.length < 2) return [];
  return ratios.slice(0, -1).map((ratio, index) => {
    const nextRatio = ratios[index + 1]?.ratio;
    if (!Number.isFinite(ratio.ratio) || !Number.isFinite(nextRatio) || ratio.ratio <= 0) return NaN;
    return redlineRpm * (nextRatio / ratio.ratio);
  }).filter(Number.isFinite);
}

function cornerRecoveryRedlineFraction(engine) {
  const fractions = {
    flatTorque: 0.72,
    highRpm: 0.82,
    turboHit: 0.78,
    supercharged: 0.75,
    lowEnd: 0.66,
    instant: 0.68,
  };
  return fractions[engine.id] ?? 0.74;
}

function automaticCornerRecoveryPlan({ gearCount, topTarget, raceId, tuneFocusId, cornerProfileId, trackRatio }) {
  if (!routeShapeEnabled(raceId)) return { active: false };

  const cornerWeight = clampNumber((trackRatio - 0.42) / 0.58, 0, 1);
  const focusWeight = tuneFocusId === "exit" || tuneFocusId === "agility" ? 0.28 : tuneFocusId === "grip" ? 0.12 : 0;
  const profileWeight =
    cornerProfileId === "small" ? 0.24 : cornerProfileId === "medium" ? 0.16 : cornerProfileId === "mixed" ? 0.08 : 0;
  const strength = clampNumber(cornerWeight + focusWeight + profileWeight, 0, 1);

  if (strength < 0.38) return { active: false };

  const profileSpeedRatio =
    cornerProfileId === "small"
      ? 0.23
      : cornerProfileId === "medium"
        ? 0.31
        : cornerProfileId === "large"
          ? 0.43
          : 0.29;
  const targetGear =
    cornerProfileId === "small"
      ? Math.min(3, gearCount - 1)
      : cornerProfileId === "large"
        ? Math.max(3, gearCount - 2)
        : Math.min(4, Math.max(3, gearCount - 2));

  return {
    active: true,
    blend: 0.22 + strength * 0.42,
    cornerSpeed: clampNumber(topTarget * profileSpeedRatio, 45, topTarget * 0.72),
    targetGear: Math.round(clampNumber(targetGear, 2, gearCount - 1)),
  };
}

function applyCornerRecoveryBias(
  ratios,
  {
    gearCount,
    topTarget,
    topRatio,
    engine,
    raceId,
    tuneFocusId,
    cornerProfileId,
    trackRatio,
    shiftRecoveryFraction,
    redlineRpm,
    finalDrive,
    tireCircumference,
  },
) {
  const recoveryPlan = automaticCornerRecoveryPlan({ gearCount, topTarget, raceId, tuneFocusId, cornerProfileId, trackRatio });
  if (!recoveryPlan.active) return { ratios, note: "", strategyId: "balanced", targetGear: null };

  const cornerSpeed = recoveryPlan.cornerSpeed;
  const targetGear = recoveryPlan.targetGear;
  const targetIndex = targetGear - 1;
  const desiredRevFraction = clampNumber(
    (cornerRecoveryRedlineFraction(engine) + shiftRecoveryFraction) / 2,
    0.64,
    0.88,
  );
  const targetRedlineSpeed = clampNumber(cornerSpeed / desiredRevFraction, cornerSpeed + 5, topTarget * 0.96);
  const previousRatio = ratios[targetIndex - 1]?.ratio;
  const nextRatio = ratios[targetIndex + 1]?.ratio;
  let targetRatio = gearRatioForSpeed(redlineRpm, targetRedlineSpeed, finalDrive, tireCircumference);
  if (!Number.isFinite(targetRatio)) targetRatio = topTarget * (topRatio / targetRedlineSpeed);

  if (Number.isFinite(previousRatio)) targetRatio = Math.min(targetRatio, previousRatio * 0.9);
  if (Number.isFinite(nextRatio)) targetRatio = Math.max(targetRatio, nextRatio * 1.1);

  const blend = clampNumber(recoveryPlan.blend, 0, 0.85);
  const lastIndex = ratios.length - 1;
  const adjustedRatios = ratios.map((ratio, index) => {
    const distance = Math.abs(index - targetIndex);
    if (index === lastIndex || distance > 2) return { ...ratio };

    const localBlend = blend * Math.max(0, 1 - distance * 0.38);
    const neighborTargetRatio = targetRatio * Math.pow(1.22, targetIndex - index);
    return {
      ...ratio,
      ratio: ratio.ratio * (1 - localBlend) + neighborTargetRatio * localBlend,
    };
  });

  for (let index = 1; index < lastIndex; index += 1) {
    adjustedRatios[index].ratio = Math.min(adjustedRatios[index].ratio, adjustedRatios[index - 1].ratio * 0.94);
  }

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    adjustedRatios[index].ratio = Math.max(adjustedRatios[index].ratio, adjustedRatios[index + 1].ratio * 1.06);
  }

  adjustedRatios.forEach((ratio) => {
    ratio.ratio = clampGearRatio(ratio.ratio);
    ratio.shiftKmh = speedForGearRatio(redlineRpm, ratio.ratio, finalDrive, tireCircumference);
    if (!Number.isFinite(ratio.shiftKmh)) ratio.shiftKmh = topTarget * (topRatio / ratio.ratio);
  });

  return {
    ratios: adjustedRatios,
    strategyId: "corner",
    targetGear,
    note: t("gearCornerNote", {
      speed: Math.round(cornerSpeed),
      gear: targetGear,
      rev: Math.round(desiredRevFraction * 100),
    }),
  };
}

function gearRatioBandProfile(gear, gearCount, isCornerTarget = false) {
  if (isCornerTarget) {
    return { roleKey: "gearBandRoleCornerTarget" };
  }

  if (gear === 1) {
    return { roleKey: "gearBandRoleLaunch" };
  }

  if (gear === gearCount) {
    return { roleKey: "gearBandRoleTop" };
  }

  if (gear >= gearCount - 1) {
    return { roleKey: "gearBandRoleHigh" };
  }

  if (gear <= 3) {
    return { roleKey: "gearBandRoleLowMid" };
  }

  return { roleKey: "gearBandRoleMid" };
}

function calculateGearRatios(tune = buildTune()) {
  const race = optionById(raceTypes, state.race) ?? raceTypes[0];
  const tuneFocus = optionById(tuneFocusTypes, state.tuneFocus) ?? tuneFocusTypes[0];
  const engine = optionById(engineCurves, state.engine) ?? engineCurves[0];
  const tireProfile = drivenTireProfile(tune);
  const raceGearMod = raceGearProfile(race.id);
  const trackGearMods = trackTypeGearMods();
  const cornerGearMods = cornerProfileGearMods();
  const focusIntensity = tuneFocusIntensityMultiplier();
  const focusGearMods = scaledGearMods(tuneFocus.gearMods ?? {}, focusIntensity);
  const engineGearMods = engine.gearMods ?? {};
  const gearCount = Math.round(clampNumber(gearNumber("gearCount"), ...gearboxLimits.gearCount));
  const redlineRpm = Math.round(clampNumber(gearNumber("redlineRpm"), ...gearboxLimits.redlineRpm));
  const peakHpRpm = Math.round(clampNumber(Math.min(gearNumber("peakHpRpm"), redlineRpm), ...gearboxLimits.peakHpRpm));
  const targetTerminalSpeed = clampNumber(gearNumber("topSpeedKmh"), ...gearboxLimits.topSpeedKmh);
  const finalDrive = clampNumber(gearNumber("finalDrive"), ...gearboxLimits.finalDrive);
  const terminalMode = validTerminalMode(state.gearbox.terminalMode);
  const gearCountAdjust = gearCount <= 5 ? 0.35 : gearCount >= 8 ? -0.2 : 0;
  const trackRatio = routeShapeEnabled(race.id) ? trackTypeRatio() : 0;
  const selectedSpacingMode = validGearSpacingMode(state.gearbox.spacingMode);
  const resolvedSpacingMode = selectedSpacingMode;
  const powerRatio = rpmPowerRatio(redlineRpm, peakHpRpm);
  const shiftRecoveryFraction = targetShiftRecoveryFraction({
    engine,
    raceId: race.id,
    tuneFocusId: tuneFocus.id,
    trackRatio,
    powerRatio,
  });
  const terminalBandPosition =
    terminalMode === "redline"
      ? 1
      : targetTerminalBandPosition({
          raceId: race.id,
          tuneFocusId: tuneFocus.id,
          trackRatio,
          cornerProfileId: selectedCornerProfile().id,
          engineId: engine.id,
        });
  const desiredTerminalRpm = terminalMode === "redline" ? redlineRpm : targetTerminalRpm(peakHpRpm, redlineRpm, terminalBandPosition);
  const formulaTopRatio = gearRatioForSpeed(desiredTerminalRpm, targetTerminalSpeed, finalDrive, tireProfile.circumference);
  const baseTopRatio = Number.isFinite(formulaTopRatio) ? formulaTopRatio : 0.85;
  const topRatio = clampGearRatio(baseTopRatio);
  const topTarget = speedForGearRatio(redlineRpm, topRatio, finalDrive, tireProfile.circumference);
  const firstGearTarget = estimateFirstGearTarget({
    tuneFocus,
    engine,
    raceGearMod,
    trackGearMods,
    cornerGearMods,
    focusGearMods,
    engineGearMods,
    focusIntensity,
  });
  const speedSpread = topTarget / firstGearTarget + gearCountAdjust * 0.08;
  const rpmSpread = Math.pow(1 / shiftRecoveryFraction, Math.max(1, gearCount - 1));
  const spread = clampNumber(speedSpread * 0.78 + rpmSpread * 0.22, 3.05, 5.35);
  const actualFirstGearTarget = topTarget / spread;
  const rpmCurveAdjust = clampNumber((shiftRecoveryFraction - 0.82) * 0.32, -0.08, 0.08);
  const abilityCurveAdjust = clampNumber((vehicleWeightIndex() - powerToWeightIndex()) * 0.035, -0.08, 0.1);
  const curvePower = clampNumber(
    1 +
      rpmCurveAdjust +
      abilityCurveAdjust +
      combinedGearMod("curvePower", raceGearMod, trackGearMods, cornerGearMods, focusGearMods, engineGearMods),
    0.78,
    1.35,
  );
  let ratios = [];

  for (let gear = 1; gear <= gearCount; gear += 1) {
    const position = (gearCount - gear) / Math.max(1, gearCount - 1);
    const ratio = clampGearRatio(topRatio * Math.pow(spread, Math.pow(position, curvePower)));
    const formulaShiftKmh = speedForGearRatio(redlineRpm, ratio, finalDrive, tireProfile.circumference);
    const shiftKmh = Number.isFinite(formulaShiftKmh) ? formulaShiftKmh : topTarget * (topRatio / ratio);
    ratios.push({ gear, ratio, shiftKmh });
  }

  const spacingPlan = applyGearSpacingPattern(ratios, {
    modeId: resolvedSpacingMode,
    gearCount,
    redlineRpm,
    peakHpRpm,
    engine,
    baseRecoveryFraction: shiftRecoveryFraction,
    finalDrive,
    tireCircumference: tireProfile.circumference,
  });
  ratios = spacingPlan.ratios;

  const cornerPlan = applyCornerRecoveryBias(ratios, {
    gearCount,
    topTarget,
    topRatio,
    engine,
    raceId: race.id,
    tuneFocusId: tuneFocus.id,
    cornerProfileId: selectedCornerProfile().id,
    trackRatio,
    shiftRecoveryFraction,
    redlineRpm,
    finalDrive,
    tireCircumference: tireProfile.circumference,
  });
  ratios = cornerPlan.ratios;
  ratios = ratios.map((ratio) => ({
    ...ratio,
    suggestedRatio: ratio.ratio,
    isManual: false,
    isSynchronized: false,
  }));
  const currentTopRatio = ratios[ratios.length - 1]?.ratio ?? topRatio;
  const currentTopTarget = speedForGearRatio(redlineRpm, currentTopRatio, finalDrive, tireProfile.circumference);
  const currentTerminalRpm = rpmForSpeedGearRatio(targetTerminalSpeed, currentTopRatio, finalDrive, tireProfile.circumference);
  const currentTerminalBandPercent = terminalPowerBandPercent(currentTerminalRpm, peakHpRpm, redlineRpm);
  const currentTerminalStatus = terminalStatusKey(currentTerminalRpm, peakHpRpm, redlineRpm);
  const currentFirstRatio = ratios[0]?.ratio;
  const currentFirstGearTarget = speedForGearRatio(redlineRpm, currentFirstRatio, finalDrive, tireProfile.circumference);
  const shiftRecoveryRpms = gearShiftRecoveryRpms(ratios, redlineRpm);
  const currentSpread = ratios[0].ratio / ratios[ratios.length - 1].ratio;
  const strategyKey =
    cornerPlan.strategyId === "corner"
      ? "gearAutoStrategyCorner"
      : gearAutoStrategyKey({
          raceId: race.id,
          tuneFocusId: tuneFocus.id,
          trackRatio,
          cornerProfileId: selectedCornerProfile().id,
        });

  return {
    gearCount,
    finalDrive,
    spread: currentSpread,
    redlineRpm,
    peakHpRpm,
    tireCircumference: tireProfile.circumference,
    tireDriveLabel: tireProfile.label,
    terminalMode,
    targetTerminalSpeed,
    terminalRpm: currentTerminalRpm,
    terminalBandPercent: currentTerminalBandPercent,
    terminalStatus: currentTerminalStatus,
    topTarget: currentTopTarget,
    firstGearTarget: Number.isFinite(currentFirstGearTarget) ? currentFirstGearTarget : actualFirstGearTarget,
    targetShiftRpm: shiftRecoveryRpms.length
      ? shiftRecoveryRpms.reduce((total, value) => total + value, 0) / shiftRecoveryRpms.length
      : redlineRpm * shiftRecoveryFraction,
    shiftRecoveryRpms,
    shiftRecoveryFraction,
    terminalBandPosition,
    selectedSpacingMode,
    resolvedSpacingMode,
    spacingLabel: gearSpacingDisplayLabel(selectedSpacingMode),
    raceLabel: localizedOption("raceTypes", race).label,
    raceNote: localizedRaceGearNote(race.id, raceGearMod.note),
    trackTypeLabel: formatTrackTypeLabel(),
    cornerProfileLabel: formatCornerProfileLabel(),
    engineLabel: localizedOption("engineCurves", engine).label,
    tuneFocusLabel: formatTuneFocusLabel(tuneFocus),
    tuneFocusIntensity: formatTuneFocusIntensity(),
    strategyId: cornerPlan.strategyId,
    strategyLabel: t(strategyKey),
    cornerTargetGear: cornerPlan.targetGear,
    hasManualRatios: false,
    ratios,
    note:
      cornerPlan.note
        ? `${cornerPlan.note} ${t("gearAutoApplied", { strategy: t(strategyKey) })}`
        : `${t(currentTerminalStatus)} ${t("gearDefaultNote", {
            strategy: t(strategyKey),
            focus: formatTuneFocusLabel(tuneFocus),
          })}`,
  };
}

function formatShiftRecoverySummary(plan) {
  const values = (plan.shiftRecoveryRpms ?? []).filter(Number.isFinite);
  if (!values.length) return `${Math.round(plan.targetShiftRpm)} RPM`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 90) return `${Math.round(plan.targetShiftRpm)} RPM`;
  return `${Math.round(min)}-${Math.round(max)} RPM`;
}

function renderGearCalculator(tune = buildTune()) {
  const summaryGrid = document.getElementById("gearSummaryGrid");
  const ratioGrid = document.getElementById("gearRatioGrid");
  if (!summaryGrid || !ratioGrid) return;

  if (!availabilityEnabled("gearbox")) {
    summaryGrid.innerHTML = `
      <div class="gear-empty">
        ${t("gearboxUnavailableMessage")}
      </div>
    `;
    ratioGrid.innerHTML = "";
    return;
  }

  if (!gearboxReady()) {
    summaryGrid.innerHTML = `
      <div class="gear-empty">
        ${t("gearEmpty")}
      </div>
    `;
    ratioGrid.innerHTML = "";
    return;
  }

  const plan = calculateGearRatios(tune);
  summaryGrid.innerHTML = `
    <article class="gear-summary-card">
      <span>${t("gearSummaryFinal")}</span>
      <strong>${formatGearRatio(plan.finalDrive)}</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryTop")}</span>
      <strong>${Math.round(plan.topTarget)} km/h</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryUsable")}</span>
      <strong>${Math.round(plan.terminalRpm)} RPM / ${t("gearSummaryUsableValue", {
        percent: Math.round(plan.terminalBandPercent),
      })}</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryFirst")}</span>
      <strong>${Math.round(plan.firstGearTarget)} km/h</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryRpmWindow")}</span>
      <strong>${Math.round(plan.peakHpRpm)} / ${Math.round(plan.redlineRpm)} RPM</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryShiftDrop")}</span>
      <strong>${formatShiftRecoverySummary(plan)}</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryTireCirc")}</span>
      <strong>${plan.tireCircumference.toFixed(2)} m</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummarySpread")}</span>
      <strong>${formatGearRatio(plan.spread)}</strong>
    </article>
    <article class="gear-summary-card">
      <span>${t("gearSummaryGoal")}</span>
      <strong>${plan.strategyLabel}</strong>
    </article>
  `;

  ratioGrid.innerHTML = plan.ratios
    .map((ratio) => {
      const isCornerTarget = plan.strategyId === "corner" && ratio.gear === plan.cornerTargetGear;
      const profile = gearRatioBandProfile(ratio.gear, plan.gearCount, isCornerTarget);
      const badges = [isCornerTarget ? t("gearBandTarget") : ""].filter(Boolean);
      const badgeHtml = badges.map((badge) => `<span class="gear-target-badge">${escapeHtml(badge)}</span>`).join("");
      const suggestedRatio = Number.isFinite(ratio.suggestedRatio) ? ratio.suggestedRatio : ratio.ratio;
      const speedLabel =
        ratio.gear === plan.gearCount
          ? t("gearTopRedlineSpeed", { speed: Math.round(ratio.shiftKmh) })
          : t("gearShift", { speed: Math.round(ratio.shiftKmh) });
      return `
        <article class="gear-ratio-card ${isCornerTarget ? "is-target" : ""}">
          <div class="gear-ratio-header">
            <div class="gear-ratio-title">
              <span>${t("gearLabel", { gear: ratio.gear })}</span>
              ${badgeHtml}
            </div>
            <small>${escapeHtml(t(profile.roleKey))}</small>
          </div>
          <div class="gear-ratio-metrics">
            <strong>${t("gearRatioSuggested", { value: formatGearRatio(suggestedRatio) })}</strong>
            <span>${speedLabel}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function bindGearboxInputs() {
  const spacingModeSelect = document.getElementById("gearSpacingModeSelect");
  if (spacingModeSelect) {
    spacingModeSelect.addEventListener("change", () => {
      state.gearbox.spacingMode = validGearSpacingMode(spacingModeSelect.value);
      syncGearboxInputs();
      renderGearCalculator(buildTune());
    });
  }

  const terminalModeSelect = document.getElementById("gearTerminalModeSelect");
  if (terminalModeSelect) {
    terminalModeSelect.addEventListener("change", () => {
      state.gearbox.terminalMode = validTerminalMode(terminalModeSelect.value);
      syncGearboxInputs();
      renderGearCalculator(buildTune());
    });
  }

  [
    ["gearCountInput", "gearCount"],
    ["gearRedlineRpmInput", "redlineRpm"],
    ["gearPeakHpRpmInput", "peakHpRpm"],
    ["gearTopSpeedInput", "topSpeedKmh"],
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
      const value = key === "gearCount" || key === "redlineRpm" || key === "peakHpRpm" ? Math.round(parsed) : parsed;
      if (!gearboxValueInRange(key, value)) return;
      state.gearbox[key] = value;
      syncGearStrategyControls();
      renderGearCalculator();
    });

    input.addEventListener("change", () => {
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) {
        state.gearbox[key] = gearboxDefaultValue(key);
      } else {
        const [min, max] = gearboxLimits[key];
        const value = key === "gearCount" || key === "redlineRpm" || key === "peakHpRpm" ? Math.round(parsed) : parsed;
        state.gearbox[key] = clampNumber(value, min, max);
      }

      syncGearStrategyControls();
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
  document.getElementById("encyclopediaPage").classList.toggle("is-hidden", view !== "encyclopedia");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function valuePair(front, rear) {
  return `${t("frontShort")} ${front} / ${t("rearShort")} ${rear}`;
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

function sideAvailabilityValue(groupId, value) {
  return availabilityEnabled(groupId) ? value : t("settingUnavailable");
}

function settingValue(card, tune) {
  const status = settingAvailabilityStatus(card[1]);
  if (status === "unavailable") return t("settingUnavailable");

  switch (card[1]) {
    case "camber":
      return valuePair(tune.camberFront.toFixed(1), tune.camberRear.toFixed(1));
    case "toe":
      return valuePair(tune.toeFront.toFixed(2), tune.toeRear.toFixed(2));
    case "arb":
      return valuePair(
        sideAvailabilityValue("frontArb", formatAdjustmentNumber(mappedAdjustmentValue("arbFront", tune.arbFront))),
        sideAvailabilityValue("rearArb", formatAdjustmentNumber(mappedAdjustmentValue("arbRear", tune.arbRear))),
      );
    case "spring":
      return adjustmentValuePair("springFront", "springRear", tune);
    case "ride":
      return valuePair(Math.round(tune.rideFront), Math.round(tune.rideRear));
    case "rebound":
      return adjustmentValuePair("reboundFront", "reboundRear", tune);
    case "bump":
      return adjustmentValuePair("bumpFront", "bumpRear", tune);
    case "aero":
      return valuePair(
        sideAvailabilityValue("frontAero", formatAdjustmentNumber(mappedAdjustmentValue("aeroFront", tune.aeroFront))),
        sideAvailabilityValue("rearAero", formatAdjustmentNumber(mappedAdjustmentValue("aeroRear", tune.aeroRear))),
      );
    case "brake":
      return `${t("frontShort")} ${Math.round(tune.brakeBalance)}% / ${t("brakePressure")} ${Math.round(
        tune.brakePressure,
      )}%`;
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
    return `${t("frontShort")} ${Math.round(tune.diffFrontAccel)} / ${Math.round(tune.diffFrontDecel)}`;
  }

  if (state.drive === "rwd") {
    return `${t("rearShort")} ${Math.round(tune.diffRearAccel)} / ${Math.round(tune.diffRearDecel)}`;
  }

  return `${t("frontShort")} ${Math.round(tune.diffFrontAccel)}/${Math.round(tune.diffFrontDecel)} ${t(
    "rearShort",
  )} ${Math.round(
    tune.diffRearAccel,
  )}/${Math.round(tune.diffRearDecel)} ${t("centerShort")} ${Math.round(tune.diffCenter)} ${t("rearBias")}`;
}

function settingExplanation(card, tune) {
  const [label, key, , note] = card;
  const availabilityStatus = settingAvailabilityStatus(key);
  if (availabilityStatus !== "available") {
    const compensation = compensationNoteForSetting(key);
    const statusText = unavailableLabelForStatus(availabilityStatus);
    if (currentLanguage() === "en") {
      return `${label} ${statusText}. ${t("settingUnavailableExplanation")} ${compensation}`.trim();
    }
    return `${label} ${statusText}。${t("settingUnavailableExplanation")} ${compensation}`.trim();
  }
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const separator = currentLanguage() === "en" ? ", " : "、";
  const context = [race.label, formatTuneFocusLabel(tuneFocus), engine.label, `${drive.label}${drive.subtitle ? ` ${drive.subtitle}` : ""}`].join(
    separator,
  );
  const specs = [
    `${t("vehicleSpecWeight")} ${Math.round(state.carWeight)} kg`,
    `${t("vehicleSpecFront")} ${formatSpecPercent(state.frontWeightPercent)}%`,
    `${t("vehicleSpecFrontTire")} ${state.frontTireSpec}`,
    `${t("vehicleSpecRearTire")} ${state.rearTireSpec}`,
    `${state.powerKw} kW`,
    `${state.torqueNm} N.m`,
  ].join(separator);
  const unit = settingUnit(card);
  const rangeText = adjustmentRangeText(key);
  const value = `${settingValue(card, tune)}${unit ? ` ${unit}` : ""}${rangeText}，${t(
    "settingExplanationCurrentFocus",
  )} ${formatTuneFocusLabel(tuneFocus)}`;

  if (currentLanguage() === "en") {
    return `${label} is suggested at ${value}. This combines ${context} with ${specs}; ${note}.`;
  }

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
      const localizedCard = localizedSettingCard(card);
      const [label, key, , note] = localizedCard;
      const availabilityStatus = settingAvailabilityStatus(key);
      const unit = availabilityStatus === "unavailable" ? "" : settingUnit(localizedCard);
      const wide = key === "diff" || key === "brake" ? " wide" : "";
      const unavailableClass = availabilityStatus !== "available" ? " is-unavailable" : "";
      const explanation = settingExplanation(localizedCard, tune);
      const unitMarkup = unit ? `<span class="setting-unit">${unit}</span>` : "";
      const unavailableMarkup =
        availabilityStatus !== "available"
          ? `<span class="setting-unavailable-chip">${unavailableLabelForStatus(availabilityStatus)}</span>`
          : "";
      const compensation = compensationNoteForSetting(key);
      const compensationMarkup =
        availabilityStatus !== "available" && compensation
          ? `<p class="setting-compensation-note">${escapeHtml(compensation)}</p>`
          : "";
      return `
        <article class="setting-card${wide}${unavailableClass}">
          <div>
            <div class="setting-label">${label}</div>
            <div class="setting-value">
              <span>${settingValue(localizedCard, tune)}</span>
              ${unitMarkup}
              ${unavailableMarkup}
              <span class="setting-help" tabindex="0" aria-label="${escapeHtml(explanation)}" title="${escapeHtml(explanation)}" data-tooltip="${escapeHtml(explanation)}">?</span>
            </div>
          </div>
          ${compensationMarkup}
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
      const localizedLabel = localizedMeterLabel(key, label);
      const value = Math.round(metricValue(key, tune));
      return `
        <div class="meter">
          <div class="meter-header">
            <span>${localizedLabel}</span>
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

function renderAdvice() {
  const adviceList = document.getElementById("adviceList");
  const selected = issueTypes.filter((issue) => state.issues.has(issue.id));

  if (!selected.length) {
    adviceList.innerHTML = `<div class="advice-empty">${t("adviceEmpty")}</div>`;
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
            <span>${localizedSymptom(issue).label}</span>
            <span class="advice-chip">${localizedSymptom(issue).chip}</span>
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

  if (issue.id === "top-speed" && state.race === "road" && trackTypeRatio() >= 0.65) {
    steps.push(["賽道取捨", "多彎賽道不要一次降太多終傳，先用 -0.08 小步測。"]);
  }

  if (issue.id === "drift-angle" && state.race !== "drift") {
    steps.push(["模式確認", "若目標不是甩尾，先只小幅調胎壓與前束，避免破壞正賽穩定。"]);
  }

  return adaptAdviceStepsForAvailability(steps);
}

function renderResult() {
  const tune = buildTune();
  renderSummary();
  renderSelectionPreview();
  renderRecommendationHints();
  renderMeters(tune);
  renderSetup(tune);
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${formatTuneFocusLabel(tuneFocus)} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...vehicleSpecCopyLines(),
    ...settingCards.map((card) => {
      const localizedCard = localizedSettingCard(card);
      const status = settingAvailabilityStatus(localizedCard[1]);
      const unit = status === "unavailable" ? "" : settingUnit(localizedCard);
      const statusText = copyStatusText(status);
      return `${localizedCard[0]}: ${settingValue(localizedCard, tune)} ${unit}${statusText}`.trim();
    }),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => flashButton("copyButton", t("copySuccess")))
    .catch(() => flashButton("copyButton", t("copyFail")));
}

function flashButton(id, label) {
  const button = document.getElementById(id);
  if (!button) return;
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1300);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnValue(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validOptionId(options, value, fallback) {
  return options.some((option) => option.id === value) ? value : fallback;
}

function sanitizedText(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizedNumber(value, fallback, [min, max], shouldRound = false) {
  const number = Number(value);
  const normalized = clampNumber(Number.isFinite(number) ? number : fallback, min, max);
  return shouldRound ? Math.round(normalized) : normalized;
}

function safeFileNameSegment(value) {
  return (
    sanitizedText(value, 60)
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "FH6-TuneLab"
  );
}

function setupFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `FH6-TuneLab_${safeFileNameSegment(normalizedVehicleName())}_${date}.json`;
}

function serializableAvailability() {
  return Object.fromEntries(availabilityGroups.map((group) => [group.id, availabilityEnabled(group.id)]));
}

function serializableAdjustmentRanges() {
  return Object.fromEntries(
    Object.keys(DEFAULT_ADJUSTMENT_RANGES).map((groupId) => [
      groupId,
      { ...normalizeAdjustmentRange(groupId) },
    ]),
  );
}

function serializableAdjustmentRangeOptions() {
  return {
    springLinked: springRangeLinked(),
  };
}

function createSetupSavePayload() {
  normalizeVehicleSpecs();
  normalizeTrackType();
  normalizeTuneFocusIntensity();
  const gearbox = Object.fromEntries(Object.keys(DEFAULT_GEARBOX).map((key) => [key, state.gearbox[key]]));

  return {
    schema: SETUP_SAVE_SCHEMA,
    schemaVersion: SETUP_SAVE_SCHEMA_VERSION,
    appVersion: SETUP_SAVE_APP_VERSION,
    savedAt: new Date().toISOString(),
    vehicle: {
      vehicleName: normalizedVehicleName(),
      carWeight: state.carWeight,
      frontWeightPercent: state.frontWeightPercent,
      frontTireSpec: state.frontTireSpec,
      rearTireSpec: state.rearTireSpec,
      powerKw: state.powerKw,
      torqueNm: state.torqueNm,
    },
    config: {
      race: state.race,
      trackType: state.trackType,
      cornerProfile: state.cornerProfile,
      tuneFocus: state.tuneFocus,
      tuneFocusIntensity: state.tuneFocusIntensity,
      engine: state.engine,
      drive: state.drive,
    },
    gearbox,
    adjustmentRanges: serializableAdjustmentRanges(),
    adjustmentRangeOptions: serializableAdjustmentRangeOptions(),
    availability: serializableAvailability(),
    symptoms: {
      activeIssueCategory: state.activeIssueCategory,
      issues: [...state.issues],
      solutionActiveIssueCategory: state.solutionActiveIssueCategory,
      solutionIssues: [...state.solutionIssues],
      appliedSymptomAdjustmentSeq: state.appliedSymptomAdjustmentSeq,
      appliedSymptomAdjustments: state.appliedSymptomAdjustments.map((adjustment) => ({
        id: adjustment.id,
        issueIds: [...(adjustment.issueIds ?? [])],
        deltaByKey: { ...(adjustment.deltaByKey ?? {}) },
        createdAt: adjustment.createdAt,
      })),
    },
  };
}

function saveSetupJson() {
  const payload = createSetupSavePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = setupFileName();
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  flashButton("saveJsonButton", t("saveJsonSuccess"));
}

function sanitizedIssueIds(value) {
  if (!Array.isArray(value)) return [];
  const validIssueIds = new Set(allIssueTypes.map((issue) => issue.id));
  return [...new Set(value.map((id) => String(id)).filter((id) => validIssueIds.has(id)))];
}

function sanitizedCategoryId(value, fallback) {
  return symptomCategories.some((category) => category.id === value) ? value : fallback;
}

function sanitizedAvailability(value) {
  const nextAvailability = createAvailability();
  if (!isPlainObject(value)) return nextAvailability;

  if (hasOwnValue(value, "aero")) {
    const isEnabled = value.aero !== false;
    nextAvailability.frontAero = isEnabled;
    nextAvailability.rearAero = isEnabled;
  }

  availabilityGroups.forEach((group) => {
    if (hasOwnValue(value, group.id)) {
      nextAvailability[group.id] = value[group.id] !== false;
    }
  });

  return nextAvailability;
}

function sanitizedAdjustmentRanges(value) {
  const nextRanges = createAdjustmentRanges();
  if (!isPlainObject(value)) return nextRanges;

  Object.entries(DEFAULT_ADJUSTMENT_RANGES).forEach(([groupId, defaults]) => {
    const rawRange = isPlainObject(value[groupId]) ? value[groupId] : {};
    const range = {};

    Object.keys(defaults).forEach((field) => {
      range[field] = sanitizedNumber(rawRange[field], defaults[field], adjustmentRangeValueLimits);
    });

    if (range.frontMin > range.frontMax) {
      [range.frontMin, range.frontMax] = [range.frontMax, range.frontMin];
    }
    if (range.rearMin > range.rearMax) {
      [range.rearMin, range.rearMax] = [range.rearMax, range.rearMin];
    }

    nextRanges[groupId] = range;
  });

  return nextRanges;
}

function sanitizedAdjustmentRangeOptions(value) {
  const rawOptions = isPlainObject(value) ? value : {};
  return {
    springLinked: rawOptions.springLinked === true,
  };
}

function sanitizedGearbox(value) {
  const rawGearbox = isPlainObject(value) ? value : {};
  const nextGearbox = createDefaultGearbox();

  Object.entries(DEFAULT_GEARBOX).forEach(([key, fallback]) => {
    if (key === "terminalMode") {
      nextGearbox.terminalMode = validTerminalMode(rawGearbox.terminalMode);
      return;
    }
    if (key === "spacingMode") {
      nextGearbox.spacingMode = validGearSpacingMode(rawGearbox.spacingMode);
      return;
    }
    nextGearbox[key] = sanitizedNumber(rawGearbox[key], fallback, gearboxLimits[key]);
  });

  nextGearbox.gearCount = Math.round(nextGearbox.gearCount);
  nextGearbox.redlineRpm = Math.round(nextGearbox.redlineRpm);
  nextGearbox.peakHpRpm = Math.round(Math.min(nextGearbox.peakHpRpm, nextGearbox.redlineRpm));

  return nextGearbox;
}

function sanitizedAppliedSymptomAdjustments(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();

  return value
    .map((adjustment, index) => {
      if (!isPlainObject(adjustment)) return null;
      const issueIds = sanitizedIssueIds(adjustment.issueIds);
      const rawDelta = isPlainObject(adjustment.deltaByKey) ? adjustment.deltaByKey : {};
      const deltaByKey = {};

      TUNE_KEYS.forEach((key) => {
        const delta = Number(rawDelta[key]);
        if (Number.isFinite(delta) && Math.abs(delta) > TUNE_DELTA_EPSILON) {
          deltaByKey[key] = delta;
        }
      });

      if (!issueIds.length || !Object.keys(deltaByKey).length) return null;

      const baseId = sanitizedText(adjustment.id, 80) || `loaded-symptom-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);

      const createdAt = Number(adjustment.createdAt);
      return {
        id,
        issueIds,
        deltaByKey,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() + index,
      };
    })
    .filter(Boolean);
}

function applySetupSavePayload(payload) {
  if (!isPlainObject(payload)) throw new Error("Invalid setup file");
  if (payload.schema && payload.schema !== SETUP_SAVE_SCHEMA) throw new Error("Unsupported setup schema");
  if (
    payload.schema === SETUP_SAVE_SCHEMA &&
    Number(payload.schemaVersion ?? SETUP_SAVE_SCHEMA_VERSION) > SETUP_SAVE_SCHEMA_VERSION
  ) {
    throw new Error("Unsupported setup schema version");
  }

  const hasSetupSections = ["vehicle", "config", "gearbox", "adjustmentRanges", "availability", "symptoms"].some((key) =>
    isPlainObject(payload[key]),
  );
  if (payload.schema !== SETUP_SAVE_SCHEMA && !hasSetupSections) throw new Error("Invalid setup file");

  const config = isPlainObject(payload.config) ? payload.config : {};
  const vehicle = isPlainObject(payload.vehicle) ? payload.vehicle : {};
  const symptoms = isPlainObject(payload.symptoms) ? payload.symptoms : {};

  state.view = "result";
  state.symptomMode = "linked";
  state.race = validOptionId(raceTypes, config.race, "road");
  state.trackType = sanitizedNumber(config.trackType, optionById(raceTypes, state.race)?.defaultTrackType ?? 55, routeShapeLimits.trackType, true);
  state.cornerProfile = validOptionId(cornerProfileTypes, config.cornerProfile, "mixed");
  state.tuneFocus = validOptionId(tuneFocusTypes, config.tuneFocus, "balanced");
  state.tuneFocusIntensity = sanitizedNumber(config.tuneFocusIntensity, 100, tuneFocusIntensityLimits, true);
  state.engine = validOptionId(engineCurves, config.engine, "flatTorque");
  state.drive = validOptionId(driveTypes, config.drive, "awd");
  state.vehicleName = sanitizedText(vehicle.vehicleName ?? payload.vehicleName, 80);
  state.carWeight = sanitizedNumber(vehicle.carWeight, 1500, vehicleSpecLimits.carWeight, true);
  state.frontWeightPercent = sanitizedNumber(vehicle.frontWeightPercent, 52, vehicleSpecLimits.frontWeightPercent, true);
  state.frontTireSpec = parseTireSpec(vehicle.frontTireSpec, "245/35R19").spec;
  state.rearTireSpec = parseTireSpec(vehicle.rearTireSpec, "265/35R19").spec;
  state.powerKw = sanitizedNumber(vehicle.powerKw, 400, vehicleSpecLimits.powerKw, true);
  state.torqueNm = sanitizedNumber(vehicle.torqueNm, 650, vehicleSpecLimits.torqueNm, true);
  state.gearbox = sanitizedGearbox(payload.gearbox);
  state.adjustmentRanges = sanitizedAdjustmentRanges(payload.adjustmentRanges);
  state.springRangeLinked = sanitizedAdjustmentRangeOptions(payload.adjustmentRangeOptions).springLinked;
  if (springRangeLinked()) syncSpringRangeFromFront();
  state.availability = sanitizedAvailability(payload.availability);
  state.activeIssueCategory = sanitizedCategoryId(symptoms.activeIssueCategory, "steering");
  state.solutionActiveIssueCategory = sanitizedCategoryId(symptoms.solutionActiveIssueCategory, "steering");
  state.issues = new Set(sanitizedIssueIds(symptoms.issues));
  state.solutionIssues = new Set(sanitizedIssueIds(symptoms.solutionIssues));
  state.appliedSymptomAdjustments = sanitizedAppliedSymptomAdjustments(symptoms.appliedSymptomAdjustments);
  state.appliedSymptomAdjustmentSeq = Math.max(
    state.appliedSymptomAdjustments.length,
    sanitizedNumber(symptoms.appliedSymptomAdjustmentSeq, state.appliedSymptomAdjustments.length, [0, 999999], true),
  );

  normalizeVehicleSpecs();
  normalizeTrackType();
  normalizeTuneFocusIntensity();
}

function refreshAfterSetupLoad() {
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  syncConfigControls();
  renderAvailabilityControls();
  renderAdjustmentRangeControls();
  bindAdjustmentRangeInputs();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncGearStrategyControls();
  syncTuneFocusIntensityInput();
  syncVehicleInputs();
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderEncyclopedia();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  renderGearCalculator();
  setView("result");
}

function loadSetupJsonText(text) {
  const payload = JSON.parse(text);
  applySetupSavePayload(payload);
  refreshAfterSetupLoad();
}

async function handleLoadSetupJson(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;

  try {
    loadSetupJsonText(await file.text());
    flashButton("loadJsonButton", t("loadJsonSuccess"));
  } catch (error) {
    console.error(error);
    flashButton("loadJsonButton", t("loadJsonFail"));
  } finally {
    input.value = "";
  }
}

function bindSetupJsonButtons() {
  const saveButton = document.getElementById("saveJsonButton");
  const loadButton = document.getElementById("loadJsonButton");
  const loadInput = document.getElementById("loadJsonInput");

  if (saveButton) saveButton.addEventListener("click", saveSetupJson);
  if (loadButton && loadInput) {
    loadButton.addEventListener("click", () => loadInput.click());
    loadInput.addEventListener("change", handleLoadSetupJson);
  }
}

function openSymptomPage(mode) {
  state.symptomMode = mode === "standalone" ? "standalone" : "linked";
  renderSelectionPreview();
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderAdvice();
  setView("symptoms");
}

function openEncyclopediaPage() {
  renderSelectionPreview();
  renderEncyclopedia();
  setView("encyclopedia");
}

function availabilityGroupsForAdviceTarget(target) {
  const normalizedTarget = target.toLowerCase();
  if (
    target.includes("低檔齒比") ||
    target.includes("齒比") ||
    target.includes("終傳") ||
    normalizedTarget.includes("gear ratio") ||
    normalizedTarget.includes("low gear") ||
    normalizedTarget.includes("final drive")
  ) {
    return ["gearbox"];
  }
  if (target.includes("差速") || normalizedTarget.includes("diff")) return ["diff"];
  if (target.includes("煞車") || normalizedTarget.includes("brake")) return ["brake"];
  if (
    target.includes("前空力") ||
    target.includes("前下壓") ||
    normalizedTarget.includes("front aero") ||
    normalizedTarget.includes("front downforce")
  ) {
    return ["frontAero"];
  }
  if (
    target.includes("後空力") ||
    target.includes("後下壓") ||
    normalizedTarget.includes("rear aero") ||
    normalizedTarget.includes("rear downforce")
  ) {
    return ["rearAero"];
  }
  if (target.includes("空力") || target.includes("下壓") || normalizedTarget.includes("aero") || normalizedTarget.includes("downforce")) {
    return ["frontAero", "rearAero"];
  }
  if (
    target.includes("彈簧") ||
    target.includes("車高") ||
    target.includes("阻尼") ||
    target.includes("懸吊") ||
    normalizedTarget.includes("spring") ||
    normalizedTarget.includes("ride height") ||
    normalizedTarget.includes("damper") ||
    normalizedTarget.includes("damping") ||
    normalizedTarget.includes("suspension")
  ) {
    return ["suspension"];
  }
  if (target.includes("前防傾") || normalizedTarget.includes("front anti-roll")) return ["frontArb"];
  if (target.includes("後防傾") || normalizedTarget.includes("rear anti-roll")) return ["rearArb"];
  if (target.includes("防傾") || normalizedTarget.includes("anti-roll")) return ["frontArb", "rearArb"];
  if (
    target.includes("外傾") ||
    target.includes("前束") ||
    target.includes("後束") ||
    target.includes("後傾") ||
    target.includes("定位") ||
    normalizedTarget.includes("camber") ||
    normalizedTarget.includes("toe") ||
    normalizedTarget.includes("caster") ||
    normalizedTarget.includes("alignment")
  ) {
    return ["alignment"];
  }
  return [];
}

function adaptAdviceStepsForAvailability(steps) {
  return steps.map(([target, text]) => {
    const groupIds = availabilityGroupsForAdviceTarget(target);
    const shouldReplace = groupIds.length > 0 && groupIds.every((groupId) => !availabilityEnabled(groupId));
    if (!shouldReplace) return [target, text];

    const fallbacks = fallbackTargetsForGroups(groupIds);
    const fallbackText = fallbacks.length ? fallbacks.join(" / ") : t("compensationLimited");
    return [
      t("adviceAlternativeTarget", { target }),
      t("adviceAlternativeText", {
        target,
        fallbacks: fallbackText,
      }),
    ];
  });
}

function renderLinkedTuneCard(card, baseTune, optimizedTune) {
  const localizedCard = localizedSettingCard(card);
  const [label, key] = localizedCard;
  const availabilityStatus = settingAvailabilityStatus(key);
  const unit = availabilityStatus === "unavailable" ? "" : settingUnit(localizedCard);
  const unavailableClass = availabilityStatus !== "available" ? " is-unavailable" : "";
  const adjusted = settingValue(localizedCard, baseTune) !== settingValue(localizedCard, optimizedTune);
  const unavailableMarkup =
    availabilityStatus !== "available"
      ? `<span class="setting-unavailable-chip">${unavailableLabelForStatus(availabilityStatus)}</span>`
      : "";
  const unitMarkup = unit ? `<span class="setting-unit">${unit}</span>` : "";

  return `
    <article class="linked-tune-card${unavailableClass}${adjusted ? " is-adjusted" : ""}">
      <div class="linked-tune-head">
        <span class="linked-tune-label">${label}</span>
      </div>
      <div class="linked-tune-value">
        <span>${settingValue(localizedCard, optimizedTune)}</span>
        ${unitMarkup}
        ${unavailableMarkup}
      </div>
    </article>
  `;
}

function renderLinkedTuneAdvice(selectedIssues) {
  const adviceList = document.getElementById("adviceList");
  const baseTune = buildTune();
  const optimizedTune = buildSymptomOptimizedTune(selectedIssues, baseTune);
  const deltaByKey = tuneDeltaByKey(baseTune, optimizedTune);
  const canApply = selectedIssues.length > 0 && Object.keys(deltaByKey).length > 0;
  const actionHint = selectedIssues.length
    ? t("applySymptomAdjustmentHint")
    : state.appliedSymptomAdjustments.length
      ? t("appliedSymptomAdjustmentHint")
      : t("linkedTuneEmpty");
  adviceList.innerHTML = `
    <div class="linked-tune-actions">
      <button class="utility-button compact-button" id="applySymptomAdjustmentButton" type="button" ${canApply ? "" : "disabled"}>
        ${t("buttonApplySymptomAdjustment")}
      </button>
      <span>${actionHint}</span>
    </div>
    <div class="linked-tune-grid">
      ${settingCards.map((card) => renderLinkedTuneCard(card, baseTune, optimizedTune)).join("")}
    </div>
  `;
  const applyButton = document.getElementById("applySymptomAdjustmentButton");
  if (applyButton) applyButton.addEventListener("click", applyCurrentSymptomAdjustment);
}

function uniqueAdviceRisks(steps) {
  const seen = new Set();
  return steps
    .flatMap((step) => step.risks)
    .filter((risk) => {
      if (seen.has(risk)) return false;
      seen.add(risk);
      return true;
    })
    .slice(0, 5);
}

function renderStandaloneAdviceCard(issue) {
  const steps = issue.steps.map((step, index) => standaloneAdviceStep(issue, step, index));
  const risks = uniqueAdviceRisks(steps);
  const localizedIssue = localizedSymptom(issue);
  const separator = currentLanguage() === "en" ? ": " : "：";

  return `
    <article class="advice-card is-learning-card">
      <h3>
        <span>${escapeHtml(localizedIssue.label)}</span>
        <span class="advice-chip">${escapeHtml(localizedIssue.chip)}</span>
      </h3>
      <section class="advice-learning-block is-positive" aria-label="${escapeHtml(t("advicePlanTitle"))}">
        <h4>${t("advicePlanTitle")}</h4>
        <div class="advice-learning-list">
          ${steps
            .map(
              (step) => `
                <div class="advice-learning-item">
                  <p><strong>${escapeHtml(t("adviceAdjustmentLabel"))}${separator}${escapeHtml(step.target)}</strong><span>${escapeHtml(step.text)}</span></p>
                  <p><strong>${escapeHtml(t("adviceReasonLabel"))}${separator}</strong>${escapeHtml(step.reason)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="advice-learning-block is-risk" aria-label="${escapeHtml(t("adviceRiskTitle"))}">
        <h4>${t("adviceRiskTitle")}</h4>
        <ul>
          ${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}
        </ul>
      </section>
    </article>
  `;
}

function renderAdvice() {
  const adviceList = document.getElementById("adviceList");
  const issueLookup = new Map(allIssueTypes.map((issue) => [issue.id, issue]));
  const selected = [...currentIssueSet()].map((id) => issueLookup.get(id)).filter(Boolean);
  const isLinkedMode = !isStandaloneSymptomMode();
  renderSymptomModeHeader();
  adviceList.classList.toggle("is-linked-tune", isLinkedMode);

  if (isLinkedMode) {
    renderLinkedTuneAdvice(selected);
    return;
  }

  if (!selected.length) {
    adviceList.innerHTML = `<div class="advice-empty">${t("adviceEmpty")}</div>`;
    return;
  }

  adviceList.innerHTML = selected.map(renderStandaloneAdviceCard).join("");
}

function contextualSteps(issue) {
  const steps = [...issue.steps];

  if (!isStandaloneSymptomMode()) {
    if ((issue.id === "exit-flat" || issue.id === "accel-power-rough") && state.engine === "turboHit") {
      steps.push(["渦輪遲滯", "把終傳縮短前先試縮短低檔，避免高檔尾速被犧牲太多。"]);
    }

    if ((issue.id.includes("oversteer") || issue.id.includes("rear")) && state.drive === "rwd") {
      steps.push(["後驅容錯", "後驅車先保住後胎胎壓與後差速器，再調防傾桿。"]);
    }

    if ((issue.id.includes("understeer") || issue.id.includes("push")) && state.drive === "fwd") {
      steps.push(["前驅補救", "若入彎仍推，前差減速降低 2% 到 4%，讓收油時前輪更願意轉。"]);
    }

    if (issue.id.includes("highspeed") && state.race === "road" && trackTypeRatio() >= 0.65) {
      steps.push(["賽道取捨", "多彎賽道不要一次犧牲太多尾速或下壓，先用小幅調整測試。"]);
    }

    if (issue.label.includes("甩尾") && state.race !== "drift") {
      steps.push(["模式確認", "若目標不是甩尾，先只小幅調胎壓與前束，避免破壞正賽穩定。"]);
    }
  }

  const localizedSteps = steps.map((step, index) => localizedAdviceStep(issue, step, index));
  return isStandaloneSymptomMode() ? localizedSteps : adaptAdviceStepsForAvailability(localizedSteps);
}

function renderResult() {
  const tune = buildTune();
  renderSummary();
  renderSelectionPreview();
  renderRecommendationHints();
  renderMeters(tune);
  renderSetup(tune);
  renderIssueCategories();
  renderSelectedIssues();
  renderAdvice();
  document.getElementById("copyButton").onclick = () => copyTune(tune);
}

function copyTune(tune) {
  const { race, tuneFocus, engine, drive } = selectedOptions();
  const lines = [
    `FH6 Tune Lab: ${race.label} / ${formatTuneFocusLabel(tuneFocus)} / ${engine.label} / ${drive.label} ${drive.subtitle}`,
    ...vehicleSpecCopyLines(),
    ...settingCards.map((card) => {
      const localizedCard = localizedSettingCard(card);
      const status = settingAvailabilityStatus(localizedCard[1]);
      const unit = status === "unavailable" ? "" : settingUnit(localizedCard);
      const statusText = copyStatusText(status);
      return `${localizedCard[0]}: ${settingValue(localizedCard, tune)} ${unit}${statusText}`.trim();
    }),
  ];

  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => flashButton("copyButton", t("copySuccess")))
    .catch(() => flashButton("copyButton", t("copyFail")));
}

function resetAll() {
  state.view = "result";
  state.race = "road";
  state.trackType = 55;
  state.cornerProfile = "mixed";
  state.tuneFocus = "balanced";
  state.tuneFocusIntensity = 100;
  state.engine = "flatTorque";
  state.drive = "awd";
  state.vehicleName = "";
  state.carWeight = 1500;
  state.frontWeightPercent = 52;
  state.frontTireSpec = "245/35R19";
  state.rearTireSpec = "265/35R19";
  state.frontTireSizeMm = 245;
  state.rearTireSizeMm = 265;
  state.powerKw = 400;
  state.torqueNm = 650;
  state.gearbox = createDefaultGearbox();
  state.adjustmentRanges = createAdjustmentRanges();
  state.springRangeLinked = DEFAULT_SPRING_RANGE_LINKED;
  state.availability = createAvailability();
  state.activeIssueCategory = "steering";
  state.solutionActiveIssueCategory = "steering";
  state.activeEncyclopediaPart = "frontTirePressure";
  state.issues.clear();
  state.solutionIssues.clear();
  state.appliedSymptomAdjustments = [];
  state.appliedSymptomAdjustmentSeq = 0;
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderEncyclopedia();
  renderAvailabilityControls();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncGearStrategyControls();
  syncVehicleInputs();
  syncTuneFocusIntensityInput();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");
}

function init() {
  bindLanguageSelect();
  bindThemeToggle();
  renderOptions("raceOptions", raceTypes, "race");
  renderOptions("engineOptions", engineCurves, "engine");
  renderOptions("driveOptions", driveTypes, "drive");
  bindConfigSelects();
  bindTrackTypeInput();
  bindTuneFocusIntensityInput();
  bindVehicleInputs();
  bindGearboxInputs();
  bindSetupJsonButtons();
  renderAvailabilityControls();
  renderAdjustmentRangeControls();
  bindAdjustmentRangeInputs();
  syncAdjustmentRangeInputs();
  syncGearboxInputs();
  syncGearStrategyControls();
  syncTuneFocusIntensityInput();
  syncVehicleInputs();
  renderIssueCategories();
  renderIssues();
  renderSelectedIssues();
  renderEncyclopedia();
  renderSummary();
  renderSelectionPreview();
  renderResult();
  syncConfigControls();
  setView("result");

  document.getElementById("confirmButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("startTestButton").addEventListener("click", () => openSymptomPage("linked"));

  document.getElementById("solutionButton").addEventListener("click", () => openSymptomPage("standalone"));

  document.getElementById("encyclopediaButton").addEventListener("click", openEncyclopediaPage);

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

  document.getElementById("backFromEncyclopediaButton").addEventListener("click", () => {
    renderResult();
    setView("result");
  });

  document.getElementById("resetButton").addEventListener("click", resetAll);

  document.getElementById("clearIssuesButton").addEventListener("click", () => {
    currentIssueSet().clear();
    renderIssueCategories();
    renderIssues();
    renderSelectedIssues();
    renderAdvice();
  });
}

init();
