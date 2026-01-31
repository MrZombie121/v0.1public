
import { TargetType, RegionData } from './types';

export const UKRAINE_BOUNDS: [[number, number], [number, number]] = [
  [43.0, 22.0], 
  [53.5, 41.5]
];

export const REGIONS: RegionData[] = [
  { id: "odesa", name: "Одеська область", center: [46.48, 30.72], radius: 110000, keywords: ["одеса", "ізмаїл", "чорноморськ", "южне"], isCoastal: true },
  { id: "kyiv", name: "Київська область", center: [50.45, 30.52], radius: 95000, keywords: ["київ", "біла церква", "бровари", "бориспіль"] },
  { id: "kharkiv", name: "Харківська область", center: [49.99, 36.23], radius: 100000, keywords: ["харків", "лозова", "ізюм"], isBorder: true },
  { id: "lviv", name: "Львівська область", center: [49.83, 24.02], radius: 90000, keywords: ["львів", "дрогобич", "червоноград"] },
  { id: "dnipro", name: "Дніпропетровська область", center: [48.46, 35.04], radius: 110000, keywords: ["дніпро", "кривий ріг", "кам'янське"] },
  { id: "zaporizhzhia", name: "Запорізька область", center: [47.83, 35.13], radius: 90000, keywords: ["запоріжжя", "мелітополь", "бердянськ"], isBorder: true },
  { id: "mykolaiv", name: "Миколаївська область", center: [46.97, 31.99], radius: 85000, keywords: ["миколаїв", "первомайськ", "очаків"], isCoastal: true },
  { id: "kherson", name: "Херсонська область", center: [46.63, 32.61], radius: 95000, keywords: ["херсон", "каховка", "скадовськ"], isCoastal: true },
  { id: "chernihiv", name: "Чернігівська область", center: [51.49, 31.28], radius: 95000, keywords: ["чернігів", "ніжин", "прилуки"], isBorder: true },
  { id: "sumy", name: "Сумська область", center: [50.90, 34.79], radius: 90000, keywords: ["суми", "конотоп", "шостка"], isBorder: true },
  { id: "poltava", name: "Полтавська область", center: [49.58, 34.55], radius: 90000, keywords: ["полтава", "кременчук", "миргород"] },
  { id: "vinnytsia", name: "Вінницька область", center: [49.23, 28.46], radius: 90000, keywords: ["вінниця", "жмеринка", "могилів-подільський"] },
  { id: "cherkasy", name: "Черкаська область", center: [49.44, 32.05], radius: 80000, keywords: ["черкаси", "умань", "сміла"] },
  { id: "khmelnytskyi", name: "Хмельницька область", center: [49.42, 26.98], radius: 85000, keywords: ["хмельницький", "кам'янець-подільський"] },
  { id: "zhytomyr", name: "Житомирська область", center: [50.25, 28.65], radius: 95000, keywords: ["житомир", "бердичів", "коростень"] },
  { id: "rivne", name: "Рівненська область", center: [50.61, 26.25], radius: 80000, keywords: ["рівне", "вараш", "дубно"] },
  { id: "lutsk", name: "Волинська область", center: [50.74, 25.32], radius: 80000, keywords: ["луцьк", "ковель", "волинь"] },
  { id: "ternopil", name: "Тернопільська область", center: [49.55, 25.59], radius: 70000, keywords: ["тернопіль", "чортків"] },
  { id: "if", name: "Івано-Франківська область", center: [48.92, 24.71], radius: 75000, keywords: ["івано-франківськ", "калуш", "коломия"] },
  { id: "uzhhorod", name: "Закарпатська область", center: [48.62, 22.28], radius: 75000, keywords: ["ужгород", "мукачево", "закарпаття"] },
  { id: "chernivtsi", name: "Чернівецька область", center: [48.29, 25.93], radius: 60000, keywords: ["чернівці", "хотин"] },
  { id: "kirovohrad", name: "Кіровоградська область", center: [48.50, 32.26], radius: 85000, keywords: ["кропивницький", "олександрія"] },
  { id: "donetsk", name: "Донецька область", center: [48.00, 37.80], radius: 95000, keywords: ["донецьк", "маріуполь", "бахмут"], isBorder: true },
  { id: "luhansk", name: "Луганська область", center: [48.57, 39.31], radius: 90000, keywords: ["луганськ", "лисичанськ"], isBorder: true },
  { id: "crimea", name: "АР Крим", center: [45.00, 34.00], radius: 120000, keywords: ["крим", "севастополь", "сімферополь"], isCoastal: true },
  { id: "sea", name: "Чорне море", center: [44.50, 31.50], radius: 150000, keywords: ["море", "акваторія"], isCoastal: true }
];

export const TARGET_COLORS = {
  REAL: '#ff3333', 
  TEST: '#3b82f6',
  USER_TEST: '#22c55e',
  ZONE_ALERT: 'rgba(239, 68, 68, 0.15)',
  ZONE_PULSE: 'rgba(239, 68, 68, 0.4)',
  OBLAST_BORDER: 'rgba(255, 255, 255, 0.15)',
  OBLAST_ACTIVE_BG: 'rgba(255, 51, 51, 0.1)'
};
