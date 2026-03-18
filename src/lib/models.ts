import { ObjectId } from "mongodb";

export type UserDocument = {
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SavedMapDocument = {
  userId: ObjectId;
  cid: string;
  url: string;
  description: string;
  createdAt: Date;
};
