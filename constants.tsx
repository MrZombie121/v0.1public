
import { TargetType, RegionData } from './types';

export const UKRAINE_BOUNDS: [[number, number], [number, number]] = [
  [44.38, 22.13], 
  [52.37, 40.22]
];

export const MONITORING_CHANNELS = [
  { id: '1', name: 'Николаевский Ванёк', username: 'vanek_nikolaev', url: 'https://t.me/vanek_nikolaev', isOfficial: false },
  { id: '2', name: 'Повітряні Сили ЗСУ', username: 'kpszsu', url: 'https://t.me/kpszsu', isOfficial: true },
  { id: '5', name: 'Odecit', username: 'oddesitmedia', url: 'https://t.me/oddesitmedia', isOfficial: false },
  { id: '3', name: 'Monitoring', username: 'monitor_ua_1', url: 'https://t.me/monitor_ua_1', isOfficial: false }
];

export const REGIONS: RegionData[] = [
  // --- ODESA REGION & DISTRICTS ---
  { name: "Odesa", center: [46.4825, 30.7233], keywords: ["одеса", "одесса", "фонтан", "центр", "аркадия", "аркадія", "ланжерон", "пересыпь", "пересип", "лузановка", "лузанівка", "слободка", "слобідка"] },
  { name: "KotovskyDist", center: [46.5843, 30.7954], keywords: ["селище котовського", "поселок котовского", "поскот", "котовського", "котовского"] },
  { name: "Tairova", center: [46.3944, 30.7103], keywords: ["таїрова", "таирова", "вузовский", "червоний хутір"] },
  { name: "Cheryomushki", center: [46.4326, 30.6922], keywords: ["черемушки", "черемушках", "гайдара", "филатова"] },
  { name: "Moldavanka", center: [46.4667, 30.7167], keywords: ["молдаванка", "молдаванке"] },
  { name: "Yuzhne", center: [46.6213, 31.1011], keywords: ["южне", "южное"] },
  { name: "Krasnosilka", center: [46.5866, 30.7678], keywords: ["красносілка", "красноселка"] },
  { name: "Chornomorske_Od", center: [46.5911, 30.9397], keywords: ["чорноморське", "черноморское"] },
  { name: "Ovidiopol", center: [46.2415, 30.4431], keywords: ["овідіополь", "овидиополь"] },
  { name: "Chornomorsk", center: [46.2991, 30.6481], keywords: ["чорноморськ", "черноморск", "ильичевск"] },
  { name: "Zatoka", center: [46.0658, 30.4514], keywords: ["затока", "кароліно-бугаз"] },
  { name: "Bilyaivka", center: [46.4772, 30.2033], keywords: ["біляївка", "беляевка"] },
  { name: "Izmail", center: [45.3507, 28.8394], keywords: ["ізмаїл", "измаил"], isCoastal: true },
  { name: "Reni", center: [45.4567, 28.2844], keywords: ["рені", "рени"], isCoastal: true },

  // --- KYIV & NORTH ---
  { name: "Kyiv", center: [50.4501, 30.5234], keywords: ["київ", "киев", "васильків", "ірпінь", "бровари"] },
  { name: "Boryspil", center: [50.3501, 30.9500], keywords: ["бориспіль", "борисполь"] },
  { name: "Bila Tserkva", center: [49.7989, 30.1153], keywords: ["біла церква", "белая церковь"] },
  { name: "Chernihiv", center: [51.4982, 31.2893], keywords: ["чернігів", "чернигов"], isBorder: true },

  // --- WEST ---
  { name: "Lviv", center: [49.8397, 24.0297], keywords: ["львів", "львов", "стрий"] },
  { name: "Lutsk", center: [50.7472, 25.3254], keywords: ["луцьк", "луцк"] },
  { name: "Rivne", center: [50.6199, 26.2516], keywords: ["рівне", "ровно"] },
  { name: "Ternopil", center: [49.5535, 25.5948], keywords: ["тернопіль", "тернополь"] },
  { name: "Khmelnytskyi", center: [49.4230, 26.9871], keywords: ["хмельницький", "хмельницкий"] },
  { name: "Ivano-Frankivsk", center: [48.9226, 24.7111], keywords: ["франківськ", "ивано-франковск"] },
  { name: "Uzhhorod", center: [48.6208, 22.2879], keywords: ["ужгород"] },

  // --- EAST & BORDER ---
  { name: "Kharkiv", center: [49.9935, 36.2304], keywords: ["харків", "харьков", "чугуїв"], isBorder: true },
  { name: "Sumy", center: [50.9077, 34.7981], keywords: ["суми", "сум", "конотоп"], isBorder: true },
  { name: "Dnipro", center: [48.4647, 35.0462], keywords: ["дніпро", "днепр", "павлоград"] },
  { name: "Zaporizhzhia", center: [47.8388, 35.1396], keywords: ["запоріжжя", "запорожье"], isBorder: true },

  // --- CENTRAL & TRANSIT ---
  { name: "Poltava", center: [49.5883, 34.5514], keywords: ["полтава", "полтави", "миргород"] },
  { name: "Kirovohrad", center: [48.5079, 32.2623], keywords: ["кропивницький", "кіровоград", "кропивницкий"] },
  { name: "Cherkasy", center: [49.4444, 32.0598], keywords: ["черкаси", "черкассы"] },
  { name: "Vinnytsia", center: [49.2331, 28.4682], keywords: ["вінниця", "винница"] },
  { name: "Zhytomyr", center: [50.2547, 28.6587], keywords: ["житомир", "житомирі"] },
  { name: "Uman", center: [48.7517, 30.2211], keywords: ["умань"] }
];

export const TACTICAL_SPAWN_POINTS = {
  SEA: [
    { name: 'Black Sea West', coords: [45.5, 30.5] },
    { name: 'Black Sea South', coords: [45.0, 32.0] }
  ],
  BORDER: [
    { name: 'North Border', coords: [51.5, 30.0] },
    { name: 'East Border', coords: [50.5, 37.0] }
  ]
};

export const TARGET_COLORS = {
  REAL: '#ef4444', 
  TEST: '#3b82f6',
  USER_TEST: '#22c55e',
  VERIFIED: '#fbbf24',
  UNVERIFIED: '#94a3b8'
};

export const EVENT_EXPIRY_MINUTES = 30;
