// types.ts

export type EventType = 'KTV' | 'Bar' | 'Mahjong';

export type GenderType = '男' | '女' | null;

export type Profile = {
  nickname: string;
  gender: GenderType;
  age: number | null;
  intro: string;
  photoUri: string;
};

export type AttendeeStatus = 'joined' | 'cancelled' | 'removed';

export type Attendee = {
  id: string;
  userId: string;
  status: AttendeeStatus;
  joinedAt: string;
  profile: Profile | null;
};

export type ChatMessageType = 'text' | 'image';

export type ChatMessage = {
  id: string;
  userId: string;
  type: ChatMessageType;
  text: string;
  imageUri: string;
  retracted: boolean;
  createdAt: string;
  profile: Profile | null;
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
  messages: ChatMessage[];
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  createdByProfile: Profile | null;
};