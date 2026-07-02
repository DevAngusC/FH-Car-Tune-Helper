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
  gearCount: 6,
  redlineRpm: 7000,
  peakHpRpm: 6500,
  topSpeedKmh: 312,
  finalDrive: BASE_TUNE.finalDrive,
};

function createDefaultGearbox(overrides = {}) {
  return {
    ...DEFAULT_GEARBOX,
    manualRatios: {},
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
  availability: createAvailability(),
  symptomMode: "linked",
  activeIssueCategory: "steering",
  issues: new Set(),
  solutionActiveIssueCategory: "steering",
  solutionIssues: new Set(),
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
    gearTitle: "齒比計算器",
    labelGearCount: "總共有幾個檔位",
    labelRedlineRpm: "紅線 RPM",
    labelPeakHpRpm: "最高馬力 RPM",
    labelTopSpeed: "車輛卡理論極速",
    labelAccel97: "1-97 km/h 加速",
    labelAccel161: "0-161 km/h 加速",
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
    placeholderExample80: "例如 80",
    placeholderExample312: "例如 312",
    placeholderExample6500: "例如 6500",
    placeholderExample7000: "例如 7000",
    placeholderExample34: "例如 3.4",
    placeholderExample78: "例如 7.8",
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
    linkedTuneAdjusted: "已優化",
    buttonApplySymptomAdjustment: "應用修改",
    applySymptomAdjustmentHint: "套用後會清空目前勾選，並保留已應用症狀標籤。",
    appliedSymptomAdjustmentHint: "目前數值已包含已應用修改。",
    removeAppliedSymptomAdjustment: "取消這次修改：{label}",
    adviceAlternativeTarget: "替代：{target}",
    adviceAlternativeText: "原本可調整「{target}」，但目前標記為不可調。先改用 {fallbacks} 小幅補償，試車後再微調。",
    gearFinalDriveChip: "終傳比 {value}",
    gearboxUnavailableChip: "齒輪箱無法調整",
    gearboxUnavailableMessage: "齒輪箱目前標記為不可調，無法產生終傳比或各檔齒比。請先使用其他仍可調項目做保守補償。",
    gearRpmNote: "紅線決定各檔最大拉轉速度，最高馬力 RPM 用來校準升檔後落點與終端檔長度。",
    gearTopSpeedNote: "使用 Forza 車輛數據頁顯示的理論極速，計算器會結合紅線 RPM、終傳比與輪胎規格反推最高檔。",
    gearEmpty: "填入檔位數、紅線 RPM、最高馬力 RPM、車輛卡理論極速、1-97 km/h 和 0-161 km/h 秒數後，這裡會依基礎配置與胎規格自動計算齒比。",
    gearSummaryFinal: "建議終傳比",
    gearSummaryTop: "最高檔紅線速度",
    gearSummaryUsable: "理論極速折算",
    gearSummaryUsableValue: "理論值 {percent}%",
    gearSummaryFirst: "1 檔紅線目標",
    gearSummaryRpmWindow: "馬力轉速區",
    gearSummaryShiftDrop: "升檔落點",
    gearSummaryTireCirc: "驅動輪周長",
    gearSummarySpread: "齒比跨度",
    gearSummaryGoal: "自動策略",
    gearSummaryDecision: "判斷",
    gearFormulaNote: "已用{drive}輪胎規格計算輪周長，並反推各檔紅線速度。",
    gearDrivenFront: "前輪",
    gearDrivenRear: "後輪",
    gearDrivenAwd: "AWD 混合",
    gearDecisionSuffix: "{race}策略：{raceNote} 路線：{route} / {corner}、{engine}引擎曲線、{focus}調校取向已計入。",
    gearAutoStrategyBalanced: "平衡泛用",
    gearAutoStrategyCorner: "彎道回速",
    gearAutoStrategyLaunch: "起步牽引",
    gearAutoStrategyTopSpeed: "高檔延伸",
    gearAutoStrategyGrip: "抓地穩定",
    gearAutoApplied: "{strategy}已自動套用。",
    gearLabel: "第 {gear} 檔",
    gearShift: "約 {speed} km/h 換檔",
    gearRatioSuggested: "建議 {value}",
    gearRatioCurrent: "目前 {value}",
    gearRatioManual: "已手動調整",
    gearRatioSynced: "同步更新",
    gearRatioOutOfRange: "超出安全區間",
    gearRatioReset: "重置",
    gearRatioSafeRange: "安全試調 {min} - {max}",
    gearBandLonger: "較長 / 較穩",
    gearBandShorter: "較短 / 較衝",
    gearBandLowLabel: "偏低",
    gearBandHighLabel: "偏高",
    gearBandTarget: "回速目標",
    gearBandRoleLaunch: "起步抓地",
    gearBandRoleCornerTarget: "指定回速檔",
    gearBandRoleLowMid: "出彎回速",
    gearBandRoleMid: "檔位銜接",
    gearBandRoleHigh: "中高速拉伸",
    gearBandRoleTop: "尾速保留",
    gearBandLowLaunch: "再低會拉長 1 檔，起步更穩但可能拖轉。",
    gearBandHighLaunch: "再高會讓起步更衝，高馬力或 RWD 可能更容易打滑。",
    gearBandLowCorner: "再低會讓出彎轉速偏低，補油可能慢半拍。",
    gearBandHighCorner: "再高會讓出彎轉速更高，但油門太早可能破壞抓地。",
    gearBandLowLowMid: "再低會拉長低中檔，出彎後可能掉出有效轉速。",
    gearBandHighLowMid: "再高會縮短低中檔，回速更快但換檔更密。",
    gearBandLowMid: "再低會讓相鄰檔距拉大，換檔後轉速掉更多。",
    gearBandHighMid: "再高會讓檔位更密，反應更快但可能增加換檔次數。",
    gearBandLowHigh: "再低會保留高速延伸，但高檔可能拉不動。",
    gearBandHighHigh: "再高會強化中高速加速，但直線尾段可能太早接近紅線。",
    gearBandLowTop: "再低會保留尾速，但若馬力不足可能拉不上去。",
    gearBandHighTop: "再高會讓最高檔更有力，但容易犧牲尾速或撞紅線。",
    gearCornerNote: "彎道回速以 {speed} km/h、{gear} 檔為核心，目標約 {rev}% 紅線區。",
    gearUsableNote: "已將車輛卡極速視為理論值，最高檔目標抓在理論值約 {percent}%。",
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
    buttonTuneSolutions: "Tune Response Guide",
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
    gearTitle: "Gear Ratio Calculator",
    labelGearCount: "Number of Gears",
    labelRedlineRpm: "Redline RPM",
    labelPeakHpRpm: "Peak HP RPM",
    labelTopSpeed: "Listed Theoretical Top Speed",
    labelAccel97: "1-97 km/h Accel",
    labelAccel161: "0-161 km/h Accel",
    labelFinalDrive: "Final Drive",
    unitSecond: "sec",
    roadTestTitle: "Condition Tuning",
    solutionTitle: "Tune Response Guide",
    solutionModeChip: "Standalone Guide",
    symptomGroupLabel: "Issue Group",
    adjustmentDirectionLabel: "Adjustment Direction",
    linkedTunePanelLabel: "Optimized Values",
    symptomAdviceHint: "Select issues to show optimized values based on the current base tune.",
    solutionAdviceHint: "Select the issue you are seeing to show general adjustment responses.",
    placeholderExample80: "e.g. 80",
    placeholderExample312: "e.g. 312",
    placeholderExample6500: "e.g. 6500",
    placeholderExample7000: "e.g. 7000",
    placeholderExample34: "e.g. 3.4",
    placeholderExample78: "e.g. 7.8",
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
    linkedTuneAdjusted: "Optimized",
    buttonApplySymptomAdjustment: "Apply Changes",
    applySymptomAdjustmentHint: "Applying clears the current selection and keeps the applied issue tags.",
    appliedSymptomAdjustmentHint: "Current values include applied changes.",
    removeAppliedSymptomAdjustment: "Remove this applied change: {label}",
    adviceAlternativeTarget: "Alternative: {target}",
    adviceAlternativeText: "{target} is currently locked. Start by compensating lightly with {fallbacks}, then road-test again.",
    gearFinalDriveChip: "Final Drive {value}",
    gearboxUnavailableChip: "Gearbox locked",
    gearboxUnavailableMessage: "The gearbox is marked as locked, so final drive and per-gear ratios cannot be generated. Use other adjustable items for conservative compensation.",
    gearRpmNote: "Redline sets each gear's maximum pull; Peak HP RPM calibrates shift recovery and the terminal gear length.",
    gearTopSpeedNote: "Use the theoretical top speed shown on the Forza car stats page; redline RPM, final drive, and tire specs derive top gear.",
    gearEmpty: "Enter gear count, redline RPM, Peak HP RPM, listed top speed, 1-97 km/h, and 0-161 km/h times. The calculator will infer ratios from the base setup and tire specs.",
    gearSummaryFinal: "Suggested Final Drive",
    gearSummaryTop: "Top-Gear Redline Speed",
    gearSummaryUsable: "Theory-Speed Use",
    gearSummaryUsableValue: "{percent}% of listed",
    gearSummaryFirst: "1st-Gear Redline",
    gearSummaryRpmWindow: "HP RPM Window",
    gearSummaryShiftDrop: "Shift Recovery",
    gearSummaryTireCirc: "Driven Tire Circ.",
    gearSummarySpread: "Ratio Spread",
    gearSummaryGoal: "Auto Strategy",
    gearSummaryDecision: "Decision",
    gearFormulaNote: "Ratios use the {drive} tire specs to calculate rolling circumference and redline speed.",
    gearDrivenFront: "front-wheel",
    gearDrivenRear: "rear-wheel",
    gearDrivenAwd: "AWD blended",
    gearDecisionSuffix: "{race} strategy: {raceNote} Route: {route} / {corner}, {engine} engine curve, and {focus} tune focus are included.",
    gearAutoStrategyBalanced: "Balanced general",
    gearAutoStrategyCorner: "Corner recovery",
    gearAutoStrategyLaunch: "Launch traction",
    gearAutoStrategyTopSpeed: "Upper-gear extension",
    gearAutoStrategyGrip: "Grip stability",
    gearAutoApplied: "{strategy} is applied automatically.",
    gearLabel: "Gear {gear}",
    gearShift: "Shift around {speed} km/h",
    gearRatioSuggested: "Suggested {value}",
    gearRatioCurrent: "Current {value}",
    gearRatioManual: "Manual",
    gearRatioSynced: "Synced",
    gearRatioOutOfRange: "Outside safe range",
    gearRatioReset: "Reset",
    gearRatioSafeRange: "Safe trial {min} - {max}",
    gearBandLonger: "Longer / steadier",
    gearBandShorter: "Shorter / punchier",
    gearBandLowLabel: "Lower",
    gearBandHighLabel: "Higher",
    gearBandTarget: "Recovery target",
    gearBandRoleLaunch: "Launch grip",
    gearBandRoleCornerTarget: "Target recovery gear",
    gearBandRoleLowMid: "Corner-exit recovery",
    gearBandRoleMid: "Gear-to-gear spacing",
    gearBandRoleHigh: "Mid-high pull",
    gearBandRoleTop: "Top-speed reserve",
    gearBandLowLaunch: "Lower lengthens 1st gear, improving launch stability but risking bogging.",
    gearBandHighLaunch: "Higher makes launch punchier, but high-power or RWD builds may spin more easily.",
    gearBandLowCorner: "Lower drops exit rpm, so throttle pickup may feel delayed.",
    gearBandHighCorner: "Higher raises exit rpm, but early throttle can upset grip.",
    gearBandLowLowMid: "Lower lengthens low-mid gears and may drop the car out of the useful rev range.",
    gearBandHighLowMid: "Higher shortens low-mid gears for faster recovery, but shifts come closer together.",
    gearBandLowMid: "Lower widens adjacent spacing and drops more rpm after shifts.",
    gearBandHighMid: "Higher tightens spacing for quicker response, but may add extra shifts.",
    gearBandLowHigh: "Lower preserves high-speed stretch, but upper gears may struggle to pull.",
    gearBandHighHigh: "Higher strengthens mid-high acceleration, but may approach redline too early.",
    gearBandLowTop: "Lower preserves top speed, but weak power may not pull it.",
    gearBandHighTop: "Higher makes top gear pull harder, but can sacrifice speed or hit redline.",
    gearCornerNote: "Corner recovery centers on {speed} km/h in gear {gear}, targeting about {rev}% of redline.",
    gearUsableNote: "The listed car-card top speed is treated as theoretical, so top gear targets about {percent}% of that value.",
    gearSlowHighPull: "Mid-high speed acceleration is slow, so upper gears are packed tighter.",
    gearQuickLowSpeed: "Low-speed acceleration is already quick, so 1st-2nd are slightly longer to reduce wheelspin.",
    gearDefaultNote: "Auto strategy uses {strategy}; ratio spacing mainly follows {focus} and RPM recovery.",
    settingExplanationCurrentFocus: "current tune focus",
  },
};

Object.assign(translations.zh, {
  labelTopSpeed: "目標終端速度",
  gearRpmNote: "紅線與最高馬力 RPM 會決定目標終端速度落在 power band 的位置。",
  gearTopSpeedNote: "輸入你希望最後一檔支援的終端速度，計算器會讓該速度時的 RPM 維持在最高馬力 RPM 到紅線之間。",
  gearEmpty: "填入檔位數、紅線 RPM、最高馬力 RPM、目標終端速度與終傳比後，這裡會依基礎配置與胎規格自動計算齒比。",
  gearSummaryTop: "最高檔齒比上限",
  gearSummaryUsable: "目標終端 RPM",
  gearSummaryUsableValue: "Power band {percent}%",
  gearUsableNote: "目標終端速度 {speed} km/h 時約落在 {rpm} RPM，位於 power band 的 {percent}%。",
  gearTerminalLong: "終端檔偏長，目標速度時 RPM 低於最高馬力區。",
  gearTerminalShort: "終端檔偏短，目標速度前可能太早接近紅線。",
  gearTerminalOk: "終端檔已對齊最高馬力 RPM 到紅線之間。",
});

Object.assign(translations.en, {
  labelTopSpeed: "Target Terminal Speed",
  gearRpmNote: "Redline and Peak HP RPM decide where the target terminal speed lands inside the power band.",
  gearTopSpeedNote: "Enter the terminal speed you want top gear to support; the calculator keeps that speed between Peak HP RPM and redline.",
  gearEmpty: "Enter gear count, redline RPM, Peak HP RPM, target terminal speed, and final drive. The calculator will infer ratios from the base setup and tire specs.",
  gearSummaryTop: "Top-Gear Ratio Ceiling",
  gearSummaryUsable: "Terminal RPM",
  gearSummaryUsableValue: "Power band {percent}%",
  gearUsableNote: "At {speed} km/h, top gear lands near {rpm} RPM, about {percent}% through the power band.",
  gearTerminalLong: "Top gear is too long; target speed is below the Peak HP range.",
  gearTerminalShort: "Top gear is too short; the car may reach redline before the target speed.",
  gearTerminalOk: "Top gear is aligned between Peak HP RPM and redline.",
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
        label: "Offroad",
        subtitle: "Grass, dirt, and big elevation",
        title: "Offroad Base Tune",
        principles: ["Longer low gears and extra travel make throttle easier on rough surfaces."],
      },
      dragQuarter: {
        label: "Drag Quarter Mile",
        subtitle: "Launch and short sprint",
        title: "Quarter Mile Drag Base Tune",
        principles: ["Dense low gears prioritize launch, traction, and the 1-2 shift."],
      },
      dragHalf: {
        label: "Drag Half Mile",
        subtitle: "Mid-long acceleration",
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
        label: "More Big Corners",
        subtitle: "High-speed sweepers",
        principle: "Big corners need stability, aero support, and a little more top-speed reserve.",
      },
      medium: {
        label: "More Medium Corners",
        subtitle: "Mid-speed bends",
        principle: "Medium corners reward balanced rotation and low-mid gear recovery.",
      },
      small: {
        label: "More Small Corners",
        subtitle: "Hairpins / tight turns",
        principle: "Small corners need stronger turn-in and shorter recovery gearing.",
      },
    },
    tuneFocusTypes: {
      balanced: { label: "Balanced Baseline", subtitle: "General setup" },
      stability: { label: "Stability", subtitle: "High-speed and braking confidence" },
      agility: { label: "Agility", subtitle: "Faster turn-in response" },
      exit: { label: "Corner Exit", subtitle: "Earlier throttle application" },
      topSpeed: { label: "Top-Speed Focus", subtitle: "Long straights" },
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
        principle: "Slightly shorter gearing helps exits climb back into the high-rpm range.",
      },
      turboHit: {
        label: "Turbo Hit",
        subtitle: "Mid-high rpm surge",
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
      label: "FH-Specific Issues",
      description: "Mountain roads, rough roads, grass, jumps, and surface changes.",
    },
    "awd-common": {
      label: "AWD Top Issues",
      description: "Quick entry points for common Horizon AWD behavior.",
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
    重煞: "Heavy brake",
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
    "steering-entry-push": "Entry push",
    "steering-mid-push": "Mid-corner understeer",
    "steering-exit-push": "Exit understeer",
    "steering-fast-corner-not-turning": "Won't rotate in fast bends",
    "steering-dull": "Steering feels dull",
    "steering-nervous": "Steering feels nervous",
    "steering-small-correction-hard": "Small corrections are difficult",
    "steering-small-angle-weak": "Small steering inputs feel weak",
    "steering-highspeed-float": "High-speed steering float",
    "steering-highspeed-unsafe": "High-speed steering feels unsafe",
    "steering-mid-sudden-oversteer": "Sudden mid-corner oversteer",
    "steering-mid-constant-correction": "Constant mid-corner corrections",
    "steering-delay": "Delayed steering response",
    "steering-too-sensitive": "Steering is too sensitive",
    "steering-front-not-follow": "Front end will not follow steering",
    "steering-understeer": "Understeer",
    "steering-oversteer": "Oversteer",
    "rear-fishtail": "Rear fishtailing",
    "rear-floating": "Floating rear feel",
    "rear-sway": "Rear swaying side to side",
    "rear-unstable": "Unstable rear end",
    "rear-too-active": "Rear is too active",
    "rear-exit-drift": "Exit oversteer",
    "rear-lift-off-drift": "Lift-off oversteer",
    "rear-highspeed-snap": "High-speed rear snap",
    "rear-highspeed-direction-unstable": "Unstable high-speed direction changes",
    "rear-mid-slide": "Rear keeps sliding mid-corner",
    "rear-throttle-slide": "Rear slides after throttle",
    "rear-loses-grip": "Rear loses grip easily",
    "rear-wiggle": "Rear wiggle",
    "rear-snap-death": "Sudden rear snap",
    "rear-too-quick": "Rear reacts too quickly",
    "rear-lags-front": "Rear lags behind the front",
    "grip-front-low": "Low front grip",
    "grip-rear-low": "Low rear grip",
    "grip-all-low": "Low overall grip",
    "grip-exit-low": "Poor exit grip",
    "grip-highspeed-low": "Low high-speed grip",
    "grip-mid-low": "Low mid-corner grip",
    "grip-throttle-low": "Poor throttle grip",
    "grip-brake-low": "Poor braking grip",
    "grip-curb-low": "Poor curb grip",
    "grip-bumpy-low": "Poor bumpy-road grip",
    "grip-rain-low": "Poor wet grip",
    "grip-tire-slide": "Tires slide easily",
    "grip-limit-low": "Tire limit feels too low",
    "suspension-boat": "Boat-like body motion",
    "suspension-body-roll-too-much": "Too much body roll",
    "suspension-jumpy": "Car keeps bouncing",
    "suspension-curb-fly": "Car flies off curbs",
    "suspension-bump-kick": "Bumps kick the car away",
    "suspension-crest-unstable": "Unstable over crests",
    "suspension-highspeed-bottom": "High-speed bottoming out",
    "suspension-landing-lost": "Loss of control on landing",
    "suspension-roll-large": "Excessive body roll",
    "suspension-left-right": "Body sways left and right",
    "suspension-up-down": "Body bounces up and down",
    "suspension-pitch": "Excessive pitch",
    "suspension-corner-stiff": "Cornering posture feels too stiff",
    "suspension-too-stiff": "Body feels too stiff",
    "suspension-travel-low": "Not enough suspension travel",
    "suspension-landing-rebound": "Too much rebound after landing",
    "suspension-lift-easy": "Car gets airborne too easily",
    "brake-unstable": "Unstable braking",
    "brake-understeer": "Brake understeer",
    "brake-oversteer": "Brake oversteer",
    "brake-distance-long": "Braking distance is too long",
    "brake-entry-not-turning": "Won't turn while braking into corners",
    "brake-body-wobble": "Body wobbles under braking",
    "brake-heavy-unstable": "Unstable under heavy braking",
    "brake-lock": "Brake lock-up",
    "brake-trail-unstable": "Unstable trail braking",
    "brake-rear-move": "Rear moves around after braking",
    "brake-highspeed-unstable": "Unstable high-speed braking",
    "accel-launch-unstable": "Unstable launch",
    "launch-spin": "Launch wheelspin",
    "accel-exit-slide": "Too much exit slide",
    "accel-throttle-understeer": "Understeer on throttle",
    "accel-throttle-oversteer": "Oversteer on throttle",
    "accel-full-throttle-hard": "Full throttle is hard to control",
    "accel-highspeed-float": "High-speed acceleration float",
    "accel-direction-pull": "Car pulls under acceleration",
    "accel-power-rough": "Rough power delivery",
    "accel-cannot-early-throttle": "Cannot get on throttle early",
    "accel-body-unstable": "Body unstable on throttle",
    "accel-front-push-out": "Front pushes wide after throttle",
    "highspeed-left-right-float": "High-speed left-right float",
    "highspeed-steering-light": "Steering feels light at speed",
    "highspeed-floating": "Car feels like it is floating",
    "highspeed-road-jump": "Car hops over high-speed bumps",
    "highspeed-line-unstable": "Unstable high-speed line",
    "highspeed-fast-corner-unstable": "Unstable in fast bends",
    "highspeed-lane-change-unstable": "Unstable lane changes",
    "highspeed-crest-unstable": "Unstable over high-speed crests",
    "highspeed-curb-unstable": "Unstable over high-speed curbs",
    "highspeed-correction-hard": "Hard to correct at high speed",
    "highspeed-body-wobble": "High-speed body wobble",
    "highspeed-float-feel": "High-speed floating feel",
    "fh-mountain-lost": "Easy to lose control on mountain roads",
    "fh-downhill-brake-hard": "Hard to brake downhill",
    "fh-s-corner-slow-correct": "Slow corrections through linked corners",
    "fh-mountain-jump": "Car jumps too much on mountain roads",
    "fh-rough-road-unstable": "Unstable on rough FH roads",
    "fh-ramp-fly": "Car launches off ramps",
    "fh-jump-landing-unstable": "Unstable after jump landings",
    "fh-grass-lost": "Loses control on grass",
    "fh-elevation-unstable": "Unstable over elevation changes",
    "fh-tarmac-dirt-unstable": "Unstable from tarmac to dirt",
    "fh-mountain-throttle-unstable": "Unstable throttle on mountain roads",
    "fh-mountain-highspeed-push": "High-speed mountain understeer",
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
      engineWhy: "Offroad routes need low-end torque to recover from grass, dirt, jumps, and elevation.",
      driveWhy: "AWD gives control over uneven surfaces and landing traction.",
    },
    dragQuarter: {
      engineWhy: "A turbo-hit curve prioritizes hard acceleration once boost is loaded.",
      driveWhy: "AWD launches harder and reduces wheelspin during the first shift.",
    },
    dragHalf: {
      engineWhy: "High-rpm power keeps pulling deeper into the half-mile run.",
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
      ["Final drive", "Lower -0.08 to -0.18 so the low gears are less violent."],
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
      ["Final drive", "Adjust by symptom: add +0.08 if rpm drops, or lower -0.08 if delivery is too violent."],
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
      ["Final drive", "If rpm drops on mountain exits, add +0.08 to +0.15."],
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
  return state.language === "en" ? "en" : "zh";
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
  try {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === "en" || savedLanguage === "zh") return savedLanguage;
  } catch {
    // Language persistence is optional.
  }

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
  renderResult();
  renderGearCalculator();
}

function setLanguage(language) {
  state.language = language === "en" ? "en" : "zh";
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  } catch {
    // Language persistence is optional.
  }
  refreshLanguageUi();
}

function bindLanguageSelect() {
  state.language = preferredLanguage();
  applyStaticTranslations();

  const languageSelect = document.getElementById("languageSelect");
  if (!languageSelect) return;

  languageSelect.value = currentLanguage();
  languageSelect.addEventListener("change", () => {
    setLanguage(languageSelect.value);
  });
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
  if (output) output.textContent = formatTrackTypeLabel();
  if (cornerSelect) cornerSelect.disabled = disabled;
}

function bindTrackTypeInput() {
  const slider = document.getElementById("trackTypeSlider");
  if (!slider) return;

  slider.addEventListener("input", () => {
    state.trackType = Number(slider.value);
    syncTrackTypeControls("trackTypeSlider");
    resetManualGearRatios();
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
      if (["race", "cornerProfile", "tuneFocus", "engine", "drive"].includes(stateKey)) resetManualGearRatios();
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
        return `
        <div class="issue-card">
          <input type="checkbox" id="issue-${issue.id}" value="${issue.id}" ${
            selectedIssues.has(issue.id) ? "checked" : ""
          }>
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
        issues.add(event.target.value);
      } else {
        issues.delete(event.target.value);
      }
      renderIssueCategories();
      renderSelectedIssues();
      renderAdvice();
    });
  });
}

function renderSelectedIssues() {
  const container = document.getElementById("selectedIssues");
  const selected = issueObjectsFromSet(currentIssueSet());
  const appliedChips = isStandaloneSymptomMode()
    ? []
    : state.appliedSymptomAdjustments.map((adjustment) => {
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

function renderAvailabilityControls() {
  const grid = document.getElementById("availabilityGrid");
  if (!grid) return;

  grid.innerHTML = availabilityGroups
    .map((group) => {
      const checked = availabilityEnabled(group.id);
      const inputId = `availability-${group.id}`;
      return `
        <label class="availability-toggle ${checked ? "" : "is-disabled"}" for="${inputId}">
          <input id="${inputId}" type="checkbox" ${checked ? "checked" : ""} data-availability-group="${group.id}" />
          <span class="availability-toggle-text">
            <span class="availability-toggle-title">${localizedAvailabilityGroup(group)}</span>
            <span class="availability-toggle-state">${checked ? t("availabilityOn") : t("availabilityOff")}</span>
          </span>
        </label>
      `;
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
          <div class="adjustment-range-title">${localizedGroup.label}</div>
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

function formatGearRatio(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}

function roundGearRatio(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : NaN;
}

function rangeThumbAlignedPosition(percent, thumbSizePx = 16) {
  const normalized = clampNumber(Number(percent) || 0, 0, 100);
  const offsetPx = thumbSizePx / 2 - (thumbSizePx * normalized) / 100;
  return `calc(${normalized.toFixed(2)}% + ${offsetPx.toFixed(2)}px)`;
}

function syncGearboxInputs(skipInputId = "") {
  const fieldMap = [
    ["gearCountInput", "gearCount"],
    ["gearRedlineRpmInput", "redlineRpm"],
    ["gearPeakHpRpmInput", "peakHpRpm"],
    ["gearTopSpeedInput", "topSpeedKmh"],
    ["gearFinalDriveInput", "finalDrive"],
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
  resetManualGearRatios();
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
  const adjustedRatios = ratios.map((ratio, index) => {
    const distance = Math.abs(index - targetIndex);
    if (distance > 2) return { ...ratio };

    const localBlend = blend * Math.max(0, 1 - distance * 0.38);
    const neighborTargetRatio = targetRatio * Math.pow(1.22, targetIndex - index);
    return {
      ...ratio,
      ratio: ratio.ratio * (1 - localBlend) + neighborTargetRatio * localBlend,
    };
  });

  for (let index = 1; index < adjustedRatios.length; index += 1) {
    adjustedRatios[index].ratio = Math.min(adjustedRatios[index].ratio, adjustedRatios[index - 1].ratio * 0.94);
  }

  for (let index = adjustedRatios.length - 2; index >= 0; index -= 1) {
    adjustedRatios[index].ratio = Math.max(adjustedRatios[index].ratio, adjustedRatios[index + 1].ratio * 1.06);
  }

  adjustedRatios.forEach((ratio) => {
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
    return {
      roleKey: "gearBandRoleCornerTarget",
      lowPct: 0.05,
      highPct: 0.045,
      lowNoteKey: "gearBandLowCorner",
      highNoteKey: "gearBandHighCorner",
    };
  }

  if (gear === 1) {
    return {
      roleKey: "gearBandRoleLaunch",
      lowPct: 0.065,
      highPct: 0.05,
      lowNoteKey: "gearBandLowLaunch",
      highNoteKey: "gearBandHighLaunch",
    };
  }

  if (gear === gearCount) {
    return {
      roleKey: "gearBandRoleTop",
      lowPct: 0.035,
      highPct: 0.028,
      lowNoteKey: "gearBandLowTop",
      highNoteKey: "gearBandHighTop",
    };
  }

  if (gear >= gearCount - 1) {
    return {
      roleKey: "gearBandRoleHigh",
      lowPct: 0.04,
      highPct: 0.035,
      lowNoteKey: "gearBandLowHigh",
      highNoteKey: "gearBandHighHigh",
    };
  }

  if (gear <= 3) {
    return {
      roleKey: "gearBandRoleLowMid",
      lowPct: 0.05,
      highPct: 0.045,
      lowNoteKey: "gearBandLowLowMid",
      highNoteKey: "gearBandHighLowMid",
    };
  }

  return {
    roleKey: "gearBandRoleMid",
    lowPct: 0.045,
    highPct: 0.04,
    lowNoteKey: "gearBandLowMid",
    highNoteKey: "gearBandHighMid",
  };
}

function gearRatioDisplayBounds(ratio, plan) {
  const isCornerTarget = plan.strategyId === "corner" && ratio.gear === plan.cornerTargetGear;
  const profile = gearRatioBandProfile(ratio.gear, plan.gearCount, isCornerTarget);
  const suggestedRatio = Number.isFinite(ratio.suggestedRatio) ? ratio.suggestedRatio : ratio.ratio;
  const currentRatio = Number.isFinite(ratio.ratio) ? ratio.ratio : suggestedRatio;
  const roundedSuggestedRatio = roundGearRatio(suggestedRatio);
  const roundedCurrentRatio = roundGearRatio(currentRatio);
  const safeMin = roundGearRatio(suggestedRatio * (1 - profile.lowPct));
  const safeMax = Math.max(roundGearRatio(suggestedRatio * (1 + profile.highPct)), safeMin + 0.01);
  const displayMin = roundGearRatio(suggestedRatio * (1 - profile.lowPct * 2.35));
  const displayMax = Math.max(
    roundGearRatio(suggestedRatio * (1 + profile.highPct * 2.35)),
    displayMin + 0.02,
  );

  return {
    isCornerTarget,
    profile,
    roundedSuggestedRatio,
    roundedCurrentRatio,
    safeMin,
    safeMax,
    displayMin,
    displayMax,
  };
}

function gearRatioSharedScale(plan) {
  const bounds = plan.ratios.map((ratio) => gearRatioDisplayBounds(ratio, plan));
  const rawMin = Math.min(...bounds.map((band) => Math.min(band.displayMin, band.safeMin, band.roundedCurrentRatio)));
  const rawMax = Math.max(...bounds.map((band) => Math.max(band.displayMax, band.safeMax, band.roundedCurrentRatio)));
  const span = Math.max(0.1, rawMax - rawMin);

  return {
    displayMin: Math.max(0.01, roundGearRatio(rawMin - span * 0.04)),
    displayMax: roundGearRatio(rawMax + span * 0.04),
  };
}

function gearRatioSafetyBand(ratio, plan, sharedScale = null) {
  const bounds = gearRatioDisplayBounds(ratio, plan);
  const displayMin = sharedScale?.displayMin ?? bounds.displayMin;
  const displayMax = Math.max(sharedScale?.displayMax ?? bounds.displayMax, displayMin + 0.02);
  const displaySpan = Math.max(0.01, displayMax - displayMin);
  const safeLeft = ((bounds.safeMin - displayMin) / displaySpan) * 100;
  const safeWidth = ((bounds.safeMax - bounds.safeMin) / displaySpan) * 100;
  const markerLeft = ((bounds.roundedCurrentRatio - displayMin) / displaySpan) * 100;
  const suggestedLeft = ((bounds.roundedSuggestedRatio - displayMin) / displaySpan) * 100;
  const clampedSuggestedLeft = clampNumber(suggestedLeft, 0, 100);

  return {
    isCornerTarget: bounds.isCornerTarget,
    safeMin: bounds.safeMin,
    safeMax: bounds.safeMax,
    displayMin,
    displayMax,
    currentRatio: bounds.roundedCurrentRatio,
    suggestedRatio: bounds.roundedSuggestedRatio,
    isOutOfRange: bounds.roundedCurrentRatio < bounds.safeMin || bounds.roundedCurrentRatio > bounds.safeMax,
    safeLeft: clampNumber(safeLeft, 0, 100).toFixed(2),
    safeWidth: clampNumber(safeWidth, 0, 100).toFixed(2),
    markerLeft: clampNumber(markerLeft, 0, 100).toFixed(2),
    suggestedLeft: clampedSuggestedLeft.toFixed(2),
    suggestedMarkerLeft: rangeThumbAlignedPosition(clampedSuggestedLeft),
    role: t(bounds.profile.roleKey),
    lowNote: t(bounds.profile.lowNoteKey),
    highNote: t(bounds.profile.highNoteKey),
  };
}

function resetManualGearRatios() {
  state.gearbox.manualRatios = {};
}

function manualGearRatioEntries(gearCount) {
  return Object.entries(state.gearbox.manualRatios ?? {})
    .map(([gear, ratio]) => [Number(gear), Number(ratio)])
    .filter(([gear, ratio]) => Number.isInteger(gear) && gear >= 1 && gear <= gearCount && Number.isFinite(ratio));
}

function applyManualGearRatios(baseRatios, { topTarget, topRatio, redlineRpm, finalDrive, tireCircumference }) {
  const gearCount = baseRatios.length;
  const manualEntries = manualGearRatioEntries(gearCount);
  const manualGears = new Set(manualEntries.map(([gear]) => gear));

  if (!manualEntries.length) {
    return baseRatios.map((ratio) => ({
      ...ratio,
      suggestedRatio: ratio.ratio,
      isManual: false,
      isSynchronized: false,
    }));
  }

  const anchorMap = new Map([
    [1, baseRatios[0].ratio],
    [gearCount, baseRatios[gearCount - 1].ratio],
    ...manualEntries,
  ]);
  const anchors = Array.from(anchorMap.entries())
    .map(([gear, ratio]) => ({ gear, ratio }))
    .sort((a, b) => a.gear - b.gear);

  for (let index = 1; index < anchors.length; index += 1) {
    anchors[index].ratio = Math.min(anchors[index].ratio, anchors[index - 1].ratio * 0.94);
  }

  for (let index = anchors.length - 2; index >= 0; index -= 1) {
    anchors[index].ratio = Math.max(anchors[index].ratio, anchors[index + 1].ratio * 1.06);
  }

  return baseRatios.map((ratio) => {
    const leftAnchor = [...anchors].reverse().find((anchor) => anchor.gear <= ratio.gear) ?? anchors[0];
    const rightAnchor = anchors.find((anchor) => anchor.gear >= ratio.gear) ?? anchors[anchors.length - 1];
    const segment = Math.max(1, rightAnchor.gear - leftAnchor.gear);
    const progress = (ratio.gear - leftAnchor.gear) / segment;
    const logRatio =
      Math.log(leftAnchor.ratio) * (1 - progress) + Math.log(rightAnchor.ratio) * progress;
    const currentRatio = leftAnchor.gear === rightAnchor.gear ? leftAnchor.ratio : Math.exp(logRatio);
    const shiftKmh = speedForGearRatio(redlineRpm, currentRatio, finalDrive, tireCircumference);

    return {
      ...ratio,
      suggestedRatio: ratio.ratio,
      ratio: currentRatio,
      shiftKmh: Number.isFinite(shiftKmh) ? shiftKmh : topTarget * (topRatio / currentRatio),
      isManual: manualGears.has(ratio.gear),
      isSynchronized: !manualGears.has(ratio.gear),
    };
  });
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
  const gearCountAdjust = gearCount <= 5 ? 0.35 : gearCount >= 8 ? -0.2 : 0;
  const trackRatio = routeShapeEnabled(race.id) ? trackTypeRatio() : 0;
  const powerRatio = rpmPowerRatio(redlineRpm, peakHpRpm);
  const shiftRecoveryFraction = targetShiftRecoveryFraction({
    engine,
    raceId: race.id,
    tuneFocusId: tuneFocus.id,
    trackRatio,
    powerRatio,
  });
  const terminalBandPosition = targetTerminalBandPosition({
    raceId: race.id,
    tuneFocusId: tuneFocus.id,
    trackRatio,
    cornerProfileId: selectedCornerProfile().id,
    engineId: engine.id,
  });
  const desiredTerminalRpm = targetTerminalRpm(peakHpRpm, redlineRpm, terminalBandPosition);
  const formulaTopRatio = gearRatioForSpeed(desiredTerminalRpm, targetTerminalSpeed, finalDrive, tireProfile.circumference);
  const baseTopRatio = Number.isFinite(formulaTopRatio) ? formulaTopRatio : 0.85;
  const topRatio = clampNumber(baseTopRatio, 0.45, 2.2);
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
    const ratio = topRatio * Math.pow(spread, Math.pow(position, curvePower));
    const formulaShiftKmh = speedForGearRatio(redlineRpm, ratio, finalDrive, tireProfile.circumference);
    const shiftKmh = Number.isFinite(formulaShiftKmh) ? formulaShiftKmh : topTarget * (topRatio / ratio);
    ratios.push({ gear, ratio, shiftKmh });
  }

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
  ratios = applyManualGearRatios(ratios, {
    topTarget,
    topRatio,
    redlineRpm,
    finalDrive,
    tireCircumference: tireProfile.circumference,
  });
  const currentTopRatio = ratios[ratios.length - 1]?.ratio ?? topRatio;
  const currentTopTarget = speedForGearRatio(redlineRpm, currentTopRatio, finalDrive, tireProfile.circumference);
  const currentTerminalRpm = rpmForSpeedGearRatio(targetTerminalSpeed, currentTopRatio, finalDrive, tireProfile.circumference);
  const currentTerminalBandPercent = terminalPowerBandPercent(currentTerminalRpm, peakHpRpm, redlineRpm);
  const currentTerminalStatus = terminalStatusKey(currentTerminalRpm, peakHpRpm, redlineRpm);
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
    targetTerminalSpeed,
    terminalRpm: currentTerminalRpm,
    terminalBandPercent: currentTerminalBandPercent,
    terminalStatus: currentTerminalStatus,
    topTarget: currentTopTarget,
    firstGearTarget: actualFirstGearTarget,
    targetShiftRpm: redlineRpm * shiftRecoveryFraction,
    shiftRecoveryFraction,
    terminalBandPosition,
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
    hasManualRatios: manualGearRatioEntries(gearCount).length > 0,
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

function gearDecisionText(plan) {
  return `${t("gearFormulaNote", { drive: plan.tireDriveLabel })} ${t("gearUsableNote", {
    speed: Math.round(plan.targetTerminalSpeed),
    rpm: Math.round(plan.terminalRpm),
    percent: Math.round(plan.terminalBandPercent),
  })} ${plan.note} ${t("gearDecisionSuffix", {
    race: plan.raceLabel,
    raceNote: plan.raceNote,
    route: plan.trackTypeLabel,
    corner: plan.cornerProfileLabel,
    engine: plan.engineLabel,
    focus: plan.tuneFocusLabel,
  })}`;
}

function renderGearDecisionPanel(plan) {
  const decisionPanel = document.getElementById("gearDecisionPanel");
  if (!decisionPanel) return;

  if (!plan) {
    decisionPanel.innerHTML = "";
    return;
  }

  decisionPanel.innerHTML = `
    <article class="gear-decision-card">
      <span>${t("gearSummaryDecision")}</span>
      <strong>${escapeHtml(gearDecisionText(plan))}</strong>
    </article>
  `;
}

function renderGearCalculator(tune = buildTune()) {
  const summaryGrid = document.getElementById("gearSummaryGrid");
  const ratioGrid = document.getElementById("gearRatioGrid");
  const finalChip = document.getElementById("gearFinalChip");
  if (!summaryGrid || !ratioGrid || !finalChip) return;

  if (!availabilityEnabled("gearbox")) {
    finalChip.textContent = t("gearboxUnavailableChip");
    renderGearDecisionPanel();
    summaryGrid.innerHTML = `
      <div class="gear-empty">
        ${t("gearboxUnavailableMessage")}
      </div>
    `;
    ratioGrid.innerHTML = "";
    return;
  }

  const finalDrive = Number.isFinite(gearNumber("finalDrive")) ? gearNumber("finalDrive") : recommendedGearFinalDrive(tune);
  finalChip.textContent = t("gearFinalDriveChip", { value: formatGearRatio(finalDrive) });

  if (!gearboxReady()) {
    renderGearDecisionPanel();
    summaryGrid.innerHTML = `
      <div class="gear-empty">
        ${t("gearEmpty")}
      </div>
    `;
    ratioGrid.innerHTML = "";
    return;
  }

  const plan = calculateGearRatios(tune);
  renderGearDecisionPanel(plan);
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
      <strong>${Math.round(plan.targetShiftRpm)} RPM</strong>
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

  const sharedGearScale = gearRatioSharedScale(plan);
  ratioGrid.innerHTML = plan.ratios
    .map((ratio) => {
      const band = gearRatioSafetyBand(ratio, plan, sharedGearScale);
      const badges = [
        band.isCornerTarget ? t("gearBandTarget") : "",
        ratio.isManual ? t("gearRatioManual") : "",
        plan.hasManualRatios && ratio.isSynchronized ? t("gearRatioSynced") : "",
        band.isOutOfRange ? t("gearRatioOutOfRange") : "",
      ].filter(Boolean);
      const badgeHtml = badges.map((badge) => `<span class="gear-target-badge">${escapeHtml(badge)}</span>`).join("");
      const resetButton = ratio.isManual
        ? `<button class="gear-ratio-reset" type="button" data-gear="${ratio.gear}">${t("gearRatioReset")}</button>`
        : "";
      return `
        <article class="gear-ratio-card ${band.isCornerTarget ? "is-target" : ""} ${ratio.isManual ? "is-manual" : ""} ${band.isOutOfRange ? "is-out-of-range" : ""}">
          <div class="gear-ratio-header">
            <div class="gear-ratio-title">
              <span>${t("gearLabel", { gear: ratio.gear })}</span>
              ${badgeHtml}
            </div>
            <small>${escapeHtml(band.role)}</small>
          </div>
          <div class="gear-ratio-metrics">
            <strong>${t("gearRatioCurrent", { value: formatGearRatio(band.currentRatio) })}</strong>
            <span>${t("gearRatioSuggested", { value: formatGearRatio(band.suggestedRatio) })}</span>
            <span>${t("gearRatioSafeRange", {
              min: formatGearRatio(band.safeMin),
              max: formatGearRatio(band.safeMax),
            })}</span>
            <span>${t("gearShift", { speed: Math.round(ratio.shiftKmh) })}</span>
          </div>
          <div class="gear-band">
            <div class="gear-band-labels">
              <span>${t("gearBandLonger")}</span>
              <span>${t("gearBandShorter")}</span>
            </div>
            <div class="gear-band-control">
              <input
                class="gear-ratio-slider"
                type="range"
                min="${formatGearRatio(band.displayMin)}"
                max="${formatGearRatio(band.displayMax)}"
                step="0.01"
                value="${formatGearRatio(band.currentRatio)}"
                data-gear="${ratio.gear}"
                style="--safe-left: ${band.safeLeft}%; --safe-width: ${band.safeWidth}%;"
                aria-label="${escapeHtml(t("gearLabel", { gear: ratio.gear }))}"
              />
              <span
                class="gear-suggested-marker"
                style="--suggested-left: ${band.suggestedMarkerLeft};"
                title="${escapeHtml(t("gearRatioSuggested", { value: formatGearRatio(band.suggestedRatio) }))}"
                aria-hidden="true"
              ></span>
            </div>
          </div>
          <div class="gear-range-notes">
            <p><strong>${t("gearBandLowLabel")}</strong>${escapeHtml(band.lowNote)}</p>
            <p><strong>${t("gearBandHighLabel")}</strong>${escapeHtml(band.highNote)}</p>
          </div>
          ${resetButton}
        </article>
      `;
    })
    .join("");
}

function setManualGearRatio(gear, ratio) {
  const gearCount = Math.round(clampNumber(Number.isFinite(gearNumber("gearCount")) ? gearNumber("gearCount") : 6, ...gearboxLimits.gearCount));
  if (!Number.isInteger(gear) || gear < 1 || gear > gearCount || !Number.isFinite(ratio)) return;
  state.gearbox.manualRatios = {
    ...(state.gearbox.manualRatios ?? {}),
    [gear]: Number(ratio.toFixed(2)),
  };
}

function clearManualGearRatio(gear) {
  if (!state.gearbox.manualRatios) return;
  delete state.gearbox.manualRatios[gear];
}

function bindGearRatioControls() {
  const ratioGrid = document.getElementById("gearRatioGrid");
  if (!ratioGrid) return;
  let isDraggingGearRatio = false;
  let gearRatioCommitPending = false;

  function sliderFromEvent(event) {
    return event.target instanceof Element ? event.target.closest(".gear-ratio-slider") : null;
  }

  function updateGearRatioSliderPreview(slider) {
    const value = Number(slider.value);
    const card = slider.closest(".gear-ratio-card");
    const currentValue = card?.querySelector(".gear-ratio-metrics strong");

    if (currentValue && Number.isFinite(value)) {
      currentValue.textContent = t("gearRatioCurrent", { value: formatGearRatio(value) });
    }
  }

  function commitGearRatioChange() {
    if (!gearRatioCommitPending) return;
    gearRatioCommitPending = false;
    isDraggingGearRatio = false;
    renderGearCalculator();
  }

  ratioGrid.addEventListener("pointerdown", (event) => {
    const slider = sliderFromEvent(event);
    if (!slider) return;
    isDraggingGearRatio = true;
    slider.setPointerCapture?.(event.pointerId);
  });

  ratioGrid.addEventListener("input", (event) => {
    const slider = sliderFromEvent(event);
    if (!slider) return;
    const gear = Number(slider.dataset.gear);
    const ratio = Number(slider.value);
    setManualGearRatio(gear, ratio);
    gearRatioCommitPending = true;
    updateGearRatioSliderPreview(slider);
    if (!isDraggingGearRatio) commitGearRatioChange();
  });

  ratioGrid.addEventListener("change", (event) => {
    if (!sliderFromEvent(event)) return;
    commitGearRatioChange();
  });

  ratioGrid.addEventListener("pointerup", (event) => {
    if (!sliderFromEvent(event)) return;
    commitGearRatioChange();
  });

  ratioGrid.addEventListener("pointercancel", (event) => {
    if (!sliderFromEvent(event)) return;
    commitGearRatioChange();
  });

  ratioGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".gear-ratio-reset");
    if (!button) return;
    clearManualGearRatio(Number(button.dataset.gear));
    renderGearCalculator();
  });
}

function bindGearboxInputs() {
  [
    ["gearCountInput", "gearCount"],
    ["gearRedlineRpmInput", "redlineRpm"],
    ["gearPeakHpRpmInput", "peakHpRpm"],
    ["gearTopSpeedInput", "topSpeedKmh"],
    ["gearFinalDriveInput", "finalDrive"],
  ].forEach(([inputId, key]) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener("focus", () => input.select());

    input.addEventListener("input", () => {
      if (input.value === "") {
        resetManualGearRatios();
        state.gearbox[key] = "";
        renderGearCalculator();
        return;
      }

      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) return;
      const value = key === "gearCount" || key === "redlineRpm" || key === "peakHpRpm" ? Math.round(parsed) : parsed;
      if (!gearboxValueInRange(key, value)) return;
      resetManualGearRatios();
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

      resetManualGearRatios();
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

function renderPrinciples() {
  const { race, cornerProfile, engine, drive } = selectedOptions();
  const principles = [
    race.principles[0],
    routeShapeEnabled() ? cornerProfile.principle : "",
    engine.principle,
    drive.principle,
    t("tireSizePrinciple"),
  ].filter(Boolean);
  document.getElementById("principleStrip").innerHTML = principles.map((principle) => `<div class="principle">${principle}</div>`).join("");
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
  renderPrinciples();
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

function serializableManualGearRatios() {
  const gearCount = Math.round(clampNumber(Number(state.gearbox.gearCount) || DEFAULT_GEARBOX.gearCount, ...gearboxLimits.gearCount));
  return Object.fromEntries(
    manualGearRatioEntries(gearCount).map(([gear, ratio]) => [gear, Number(ratio.toFixed(2))]),
  );
}

function createSetupSavePayload() {
  normalizeVehicleSpecs();
  normalizeTrackType();
  normalizeTuneFocusIntensity();

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
    gearbox: {
      ...state.gearbox,
      manualRatios: serializableManualGearRatios(),
    },
    adjustmentRanges: serializableAdjustmentRanges(),
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

function sanitizedGearbox(value) {
  const rawGearbox = isPlainObject(value) ? value : {};
  const nextGearbox = createDefaultGearbox();

  Object.entries(DEFAULT_GEARBOX).forEach(([key, fallback]) => {
    nextGearbox[key] = sanitizedNumber(rawGearbox[key], fallback, gearboxLimits[key]);
  });

  nextGearbox.gearCount = Math.round(nextGearbox.gearCount);
  nextGearbox.redlineRpm = Math.round(nextGearbox.redlineRpm);
  nextGearbox.peakHpRpm = Math.round(Math.min(nextGearbox.peakHpRpm, nextGearbox.redlineRpm));

  const rawManualRatios = isPlainObject(rawGearbox.manualRatios) ? rawGearbox.manualRatios : {};
  nextGearbox.manualRatios = Object.entries(rawManualRatios).reduce((ratios, [gearKey, ratioValue]) => {
    const gear = Number(gearKey);
    const ratio = Number(ratioValue);
    if (!Number.isInteger(gear) || gear < 1 || gear > nextGearbox.gearCount || !Number.isFinite(ratio)) {
      return ratios;
    }
    ratios[gear] = Number(clampNumber(ratio, 0.2, 10).toFixed(2));
    return ratios;
  }, {});

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
  const adjustedMarkup = adjusted ? `<span class="linked-tune-chip">${t("linkedTuneAdjusted")}</span>` : "";
  const unavailableMarkup =
    availabilityStatus !== "available"
      ? `<span class="setting-unavailable-chip">${unavailableLabelForStatus(availabilityStatus)}</span>`
      : "";
  const unitMarkup = unit ? `<span class="setting-unit">${unit}</span>` : "";

  return `
    <article class="linked-tune-card${unavailableClass}${adjusted ? " is-adjusted" : ""}">
      <div class="linked-tune-head">
        <span class="linked-tune-label">${label}</span>
        ${adjustedMarkup}
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

  adviceList.innerHTML = selected
    .map((issue) => {
      const separator = currentLanguage() === "en" ? ": " : "：";
      const steps = contextualSteps(issue)
        .map(([target, text]) => `<li><strong>${target}</strong>${separator}${text}</li>`)
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
  state.availability = createAvailability();
  state.activeIssueCategory = "steering";
  state.solutionActiveIssueCategory = "steering";
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
  bindGearRatioControls();
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
    currentIssueSet().clear();
    renderIssueCategories();
    renderIssues();
    renderSelectedIssues();
    renderAdvice();
  });
}

init();
