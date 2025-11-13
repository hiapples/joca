// types.ts

// 活動類型
export type EventType = 'KTV' | 'Bar';

// 活動資料型別
export type PartyEvent = {
  id: string;
  type: EventType;

  // 地點相關
  region: string;   // 縣市
  place: string;    // 詳細地點（好樂迪 竹北店 等）

  // 時間相關
  timeRange: string; // 👈 新增：顯示用時間（例如 "20:00"）
  timeISO: string;   // 實際 Date ISO 字串，用來排序 / 顯示完整時間

  // 人數相關
  builtInPeople: number; // 內建人數
  maxPeople: number;     // 人數上限

  // 其他
  notes: string;         // 備註（可以是空字串）
  attendees: any[];      // 之後你要實作參加者可以再細修型別
  createdAt: string;     // 活動建立時間
  createdBy?: string;    // 誰建立的（'me' 表示自己創建）
};
