// src/types.ts

// 活動類型
export type EventType = 'KTV' | 'Bar';

// 主揪的會員快照（發起當下的資料）
export type HostProfileSnapshot = {
  nickname: string;
  gender: '男' | '女' | null;
  age: number | null;
  intro?: string;
  photoUri?: string;
};

// 從後端拿回來的一筆活動
export type PartyEvent = {
  id: string;

  type: EventType;

  region: string;    // 地區
  place: string;     // 地點

  timeRange: string; // 顯示用時間（例如 "20:00"）
  timeISO: string;   // ISO 時間字串

  builtInPeople: number; // 內建人數
  maxPeople: number;     // 人數上限

  notes: string;         // 備註（可以是空字串）

  attendees: any[];      // 之後要細分再改

  createdAt: string;     // 建立時間 ISO
  createdBy: string;     // 主揪 userId / deviceId

  createdByProfile?: HostProfileSnapshot; // 主揪快照
};
