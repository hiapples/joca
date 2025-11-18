// types.ts
export type EventType = 'KTV' | 'Bar';

export type CreatorProfile = {
  nickname?: string;
  gender?: '男' | '女' | null;
  age?: number | null;
  intro?: string;
  photoUri?: string;
};

export type Attendee = {
  id?: string; // 後端 attendee._id
  userId?: string;
  status?:
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'cancelled'
    | 'removed';
  joinedAt?: string; // ISO 字串
  profile?: CreatorProfile | null;
};

export type ChatMessage = {
  id?: string;
  userId?: string;
  text: string;
  createdAt?: string;
  profile?: CreatorProfile | null;
};

export type PartyEvent = {
  id: string;
  type: EventType;

  region: string;
  place: string;

  timeRange: string;
  timeISO: string;

  builtInPeople: number;
  maxPeople: number;

  notes: string;

  attendees: Attendee[];

  // 聊天訊息
  messages?: ChatMessage[];

  createdAt: string;
  createdBy: string;
  createdByProfile?: CreatorProfile | null;
};
